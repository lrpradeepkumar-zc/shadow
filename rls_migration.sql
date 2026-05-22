-- =============================================================================
-- Shadow ToDo — Row-Level Security (RLS) Migration
-- =============================================================================
-- 3-Tier Workspace Roles
--   admin  – Workspace Owner   : full access to all data, users, and settings
--   user   – Team Member       : ownership-scoped CRUD on tasks/groups they own
--   guest  – Read-Only / Guest : read-only on explicitly invited groups only
--
-- This file mirrors the permission logic in rbac.js.
-- Run against your Supabase project: supabase db push  OR  paste in SQL editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: check if the calling user is a workspace admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_workspace_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id   = auth.uid()
      AND role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Helper: check if the calling user is at least a team member (user or admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_team_member()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id   = auth.uid()
      AND role IN ('admin', 'user')
  );
$$;

-- ---------------------------------------------------------------------------
-- Helper: resolve effective role for a specific group
--   Returns 'admin' / 'user' / 'guest' for auth.uid() in the given group.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION group_role(p_group_id text)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT
    CASE
      WHEN is_workspace_admin()                          THEN 'admin'
      WHEN g.owner_id     = auth.uid()                  THEN 'user'
      WHEN g.created_by   = auth.uid()                  THEN 'user'
      WHEN auth.uid() = ANY(g.admin_ids::uuid[])        THEN 'user'
      WHEN auth.uid() = ANY(g.member_ids::uuid[])       THEN 'user'
      WHEN auth.uid() = ANY(g.viewer_ids::uuid[])       THEN 'guest'
      ELSE (SELECT role FROM users WHERE id = auth.uid())
    END
  FROM groups g
  WHERE g.id = p_group_id;
$$;

-- =============================================================================
-- TABLE: users
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Anyone who is authenticated can read the users table (needed for assignee lookups)
CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Only admins can insert new user rows (normal signup goes through auth.users trigger)
CREATE POLICY "users_insert_admin"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_admin());

-- Only admins can delete users
CREATE POLICY "users_delete_admin"
  ON users FOR DELETE
  TO authenticated
  USING (is_workspace_admin());

-- =============================================================================
-- TABLE: groups
-- =============================================================================
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- SELECT: admin sees all; team members see groups they belong to; guests see invited groups
CREATE POLICY "groups_select"
  ON groups FOR SELECT
  TO authenticated
  USING (
    is_workspace_admin()
    OR created_by  = auth.uid()
    OR owner_id    = auth.uid()
    OR auth.uid()  = ANY(admin_ids::uuid[])
    OR auth.uid()  = ANY(member_ids::uuid[])
    OR auth.uid()  = ANY(viewer_ids::uuid[])
  );

-- INSERT: team members (user + admin) can create groups
CREATE POLICY "groups_insert"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (is_team_member());

-- UPDATE: admin always; group owner/admin can update their own group
CREATE POLICY "groups_update"
  ON groups FOR UPDATE
  TO authenticated
  USING (
    is_workspace_admin()
    OR created_by = auth.uid()
    OR owner_id   = auth.uid()
    OR auth.uid() = ANY(admin_ids::uuid[])
  )
  WITH CHECK (
    is_workspace_admin()
    OR created_by = auth.uid()
    OR owner_id   = auth.uid()
    OR auth.uid() = ANY(admin_ids::uuid[])
  );

-- DELETE: admin always; group creator/owner can delete their own group
CREATE POLICY "groups_delete"
  ON groups FOR DELETE
  TO authenticated
  USING (
    is_workspace_admin()
    OR created_by = auth.uid()
    OR owner_id   = auth.uid()
  );

