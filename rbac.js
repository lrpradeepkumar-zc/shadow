/**
 * Shadow ToDo — RBAC v2
 * ---------------------------------------------------------------------------
 * Single source of truth for roles, permissions, and access checks.
 *
 *  3 Workspace Roles
 *  -----------------
 *  admin  – Workspace Owner   : full CRUD + org management + billing
 *  user   – Team Member       : scoped CRUD; ownership-based update/delete
 *  guest  – Read-Only / Guest : view-only on explicitly invited groups
 *
 *  Public API (unchanged — no call-site breakage)
 *  -----------------------------------------------
 *  RBAC.can(permission, ctx?)         – main permission check
 *  RBAC.canManageGroup(groupId)       – shorthand for group admin actions
 *  RBAC.isAdmin()                     – alias for isOrgAdmin
 *  RBAC.isOrgAdmin()                  – backward-compat alias
 *  RBAC.isViewer()                    – true when current role is guest
 *  RBAC.getEffectiveRole(ctx?)        – resolve role given optional groupId/task
 *  RBAC.getUserRoleInGroup(uid, gid)  – per-group role resolution
 *  RBAC.guardRoute(name, ctx?)        – client-side route guard
 *  RBAC.subscribe(fn)                 – subscribe to user-change events
 *  RBAC.getCurrentUser()              – current user context object
 *  RBAC._syncFromAuth(authUser)       – called by auth.js after login
 *
 *  REMOVED (no longer needed)
 *  -----------------------------------------------
 *  MockUsers / setCurrentUser()  – replaced by real Supabase user
 *  localStorage STORAGE_KEY      – no more fake sessions
 * ---------------------------------------------------------------------------
 */
