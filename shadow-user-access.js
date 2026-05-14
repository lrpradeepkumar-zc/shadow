// ================================================================
// shadow-user-access.js - User & Group Access Control Fix
// ================================================================
// Fixes:
// 1. state.currentUserId locked to the logged-in ShadowAuth user (not always Admin)
// 2. RBAC.MockUsers populated from real ShadowAuth users
// 3. state.groups filtered to only groups the current user can access
// 4. state.tasks filtered to tasks in accessible groups
// 5. Group member management UI uses real ShadowAuth users
// 6. New user registration does NOT auto-add to any group
// ================================================================
(function svkUserAccess() {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────
  function getAuthUser() {
    try {
      var raw = localStorage.getItem('shadow_session');
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function getAuthUsers() {
    try {
      return JSON.parse(localStorage.getItem('shadow_users') || '[]');
    } catch(e) { return []; }
  }

  function isOrgAdmin(user) {
    return user && user.role === 'admin';
  }

  // ── Core: check if user has access to a group ──────────────────
  function userHasGroupAccess(userId, group) {
    if (!group) return false;
    var admins = group.adminIds || [];
    var members = group.memberIds || [];
    if (admins.indexOf(userId) >= 0) return true;
    if (members.indexOf(userId) >= 0) return true;
    if (group.ownerId === userId || group.createdBy === userId) return true;
    return false;
  }

  // ── Fix 1: Lock state.currentUserId to the session user ───────
  // Uses Object.defineProperty to prevent app.js from overwriting it
  function fixCurrentUserId() {
    var authUser = getAuthUser();
    if (!authUser || !authUser.id) return;
    var correctId = authUser.id;

    function apply(s) {
      if (!s) return;
      // If already correct, skip
      if (s.currentUserId === correctId) return;
      // Try to lock it via defineProperty
      try {
        Object.defineProperty(s, 'currentUserId', {
          get: function() { return correctId; },
          set: function(v) {
            // Allow if setting same correct value
            if (v === correctId) return;
            // Log suppressed assignment attempts (app.js sets to Admin)
            console.debug('SVKUserAccess: blocked state.currentUserId = ' + v + ' (keeping ' + correctId + ')');
          },
          configurable: true,
          enumerable: true
        });
      } catch(e) {
        // Fallback: just set it
        s.currentUserId = correctId;
      }
      s.currentUserName = authUser.name;
      s.currentUserRole = authUser.role;
      if (window.SVK) window.SVK.initFromPersistedState(correctId);
    }

    var s = window.state;
    if (s) { apply(s); return; }

    // Poll until state is available
    var t = 0;
    var interval = setInterval(function() {
      t++;
      var st = window.state;
      if (st) { apply(st); clearInterval(interval); }
      if (t > 50) clearInterval(interval);
    }, 100);
  }

  // ── Fix 2: Bridge ShadowAuth users to RBAC.MockUsers ──────────
  function syncRBACUsers() {
    var authUser = getAuthUser();
    var authUsers = getAuthUsers();
    if (!authUsers.length || !window.RBAC) return;

    var roleMap = { 'admin': 'org_admin', 'member': 'group_member', 'viewer': 'viewer' };

    var realUsers = authUsers.map(function(u) {
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        globalRole: roleMap[u.role] || 'group_member',
        color: u.color || '#64748b',
        avatar: u.avatar || (u.name ? u.name[0] : '?')
      };
    });

    window.RBAC.MockUsers.splice(0, window.RBAC.MockUsers.length);
    realUsers.forEach(function(u) { window.RBAC.MockUsers.push(u); });

    if (authUser) {
      var rbacUser = realUsers.find(function(u) { return u.id === authUser.id; });
      if (rbacUser && typeof window.RBAC.setCurrentUser === 'function') {
        window.RBAC.setCurrentUser(rbacUser.id);
      }
    }
  }

  // ── Fix 3 & 4: Filter groups and tasks by user access ─────────
  function filterStateByAccess() {
    var authUser = getAuthUser();
    var s = window.state;
    if (!authUser || !s) return;

    var userId = authUser.id;
    if (isOrgAdmin(authUser)) return; // Org admin sees everything

    var allGroups = s.groups || [];
    var accessibleGroups = allGroups.filter(function(g) {
      return userHasGroupAccess(userId, g);
    });
    var accessibleGroupIds = accessibleGroups.map(function(g) { return g.id; });

    s.groups = accessibleGroups;

    var allTasks = s.tasks || [];
    s.tasks = allTasks.filter(function(t) {
      var taskGroup = t.group || t.groupId;
      if (taskGroup && accessibleGroupIds.indexOf(taskGroup) >= 0) return true;
      if (!taskGroup) return true;
      if (t.createdBy === userId) return true;
      if (t.assignee === userId) return true;
      return false;
    });
  }

  // ── Fix 5: Save unfiltered groups before filtering ─────────────
  function preserveAllGroups() {
    var s = window.state;
    if (!s || !s.groups) return;
    window._svkAllGroups = s.groups.slice();
  }

  // ── Fix 6: Patch user registration ────────────────────────────
  function patchUserRegistration() {
    if (!window.ShadowAuth || typeof window.ShadowAuth.register !== 'function') return;
    if (window.ShadowAuth._svkRegPatch) return; // already patched
    var _orig = window.ShadowAuth.register;
    window.ShadowAuth.register = function(name, email, password, noLogin) {
      var result = _orig.call(this, name, email, password, noLogin);
      if (result.ok && result.user) {
        syncRBACUsers(); // sync RBAC with new user
      }
      return result;
    };
    window.ShadowAuth._svkRegPatch = true;
  }

  // ── Fix 7: Watch data:changed to re-apply access filter ───────
  function patchRenderView() {
    if (window.ShadowDB && typeof window.ShadowDB.on === 'function') {
      window.ShadowDB.on('data:changed', function() {
        setTimeout(function() {
          var authUser = getAuthUser();
          if (!authUser) return;
          var s = window.state;
          if (!s) return;
          // Re-lock currentUserId
          fixCurrentUserId();
          // Re-preserve and re-filter
          preserveAllGroups();
          filterStateByAccess();
        }, 200);
      });
    }
  }

  // ── Fix 8: Members tab enhancement ───────────────────────────
  function patchSettingsMembersTab() {
    document.addEventListener('click', function(e) {
      var tab = e.target.closest('.group-tab');
      if (!tab || tab.dataset.tab !== 'members') return;
      setTimeout(function() { enhanceMembersTabWithRealUsers(); }, 200);
    });
  }

  function enhanceMembersTabWithRealUsers() {
    var membersList = document.getElementById('membersList');
    if (!membersList) return;

    var authUsers = getAuthUsers();
    var currentGroupId = typeof window.currentGroupId !== 'undefined' ? window.currentGroupId : null;
    if (!currentGroupId) return;

    var allGroups = window._svkAllGroups || (window.state && window.state.groups) || [];
    var group = allGroups.find(function(g) { return g.id === currentGroupId; });
    if (!group) return;

    var currentMemberIds = [].concat(group.adminIds || [], group.memberIds || []);

    // Render member list using real ShadowAuth users
    var memberRows = currentMemberIds.map(function(uid) {
      var u = authUsers.find(function(au) { return au.id === uid; });
      if (!u) return '';
      var isGroupAdmin = (group.adminIds || []).indexOf(uid) >= 0;
      var roleLabel = isGroupAdmin ? 'Group Admin' : 'Member';
      var roleColor = isGroupAdmin ? '#f59e0b' : '#10b981';
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color,#f0f0f0);">'
        + '<div style="background:' + (u.color||'#667eea') + ';width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0;">' + (u.avatar||u.name[0]) + '</div>'
        + '<div style="flex:1;"><div style="font-weight:500;font-size:13px;">' + u.name + '</div><div style="font-size:11px;color:var(--text-secondary);">' + u.email + '</div></div>'
        + '<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:' + roleColor + '20;color:' + roleColor + ';border:1px solid ' + roleColor + '44;">' + roleLabel + '</span>'
        + '<button data-svk-remove="' + uid + '" style="background:none;border:none;cursor:pointer;color:#e53e3e;font-size:13px;padding:4px 6px;" title="Remove"><i class=\'fa-solid fa-user-minus\'></i></button>'
        + '</div>';
    }).join('');

    membersList.innerHTML = memberRows || '<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:13px;">No members yet. Add members below.</div>';

    membersList.querySelectorAll('[data-svk-remove]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var uid = btn.getAttribute('data-svk-remove');
        if (!confirm('Remove this user from the group?')) return;
        group.adminIds = (group.adminIds || []).filter(function(x) { return x !== uid; });
        group.memberIds = (group.memberIds || []).filter(function(x) { return x !== uid; });
        try {
          if (window.ShadowDB && window.ShadowDB.Groups) await window.ShadowDB.Groups.update(currentGroupId, {adminIds: group.adminIds, memberIds: group.memberIds});
          syncGroupToState(group);
          enhanceMembersTabWithRealUsers();
        } catch(e) { alert('Error: ' + e.message); }
      });
    });

    // Remove existing add section and re-add
    var existing = document.getElementById('svk-add-member-wrap');
    if (existing) existing.remove();

    var nonMembers = authUsers.filter(function(u) { return currentMemberIds.indexOf(u.id) < 0; });
    var wrap = document.createElement('div');
    wrap.id = 'svk-add-member-wrap';
    wrap.style.cssText = 'padding:14px 0 0;margin-top:12px;';
    wrap.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Add Member</div>'
      + (nonMembers.length === 0
        ? '<p style="font-size:12px;color:var(--text-secondary);">All registered users are already members.</p>'
        : '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
          + '<select id="svkAddMemberSel" style="flex:1;min-width:150px;padding:7px 10px;border:1px solid var(--border-color);background:var(--bg-secondary);color:inherit;border-radius:7px;font-size:12px;">'
          + '<option value="">Select user...</option>'
          + nonMembers.map(function(u) { return '<option value="' + u.id + '">' + u.name + ' (' + u.role + ')</option>'; }).join('')
          + '</select>'
          + '<select id="svkMemberRoleSel" style="width:130px;padding:7px 10px;border:1px solid var(--border-color);background:var(--bg-secondary);color:inherit;border-radius:7px;font-size:12px;">'
          + '<option value="member">Member</option>'
          + '<option value="admin">Group Admin</option>'
          + '</select>'
          + '<button id="svkAddMemberBtn" style="padding:7px 16px;border:none;border-radius:7px;background:var(--accent,#4285f4);color:#fff;font-size:12px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;"><i class=\'fa-solid fa-plus\'></i> Add</button>'
          + '</div>');

    membersList.parentNode && membersList.parentNode.appendChild(wrap);

    var addBtn = wrap.querySelector('#svkAddMemberBtn');
    if (addBtn) addBtn.addEventListener('click', async function() {
      var sel = document.getElementById('svkAddMemberSel');
      var roleSel = document.getElementById('svkMemberRoleSel');
      var uid = sel && sel.value;
      var role = roleSel ? roleSel.value : 'member';
      if (!uid) return;
      if (role === 'admin') {
        group.adminIds = group.adminIds || [];
        if (group.adminIds.indexOf(uid) < 0) group.adminIds.push(uid);
      } else {
        group.memberIds = group.memberIds || [];
        if (group.memberIds.indexOf(uid) < 0) group.memberIds.push(uid);
      }
      try {
        if (window.ShadowDB && window.ShadowDB.Groups) {
          await window.ShadowDB.Groups.update(currentGroupId, {adminIds: group.adminIds || [], memberIds: group.memberIds || []});
        }
        syncGroupToState(group);
        enhanceMembersTabWithRealUsers();
        var addedUser = authUsers.find(function(u) { return u.id === uid; });
        showToast(addedUser ? addedUser.name + ' added to group' : 'Member added');
      } catch(e) { alert('Error: ' + e.message); }
    });
  }

  function syncGroupToState(group) {
    if (window.state && window.state.groups) {
      var sg = window.state.groups.find(function(g) { return g.id === group.id; });
      if (sg) { sg.adminIds = group.adminIds; sg.memberIds = group.memberIds; }
    }
    if (window._svkAllGroups) {
      var ag = window._svkAllGroups.find(function(g) { return g.id === group.id; });
      if (ag) { ag.adminIds = group.adminIds; ag.memberIds = group.memberIds; }
    }
  }

  function showToast(msg) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#10b981;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 2500);
  }

  // ── Boot: run all fixes ────────────────────────────────────────
  function boot() {
    var authUser = getAuthUser();
    if (!authUser) return; // Not logged in

    // Fix 1: Lock state.currentUserId immediately
    fixCurrentUserId();

    // Fix 2: Sync RBAC with real users
    syncRBACUsers();

    // Fix 6: Patch registration
    patchUserRegistration();

    // Fix 8: Patch settings Members tab
    patchSettingsMembersTab();

    // Wait for state to be populated, then filter
    var attempts = 0;
    var interval = setInterval(function() {
      attempts++;
      var s = window.state;
      if (s && s.groups && s.groups.length > 0 && s.tasks !== undefined) {
        clearInterval(interval);
        // Lock currentUserId again (app.js may have overwritten it by now)
        fixCurrentUserId();
        // Preserve all groups before filtering
        preserveAllGroups();
        // Filter groups and tasks by access
        filterStateByAccess();
        // Re-render sidebar with filtered data
        if (typeof window.renderSidebar === 'function') {
          window.renderSidebar();
        }
        // Fix 7: Watch for future data changes
        patchRenderView();
        return;
      }
      if (attempts > 60) clearInterval(interval); // timeout after 6 seconds
    }, 100);
  }

  // Run after ShadowDB is ready (or after 2 seconds fallback)
  function init() {
    if (window.ShadowDB && window.ShadowDB._sb) {
      boot();
    } else {
      document.addEventListener('shadowdb:ready', boot, { once: true });
      setTimeout(boot, 2000); // fallback
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 50);
  }

  // Expose for debugging
  window.SVKUserAccess = {
    fixCurrentUserId: fixCurrentUserId,
    syncRBACUsers: syncRBACUsers,
    filterStateByAccess: filterStateByAccess,
    preserveAllGroups: preserveAllGroups,
    enhanceMembersTabWithRealUsers: enhanceMembersTabWithRealUsers,
    getAuthUser: getAuthUser,
    getAuthUsers: getAuthUsers,
    userHasGroupAccess: userHasGroupAccess
  };

})(); // end svkUserAccess