-- =============================================================================
-- TABLE: tasks
-- =============================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   admin   → all tasks
--   user    → tasks they created, are assigned to, or are in a group they belong to
--   guest   → tasks in groups where they are a viewer/member
CREATE POLICY "tasks_select"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    is_workspace_admin()
    OR created_by  = auth.uid()
    OR assignee    = auth.uid()
    OR auth.uid()  = ANY(shared_with::uuid[])
    OR (
      group_id IS NOT NULL
      AND group_id IN (
        SELECT id FROM groups
        WHERE created_by  = auth.uid()
           OR owner_id    = auth.uid()
           OR auth.uid()  = ANY(admin_ids::uuid[])
           OR auth.uid()  = ANY(member_ids::uuid[])
           OR auth.uid()  = ANY(viewer_ids::uuid[])
      )
    )
  );

-- INSERT: team members (user + admin) can create tasks
CREATE POLICY "tasks_insert"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (is_team_member());

-- UPDATE:
--   admin   → any task
--   user    → tasks they created OR are assigned to
--   guest   → no update
CREATE POLICY "tasks_update"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    is_workspace_admin()
    OR created_by = auth.uid()
    OR assignee   = auth.uid()
  )
  WITH CHECK (
    is_workspace_admin()
    OR created_by = auth.uid()
    OR assignee   = auth.uid()
  );

-- DELETE:
--   admin → any task
--   user  → only tasks they created (not just assigned)
--   guest → no delete
CREATE POLICY "tasks_delete"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    is_workspace_admin()
    OR created_by = auth.uid()
  );

-- =============================================================================
-- TABLE: comments
-- =============================================================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- SELECT: can read comments if you can read the parent task
CREATE POLICY "comments_select"
  ON comments FOR SELECT
  TO authenticated
  USING (
    is_workspace_admin()
    OR author_id = auth.uid()
    OR task_id IN (
      SELECT id FROM tasks
      WHERE created_by  = auth.uid()
         OR assignee    = auth.uid()
         OR auth.uid()  = ANY(shared_with::uuid[])
         OR (
           group_id IS NOT NULL
           AND group_id IN (
             SELECT id FROM groups
             WHERE auth.uid() = ANY(member_ids::uuid[])
                OR auth.uid() = ANY(viewer_ids::uuid[])
                OR auth.uid() = ANY(admin_ids::uuid[])
                OR owner_id   = auth.uid()
                OR created_by = auth.uid()
           )
         )
    )
  );

-- INSERT: team members can comment; guests only if the group allows it
--   Note: guest comment permission (allowGuestComments) is enforced at the
--   application layer (rbac.js can() with ctx.listSettings). RLS here only
--   allows authenticated users who can read the task.
CREATE POLICY "comments_insert"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_team_member()
    OR task_id IN (
      SELECT id FROM tasks
      WHERE group_id IN (
        SELECT id FROM groups
        WHERE auth.uid() = ANY(viewer_ids::uuid[])
      )
    )
  );

-- UPDATE / DELETE: only comment author or workspace admin
CREATE POLICY "comments_update"
  ON comments FOR UPDATE
  TO authenticated
  USING  (is_workspace_admin() OR author_id = auth.uid())
  WITH CHECK (is_workspace_admin() OR author_id = auth.uid());

CREATE POLICY "comments_delete"
  ON comments FOR DELETE
  TO authenticated
  USING (is_workspace_admin() OR author_id = auth.uid());

-- =============================================================================
-- TABLE: activity (audit log — append-only for regular users)
-- =============================================================================
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_select"
  ON activity FOR SELECT
  TO authenticated
  USING (
    is_workspace_admin()
    OR actor_id = auth.uid()
    OR task_id IN (
      SELECT id FROM tasks
      WHERE created_by = auth.uid() OR assignee = auth.uid()
    )
  );

CREATE POLICY "activity_insert"
  ON activity FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR is_workspace_admin());

-- No UPDATE or DELETE on activity (immutable audit log)

