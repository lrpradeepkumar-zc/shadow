// shadow-auth-gate.js
// Full authentication wall for Shadow ToDo
// Blocks ALL app content until user is authenticated
// Must be loaded BEFORE app.js in index.html
(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────
  var SESSION_KEY = 'shadow_session';
  var USERS_KEY   = 'shadow_users';
  var APP_READY_EVENT = 'shadow_app_ready';

  // ─── Helpers ─────────────────────────────────────────────────
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e) { return null; }
  }
  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }
  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch(e) { return []; }
  }
  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  function hashPass(p) {
    // Simple deterministic hash (not cryptographic - same as auth.js)
    var h = 0;
    for (var i = 0; i < p.length; i++) { h = (Math.imul(31, h) + p.charCodeAt(i)) | 0; }
    return 'h' + Math.abs(h).toString(36);
  }
  function genId() {
    return 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  function getInitials(name) {
    return (name || '').trim().split(/\s+/).map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2) || '?';
  }
  function seedAdmin() {
    var users = getUsers();
    if (!users.length) {
      users.push({
        id: 'u_admin', name: 'Admin', email: 'admin@todo.app',
        password: hashPass('admin123'), role: 'admin',
        avatar: 'A', color: '#667eea'
      });
      saveUsers(users);
    }
  }

  // ─── App shell visibility ─────────────────────────────────────
  var _appHidden = false;
  function hideApp() {
    if (_appHidden) return;
    _appHidden = true;
    var style = document.getElementById('sag-hide-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'sag-hide-style';
      style.textContent = '.top-header,.app-container,#settingsOverlay { display:none !important; }';
      document.head.appendChild(style);
    }
  }
  function showApp() {
    var style = document.getElementById('sag-hide-style');
    if (style) style.remove();
    _appHidden = false;
  }

  // ─── Auth wall DOM ────────────────────────────────────────────
  var WALL_ID = 'sag-wall';

  function buildWall() {
    var existing = document.getElementById(WALL_ID);
    if (existing) existing.remove();

    var wall = document.createElement('div');
    wall.id = WALL_ID;
    wall.style.cssText = [
      'position:fixed;inset:0;z-index:99999',
      'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)',
      'display:flex;align-items:center;justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
    ].join(';');

    wall.innerHTML = [
      '<div id="sag-card" style="background:#fff;border-radius:16px;padding:40px 36px;width:100%;max-width:420px;',
        'box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;margin:16px;">',
        // Logo
        '<div style="text-align:center;margin-bottom:24px;">',
          '<div style="width:52px;height:52px;background:linear-gradient(135deg,#667eea,#764ba2);',
            'border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">',
            '<i class="fa-solid fa-check-double" style="color:#fff;font-size:22px;"></i>',
          '</div>',
          '<h1 style="margin:0;font-size:26px;font-weight:700;color:#1a1a2e;">ToDo</h1>',
          '<p id="sag-sub" style="margin:4px 0 0;color:#64748b;font-size:14px;">Sign in to your workspace</p>',
        '</div>',

        // Tab bar
        '<div id="sag-tabs" style="display:flex;border-bottom:2px solid #f1f5f9;margin-bottom:24px;">',
          '<button id="sag-tab-login" onclick="window._sagSwitch('login')" style="flex:1;padding:10px;border:none;',
            'background:none;font-size:14px;font-weight:600;cursor:pointer;color:#667eea;',
            'border-bottom:2px solid #667eea;margin-bottom:-2px;">Sign In</button>',
          '<button id="sag-tab-register" onclick="window._sagSwitch('register')" style="flex:1;padding:10px;border:none;',
            'background:none;font-size:14px;font-weight:500;cursor:pointer;color:#94a3b8;">Register</button>',
        '</div>',

        // LOGIN FORM
        '<form id="sag-form-login" onsubmit="window._sagLogin(event)" style="display:block;">',
          '<div style="margin-bottom:16px;">',
            '<label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Email</label>',
            '<input id="sag-email" type="email" placeholder="you@company.com" required autocomplete="email"',
              ' style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;',
              'box-sizing:border-box;outline:none;transition:.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">',
          '</div>',
          '<div style="margin-bottom:8px;">',
            '<label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Password</label>',
            '<input id="sag-pass" type="password" placeholder="••••••••" required autocomplete="current-password"',
              ' style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;',
              'box-sizing:border-box;outline:none;transition:.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">',
          '</div>',
          '<div style="text-align:right;margin-bottom:20px;">',
            '<a href="#" onclick="window._sagForgot();return false;" style="font-size:12px;color:#667eea;text-decoration:none;">Forgot password?</a>',
          '</div>',
          '<p id="sag-err-login" style="color:#ef4444;font-size:13px;margin:0 0 12px;display:none;"></p>',
          '<button type="submit" id="sag-btn-login" style="width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);',
            'color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:.2s;">',
            'Sign In</button>',
        '</form>',

        // REGISTER FORM
        '<form id="sag-form-register" onsubmit="window._sagRegister(event)" style="display:none;">',
          '<div style="margin-bottom:16px;">',
            '<label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Full Name</label>',
            '<input id="sag-reg-name" type="text" placeholder="Your name" required autocomplete="name"',
              ' style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;',
              'box-sizing:border-box;outline:none;transition:.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">',
          '</div>',
          '<div style="margin-bottom:16px;">',
            '<label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Email</label>',
            '<input id="sag-reg-email" type="email" placeholder="you@company.com" required autocomplete="email"',
              ' style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;',
              'box-sizing:border-box;outline:none;transition:.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">',
          '</div>',
          '<div style="margin-bottom:20px;">',
            '<label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Password</label>',
            '<input id="sag-reg-pass" type="password" placeholder="Min. 6 characters" required autocomplete="new-password"',
              ' style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;',
              'box-sizing:border-box;outline:none;transition:.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">',
          '</div>',
          '<p id="sag-err-register" style="color:#ef4444;font-size:13px;margin:0 0 12px;display:none;"></p>',
          '<button type="submit" style="width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);',
            'color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:.2s;">',
            'Create Account</button>',
        '</form>',

        // FORGOT PASSWORD
        '<div id="sag-forgot-panel" style="display:none;">',
          '<p style="font-size:14px;color:#374151;margin-bottom:16px;">',
            'Enter your email and we'll show a temporary password reset code.</p>',
          '<div style="margin-bottom:16px;">',
            '<label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Email</label>',
            '<input id="sag-forgot-email" type="email" placeholder="you@company.com"',
              ' style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;',
              'box-sizing:border-box;outline:none;transition:.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">',
          '</div>',
          '<p id="sag-forgot-msg" style="font-size:13px;margin:0 0 12px;display:none;"></p>',
          '<button onclick="window._sagDoForgot()" style="width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);',
            'color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:8px;">',
            'Reset Password</button>',
          '<button onclick="window._sagSwitch('login')" style="width:100%;padding:10px;background:none;',
            'border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;cursor:pointer;color:#64748b;">',
            'Back to Sign In</button>',
        '</div>',

        // Footer info
        '<p style="text-align:center;margin:20px 0 0;font-size:12px;color:#94a3b8;">',
          'Your account is managed by your workspace admin.</p>',
      '</div>'
    ].join('');

    document.body.appendChild(wall);
    return wall;
  }

  // ─── Tab switching ────────────────────────────────────────────
  window._sagSwitch = function(tab) {
    var loginForm   = document.getElementById('sag-form-login');
    var regForm     = document.getElementById('sag-form-register');
    var forgotPanel = document.getElementById('sag-forgot-panel');
    var tabLogin    = document.getElementById('sag-tab-login');
    var tabReg      = document.getElementById('sag-tab-register');
    var sub         = document.getElementById('sag-sub');
    var tabs        = document.getElementById('sag-tabs');

    // Hide all
    if (loginForm)   loginForm.style.display   = 'none';
    if (regForm)     regForm.style.display      = 'none';
    if (forgotPanel) forgotPanel.style.display  = 'none';
    if (tabs)        tabs.style.display         = 'flex';

    var activeStyle   = 'flex:1;padding:10px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:#667eea;border-bottom:2px solid #667eea;margin-bottom:-2px;';
    var inactiveStyle = 'flex:1;padding:10px;border:none;background:none;font-size:14px;font-weight:500;cursor:pointer;color:#94a3b8;';

    if (tab === 'login') {
      if (loginForm)  loginForm.style.display  = 'block';
      if (tabLogin)   tabLogin.style.cssText   = activeStyle;
      if (tabReg)     tabReg.style.cssText     = inactiveStyle;
      if (sub)        sub.textContent          = 'Sign in to your workspace';
    } else if (tab === 'register') {
      if (regForm)    regForm.style.display    = 'block';
      if (tabLogin)   tabLogin.style.cssText   = inactiveStyle;
      if (tabReg)     tabReg.style.cssText     = activeStyle;
      if (sub)        sub.textContent          = 'Create your account';
    }
  };

  // ─── Login submit ─────────────────────────────────────────────
  window._sagLogin = function(e) {
    e.preventDefault();
    var email    = (document.getElementById('sag-email').value || '').trim().toLowerCase();
    var password = document.getElementById('sag-pass').value || '';
    var errEl    = document.getElementById('sag-err-login');
    var btn      = document.getElementById('sag-btn-login');

    errEl.style.display = 'none';
    btn.textContent = 'Signing in...';
    btn.disabled = true;

    var users = getUsers();
    var user  = users.find(function(u) {
      return u.email.toLowerCase() === email && u.password === hashPass(password);
    });

    setTimeout(function() { // Small delay for UX
      btn.textContent = 'Sign In';
      btn.disabled = false;

      if (!user) {
        errEl.textContent = 'Invalid email or password.';
        errEl.style.display = 'block';
        return;
      }

      setSession(user);
      onAuthSuccess(user);
    }, 300);
  };

  // ─── Register submit ──────────────────────────────────────────
  window._sagRegister = function(e) {
    e.preventDefault();
    var name     = (document.getElementById('sag-reg-name').value  || '').trim();
    var email    = (document.getElementById('sag-reg-email').value || '').trim().toLowerCase();
    var password = document.getElementById('sag-reg-pass').value || '';
    var errEl    = document.getElementById('sag-err-register');

    errEl.style.display = 'none';

    if (!name)               { errEl.textContent = 'Name is required.';         errEl.style.display='block'; return; }
    if (!email.includes('@')){ errEl.textContent = 'Valid email required.';     errEl.style.display='block'; return; }
    if (password.length < 6) { errEl.textContent = 'Password: min 6 chars.';   errEl.style.display='block'; return; }

    var users = getUsers();
    if (users.find(function(u){ return u.email.toLowerCase() === email; })) {
      errEl.textContent = 'Email already registered.';
      errEl.style.display = 'block';
      return;
    }

    var COLORS = ['#667eea','#764ba2','#f093fb','#4facfe','#43e97b','#fa709a','#fee140','#30cfd0'];
    var color  = COLORS[users.length % COLORS.length];
    var newUser = {
      id: genId(), name: name, email: email,
      password: hashPass(password),
      role: users.length === 0 ? 'admin' : 'member',
      avatar: getInitials(name), color: color
    };
    users.push(newUser);
    saveUsers(users);
    setSession(newUser);
    onAuthSuccess(newUser);
  };

  // ─── Forgot password ──────────────────────────────────────────
  window._sagForgot = function() {
    var loginForm   = document.getElementById('sag-form-login');
    var forgotPanel = document.getElementById('sag-forgot-panel');
    var tabs        = document.getElementById('sag-tabs');
    var sub         = document.getElementById('sag-sub');
    if (loginForm)   loginForm.style.display   = 'none';
    if (tabs)        tabs.style.display         = 'none';
    if (forgotPanel) forgotPanel.style.display  = 'block';
    if (sub)         sub.textContent            = 'Reset your password';
  };

  window._sagDoForgot = function() {
    var emailEl  = document.getElementById('sag-forgot-email');
    var msgEl    = document.getElementById('sag-forgot-msg');
    var email    = (emailEl ? emailEl.value : '').trim().toLowerCase();
    var users    = getUsers();
    var user     = users.find(function(u){ return u.email.toLowerCase() === email; });
    msgEl.style.display = 'block';
    if (!user) {
      msgEl.style.color = '#ef4444';
      msgEl.textContent = 'No account found with that email.';
    } else {
      // Generate a temporary password and set it
      var tempPass = 'temp' + Math.random().toString(36).slice(2, 8);
      user.password = hashPass(tempPass);
      saveUsers(users);
      msgEl.style.color = '#22c55e';
      msgEl.textContent = 'Temporary password: ' + tempPass + ' (use it to sign in, then change in profile)';
    }
  };

  // ─── Logout (global) ─────────────────────────────────────────
  window.sagLogout = function() {
    clearSession();
    // Clear app state
    if (window.state) {
      window.state.tasks = [];
      window.state.groups = [];
      window.state.currentUserId = null;
      window.state.currentUserName = null;
    }
    showLoginWall();
  };

  // ─── Auth success → launch app ────────────────────────────────
  function onAuthSuccess(user) {
    // Remove the wall
    var wall = document.getElementById(WALL_ID);
    if (wall) wall.remove();

    // Show app
    showApp();

    // Map current user into state
    function applyUser() {
      if (window.state) {
        window.state.currentUserId   = user.id;
        window.state.currentUserName = user.name;
        window.state.currentUserRole = user.role;
      }
      // Also sync with ShadowAuth if available
      if (typeof window.ShadowAuth !== 'undefined') {
        // ShadowAuth already has this session set
        if (typeof window.ShadowAuth.updateUserUI === 'function') {
          window.ShadowAuth.updateUserUI();
        }
      }
      // Update header avatar
      updateHeaderUser(user);
    }

    // Fire the app-ready event so app.js can run init()
    if (!window._sagAppStarted) {
      window._sagAppStarted = true;
      window.dispatchEvent(new CustomEvent(APP_READY_EVENT, { detail: { user: user } }));
      // Also try to trigger app init if it's already loaded
      setTimeout(function() {
        applyUser();
        if (typeof window._appInit === 'function') {
          window._appInit();
        }
      }, 100);
    } else {
      applyUser();
      // Re-render the current view
      if (typeof window.renderView === 'function') window.renderView();
      if (typeof window.renderSidebar === 'function') window.renderSidebar();
    }
  }

  // ─── Update header with user info ─────────────────────────────
  function updateHeaderUser(user) {
    // Update avatar in header
    var avatarEl = document.querySelector('.top-header .avatar');
    if (avatarEl) {
      avatarEl.textContent = getInitials(user.name);
      avatarEl.title = user.name + ' (' + user.email + ')';
      avatarEl.style.background = user.color || '#667eea';
    }

    // Add logout button if not already there
    var hdr = document.querySelector('.header-right');
    if (hdr && !document.getElementById('sag-logout-btn')) {
      var btn = document.createElement('button');
      btn.id = 'sag-logout-btn';
      btn.title = 'Sign out (' + user.name + ')';
      btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:6px 10px;border-radius:8px;' +
        'font-size:12px;font-weight:600;color:#64748b;display:flex;align-items:center;gap:4px;transition:.2s;';
      btn.innerHTML = '<i class="fa-solid fa-right-from-bracket" style="font-size:14px;"></i>';
      btn.onmouseenter = function(){ this.style.background='#f1f5f9'; this.style.color='#ef4444'; };
      btn.onmouseleave = function(){ this.style.background='none'; this.style.color='#64748b'; };
      btn.onclick = function() {
        if (confirm('Sign out of ToDo?')) window.sagLogout();
      };
      hdr.insertBefore(btn, hdr.firstChild);
    }
  }

  // ─── Show login wall ──────────────────────────────────────────
  function showLoginWall() {
    hideApp();
    // Also hide any existing shadow-auth-overlay from old auth.js
    var old = document.getElementById('shadow-auth-overlay');
    if (old) old.remove();

    if (document.body) {
      buildWall();
    } else {
      document.addEventListener('DOMContentLoaded', function() { buildWall(); });
    }
  }

  // ─── Gate: check on load ──────────────────────────────────────
  function gate() {
    var session = getSession();
    if (session && session.id && session.email) {
      // Valid session — show app
      showApp();
      // Fire auth success without rebuilding wall
      onAuthSuccess(session);
    } else {
      // No session — show login wall
      showLoginWall();
    }
  }

  // ─── Patch ShadowAuth.logout to use our gate ─────────────────
  function patchLogout() {
    if (typeof window.ShadowAuth !== 'undefined' && typeof window.ShadowAuth.logout === 'function') {
      var origLogout = window.ShadowAuth.logout;
      window.ShadowAuth.logout = function() {
        origLogout();
        showLoginWall();
      };
    }
  }

  // ─── Prevent app from loading before auth ─────────────────────
  // Override the init function exported from app.js
  // app.js calls init() at DOMContentLoaded — we block that by
  // replacing it with a guarded version
  window._sagAppStarted = false;
  window._sagGateReady  = false;

  // Intercept DOMContentLoaded to run gate first
  document.addEventListener('DOMContentLoaded', function() {
    // Immediately hide app
    hideApp();
    seedAdmin();
    gate();
    window._sagGateReady = true;
    patchLogout();
  }, true); // capture phase - runs before other DOMContentLoaded handlers

  console.log('[AuthGate] Installed');
})();