(function RBAC() {
  'use strict';

  // ── Roles ────────────────────────────────────────────────────────────────
  var Roles = Object.freeze({
    ADMIN: 'admin',   // Workspace Owner
    USER:  'user',    // Team Member
    GUEST: 'guest'    // Read-Only / Guest
  });

  var RoleMeta = Object.freeze({
    admin: { label: 'Admin',      color: '#d946ef', rank: 3,
             description: 'Workspace Owner. Full access to all data, users, and settings.' },
    user:  { label: 'Team Member', color: '#3b82f6', rank: 2,
             description: 'Execution role. CRUD within granted projects; ownership-scoped edits.' },
    guest: { label: 'Guest',      color: '#6b7280', rank: 1,
             description: 'Read-only. Limited to explicitly shared projects.' }
  });

  // ── Permission catalog ────────────────────────────────────────────────────
  var Perms = Object.freeze({
    // Org / workspace scope
    ORG_MANAGE:           'org.manage',
    ORG_BILLING:          'org.billing',
    ORG_INVITE_USER:      'org.invite_user',
    ORG_REVOKE_USER:      'org.revoke_user',
    ORG_CHANGE_USER_ROLE: 'org.change_user_role',

    // Group scope
    GROUP_CREATE:         'group.create',
    GROUP_DELETE:         'group.delete',
    GROUP_EDIT_SETTINGS:  'group.edit_settings',
    GROUP_ADD_MEMBER:     'group.add_member',
    GROUP_REMOVE_MEMBER:  'group.remove_member',
    GROUP_PROMOTE_MEMBER: 'group.promote_member',
    GROUP_MANAGE_RULES:   'group.manage_rules',

    // Task scope
    TASK_CREATE:          'task.create',
    TASK_READ:            'task.read',
    TASK_UPDATE:          'task.update',   // user: only own / assigned tasks
    TASK_DELETE:          'task.delete',   // user: only own tasks
    TASK_COMMENT:         'task.comment',
    TASK_CHANGE_STATUS:   'task.change_status',
    TASK_ASSIGN:          'task.assign',

    // Personal scope
    PERSONAL_TASK_CRUD:   'personal_task.crud'
  });

  // ── Permission matrix ─────────────────────────────────────────────────────
  // For USER role, TASK_UPDATE / TASK_DELETE / TASK_CHANGE_STATUS are listed
  // here but the actual check in can() enforces ownership (ctx.task).
  var PermissionMatrix = {
    admin: Object.values(Perms), // everything

    user: [
      Perms.GROUP_CREATE,
      Perms.GROUP_EDIT_SETTINGS,   // only for groups they own — enforced by canManageGroup
      Perms.GROUP_ADD_MEMBER,      // only for groups they own
      Perms.GROUP_REMOVE_MEMBER,   // only for groups they own
      Perms.GROUP_MANAGE_RULES,    // only for groups they own
      Perms.TASK_CREATE,
      Perms.TASK_READ,
      Perms.TASK_UPDATE,           // ownership-gated in can()
      Perms.TASK_DELETE,           // ownership-gated in can()
      Perms.TASK_COMMENT,
      Perms.TASK_CHANGE_STATUS,    // ownership-gated in can()
      Perms.PERSONAL_TASK_CRUD
    ],

    guest: [
      Perms.TASK_READ
      // TASK_COMMENT may be granted contextually via ctx.listSettings.allowGuestComments
    ]
  };

  // Permissions that require ownership verification for the USER role.
  // If ctx.task is absent, we optimistically allow (UI hides for non-owners).
  var OWNERSHIP_GATED = [Perms.TASK_UPDATE, Perms.TASK_DELETE, Perms.TASK_CHANGE_STATUS];

  // ── Current user (real, set by auth.js) ──────────────────────────────────
  var _currentUser = null;   // {id, name, email, role, color, avatar}
  var _subscribers = [];

  function getCurrentUser() { return _currentUser; }

  /**
   * Called by auth.js immediately after a successful Supabase login or
   * session restore.  Accepts the full user profile from the 'users' table.
   */
  function _syncFromAuth(authUser) {
    if (!authUser || !authUser.id) return;
    // Normalise role to the 3-tier model; fall back to 'user'.
    var role = authUser.role || 'user';
    if (role !== Roles.ADMIN && role !== Roles.USER && role !== Roles.GUEST) role = Roles.USER;
    _currentUser = {
      id:     authUser.id,
      name:   authUser.name    || authUser.email || 'User',
      email:  authUser.email   || '',
      role:   role,
      color:  authUser.color   || RoleMeta[role].color,
      avatar: authUser.avatar  || _initials(authUser.name || authUser.email || 'U')
    };
    _notify();
    try {
      document.dispatchEvent(new CustomEvent('rbac:ready', { detail: { currentUser: _currentUser } }));
    } catch (_) {}
  }

  function _initials(n) {
    var parts = (n || '').trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function _notify() {
    _subscribers.forEach(function (fn) { try { fn(_currentUser); } catch (_) {} });
  }

  function subscribe(fn) {
    _subscribers.push(fn);
    return function () { _subscribers = _subscribers.filter(function (f) { return f !== fn; }); };
  }

  // ── Role resolution ───────────────────────────────────────────────────────
  /**
   * Resolve the effective role for `userId` (defaults to current user) within
   * an optional group context.  Resolution order:
   *   1. workspace ADMIN  → always admin regardless of group
   *   2. group owner / adminIds list → elevated inside that group (still 'user' tier
   *      but canManageGroup() returns true)
   *   3. group member     → user
   *   4. group viewer     → guest
   *   5. no group context → workspace role
   */
  function getUserRoleInGroup(userId, groupId) {
    var uid = userId || (_currentUser && _currentUser.id);
    if (!uid) return Roles.GUEST;

    // Workspace admin overrides everything
    if (_currentUser && _currentUser.id === uid && _currentUser.role === Roles.ADMIN) {
      return Roles.ADMIN;
    }

    var groups = (window.state && window.state.groups) || [];
    var g = groups.find(function (x) { return x.id === groupId; });
    if (!g) return (_currentUser && _currentUser.role) || Roles.GUEST;

    // Group owner or explicit admin list
    if (g.ownerId === uid || g.createdBy === uid) return Roles.USER; // group-admin class
    if (Array.isArray(g.adminIds) && g.adminIds.indexOf(uid) >= 0) return Roles.USER;
    if (Array.isArray(g.memberIds) && g.memberIds.indexOf(uid) >= 0) return Roles.USER;
    if (Array.isArray(g.viewerIds) && g.viewerIds.indexOf(uid) >= 0) return Roles.GUEST;

    // Not mentioned in the group — fall back to workspace role
    return (_currentUser && _currentUser.role) || Roles.GUEST;
  }

  function getEffectiveRole(ctx) {
    ctx = ctx || {};
    var uid = ctx.userId || (_currentUser && _currentUser.id);
    if (ctx.groupId) return getUserRoleInGroup(uid, ctx.groupId);
    if (_currentUser && _currentUser.id === uid) return _currentUser.role || Roles.GUEST;
    return Roles.GUEST;
  }

  // ── Core can() check ──────────────────────────────────────────────────────
  /**
   * RBAC.can(permission, ctx?)
   *
   * ctx shape (all optional):
   *   groupId       – resolve group-scoped role
   *   task          – {createdBy, assignee} for ownership-gated perms
   *   userId        – override actor (default: current user)
   *   listSettings  – {allowGuestComments: bool} for comment permission
   */
  function can(permission, ctx) {
    ctx = ctx || {};
    var role    = getEffectiveRole(ctx);
    var perms   = PermissionMatrix[role] || [];
    var uid     = ctx.userId || (_currentUser && _currentUser.id);

    // Admin always passes
    if (role === Roles.ADMIN) return true;

    // Permission must be in the matrix
    if (perms.indexOf(permission) < 0) {
      // Special case: guest may comment if list settings explicitly allow it
      if (role === Roles.GUEST && permission === Perms.TASK_COMMENT) {
        return !!(ctx.listSettings && ctx.listSettings.allowGuestComments);
      }
      return false;
    }

    // Ownership-gated permissions for USER role
    if (role === Roles.USER && OWNERSHIP_GATED.indexOf(permission) >= 0 && ctx.task) {
      var task = ctx.task;
      var isOwner    = task.createdBy === uid || task.ownerId === uid;
      var isAssignee = task.assignee  === uid || task.assigneeId === uid;

      // TASK_DELETE: only task creator
      if (permission === Perms.TASK_DELETE) return isOwner;
      // TASK_UPDATE / TASK_CHANGE_STATUS: creator OR assignee
      return isOwner || isAssignee;
    }

    // Group management perms for USER role: must own/admin the group
    var GROUP_ADMIN_PERMS = [
      Perms.GROUP_DELETE, Perms.GROUP_EDIT_SETTINGS,
      Perms.GROUP_ADD_MEMBER, Perms.GROUP_REMOVE_MEMBER,
      Perms.GROUP_PROMOTE_MEMBER, Perms.GROUP_MANAGE_RULES
    ];
    if (role === Roles.USER && GROUP_ADMIN_PERMS.indexOf(permission) >= 0) {
      return canManageGroup(ctx.groupId);
    }

    return true;
  }

  /**
   * Returns true if the current user can administrate the given group.
   * Workspace admins always pass; team members only if they are the group owner.
   */
  function canManageGroup(groupId) {
    if (!_currentUser) return false;
    if (_currentUser.role === Roles.ADMIN) return true;
    if (!groupId) return false;
    var groups = (window.state && window.state.groups) || [];
    var g = groups.find(function (x) { return x.id === groupId; });
    if (!g) return false;
    var uid = _currentUser.id;
    if (g.ownerId === uid || g.createdBy === uid) return true;
    if (Array.isArray(g.adminIds) && g.adminIds.indexOf(uid) >= 0) return true;
    return false;
  }

  function isOrgAdmin()  { return !!(_currentUser && _currentUser.role === Roles.ADMIN); }
  function isAdmin()     { return isOrgAdmin(); }  // alias
  function isViewer()    { return !!(_currentUser && _currentUser.role === Roles.GUEST); }

  // ── Route guard ───────────────────────────────────────────────────────────
  function guardRoute(routeName, ctx) {
    switch (routeName) {
      case 'admin':
        return isOrgAdmin()
          ? { ok: true }
          : { ok: false, redirect: 'index.html', reason: 'Admin only' };
      case 'group_settings':
        return canManageGroup(ctx && ctx.groupId)
          ? { ok: true }
          : { ok: false, redirect: 'index.html', reason: 'Group owner or Admin only' };
      default:
        return { ok: true };
    }
  }

  // ── Listen for auth events as a fallback ──────────────────────────────────
  window.addEventListener('shadow_app_ready', function (e) {
    if (e.detail && e.detail.user && !_currentUser) {
      _syncFromAuth(e.detail.user);
    }
  });

  // ── Expose ────────────────────────────────────────────────────────────────
  window.RBAC = {
    Roles:            Roles,
    RoleMeta:         RoleMeta,
    Perms:            Perms,
    PermissionMatrix: PermissionMatrix,
    // user context
    getCurrentUser:     getCurrentUser,
    subscribe:          subscribe,
    _syncFromAuth:      _syncFromAuth,
    // backward-compat stubs (callers that used MockUsers/setCurrentUser)
    MockUsers:          [],
    setCurrentUser:     function () { console.warn('[RBAC] setCurrentUser() is removed. Real user comes from Supabase auth.'); },
    // checks
    can:                can,
    canManageGroup:     canManageGroup,
    isAdmin:            isAdmin,
    isOrgAdmin:         isOrgAdmin,   // alias
    isViewer:           isViewer,
    getEffectiveRole:   getEffectiveRole,
    getUserRoleInGroup: getUserRoleInGroup,
    // routing
    guardRoute:         guardRoute
  };
})();