-- =============================================================================
-- TABLE: members (group membership records)
-- =============================================================================
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select"
  ON members FOR SELECT
  TO authenticated
  USING (
    is_workspace_admin()
    OR user_id   = auth.uid()
    OR group_id  IN (
      SELECT id FROM groups
      WHERE owner_id    = auth.uid()
         OR created_by  = auth.uid()
         OR auth.uid()  = ANY(admin_ids::uuid[])
         OR auth.uid()  = ANY(member_ids::uuid[])
         OR auth.uid()  = ANY(viewer_ids::uuid[])
    )
  );

-- Only group owners / admins can add/remove members; workspace admin always
CREATE POLICY "members_insert"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_workspace_admin()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  );

CREATE POLICY "members_update"
  ON members FOR UPDATE
  TO authenticated
  USING (
    is_workspace_admin()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  )
  WITH CHECK (
    is_workspace_admin()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  );

CREATE POLICY "members_delete"
  ON members FOR DELETE
  TO authenticated
  USING (
    is_workspace_admin()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  );

-- =============================================================================
-- TABLE: tags
-- =============================================================================
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read tags
CREATE POLICY "tags_select"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

-- Team members can create tags
CREATE POLICY "tags_insert"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (is_team_member());

-- Creator or admin can update/delete
CREATE POLICY "tags_update"
  ON tags FOR UPDATE
  TO authenticated
  USING  (is_workspace_admin() OR created_by = auth.uid())
  WITH CHECK (is_workspace_admin() OR created_by = auth.uid());

CREATE POLICY "tags_delete"
  ON tags FOR DELETE
  TO authenticated
  USING (is_workspace_admin() OR created_by = auth.uid());

-- =============================================================================
-- TABLE: categories
-- =============================================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "categories_insert"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (is_team_member());

CREATE POLICY "categories_update"
  ON categories FOR UPDATE
  TO authenticated
  USING  (is_workspace_admin() OR created_by = auth.uid())
  WITH CHECK (is_workspace_admin() OR created_by = auth.uid());

CREATE POLICY "categories_delete"
  ON categories FOR DELETE
  TO authenticated
  USING (is_workspace_admin() OR created_by = auth.uid());

-- =============================================================================
-- TABLE: settings (workspace-wide configuration)
-- =============================================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "settings_select"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

-- Only workspace admin can write settings
CREATE POLICY "settings_insert"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_admin());

CREATE POLICY "settings_update"
  ON settings FOR UPDATE
  TO authenticated
  USING  (is_workspace_admin())
  WITH CHECK (is_workspace_admin());

CREATE POLICY "settings_delete"
  ON settings FOR DELETE
  TO authenticated
  USING (is_workspace_admin());

-- =============================================================================
-- TABLE: custom_fields
-- =============================================================================
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_fields_select"
  ON custom_fields FOR SELECT
  TO authenticated
  USING (
    is_workspace_admin()
    OR group_id IN (
      SELECT id FROM groups
      WHERE auth.uid() = ANY(member_ids::uuid[])
         OR auth.uid() = ANY(viewer_ids::uuid[])
         OR auth.uid() = ANY(admin_ids::uuid[])
         OR owner_id   = auth.uid()
         OR created_by = auth.uid()
    )
  );

CREATE POLICY "custom_fields_insert"
  ON custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    is_workspace_admin()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  );

CREATE POLICY "custom_fields_update"
  ON custom_fields FOR UPDATE
  TO authenticated
  USING (
    is_workspace_admin()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  )
  WITH CHECK (
    is_workspace_admin()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  );

CREATE POLICY "custom_fields_delete"
  ON custom_fields FOR DELETE
  TO authenticated
  USING (
    is_workspace_admin()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  );

-- =============================================================================
-- TABLE: approval_requests
-- =============================================================================
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: admin, requester, or approver can see
CREATE POLICY "approvals_select"
  ON approval_requests FOR SELECT
  TO authenticated
  USING (
    is_workspace_admin()
    OR requester_id = auth.uid()
    OR approver_id  = auth.uid()
  );

-- INSERT: any team member (requester field must equal auth.uid())
CREATE POLICY "approvals_insert"
  ON approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (is_team_member() AND requester_id = auth.uid());

