-- Shadow App — Initial Schema
-- Documents the current Supabase database structure.

-- Users (managed by Supabase Auth, extended here)
create table if not exists users (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null,
  email       text not null unique,
  role        text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  avatar      text,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Groups / Projects
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'personal' check (type in ('personal', 'group')),
  owner_id    uuid references users(id) on delete set null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tags
create table if not exists tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#6b7280',
  group_id    uuid references groups(id) on delete cascade,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Categories (within groups)
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  name        text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Members (group membership)
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        text not null default 'Member' check (role in ('Owner','Admin','Moderator','Member','Viewer')),
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (group_id, user_id)
);

-- Custom Fields (definitions per group)
create table if not exists "customFields" (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  name        text not null,
  field_type  text not null default 'text' check (field_type in ('text','number','select','date','checkbox')),
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Tasks
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid references groups(id) on delete cascade,
  status      text not null default 'Open' check (status in ('Open','In Progress','Fixed','Completed','Closed')),
  assignee_id uuid references users(id) on delete set null,
  owner_id    uuid references users(id) on delete set null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Comments
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  author_id   uuid references users(id) on delete set null,
  text        text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Activity log
create table if not exists activity (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  actor_id    uuid references users(id) on delete set null,
  action_type text not null,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Key-value settings store
create table if not exists settings (
  key         text primary key,
  value       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Approval requests
create table if not exists "approvalRequests" (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references tasks(id) on delete cascade,
  group_id            uuid not null references groups(id) on delete cascade,
  requester_id        uuid not null references users(id) on delete cascade,
  approver_id         uuid not null references users(id) on delete cascade,
  status              text not null default 'pending_approval'
                        check (status in ('pending_approval','approved','changes_requested')),
  note                text,
  decision_note       text,
  rejection_category  text,
  previous_request_id uuid references "approvalRequests"(id),
  resolved_at         timestamptz,
  data                jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Approval audit logs
create table if not exists "approvalAuditLogs" (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  request_id  uuid references "approvalRequests"(id) on delete set null,
  actor_id    uuid references users(id) on delete set null,
  action_type text not null,
  notes       text,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Approval settings (per group)
create table if not exists "approvalSettings" (
  group_id             uuid primary key references groups(id) on delete cascade,
  enabled              boolean not null default false,
  mandate_approval     boolean not null default false,
  default_approver     uuid references users(id) on delete set null,
  default_approver_type text default 'member',
  data                 jsonb not null default '{}',
  updated_at           timestamptz not null default now()
);

-- Workflow rules (dedicated table, replaces settings JSONB blob)
create table if not exists "workflowRules" (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  name            text not null,
  state           text not null default 'draft'
                    check (state in ('draft','testing','published','disabled')),
  trigger         jsonb not null default '{}',
  condition_logic text not null default 'AND' check (condition_logic in ('AND','OR')),
  conditions      jsonb not null default '[]',
  actions         jsonb not null default '[]',
  created_by      uuid references users(id) on delete set null,
  execution_count integer not null default 0,
  last_executed_at timestamptz,
  sort_order      integer not null default 0,
  data            jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Notifications (replaces localStorage storage)
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  task_id     uuid references tasks(id) on delete cascade,
  read        boolean not null default false,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Indexes for performance
create index if not exists tasks_group_id_idx on tasks(group_id);
create index if not exists tasks_assignee_id_idx on tasks(assignee_id);
create index if not exists tasks_owner_id_idx on tasks(owner_id);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_created_at_idx on tasks(created_at desc);
create index if not exists comments_task_id_idx on comments(task_id);
create index if not exists activity_task_id_idx on activity(task_id);
create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists "approvalRequests_task_id_idx" on "approvalRequests"(task_id);
create index if not exists "workflowRules_group_id_idx" on "workflowRules"(group_id);
