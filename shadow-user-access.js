// ================================================================
// shadow-user-access.js - User & Group Access Control Fix
// ================================================================
// Fixes:
// 1. state.currentUserId now matches the logged-in ShadowAuth user
// 2. RBAC.MockUsers populated from real ShadowAuth users
// 3. state.groups filtered to only groups the current user can access
// 4. state.tasks filtered to tasks in accessible groups
// 5. Group member management uses real ShadowAuth users
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

  function isAdmin(user) {
    return user && user.role === 'admin';
  }

  // ── Core: check if user has access to a group ──────────────────
  function userHasGroupAccess(userId, group) {
    if (!group) return false;
    var admins = group.adminIds || [];
    var members = group.memberIds || [];
    // Explicit membership
    if (admins.indexOf(userId) >= 0) return true;
    if (members.indexOf(userId) >= 0) return true;
    // Group creator / owner
    if (group.ownerId === userId || group.createdBy === userId) return true;
    // If group has NO membership data at all, creator (first admin) has access
    // but others should not by default
    return false;
  }

  // ── Fix 1: Set state.currentUserId to session user ────────────
  function fixCurrentUserId() {
    var authUser = getAuthUser();
    if (!authUser || !authUser.id) return;
    function apply() {
      var s = window.state;
      if (!s) return;
      if (s.currentUserId !== authUser.id) {
        s.currentUserId = authUser.id;
        s.currentUserName = authUser.name;
        s.currentUserRole = authUser.role;
        if (window.SVK) {
          window.SVK.initFromPersistedState(authUser.id);
        }
      }
    }
    apply();
    // Also apply after state loads via data:changed event
    if (window.ShadowDB && typeof window.ShadowDB.on === 'function') {
      window.ShadowDB.on('data:changed', function() { apply(); });
    }
  }

  // ── Fix 2: Bridge ShadowAuth users to RBAC.MockUsers ──────────
  function syncRBACUsers() {
    var authUser = getAuthUser();
    var authUsers = getAuthUsers();
    if (!authUsers.length || !window.RBAC) return;

    // Map ShadowAuth roles to RBAC global roles
    var roleMap = {
      'admin': 'org_admin',
      'member': 'group_member',
      'viewer': 'viewer'
    };

    // Replace MockUsers with real users
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

    // Replace mock users array in place (keep reference)
    window.RBAC.MockUsers.splice(0, window.RBAC.MockUsers.length);
    realUsers.forEach(function(u) { window.RBAC.MockUsers.push(u); });

    // Set RBAC current user to the logged-in auth user
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
    var isOrgAdmin = isAdmin(authUser); // ShadowAuth 'admin' = org admin

    // Org admin sees everything
    if (isOrgAdmin) return;

    // Filter groups to only those user has explicit access to
    var allGroups = s.groups || [];
    var accessibleGroups = allGroups.filter(function(g) {
      return userHasGroupAccess(userId, g);
    });
    var accessibleGroupIds = accessibleGroups.map(function(g) { return g.id; });

    // Apply filtered groups to state
    s.groups = accessibleGroups;

    // Filter tasks to tasks in accessible groups OR created by/assigned to user
    var allTasks = s.tasks || [];
    s.tasks = allTasks.filter(function(t) {
      var taskGroup = t.group || t.groupId;
      // Task is in an accessible group
      if (taskGroup && accessibleGroupIds.indexOf(taskGroup) >= 0) return true;
      // Task is a personal task (no group)
      if (!taskGroup) return true;
      // Task was created by this user
      if (t.createdBy === userId) return true;
      // Task is assigned to this user
      if (t.assignee === userId) return true;
      return false;
    });
  }

  // ── Fix 5: Group member management uses real users ─────────────
  function patchGroupMemberManagement() {
    // Override the Members tab renderer in master settings to use real users
    var _origOpenGroupDetail = window.openGroupDetail;
    if (typeof _origOpenGroupDetail !== 'function') return;

    // Wait for settings to be opened, then fix the member tab
    document.addEventListener('click', function(e) {
      var membersTab = e.target.closest('.group-tab[data-tab="members"]');
      if (!membersTab) return;
      // Give the tab content time to render, then patch the Add Member select
      setTimeout(function() {
        patchAddMemberDropdown();
      }, 100);
    });
  }

  function patchAddMemberDropdown() {
    // Find the "Add member" select in the group member tab
    var membersList = document.getElementById('membersList');
    if (!membersList) return;

    var authUsers = getAuthUsers();
    var authUser = getAuthUser();
    var s = window.state;
    var currentGroupId = typeof window.currentGroupId !== 'undefined' ? window.currentGroupId : null;
    if (!currentGroupId || !s) return;

    var group = s.groups.find(function(g) { return g.id === currentGroupId; });
    // Include all groups if user is admin (since filtered)
    if (!group && window._svkAllGroups) {
      group = window._svkAllGroups.find(function(g) { return g.id === currentGroupId; });
    }
    if (!group) return;

    var currentMembers = [].concat(group.adminIds || [], group.memberIds || []);

    // Check if there's an "Add member" section already
    var existingAddSection = document.getElementById('svk-add-member-section');
    if (!existingAddSection) {
      var addSection = document.createElement('div');
      addSection.id = 'svk-add-member-section';
      addSection.style.cssText = 'padding:12px 0;border-top:1px solid var(--border-color,#e5e7eb);margin-top:12px;';

      var nonMembers = authUsers.filter(function(u) {
        return currentMembers.indexOf(u.id) < 0;
      });

      if (nonMembers.length === 0) {
        addSection.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:8px 0;">All users are already members of this group.</div>';
      } else {
        addSection.innerHTML = '<div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">Add Member</div>'
          + '<div style="display:flex;gap:8px;align-items:center;">'
          + '<select id="svkAddMemberSelect" style="flex:1;padding:6px 8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:inherit;border-radius:6px;font-size:12px;">'
          + '<option value="">Select user to add...</option>'
          + nonMembers.map(function(u) {
              return '<option value="' + u.id + '" data-role="' + u.role + '">' + u.name + ' (' + u.role + ')</option>';
            }).join('')
          + '</select>'
          + '<select id="svkMemberRoleSelect" style="width:130px;padding:6px 8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:inherit;border-radius:6px;font-size:12px;">'
          + '<option value="member">Member</option>'
          + '<option value="admin">Admin</option>'
          + '</select>'
          + '<button id="svkAddMemberBtn" style="padding:6px 14px;border:none;border-radius:6px;background:var(--accent,#4285f4);color:#fff;font-size:12px;cursor:pointer;font-weight:500;">Add</button>'
          + '</div>';
      }

      membersList.parentNode && membersList.parentNode.appendChild(addSection);

      var addBtn = addSection.querySelector('#svkAddMemberBtn');
      if (addBtn) addBtn.addEventListener('click', async function() {
        var sel = document.getElementById('svkAddMemberSelect');
        var roleSel = document.getElementById('svkMemberRoleSelect');
        var uid = sel && sel.value;
        var role = roleSel && roleSel.value;
        if (!uid || !group) return;

        if (role === 'admin') {
          group.adminIds = group.adminIds || [];
          if (group.adminIds.indexOf(uid) < 0) group.adminIds.push(uid);
        } else {
          group.memberIds = group.memberIds || [];
          if (group.memberIds.indexOf(uid) < 0) group.memberIds.push(uid);
        }

        try {
          if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
            await window.ShadowDB.Groups.update(currentGroupId, {
              adminIds: group.adminIds || [],
              memberIds: group.memberIds || []
            });
          }
          // Update state if admin (otherwise the user may not see this group)
          if (window.state && window.state.groups) {
            var stateGroup = window.state.groups.find(function(g) { return g.id === currentGroupId; });
            if (stateGroup) {
              stateGroup.adminIds = group.adminIds;
              stateGroup.memberIds = group.memberIds;
            }
          }
          // Re-render the members tab
          if (typeof window.openGroupDetail === 'function') {
            window.openGroupDetail(currentGroupId);
            setTimeout(function() {
              var tab = document.querySelector('.group-tab[data-tab="members"]');
              if (tab) tab.click();
            }, 80);
          }
        } catch(e) { alert('Could not add member: ' + e.message); }
      });
    }
  }

  // ── Fix 6: New user registration should NOT auto-add to groups ─
  function patchUserRegistration() {
    if (!window.ShadowAuth || typeof window.ShadowAuth.register !== 'function') return;
    var _origRegister = window.ShadowAuth.register;
    window.ShadowAuth.register = function(name, email, password, noLogin) {
      var result = _origRegister.call(this, name, email, password, noLogin);
      // When a new user registers, they get NO group access by default.
      // Group admins/org admins must explicitly add them.
      // The result.user will exist in shadow_users but won't be in any group's memberIds.
      // This is correct behavior - no changes needed here, just log it.
      if (result.ok && result.user) {
        console.log('SVK: New user registered:', result.user.name, '- no automatic group access granted');
        // Sync RBAC with the new user
        syncRBACUsers();
      }
      return result;
    };
  }

  // ── Fix 7: Patch renderView to apply access filter after state reload ─
  function patchRenderView() {
    // Watch for state.groups/tasks changes and re-apply the access filter
    // Since renderView is inside an IIFE, we hook into ShadowDB data:changed
    if (window.ShadowDB && typeof window.ShadowDB.on === 'function') {
      window.ShadowDB.on('data:changed', function() {
        // Small delay to let app.js reload state first
        setTimeout(function() {
          fixCurrentUserId();
          filterStateByAccess();
        }, 150);
      });
    }
  }

  // ── Fix 8: Patch the Members tab in settings to show real users ──
  // Override the existing renderMembers function used in settings.js
  function patchSettingsMembersTab() {
    // Intercept the members tab click in the group detail view
    document.addEventListener('click', function(e) {
      var tab = e.target.closest('.group-tab');
      if (!tab || tab.dataset.tab !== 'members') return;

      setTimeout(function() {
        enhanceMembersTabWithRealUsers();
      }, 200);
    });
  }

  function enhanceMembersTabWithRealUsers() {
    var membersList = document.getElementById('membersList');
    if (!membersList) return;

    var authUsers = getAuthUsers();
    var s = window.state;
    var currentGroupId = typeof window.currentGroupId !== 'undefined' ? window.currentGroupId : null;

    // Remove existing svk add-member section to re-render fresh
    var existing = document.getElementById('svk-add-member-section');
    if (existing) existing.remove();

    if (!currentGroupId || !s) return;

    // Find group in state (may be filtered for non-admins)
    // Use the unfiltered groups if available
    var allGroups = window._svkAllGroups || s.groups;
    var group = allGroups.find(function(g) { return g.id === currentGroupId; });
    if (!group) return;

    var currentMemberIds = [].concat(group.adminIds || [], group.memberIds || []);

    // Render the current members list using real ShadowAuth users
    var memberRows = currentMemberIds.map(function(uid) {
      var u = authUsers.find(function(au) { return au.id === uid; });
      if (!u) return '';
      var isGroupAdmin = (group.adminIds || []).indexOf(uid) >= 0;
      var roleLabel = isGroupAdmin ? 'Group Admin' : 'Member';
      var roleColor = isGroupAdmin ? '#f59e0b' : '#10b981';
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color,#f0f0f0);">'
        + '<div style="background:' + (u.color || '#667eea') + ';width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0;">' + (u.avatar || u.name[0]) + '</div>'
        + '<div style="flex:1;"><div style="font-weight:500;font-size:13px;">' + u.name + '</div><div style="font-size:11px;color:var(--text-secondary);">' + u.email + '</div></div>'
        + '<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:' + roleColor + '20;color:' + roleColor + ';border:1px solid ' + roleColor + '44;">' + roleLabel + '</span>'
        + '<button data-remove-uid="' + uid + '" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);font-size:11px;padding:4px 6px;" title="Remove from group"><i class="fa-solid fa-user-minus"></i></button>'
        + '</div>';
    }).join('');

    if (!memberRows) {
      membersList.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:13px;">No members yet.</div>';
    } else {
      membersList.innerHTML = memberRows;
    }

    // Wire remove buttons
    membersList.querySelectorAll('[data-remove-uid]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var uid = btn.getAttribute('data-remove-uid');
        if (!confirm('Remove this user from the group?')) return;
        group.adminIds = (group.adminIds || []).filter(function(x) { return x !== uid; });
        group.memberIds = (group.memberIds || []).filter(function(x) { return x !== uid; });
        try {
          if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
            await window.ShadowDB.Groups.update(currentGroupId, {
              adminIds: group.adminIds,
              memberIds: group.memberIds
            });
          }
          // Update state group too
          if (window.state && window.state.groups) {
            var stateGroup = window.state.groups.find(function(g) { return g.id === currentGroupId; });
            if (stateGroup) { stateGroup.adminIds = group.adminIds; stateGroup.memberIds = group.memberIds; }
          }
          enhanceMembersTabWithRealUsers(); // re-render
        } catch(e) { alert('Could not remove member: ' + e.message); }
      });
    });

    // Add the "Add Member" section below
    var nonMembers = authUsers.filter(function(u) { return currentMemberIds.indexOf(u.id) < 0; });
    var addSection = document.createElement('div');
    addSection.id = 'svk-add-member-section';
    addSection.style.cssText = 'padding:14px 0 0;margin-top:12px;';

    addSection.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Add Member</div>'
      + (nonMembers.length === 0
        ? '<div style="font-size:12px;color:var(--text-secondary);padding:8px 0;">All registered users are already members.</div>'
        : '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
          + '<select id="svkAddMemberSelect" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--border-color);background:var(--bg-secondary);color:inherit;border-radius:7px;font-size:12px;">'
          + '<option value="">Select user...</option>'
          + nonMembers.map(function(u) { return '<option value="' + u.id + '">' + u.name + ' (' + u.role + ')</option>'; }).join('')
          + '</select>'
          + '<select id="svkMemberRoleSelect" style="width:120px;padding:7px 10px;border:1px solid var(--border-color);background:var(--bg-secondary);color:inherit;border-radius:7px;font-size:12px;">'
          + '<option value="member">Member</option>'
          + '<option value="admin">Group Admin</option>'
          + '</select>'
          + '<button id="svkAddMemberBtn" style="padding:7px 16px;border:none;border-radius:7px;background:var(--accent,#4285f4);color:#fff;font-size:12px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;"><i class=\'fa-solid fa-plus\'></i> Add</button>'
          + '</div>');

    membersList.parentNode && membersList.parentNode.appendChild(addSection);

    var addBtn = addSection.querySelector('#svkAddMemberBtn');
    if (addBtn) addBtn.addEventListener('click', async function() {
      var sel = document.getElementById('svkAddMemberSelect');
      var roleSel = document.getElementById('svkMemberRoleSelect');
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
        if (window.ShadowDB && window.ShadowDB.Groups && window.ShadowDB.Groups.update) {
          await window.ShadowDB.Groups.update(currentGroupId, {
            adminIds: group.adminIds || [],
            memberIds: group.memberIds || []
          });
        }
        // Update in state too
        if (window.state && window.state.groups) {
          var sg = window.state.groups.find(function(g) { return g.id === currentGroupId; });
          if (sg) { sg.adminIds = group.adminIds; sg.memberIds = group.memberIds; }
        }
        // Also update _svkAllGroups
        if (window._svkAllGroups) {
          var ag = window._svkAllGroups.find(function(g) { return g.id === currentGroupId; });
          if (ag) { ag.adminIds = group.adminIds; ag.memberIds = group.memberIds; }
        }
        enhanceMembersTabWithRealUsers(); // re-render
        var addedUser = authUsers.find(function(u) { return u.id === uid; });
        if (addedUser) {
          var pill = document.createElement('div');
          pill.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#10b981;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;z-index:99999;';
          pill.textContent = addedUser.name + ' added to group';
          document.body.appendChild(pill);
          setTimeout(function() { pill.remove(); }, 2500);
        }
      } catch(e) { alert('Could not add member: ' + e.message); }
    });
  }

  // ── Fix 9: Save all groups before filtering (so admins can manage them) ─
  function preserveAllGroups() {
    var s = window.state;
    if (!s || !s.groups) return;
    // Store a complete unfiltered copy for admin operations
    window._svkAllGroups = s.groups.slice();
  }

  // ── Fix 10: Patch the renderSidebar to show only accessible groups ─
  // The sidebar groups list is rendered by app.js. After state is filtered,
  // renderSidebar will only show accessible groups naturally.
  // But we need to make sure state is filtered BEFORE renderSidebar runs.

  // ── Boot: run all fixes in order ──────────────────────────────
  function boot() {
    var authUser = getAuthUser();
    if (!authUser) {
      // No session: nothing to fix (login screen will show)
      return;
    }

    // Fix 1: Correct state.currentUserId
    fixCurrentUserId();

    // Fix 2: Sync RBAC with real users
    syncRBACUsers();

    // Fix 6: Patch registration
    patchUserRegistration();

    // Wait for state to be populated, then apply access filter
    function applyWhenReady() {
      var s = window.state;
      if (!s || !s.groups || !s.tasks) {
        setTimeout(applyWhenReady, 200);
        return;
      }
      // Save unfiltered groups for admin access
      preserveAllGroups();
      // Fix 1 again after state loads
      fixCurrentUserId();
      // Fix 3 & 4: Filter groups and tasks
      filterStateByAccess();
      // Re-render sidebar to show filtered groups
      if (typeof window.renderSidebar === 'function') {
        window.renderSidebar();
      }
      // Fix 7: Patch render view for subsequent changes
      patchRenderView();
    }

    applyWhenReady();

    // Fix 8: Patch settings Members tab
    patchSettingsMembersTab();
  }

  // Run boot after DOM + ShadowDB are ready
  function waitAndBoot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        // Wait for ShadowDB to be ready
        if (window.ShadowDB && window.ShadowDB._sb) {
          boot();
        } else {
          document.addEventListener('shadowdb:ready', boot, { once: true });
        }
      });
    } else {
      // Wait a tick for ShadowDB
      setTimeout(function() {
        if (window.ShadowDB && window.ShadowDB._sb) {
          boot();
        } else {
          document.addEventListener('shadowdb:ready', boot, { once: true });
          // Fallback: try after 2 seconds
          setTimeout(boot, 2000);
        }
      }, 100);
    }
  }

  waitAndBoot();

  // Expose for debugging
  window.SVKUserAccess = {
    fixCurrentUserId: fixCurrentUserId,
    syncRBACUsers: syncRBACUsers,
    filterStateByAccess: filterStateByAccess,
    preserveAllGroups: preserveAllGroups,
    enhanceMembersTabWithRealUsers: enhanceMembersTabWithRealUsers,
    getAuthUser: getAuthUser,
    getAuthUsers: getAuthUsers
  };

})(); // end svkUserAccess

