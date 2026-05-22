/**
 * auth.js v4 — Identity only.
 * ---------------------------------------------------------------------------
 * Handles ONLY Supabase Auth: login, register, logout, profile loading.
 * Permission logic has been moved entirely to rbac.js.
 *
 * After every successful auth event this module calls RBAC._syncFromAuth()
 * so rbac.js always has the real user context.
 * ---------------------------------------------------------------------------
 */
const ShadowAuth = (() => {
  'use strict';

  const SUPABASE_URL  = 'https://ycysvoolkezntbxcfrnq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeXN2b29sa2V6bnRieGNmcm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzY5MjksImV4cCI6MjA5MjAxMjkyOX0.Y0OFF8Bdc3iSp_Bm9G7Io3Szy0amnHVuO3k8nspqxCk';

  const ROLE_COLORS = { admin: '#d946ef', user: '#3b82f6', member: '#3b82f6', guest: '#6b7280', viewer: '#6b7280' };
  const ROLE_LABELS = { admin: 'Admin', user: 'Team Member', member: 'Team Member', guest: 'Guest', viewer: 'Guest' };

  let _sb = null;
  let _cu = null;

  // ── Supabase client ───────────────────────────────────────────────────────
  function getSB() {
    if (_sb) return _sb;
    if (window.ShadowDB && ShadowDB._sb) { _sb = ShadowDB._sb; return _sb; }
    if (window.supabase && supabase.createClient) {
      _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'shadow_sb_auth' }
      });
      return _sb;
    }
    return null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getInitials(n) {
    const p = (n || '').trim().split(/\s+/);
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  function genColor(r) { return ROLE_COLORS[r] || '#3b82f6'; }

  // ── Profile loading ───────────────────────────────────────────────────────
  async function loadProfile(uid) {
    const sb = getSB();
    if (!sb || !uid) return null;
    const { data } = await sb.from('users').select('*').eq('id', uid).maybeSingle();
    return data;
  }

  async function buildCU(session) {
    if (!session || !session.user) return null;
    const uid   = session.user.id;
    const email = session.user.email;
    const p     = await loadProfile(uid);

    if (p) {
      // Normalise legacy 'member' and 'viewer' to new names
      const role = p.role === 'member' ? 'user' : (p.role === 'viewer' ? 'guest' : p.role || 'user');
      return {
        id:     uid,
        name:   p.name   || email.split('@')[0],
        email:  p.email  || email,
        role:   role,
        avatar: p.avatar || getInitials(p.name || email),
        color:  p.color  || genColor(role)
      };
    }

    const n = email ? email.split('@')[0] : 'User';
    return { id: uid, name: n, email, role: 'user', avatar: getInitials(n), color: genColor('user') };
  }

  // ── Sync with RBAC ────────────────────────────────────────────────────────
  function syncRBAC(user) {
    if (user && window.RBAC && typeof RBAC._syncFromAuth === 'function') {
      RBAC._syncFromAuth(user);
    }
  }

  // ── Public identity API ───────────────────────────────────────────────────
  function isLoggedIn()    { return !!_cu; }
  function getCurrentUser(){ return _cu; }
  function getRole()       { return _cu ? _cu.role : null; }

  async function login(email, password) {
    const sb = getSB();
    if (!sb) return { ok: false, error: 'Auth not ready' };
    const r = await sb.auth.signInWithPassword({ email, password });
    if (r.error) return { ok: false, error: r.error.message };
    _cu = await buildCU(r.data.session);
    updateUI();
    syncRBAC(_cu);
    return { ok: true, user: _cu };
  }

  async function register(name, email, password, role) {
    if (!name || !name.trim()) return { ok: false, error: 'Name is required' };
    if (!email || !email.includes('@')) return { ok: false, error: 'Valid email required' };
    if (!password || password.length < 6) return { ok: false, error: 'Password must be 6+ characters' };
    const sb = getSB();
    if (!sb) return { ok: false, error: 'Auth not ready' };
    const cnt = await sb.from('users').select('*', { count: 'exact', head: true });
    // First user becomes admin; subsequent registrations default to 'user'
    const ar = role || (cnt.count === 0 ? 'admin' : 'user');
    const r = await sb.auth.signUp({ email, password, options: { data: { name, role: ar } } });
    if (r.error) return { ok: false, error: r.error.message };
    const uid = r.data.user && r.data.user.id;
    if (uid) {
      await sb.from('users').upsert({
        id: uid, name: name.trim(), email: email.trim(),
        role: ar, avatar: getInitials(name), color: genColor(ar)
      });
    }
    if (r.data.session) {
      _cu = await buildCU(r.data.session);
      updateUI();
      syncRBAC(_cu);
    }
    return { ok: true, user: { id: uid, name: name.trim(), email, role: ar } };
  }

  async function logout() {
    const sb = getSB();
    if (sb) await sb.auth.signOut();
    _cu = null;
    // Remove only shadow-specific keys; never touch third-party entries
    ['shadow_session', 'shadow_rbac_current_user'].forEach(k => localStorage.removeItem(k));
    location.reload();
  }

  // ── Org member management (admin-only) ───────────────────────────────────
  async function getOrgMembers() {
    const sb = getSB();
    if (!sb) return [];
    const { data } = await sb.from('users').select('*').order('name');
    return (data || []).map(u => ({
      id:     u.id,
      name:   u.name,
      email:  u.email,
      avatar: u.avatar || getInitials(u.name),
      color:  u.color  || genColor(u.role),
      role:   u.role
    }));
  }

  async function adminCreateUser(n, e, p, r) {
    if (!window.RBAC || !RBAC.can(RBAC.Perms.ORG_INVITE_USER)) {
      return { ok: false, error: 'Permission denied' };
    }
    return register(n, e, p || 'Shadow2025!', r || 'user');
  }

  async function adminUpdateUser(id, upd) {
    if (!window.RBAC || !RBAC.can(RBAC.Perms.ORG_CHANGE_USER_ROLE)) {
      return { ok: false, error: 'Permission denied' };
    }
    const sb = getSB();
    const o = {};
    if (upd.name) { o.name = upd.name; o.avatar = getInitials(upd.name); }
    if (upd.role) { o.role = upd.role; o.color  = genColor(upd.role); }
    const { error } = await sb.from('users').update(o).eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function adminDeleteUser(id) {
    if (!window.RBAC || !RBAC.can(RBAC.Perms.ORG_REVOKE_USER)) {
      return { ok: false, error: 'Permission denied' };
    }
    if (_cu && _cu.id === id) return { ok: false, error: 'Cannot delete yourself' };
    const sb = getSB();
    const { error } = await sb.from('users').delete().eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function updateUI() {
    const u = _cu;
    if (!u) return;
    const el = document.querySelector('.avatar');
    if (el) {
      el.textContent = u.avatar || u.name[0].toUpperCase();
      el.title       = u.name + ' (' + (ROLE_LABELS[u.role] || u.role) + ')';
      el.style.background = u.color || '#3b82f6';
      el.style.cursor     = 'pointer';
      el.onclick = () => ShadowAuth.logout();
    }
    if (window.state) {
      state.currentUserName = u.name;
      state.currentUserId   = u.id;
      state.currentUserRole = u.role;
    }
  }

  // ── Auth initialisation (called by shadow-auth-gate.js via shadow_app_ready) ─
  async function checkAuth() {
    // shadow-auth-gate.js owns the session gate; this is just a profile sync.
    let tries = 0;
    while (!getSB() && tries++ < 40) await new Promise(r => setTimeout(r, 150));
    const sb = getSB();
    if (!sb) return false;
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      _cu = await buildCU(session);
      if (_cu) {
        updateUI();
        syncRBAC(_cu);
        // Listen for future auth state changes
        sb.auth.onAuthStateChange(async (event, sess) => {
          if (event === 'SIGNED_OUT') { _cu = null; }
          else if (sess) { _cu = await buildCU(sess); updateUI(); syncRBAC(_cu); }
        });
        return true;
      }
    }
    return false;
  }

  // ── Backward-compat stubs ─────────────────────────────────────────────────
  // hasPermission() is removed — use RBAC.can() directly.
  // Kept as a warning shim so existing call-sites don't silently pass.
  function hasPermission(perm) {
    console.warn('[ShadowAuth] hasPermission() is deprecated. Use RBAC.can() instead. Perm:', perm);
    if (!window.RBAC) return false;
    // Map old camelCase keys to new Perms
    const legacyMap = {
      createTask:   RBAC.Perms.TASK_CREATE,
      editTask:     RBAC.Perms.TASK_UPDATE,
      deleteTask:   RBAC.Perms.TASK_DELETE,
      createGroup:  RBAC.Perms.GROUP_CREATE,
      editGroup:    RBAC.Perms.GROUP_EDIT_SETTINGS,
      deleteGroup:  RBAC.Perms.GROUP_DELETE,
      assignTask:   RBAC.Perms.TASK_ASSIGN,
      manageUsers:  RBAC.Perms.ORG_INVITE_USER,
      viewAll:      RBAC.Perms.ORG_MANAGE
    };
    return RBAC.can(legacyMap[perm] || perm);
  }

  function getUsers()   { return []; }
  function saveUsers()  {}
  function getPerms()   { return window.RBAC ? RBAC.PermissionMatrix : {}; }
  function savePerms()  {}
  function getSession() { return _cu; }
  function setSession() {}
  function clearSession() { localStorage.removeItem('shadow_session'); }
  function genId() { return 'u_' + Date.now(); }
  function hashPass(p) { return p; }

  document.addEventListener('DOMContentLoaded', () => ShadowAuth.checkAuth());

  return {
    // Identity
    checkAuth, isLoggedIn, getCurrentUser, getRole,
    login, logout, register, updateUserUI: updateUI,
    // Org management
    getOrgMembers, adminCreateUser, adminUpdateUser, adminDeleteUser,
    adminUpdatePerms: () => ({ ok: true }),
    // Backward-compat
    hasPermission,
    getUsers, saveUsers, getPerms, savePerms,
    getSession, setSession, clearSession,
    genId, hashPass, getInitials,
    ROLE_LABELS, ROLE_COLORS,
    // Removed — kept as null so destructured references don't crash
    DEFAULT_PERMS: null,
    DEFAULT_USER:  null
  };
})();
