// ================================================================
// shadow-user-access.js v3 - User & Group Access Control Fix
// ================================================================
(function svkUserAccess() {
  'use strict';

  function getAuthUser() {
    try { return JSON.parse(localStorage.getItem('shadow_session') || 'null'); } catch(e) { return null; }
  }
  function getAuthUsers() {
    try { return JSON.parse(localStorage.getItem('shadow_users') || '[]'); } catch(e) { return []; }
  }
  function isOrgAdmin(user) { return user && user.role === 'admin'; }

  function userHasGroupAccess(userId, group) {
    if (!group) return false;
    if ((group.adminIds || []).indexOf(userId) >= 0) return true;
    if ((group.memberIds || []).indexOf(userId) >= 0) return true;
    if (group.ownerId === userId || group.createdBy === userId) return true;
    return false;
  }

  // Fix 1: Lock state.currentUserId to the logged-in ShadowAuth user
  function fixCurrentUserId() {
    var authUser = getAuthUser();
    if (!authUser || !authUser.id) return;
    var correctId = authUser.id;
    var s = window.state;
    if (!s) return;
    if (s.currentUserId === correctId) return;
    try {
      Object.defineProperty(s, 'currentUserId', {
        get: function() { return correctId; },
        set: function(v) { if (v !== correctId) console.debug('SVK: blocked state.currentUserId=' + v); },
        configurable: true, enumerable: true
      });
    } catch(e) { s.currentUserId = correctId; }
    s.currentUserName = authUser.name;
    s.currentUserRole = authUser.role;
    if (window.SVK) window.SVK.initFromPersistedState(correctId);
  }

  // Fix 2: Sync RBAC MockUsers with real ShadowAuth users
  function syncRBACUsers() {
    var authUser = getAuthUser();
    var authUsers = getAuthUsers();
    if (!authUsers.length || !window.RBAC) return;
    var roleMap = { admin: 'org_admin', member: 'group_member', viewer: 'viewer' };
    var realUsers = authUsers.map(function(u) {
      return { id: u.id, name: u.name, email: u.email,
        globalRole: roleMap[u.role] || 'group_member',
        color: u.color || '#64748b', avatar: u.avatar || u.name[0] };
    });
    window.RBAC.MockUsers.splice(0, window.RBAC.MockUsers.length);
    realUsers.forEach(function(u) { window.RBAC.MockUsers.push(u); });
    if (authUser) {
      var ru = realUsers.find(function(u) { return u.id === authUser.id; });
      if (ru && typeof window.RBAC.setCurrentUser === 'function') window.RBAC.setCurrentUser(ru.id);
    }
  }

  // Fix 3: Filter state.groups and state.tasks by user access
  function filterStateByAccess() {
    var authUser = getAuthUser();
    var s = window.state;
    if (!authUser || !s) return;
    if (isOrgAdmin(authUser)) return; // Org admin sees everything
    var userId = authUser.id;
    var allGroups = s.groups || [];
    var accessible = allGroups.filter(function(g) { return userHasGroupAccess(userId, g); });
    var accessIds = accessible.map(function(g) { return g.id; });
    s.groups = accessible;
    s.tasks = (s.tasks || []).filter(function(t) {
      var tg = t.group || t.groupId;
      if (tg && accessIds.indexOf(tg) >= 0) return true;
      if (!tg) return true;
      if (t.createdBy === userId || t.assignee === userId) return true;
      return false;
    });
  }

  function preserveAllGroups() {
    var s = window.state;
    if (s && s.groups) window._svkAllGroups = s.groups.slice();
  }

  // Fix 4: Patch renderSidebar to always apply access filter first
  function patchRenderSidebar() {
    if (window._svkSidebarPatched) return;
    if (typeof window.renderSidebar !== 'function') return;
    var _orig = window.renderSidebar;
    window.renderSidebar = function() {
      fixCurrentUserId();
      if (window._svkAllGroups && window._svkAllGroups.length) {
        // Restore all groups first (in case previous filter removed some)
        var s = window.state;
        if (s) {
          s.groups = window._svkAllGroups.slice();
          s.tasks = window._svkAllTasks ? window._svkAllTasks.slice() : s.tasks;
          filterStateByAccess();
        }
      }
      return _orig.apply(this, arguments);
    };
    window._svkSidebarPatched = true;
  }

  // Fix 5: Patch user registration (no auto group access)
  function patchUserRegistration() {
    if (!window.ShadowAuth || window.ShadowAuth._svkRegPatch) return;
    var _orig = window.ShadowAuth.register;
    window.ShadowAuth.register = function(name, email, password, noLogin) {
      var result = _orig.call(this, name, email, password, noLogin);
      if (result.ok) syncRBACUsers();
      return result;
    };
    window.ShadowAuth._svkRegPatch = true;
  }

  // Fix 6: Group Settings Members tab - real user management
  function patchSettingsMembersTab() {
    document.addEventListener('click', function(e) {
      var tab = e.target.closest('.group-tab');
      if (!tab || tab.dataset.tab !== 'members') return;
      setTimeout(enhanceMembersTab, 200);
    });
  }

  function enhanceMembersTab() {
    var membersList = document.getElementById('membersList');
    if (!membersList) return;
    var gid = typeof window.currentGroupId !== 'undefined' ? window.currentGroupId : null;
    if (!gid) return;
    var allGroups = window._svkAllGroups || (window.state && window.state.groups) || [];
    var group = allGroups.find(function(g) { return g.id === gid; });
    if (!group) return;
    var authUsers = getAuthUsers();
    var currentIds = [].concat(group.adminIds || [], group.memberIds || []);

    membersList.innerHTML = currentIds.length ? currentIds.map(function(uid) {
      var u = authUsers.find(function(x) { return x.id === uid; }) || {id:uid,name:uid,email:'',color:'#667eea',avatar:'?'};
      var isAdmin = (group.adminIds||[]).indexOf(uid) >= 0;
      var rc = isAdmin ? '#f59e0b' : '#10b981';
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color,#eee);">'
        + '<div style="background:'+(u.color||'#667eea')+';width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;">'+(u.avatar||u.name[0])+'</div>'
        + '<div style="flex:1"><div style="font-weight:500;font-size:13px;">'+u.name+'</div><div style="font-size:11px;color:var(--text-secondary);">'+u.email+'</div></div>'
        + '<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:'+rc+'20;color:'+rc+';border:1px solid '+rc+'44;">'+(isAdmin?'Group Admin':'Member')+'</span>'
        + '<button data-rm="'+uid+'" style="background:none;border:none;cursor:pointer;color:#e53e3e;font-size:12px;padding:4px 6px;"><i class=\'fa-solid fa-user-minus\'></i></button>'
        + '</div>';
    }).join('') : '<p style="color:var(--text-secondary);font-size:13px;padding:12px 0;">No members yet.</p>';

    membersList.querySelectorAll('[data-rm]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var uid = btn.getAttribute('data-rm');
        if (!confirm('Remove this user from the group?')) return;
        group.adminIds = (group.adminIds||[]).filter(function(x){return x!==uid;});
        group.memberIds = (group.memberIds||[]).filter(function(x){return x!==uid;});
        try {
          if (window.ShadowDB && window.ShadowDB.Groups) await window.ShadowDB.Groups.update(gid,{adminIds:group.adminIds,memberIds:group.memberIds});
          syncGroup(group); enhanceMembersTab();
        } catch(e) { alert(e.message); }
      });
    });

    var existing = document.getElementById('svk-add-wrap');
    if (existing) existing.remove();
    var nonMembers = authUsers.filter(function(u){return currentIds.indexOf(u.id)<0;});
    var wrap = document.createElement('div');
    wrap.id = 'svk-add-wrap';
    wrap.style.cssText = 'padding:14px 0 0;margin-top:10px;';
    wrap.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;margin-bottom:10px;">Add Member</div>'
      + (nonMembers.length===0 ? '<p style="font-size:12px;color:var(--text-secondary);">All users are already members.</p>'
        : '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<select id="svkAS" style="flex:1;min-width:140px;padding:7px 10px;border:1px solid var(--border-color);background:var(--bg-secondary);color:inherit;border-radius:7px;font-size:12px;">'
        + '<option value="">Select user...</option>'
        + nonMembers.map(function(u){return '<option value="'+u.id+'">'+u.name+' ('+u.role+')</option>';}).join('')
        + '</select>'
        + '<select id="svkRS" style="width:130px;padding:7px 10px;border:1px solid var(--border-color);background:var(--bg-secondary);color:inherit;border-radius:7px;font-size:12px;">'
        + '<option value="member">Member</option><option value="admin">Group Admin</option>'
        + '</select>'
        + '<button id="svkAB" style="padding:7px 16px;border:none;border-radius:7px;background:var(--accent,#4285f4);color:#fff;font-size:12px;cursor:pointer;font-weight:500;"><i class=\'fa-solid fa-plus\'></i> Add</button>'
        + '</div>');
    membersList.parentNode && membersList.parentNode.appendChild(wrap);
    var ab = wrap.querySelector('#svkAB');
    if (ab) ab.addEventListener('click', async function() {
      var sel = document.getElementById('svkAS'), rs = document.getElementById('svkRS');
      var uid = sel&&sel.value, role = rs?rs.value:'member';
      if (!uid) return;
      if (role==='admin') { group.adminIds=group.adminIds||[]; if(group.adminIds.indexOf(uid)<0) group.adminIds.push(uid); }
      else { group.memberIds=group.memberIds||[]; if(group.memberIds.indexOf(uid)<0) group.memberIds.push(uid); }
      try {
        if (window.ShadowDB&&window.ShadowDB.Groups) await window.ShadowDB.Groups.update(gid,{adminIds:group.adminIds||[],memberIds:group.memberIds||[]});
        syncGroup(group); enhanceMembersTab();
        var u=authUsers.find(function(x){return x.id===uid;});
        toast(u?u.name+' added':'Member added');
      } catch(e){alert(e.message);}
    });
  }

  function syncGroup(group) {
    [window.state&&window.state.groups, window._svkAllGroups].forEach(function(arr) {
      if (!arr) return;
      var g = arr.find(function(x){return x.id===group.id;});
      if (g) { g.adminIds=group.adminIds; g.memberIds=group.memberIds; }
    });
  }

  function toast(msg) {
    var t=document.createElement('div');
    t.style.cssText='position:fixed;bottom:24px;right:24px;background:#10b981;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);';
    t.textContent=msg; document.body.appendChild(t);
    setTimeout(function(){t.remove();},2500);
  }

  // Boot: run all fixes with proper timing
  function boot() {
    var authUser = getAuthUser();
    if (!authUser) return;

    fixCurrentUserId();
    syncRBACUsers();
    patchUserRegistration();
    patchSettingsMembersTab();

    // Wait for renderSidebar to be available (defined in app.js IIFE)
    var sidebarAttempts = 0;
    var sidebarInterval = setInterval(function() {
      sidebarAttempts++;
      if (typeof window.renderSidebar === 'function') {
        clearInterval(sidebarInterval);
        patchRenderSidebar();
      }
      if (sidebarAttempts > 100) clearInterval(sidebarInterval);
    }, 50);

    // Wait for state to be populated, then filter
    var stateAttempts = 0;
    var stateInterval = setInterval(function() {
      stateAttempts++;
      var s = window.state;
      if (s && s.groups && s.groups.length > 0) {
        clearInterval(stateInterval);
        // Save complete unfiltered copy
        window._svkAllGroups = s.groups.slice();
        window._svkAllTasks = s.tasks ? s.tasks.slice() : [];
        // Apply fixes
        fixCurrentUserId();
        filterStateByAccess();
        // Re-render sidebar
        if (typeof window.renderSidebar === 'function') window.renderSidebar();
      }
      if (stateAttempts > 100) clearInterval(stateInterval);
    }, 100);
  }

  // Init
  function init() {
    if (window.ShadowDB && window.ShadowDB._sb) { boot(); }
    else {
      document.addEventListener('shadowdb:ready', boot, {once:true});
      setTimeout(boot, 2500);
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { setTimeout(init, 50); }

  window.SVKUserAccess = {
    fixCurrentUserId, syncRBACUsers, filterStateByAccess, preserveAllGroups,
    enhanceMembersTab, getAuthUser, getAuthUsers, userHasGroupAccess
  };

})(); // end svkUserAccess
