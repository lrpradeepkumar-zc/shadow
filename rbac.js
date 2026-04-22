/**
 * Shadow ToDo - RBAC (Role-Based Access Control)
 * -----------------------------------------------------------------------------
 * Single source of truth for:
 *   1. The 5 roles (Org Admin, Group Admin, User, Group Member, Viewer)
 *   2. Permission catalog (verb + resource pairs)
 *   3. Role -> permission matrix
 *   4. Mock CurrentUser context (with live role-switcher for QA)
 *   5. Utility API:  RBAC.can(action, ctx?),  RBAC.canManageGroup(groupId),
 *                    RBAC.getUserRole(userId), RBAC.isOrgAdmin(),
 *                    RBAC.subscribe(fn)
 *
 * Strictly keeps permission LOGIC separate from UI.  All UI modules
 * (rbac-ui.js, admin-dashboard.js, group-ui.js) import only from this file.
 * -----------------------------------------------------------------------------
 */
(function RBAC(){
  "use strict";

  // ------------------------------------------------------------ Roles (enum)
  var Roles = Object.freeze({
    ORG_ADMIN:    "org_admin",
    GROUP_ADMIN:  "group_admin",
    USER:         "user",
    GROUP_MEMBER: "group_member",
    VIEWER:       "viewer"
  });

  var RoleMeta = Object.freeze({
    org_admin:    { label: "Org Admin",    color: "#d946ef", rank: 5,
                    description: "Full organization-wide control." },
    group_admin:  { label: "Group Admin",  color: "#f59e0b", rank: 4,
                    description: "Full access within specific group(s)." },
    user:         { label: "User",         color: "#3b82f6", rank: 3,
                    description: "Base user. Personal tasks + limited group view." },
    group_member: { label: "Group Member", color: "#10b981", rank: 2,
                    description: "Active participant in a group." },
    viewer:       { label: "Viewer",       color: "#6b7280", rank: 1,
                    description: "Read-only access. No CRUD." }
  });

  // ------------------------------------------------------------ Permissions
  // Flat verb.resource strings so UI + middleware can reference them statically.
  var Perms = Object.freeze({
    // Org scope
    ORG_MANAGE:             "org.manage",
    ORG_BILLING:            "org.billing",
    ORG_INVITE_USER:        "org.invite_user",
    ORG_REVOKE_USER:        "org.revoke_user",
    ORG_CHANGE_USER_ROLE:   "org.change_user_role",

    // Group scope
    GROUP_CREATE:           "group.create",
    GROUP_DELETE:           "group.delete",
    GROUP_EDIT_SETTINGS:    "group.edit_settings",
    GROUP_ADD_MEMBER:       "group.add_member",
    GROUP_REMOVE_MEMBER:    "group.remove_member",
    GROUP_PROMOTE_MEMBER:   "group.promote_member",
    GROUP_REASSIGN_ADMIN:   "group.reassign_admin",
    GROUP_MANAGE_RULES:     "group.manage_rules",

    // Task scope
    TASK_CREATE:            "task.create",
    TASK_READ:              "task.read",
    TASK_UPDATE:            "task.update",
    TASK_DELETE:            "task.delete",
    TASK_COMMENT:           "task.comment",
    TASK_CHANGE_STATUS:     "task.change_status",
    TASK_ASSIGN:            "task.assign",

    // Personal scope
    PERSONAL_TASK_CRUD:     "personal_task.crud"
  });

  // Role -> permission matrix. Org admin gets everything by default.
  var PermissionMatrix = {
    org_admin: Object.values(Perms), // all perms

    group_admin: [
      Perms.GROUP_EDIT_SETTINGS, Perms.GROUP_ADD_MEMBER, Perms.GROUP_REMOVE_MEMBER,
      Perms.GROUP_PROMOTE_MEMBER, Perms.GROUP_MANAGE_RULES,
      Perms.TASK_CREATE, Perms.TASK_READ, Perms.TASK_UPDATE, Perms.TASK_DELETE,
      Perms.TASK_COMMENT, Perms.TASK_CHANGE_STATUS, Perms.TASK_ASSIGN,
      Perms.PERSONAL_TASK_CRUD,
      Perms.GROUP_CREATE
    ],

    user: [
      Perms.PERSONAL_TASK_CRUD,
      Perms.TASK_READ,
      Perms.GROUP_CREATE // base users can create their own group
    ],

    group_member: [
      Perms.TASK_CREATE, Perms.TASK_READ, Perms.TASK_UPDATE, Perms.TASK_DELETE,
      Perms.TASK_COMMENT, Perms.TASK_CHANGE_STATUS,
      Perms.PERSONAL_TASK_CRUD
    ],

    viewer: [
      Perms.TASK_READ
    ]
  };

  // ------------------------------------------------------------ Mock users / context
  // This is a dev-only mock so the role switcher in the header works.  In
  // production, CurrentUser would come from the auth/session module.
  var MockUsers = [
    { id: "u_orgadmin",   name: "Olivia Org",    email: "olivia@shadow.dev",   globalRole: Roles.ORG_ADMIN,    color: "#d946ef" },
    { id: "u_gadmin",     name: "Gary Admin",    email: "gary@shadow.dev",     globalRole: Roles.GROUP_ADMIN,  color: "#f59e0b" },
    { id: "u_user",       name: "Ursula User",   email: "ursula@shadow.dev",   globalRole: Roles.USER,         color: "#3b82f6" },
    { id: "u_member",     name: "Max Member",    email: "max@shadow.dev",      globalRole: Roles.GROUP_MEMBER, color: "#10b981" },
    { id: "u_viewer",     name: "Vera Viewer",   email: "vera@shadow.dev",     globalRole: Roles.VIEWER,       color: "#6b7280" }
  ];

  var subscribers = [];
  var STORAGE_KEY = "shadow_rbac_current_user";

  function loadCurrentUser(){
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var found = MockUsers.find(function(u){ return u.id === parsed.id; });
        if (found) return found;
      }
    } catch(_) {}
    return MockUsers[0]; // default: Org Admin
  }

  var currentUser = loadCurrentUser();

  function setCurrentUser(userId){
    var u = MockUsers.find(function(x){ return x.id === userId; });
    if (!u) return false;
    currentUser = u;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: u.id })); } catch(_) {}
    subscribers.forEach(function(fn){ try { fn(currentUser); } catch(_) {} });
    return true;
  }

  function getCurrentUser(){ return currentUser; }

  function subscribe(fn){
    subscribers.push(fn);
    return function(){ subscribers = subscribers.filter(function(f){ return f !== fn; }); };
  }

  // ------------------------------------------------------------ Role resolution
  // A user has a GLOBAL role (org-wide) AND optional group-specific roles.
  // For a given groupId we resolve: global org_admin > group-level > "user".
  function getUserRoleInGroup(userId, groupId){
    var user = MockUsers.find(function(u){ return u.id === userId; });
    if (!user) return Roles.VIEWER;
    if (user.globalRole === Roles.ORG_ADMIN) return Roles.ORG_ADMIN;

    var groups = (window.state && window.state.groups) || [];
    var g = groups.find(function(x){ return x.id === groupId; });
    if (!g) return user.globalRole; // no group context, fall back to global

    if (Array.isArray(g.adminIds) && g.adminIds.indexOf(userId) >= 0) return Roles.GROUP_ADMIN;
    if (g.ownerId === userId || g.createdBy === userId)               return Roles.GROUP_ADMIN;
    if (Array.isArray(g.memberIds) && g.memberIds.indexOf(userId) >= 0) return Roles.GROUP_MEMBER;
    if (Array.isArray(g.viewerIds) && g.viewerIds.indexOf(userId) >= 0) return Roles.VIEWER;

    return user.globalRole;
  }

  function getEffectiveRole(ctx){
    ctx = ctx || {};
    var uid = (ctx.userId) || (currentUser && currentUser.id);
    if (ctx.groupId) return getUserRoleInGroup(uid, ctx.groupId);
    return (currentUser && currentUser.globalRole) || Roles.VIEWER;
  }

  // ------------------------------------------------------------ Core "can" check
  function can(permission, ctx){
    var role = getEffectiveRole(ctx);
    var perms = PermissionMatrix[role] || [];
    return perms.indexOf(permission) >= 0;
  }

  function canManageGroup(groupId){
    var role = getEffectiveRole({ groupId: groupId });
    return role === Roles.ORG_ADMIN || role === Roles.GROUP_ADMIN;
  }

  function isOrgAdmin(){
    return currentUser && currentUser.globalRole === Roles.ORG_ADMIN;
  }

  function isViewer(){
    return currentUser && currentUser.globalRole === Roles.VIEWER;
  }

  // ------------------------------------------------------------ Route guard
  // Simple client-side guard. Returns {ok, redirect, reason}. The caller
  // decides whether to navigate or show an inline "403" state.
  function guardRoute(routeName, ctx){
    switch (routeName) {
      case "admin":
        if (!isOrgAdmin()) return { ok: false, redirect: "index.html", reason: "Org Admin only" };
        return { ok: true };
      case "group_settings":
        if (!canManageGroup(ctx && ctx.groupId)) {
          return { ok: false, redirect: "index.html", reason: "Group Admin or Org Admin only" };
        }
        return { ok: true };
      default:
        return { ok: true };
    }
  }

  // ------------------------------------------------------------ Expose
  window.RBAC = {
    Roles: Roles,
    RoleMeta: RoleMeta,
    Perms: Perms,
    PermissionMatrix: PermissionMatrix,
    MockUsers: MockUsers,
    // context
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    subscribe: subscribe,
    // checks
    can: can,
    canManageGroup: canManageGroup,
    isOrgAdmin: isOrgAdmin,
    isViewer: isViewer,
    getEffectiveRole: getEffectiveRole,
    getUserRoleInGroup: getUserRoleInGroup,
    // routing
    guardRoute: guardRoute
  };

  // Dispatch initial event for late subscribers
  try {
    document.addEventListener("DOMContentLoaded", function(){
      var ev = new CustomEvent("rbac:ready", { detail: { currentUser: currentUser } });
      document.dispatchEvent(ev);
    });
  } catch(_) {}
})();
