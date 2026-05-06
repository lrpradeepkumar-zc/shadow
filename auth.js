/**
 * auth.js - Authentication for Shadow ToDo
 * Single-user mode: no login screen, no user bar.
 * A single anonymous session is auto-initialized on load.
 */
const ShadowAuth = (() => {
  const SESSION_KEY = 'shadow_session';

  // Single default anonymous user (no mock users, no selection screen)
  const DEFAULT_USER = { id: 0, name: 'Me', email: '', avatar: 'M', color: '#667eea' };

  function getSession() {
    const s = localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      userId: user.id, name: user.name, email: user.email,
      avatar: user.avatar, color: user.color
    }));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function getCurrentUser() {
    return getSession();
  }

  function login(user) {
    setSession(user || DEFAULT_USER);
  }

  function logout() {
    clearSession();
    location.reload();
  }

  // No-op stubs kept for compatibility
  function renderLoginScreen() {}
  function updateUserUI() {}
  function getRole() { return null; }
  function hasPermission() { return true; }

  function checkAuth() {
    if (!isLoggedIn()) {
      // Auto-login as default single user — no UI
      setSession(DEFAULT_USER);
    }
    return true;
  }

  return {
    DEFAULT_USER, checkAuth, isLoggedIn, getCurrentUser,
    getRole, hasPermission, login, logout, renderLoginScreen,
    updateUserUI, getSession, setSession, clearSession
  };
})();

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  ShadowAuth.checkAuth();
});
