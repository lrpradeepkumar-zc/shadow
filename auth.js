/**
 * auth.js — Shadow ToDo Authentication System
 * Features:
 *   - Login / Register screen
 *   - localStorage-based user store
 *   - Roles: admin | member | viewer
 *   - Permissions per role (configurable by admin)
 *   - Session management
 *   - Integrates with state.members for assignee/group pickers
 */
const ShadowAuth = (() => {
  const SESSION_KEY  = 'shadow_session';
  const USERS_KEY    = 'shadow_users';
  const PERMS_KEY    = 'shadow_perms';

  // ── Default role permissions ──────────────────────────────────────────────
  const DEFAULT_PERMS = {
    admin:  { createTask:true, editTask:true, deleteTask:true, createGroup:true, editGroup:true, deleteGroup:true, assignTask:true, manageUsers:true, viewAll:true },
    member: { createTask:true, editTask:true, deleteTask:false, createGroup:true, editGroup:true, deleteGroup:false, assignTask:true, manageUsers:false, viewAll:false },
    viewer: { createTask:false, editTask:false, deleteTask:false, createGroup:false, editGroup:false, deleteGroup:false, assignTask:false, manageUsers:false, viewAll:false }
  };

  const ROLE_COLORS = { admin: '#667eea', member: '#48bb78', viewer: '#ed8936' };
  const ROLE_LABELS = { admin: 'Admin', member: 'Member', viewer: 'Viewer' };

  // ── Persistence helpers ───────────────────────────────────────────────────
  function getPerms() {
    try { return JSON.parse(localStorage.getItem(PERMS_KEY)) || DEFAULT_PERMS; }
    catch { return DEFAULT_PERMS; }
  }

  function savePerms(p) { localStorage.setItem(PERMS_KEY, JSON.stringify(p)); }

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  }

  function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

  function getSession() {
    try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; }
    catch { return null; }
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      id: user.id, name: user.name, email: user.email,
      avatar: user.avatar, color: user.color, role: user.role
    }));
  }

  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  // ── User helpers ──────────────────────────────────────────────────────────
  function genId() { return 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

  function getInitials(name) {
    const parts = (name || '').trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function hashPass(p) {
    // Simple deterministic hash (not cryptographic — client-only demo)
    let h = 0;
    for (let i = 0; i < p.length; i++) { h = (Math.imul(31, h) + p.charCodeAt(i)) | 0; }
    return 'h_' + (h >>> 0).toString(16);
  }

  function seedAdminIfEmpty() {
    const users = getUsers();
    if (!users.length) {
      const admin = {
        id: genId(), name: 'Admin', email: 'admin@todo.app',
        password: hashPass('admin123'), role: 'admin',
        avatar: 'A', color: '#667eea', createdAt: Date.now()
      };
      saveUsers([admin]);
    }
  }

  // ── Public auth API ───────────────────────────────────────────────────────
  function isLoggedIn()     { return !!getSession(); }
  function getCurrentUser() { return getSession(); }
  function getRole()        { const s = getSession(); return s ? s.role : null; }

  function hasPermission(perm) {
    const role = getRole();
    if (!role) return false;
    const perms = getPerms();
    return !!(perms[role] && perms[role][perm]);
  }

  function login(email, password) {
    const users = getUsers();
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === hashPass(password));
    if (!user) return { ok: false, error: 'Invalid email or password' };
    setSession(user);
    return { ok: true, user };
  }

  function register(name, email, password, noLogin) {
    if (!name.trim()) return { ok: false, error: 'Name is required' };
    if (!email.trim() || !email.includes('@')) return { ok: false, error: 'Valid email required' };
    if (!password || password.length < 6) return { ok: false, error: 'Password must be 6+ characters' };
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return { ok: false, error: 'Email already registered' };
    // First user gets admin role automatically
    const role   = users.length === 0 ? 'admin' : 'member';
    const newUser = {
      id: genId(), name: name.trim(), email: email.trim(),
      password: hashPass(password), role,
      avatar: getInitials(name), color: ROLE_COLORS[role], createdAt: Date.now()
    };
    users.push(newUser);
    saveUsers(users);
    if (!noLogin) setSession(newUser);
    return { ok: true, user: newUser };
  }

  function logout() { clearSession(); location.reload(); }

  // ── Members API (used by app.js state.members) ────────────────────────────
  function getOrgMembers() {
    return getUsers().map(u => ({
      id: u.id, name: u.name, email: u.email,
      avatar: u.avatar, color: u.color, role: u.role
    }));
  }

  // ── Admin: user management ────────────────────────────────────────────────
  function adminCreateUser(name, email, password, role) {
    if (!hasPermission('manageUsers')) return { ok: false, error: 'Permission denied' };
    return register(name, email, password.length >= 6 ? password : 'shadow123');
  }

  function adminUpdateUser(id, updates) {
    if (!hasPermission('manageUsers')) return { ok: false, error: 'Permission denied' };
    const users = getUsers();
    const idx   = users.findIndex(u => u.id === id);
    if (idx === -1) return { ok: false, error: 'User not found' };
    // Prevent removing last admin
    if (updates.role && updates.role !== 'admin') {
      const admins = users.filter(u => u.role === 'admin');
      if (admins.length === 1 && users[idx].role === 'admin') {
        return { ok: false, error: 'Cannot remove last admin' };
      }
    }
    users[idx] = { ...users[idx], ...updates };
    if (updates.name) {
      users[idx].avatar  = getInitials(updates.name);
    }
    if (updates.role) { users[idx].color = ROLE_COLORS[updates.role] || users[idx].color; }
    if (updates.password) { users[idx].password = hashPass(updates.password); delete users[idx].password_plain; }
    saveUsers(users);
    return { ok: true, user: users[idx] };
  }

  function adminDeleteUser(id) {
    if (!hasPermission('manageUsers')) return { ok: false, error: 'Permission denied' };
    const users  = getUsers();
    const target = users.find(u => u.id === id);
    if (!target) return { ok: false, error: 'User not found' };
    // Prevent deleting self
    const sess = getSession();
    if (sess && sess.id === id) return { ok: false, error: 'Cannot delete your own account' };
    // Prevent removing last admin
    if (target.role === 'admin' && users.filter(u => u.role === 'admin').length === 1) {
      return { ok: false, error: 'Cannot delete the last admin' };
    }
    saveUsers(users.filter(u => u.id !== id));
    return { ok: true };
  }

  function adminUpdatePerms(role, perm, value) {
    if (!hasPermission('manageUsers')) return { ok: false, error: 'Permission denied' };
    const perms = getPerms();
    if (!perms[role]) return { ok: false, error: 'Unknown role' };
    perms[role][perm] = value;
    savePerms(perms);
    return { ok: true };
  }

  // ── Login Screen UI ───────────────────────────────────────────────────────
  function renderLoginScreen() {
    // Remove existing if any
    document.getElementById('shadow-auth-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'shadow-auth-overlay';
    overlay.innerHTML = `
      <div class="sa-card">
        <div class="sa-logo"><i class="fa-solid fa-check-double"></i></div>
        <h1 class="sa-title">ToDo</h1>
        <p class="sa-sub" id="sa-sub">Sign in to your workspace</p>

        <div class="sa-tabs">
          <button class="sa-tab active" id="sa-tab-login" onclick="ShadowAuth._switchTab('login')">Sign In</button>
          <button class="sa-tab" id="sa-tab-register" onclick="ShadowAuth._switchTab('register')">Register</button>
        </div>

        <!-- Login form -->
        <form class="sa-form" id="sa-form-login">
          <div class="sa-field">
            <label>Email</label>
            <input type="email" id="sa-login-email" placeholder="Enter your email" required autocomplete="email">
          </div>
          <div class="sa-field">
            <label>Password</label>
            <input type="password" id="sa-login-pass" placeholder="Enter your password" required autocomplete="current-password">
          </div>
          <p class="sa-error" id="sa-login-error"></p>
          <button type="button" class="sa-btn-primary" onclick="ShadowAuth._submitLogin(event)">Sign In</button>
        </form>

        <!-- Register form -->
        <form class="sa-form" id="sa-form-register" style="display:none">
          <div class="sa-field">
            <label>Full Name</label>
            <input type="text" id="sa-reg-name" placeholder="Your full name" required>
          </div>
          <div class="sa-field">
            <label>Email</label>
            <input type="email" id="sa-reg-email" placeholder="Your work email" required autocomplete="email">
          </div>
          <div class="sa-field">
            <label>Password</label>
            <input type="password" id="sa-reg-pass" placeholder="Min. 6 characters" required>
          </div>
          <p class="sa-error" id="sa-reg-error"></p>
          <button type="button" class="sa-btn-primary" onclick="ShadowAuth._submitRegister(event)">Create Account</button>
        </form>

        <p class="sa-hint" id="sa-hint">Default admin: admin@todo.app / admin123</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function _switchTab(tab) {
    document.getElementById('sa-form-login').style.display     = tab === 'login'    ? '' : 'none';
    document.getElementById('sa-form-register').style.display  = tab === 'register' ? '' : 'none';
    document.getElementById('sa-tab-login').classList.toggle('active',    tab === 'login');
    document.getElementById('sa-tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('sa-sub').textContent = tab === 'login' ? 'Sign in to your workspace' : 'Create a new account';
    document.getElementById('sa-hint').style.display = tab === 'login' ? '' : 'none';
  }

  function _submitLogin(e) {
    e.preventDefault();
    const email = document.getElementById('sa-login-email').value.trim();
    const pass  = document.getElementById('sa-login-pass').value;
    const errEl = document.getElementById('sa-login-error');
    const res   = login(email, pass);
    if (!res.ok) { errEl.textContent = res.error; return; }
    document.getElementById('shadow-auth-overlay')?.remove();
    location.reload();
  }

  function _submitRegister(e) {
    e.preventDefault();
    const name  = document.getElementById('sa-reg-name').value.trim();
    const email = document.getElementById('sa-reg-email').value.trim();
    const pass  = document.getElementById('sa-reg-pass').value;
    const errEl = document.getElementById('sa-reg-error');
    const res   = register(name, email, pass);
    if (!res.ok) { errEl.textContent = res.error; return; }
    document.getElementById('shadow-auth-overlay')?.remove();
    location.reload();
  }

  // ── User bar (header avatar) ──────────────────────────────────────────────
  function updateUserUI() {
    const user = getCurrentUser();
    if (!user) return;
    const avatarEl = document.querySelector('.avatar[title="Profile"]');
    if (avatarEl) {
      avatarEl.textContent   = user.avatar || user.name[0].toUpperCase();
      avatarEl.title         = user.name + ' (' + ROLE_LABELS[user.role] + ')';
      avatarEl.style.background = user.color || '#667eea';
      avatarEl.style.cursor  = 'pointer';
      avatarEl.onclick       = () => ShadowAuth.logout();
    }
  }

  // ── checkAuth entry point ─────────────────────────────────────────────────
  function checkAuth() {
    seedAdminIfEmpty();
    if (!isLoggedIn()) {
      renderLoginScreen();
      return false;
    }
    updateUserUI();
    return true;
  }

  // ── Compatibility stubs ───────────────────────────────────────────────────
  const DEFAULT_USER = null; // no anonymous user

  return {
    DEFAULT_USER, checkAuth, isLoggedIn, getCurrentUser,
    getRole, hasPermission, login, logout, register,
    renderLoginScreen, updateUserUI,
    getSession, setSession, clearSession,
    getOrgMembers,
    adminCreateUser, adminUpdateUser, adminDeleteUser, adminUpdatePerms,
    getUsers, saveUsers, getPerms, savePerms,
    ROLE_LABELS, ROLE_COLORS, DEFAULT_PERMS, hashPass, getInitials, genId,
    _switchTab, _submitLogin, _submitRegister
  };
})();

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  ShadowAuth.checkAuth();
});