-- UPDATE: only the designated approver or workspace admin
CREATE POLICY "approvals_update"
  ON approval_requests FOR UPDATE
  TO authenticated
  USING  (is_workspace_admin() OR approver_id = auth.uid())
  WITH CHECK (is_workspace_admin() OR approver_id = auth.uid());

-- DELETE: only workspace admin
CREATE POLICY "approvals_delete"
  ON approval_requests FOR DELETE
  TO authenticated
  USING (is_workspace_admin());

-- =============================================================================
-- TABLE: workflow_rules (automation)
-- =============================================================================
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_rules_select"
  ON workflow_rules FOR SELECT
  TO authenticated
  USING (
    is_workspace_admin()
    OR created_by = auth.uid()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
         OR auth.uid() = ANY(member_ids::uuid[])
    )
  );

-- Only group admin / workspace admin can create rules
CREATE POLICY "workflow_rules_insert"
  ON workflow_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    is_workspace_admin()
    OR (
      is_team_member() AND group_id IN (
        SELECT id FROM groups
        WHERE owner_id   = auth.uid()
           OR created_by = auth.uid()
           OR auth.uid() = ANY(admin_ids::uuid[])
      )
    )
  );

CREATE POLICY "workflow_rules_update"
  ON workflow_rules FOR UPDATE
  TO authenticated
  USING (
    is_workspace_admin()
    OR created_by = auth.uid()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  )
  WITH CHECK (
    is_workspace_admin()
    OR created_by = auth.uid()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  );

CREATE POLICY "workflow_rules_delete"
  ON workflow_rules FOR DELETE
  TO authenticated
  USING (
    is_workspace_admin()
    OR created_by = auth.uid()
    OR group_id IN (
      SELECT id FROM groups
      WHERE owner_id   = auth.uid()
         OR created_by = auth.uid()
         OR auth.uid() = ANY(admin_ids::uuid[])
    )
  );

-- =============================================================================
-- TABLE: notifications
-- =============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_workspace_admin());

-- System inserts notifications on behalf of any user (via service role) or
-- the notification recipient themselves
CREATE POLICY "notifications_insert"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can mark their own notifications as read; admin can update any
CREATE POLICY "notifications_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING  (user_id = auth.uid() OR is_workspace_admin())
  WITH CHECK (user_id = auth.uid() OR is_workspace_admin());

-- Users can delete their own notifications
CREATE POLICY "notifications_delete"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_workspace_admin());

-- =============================================================================
-- TABLE: templates
-- =============================================================================
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can browse templates
CREATE POLICY "templates_select"
  ON templates FOR SELECT
  TO authenticated
  USING (
    is_workspace_admin()
    OR is_public = true
    OR created_by = auth.uid()
  );

-- Team members can create templates
CREATE POLICY "templates_insert"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (is_team_member() AND created_by = auth.uid());

-- Creator or admin can update/delete
CREATE POLICY "templates_update"
  ON templates FOR UPDATE
  TO authenticated
  USING  (is_workspace_admin() OR created_by = auth.uid())
  WITH CHECK (is_workspace_admin() OR created_by = auth.uid());

CREATE POLICY "templates_delete"
  ON templates FOR DELETE
  TO authenticated
  USING (is_workspace_admin() OR created_by = auth.uid());

-- =============================================================================
-- Role migration: normalise legacy 'member' → 'user'  and 'viewer' → 'guest'
-- Run once to clean up any pre-migration rows.
-- =============================================================================
UPDATE users SET role = 'user'  WHERE role = 'member';
UPDATE users SET role = 'guest' WHERE role = 'viewer';

-- =============================================================================
-- Grant EXECUTE on helper functions to authenticated role
-- =============================================================================
GRANT EXECUTE ON FUNCTION is_workspace_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_team_member()     TO authenticated;
GRANT EXECUTE ON FUNCTION group_role(text)     TO authenticated;
