/**
 * auth.js - Authentication & User Role Management for Shadow ToDo
 * Handles login, user sessions, role-based permissions
 * User Types: Group Admin, User, Group Member, Viewer
 */

const ShadowAuth = (() => {
  const ROLES = {
        ORG_ADMIN: {
      id: 'org_admin', label: 'Org Admin', icon: 'fa-crown', color: '#8e44ad',
      description: 'Organization-wide access: manage all groups, users, approvals, settings & billing',
      permissions: { createTask:true, editTask:true, deleteTask:true, completeTask:true, assignTask:true, createGroup:true, editGroup:true, deleteGroup:true, manageMembers:true, manageSettings:true, manageCustomFields:true, viewTasks:true, commentOnTask:true, manageApprovals:true, manageOrg:true, manageUsers:true, manageBilling:true }
    },
ADMIN: {
      id: 'admin', label: 'Group Admin', icon: 'fa-shield-halved', color: '#e74c3c',
      description: 'Full access: create/edit/delete tasks, manage groups, settings & members',
      permissions: { createTask:true, editTask:true, deleteTask:true, completeTask:true, assignTask:true, createGroup:true, editGroup:true, deleteGroup:true, manageMembers:true, manageSettings:true, manageCustomFields:true, viewTasks:true, commentOnTask:true, manageApprovals:true }
    },
    USER: {
      id: 'user', label: 'User', icon: 'fa-user', color: '#3498db',
      description: 'Create & manage own tasks, join groups, limited group management',
      permissions: { createTask:true, editTask:true, deleteTask:true, completeTask:true, assignTask:false, createGroup:true, editGroup:false, deleteGroup:false, manageMembers:false, manageSettings:false, manageCustomFields:false, viewTasks:true, commentOnTask:true, manageApprovals:false }
    },
    MEMBER: {
      id: 'member', label: 'Group Member', icon: 'fa-user-group', color: '#2ecc71',
      description: 'Work on assigned tasks, add comments, update task status',
      permissions: { createTask:true, editTask:true, deleteTask:false, completeTask:true, assignTask:false, createGroup:false, editGroup:false, deleteGroup:false, manageMembers:false, manageSettings:false, manageCustomFields:false, viewTasks:true, commentOnTask:true, manageApprovals:false }
    },
    VIEWER: {
      id: 'viewer', label: 'Viewer', icon: 'fa-eye', color: '#95a5a6',
      description: 'Read-only access: view tasks and groups, no editing allowed',
      permissions: { createTask:false, editTask:false, deleteTask:false, completeTask:false, assignTask:false, createGroup:false, editGroup:false, deleteGroup:false, manageMembers:false, manageSettings:false, manageCustomFields:false, viewTasks:true, commentOnTask:false, manageApprovals:false }
    }
  };

  const DEFAULT_USERS = [
        { id: 0, name: 'Maya Patel', email: 'maya@shadow.app', role: 'org_admin', avatar: 'M', color: '#8e44ad' },
{ id: 1, name: 'Pradeep Kumar', email: 'pradeep@shadow.app', role: 'admin', avatar: 'P', color: '#e74c3c' },
    { id: 2, name: 'Alex Johnson', email: 'alex@shadow.app', role: 'member', avatar: 'A', color: '#3498db' },
    { id: 3, name: 'Sarah Chen', email: 'sarah@shadow.app', role: 'user', avatar: 'S', color: '#2ecc71' },
    { id: 4, name: 'Rachel Kim', email: 'rachel@shadow.app', role: 'viewer', avatar: 'R', color: '#95a5a6' }
  ];

  let currentUser = null;

  function getSession() {
    const s = localStorage.getItem('shadow_session');
    return s ? JSON.parse(s) : null;
  }

  function setSession(user) {
    localStorage.setItem('shadow_session', JSON.stringify({
      userId: user.id, name: user.name, email: user.email,
      role: user.role, avatar: user.avatar, color: user.color,
      loginAt: new Date().toISOString()
    }));
    currentUser = user;
  }

  function clearSession() {
    localStorage.removeItem('shadow_session');
    localStorage.removeItem('shadow_onboarded');
    currentUser = null;
  }

  function isLoggedIn() { return getSession() !== null; }

  function getCurrentUser() {
    if (currentUser) return currentUser;
    const s = getSession();
    if (s) { currentUser = s; return s; }
    return null;
  }

  function getRole(roleId) {
    const key = Object.keys(ROLES).find(k => ROLES[k].id === roleId);
    return key ? ROLES[key] : ROLES.VIEWER;
  }

  function hasPermission(perm) {
    const u = getCurrentUser();
    if (!u) return false;
    return getRole(u.role).permissions[perm] === true;
  }

  function renderLoginScreen() {
    const existing = document.getElementById('shadow-login-screen');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shadow-login-screen';
    overlay.innerHTML = '<div class="login-container">' +
      '<div class="login-header">' +
        '<div class="login-logo"><i class="fas fa-check-double"></i></div>' +
        '<h1>Shadow ToDo</h1>' +
        '<p class="login-subtitle">Task Management Application</p>' +
      '</div>' +
      '<div class="login-form">' +
        '<h2>Sign In</h2>' +
        '<p class="login-desc">Choose your account to continue</p>' +
        '<div class="user-cards" id="login-user-cards">' +
          DEFAULT_USERS.map(u => {
            const role = getRole(u.role);
            return '<div class="user-card" data-user-id="' + u.id + '" tabindex="0">' +
              '<div class="user-card-avatar" style="background:' + u.color + '">' + u.avatar + '</div>' +
              '<div class="user-card-info">' +
                '<div class="user-card-name">' + u.name + '</div>' +
                '<div class="user-card-email">' + u.email + '</div>' +
              '</div>' +
              '<div class="user-card-role">' +
                '<span class="role-badge" style="background:' + role.color + '20;color:' + role.color + '">' +
                  '<i class="fas ' + role.icon + '"></i> ' + role.label +
                '</span>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="login-roles-info">' +
          '<h3>User Roles</h3>' +
          '<div class="roles-grid">' +
            Object.values(ROLES).map(r =>
              '<div class="role-info-card">' +
                '<div class="role-info-icon" style="color:' + r.color + '"><i class="fas ' + r.icon + '"></i></div>' +
                '<div class="role-info-label">' + r.label + '</div>' +
                '<div class="role-info-desc">' + r.description + '</div>' +
              '</div>'
            ).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="login-footer"><p>Shadow ToDo &copy; 2026</p></div>' +
    '</div>';

    document.body.appendChild(overlay);

    overlay.querySelectorAll('.user-card').forEach(card => {
      card.addEventListener('click', () => {
        const userId = parseInt(card.dataset.userId);
        const user = DEFAULT_USERS.find(u => u.id === userId);
        if (user) {
          card.classList.add('selected');
          setTimeout(() => login(user), 300);
        }
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });
  }

  function login(user) {
    setSession(user);
    const loginScreen = document.getElementById('shadow-login-screen');
    if (loginScreen) {
      loginScreen.classList.add('login-exit');
      setTimeout(() => {
        loginScreen.remove();
        if (!localStorage.getItem('shadow_onboarded')) {
          if (typeof ShadowOnboarding !== 'undefined') {
            ShadowOnboarding.start();
          } else {
            applyRoleRestrictions();
            updateUserUI();
          }
        } else {
          applyRoleRestrictions();
          updateUserUI();
        }
      }, 400);
    }
  }

  function logout() { clearSession(); location.reload(); }

  function applyRoleRestrictions() {
    const user = getCurrentUser();
    if (!user) return;
    const role = getRole(user.role);
    const perms = role.permissions;
    document.body.setAttribute('data-user-role', user.role);

    // Hide new task button for viewers
    const newTaskBtns = document.querySelectorAll('.new-task-btn, #new-task-btn');
    newTaskBtns.forEach(btn => {
      if (!perms.createTask) btn.style.display = 'none';
    });

    // Viewer: full read-only
    if (user.role === 'viewer') {
      const style = document.createElement('style');
      style.id = 'viewer-restrictions';
      style.textContent = '[data-user-role="viewer"] .new-task-btn,' +
        '[data-user-role="viewer"] .inline-add-task,' +
        '[data-user-role="viewer"] .add-task-row,' +
        '[data-user-role="viewer"] .board-add-btn,' +
        '[data-user-role="viewer"] .task-delete-btn,' +
        '[data-user-role="viewer"] .subtask-add,' +
        '[data-user-role="viewer"] [data-action="delete"],' +
        '[data-user-role="viewer"] .column-add-btn,' +
        '[data-user-role="viewer"] .task-edit-actions { display:none!important; }' +
        '[data-user-role="viewer"] .task-status-select,' +
        '[data-user-role="viewer"] .task-priority-select,' +
        '[data-user-role="viewer"] .task-assignee-select { pointer-events:none; opacity:0.7; }';
      document.head.appendChild(style);
    }

    // Member: no delete
    if (user.role === 'member') {
      const style = document.createElement('style');
      style.id = 'member-restrictions';
      style.textContent = '[data-user-role="member"] .task-delete-btn,' +
        '[data-user-role="member"] [data-action="delete"],' +
        '[data-user-role="member"] .group-delete-btn { display:none!important; }';
      document.head.appendChild(style);
    }
  }

  function updateUserUI() {
    const user = getCurrentUser();
    if (!user) return;
    const role = getRole(user.role);

    let userBar = document.getElementById('shadow-user-bar');
    if (!userBar) {
      userBar = document.createElement('div');
      userBar.id = 'shadow-user-bar';
      const header = document.querySelector('.app-header, header, .header');
      if (header) {
        header.parentNode.insertBefore(userBar, header.nextSibling);
      } else {
        document.body.insertBefore(userBar, document.body.firstChild);
      }
    }
    userBar.innerHTML = '<div class="user-bar-content">' +
      '<div class="user-bar-left">' +
        '<div class="user-bar-avatar" style="background:' + user.color + '">' + user.avatar + '</div>' +
        '<span class="user-bar-name">' + user.name + '</span>' +
        '<span class="user-bar-role" style="background:' + role.color + '20;color:' + role.color + '">' +
          '<i class="fas ' + role.icon + '"></i> ' + role.label +
        '</span>' +
      '</div>' +
      '<div class="user-bar-right">' +
        '<button class="user-bar-logout" onclick="ShadowAuth.logout()" title="Sign Out">' +
          '<i class="fas fa-right-from-bracket"></i> Sign Out' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function checkAuth() {
    if (!isLoggedIn()) {
      renderLoginScreen();
      return false;
    }
    applyRoleRestrictions();
    updateUserUI();
    return true;
  }

  return {
    ROLES, DEFAULT_USERS, checkAuth, isLoggedIn, getCurrentUser,
    getRole, hasPermission, login, logout, renderLoginScreen,
    applyRoleRestrictions, updateUserUI, getSession, setSession, clearSession
  };
})();

// Auto-check auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { ShadowAuth.checkAuth(); }, 100);
});
