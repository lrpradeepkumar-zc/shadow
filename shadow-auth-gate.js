// shadow-auth-gate.js
// Full authentication wall - blocks ALL app content until authenticated
// Loaded FIRST before all other scripts
(function () {
  'use strict';
  var SESSION_KEY = 'shadow_session';
  var USERS_KEY   = 'shadow_users';
  var APP_READY_EVENT = 'shadow_app_ready';

  function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e) { return null; } }
  function setSession(u) { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }
  function getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch(e) { return []; } }
  function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
  function hashPass(p) { var h=0; for(var i=0;i<p.length;i++){h=(Math.imul(31,h)+p.charCodeAt(i))|0;} return 'h_'+(h>>>0).toString(16); }
  function genId() { return 'u_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); }
  function getInitials(n) { return (n||'').trim().split(/\s+/).map(function(w){return w[0];}).join('').toUpperCase().slice(0,2)||'?'; }
  function seedAdmin() {
    var users = getUsers();
    if (!users.length) {
      users.push({ id:'u_admin', name:'Admin', email:'admin@todo.app', password:hashPass('admin123'), role:'admin', avatar:'A', color:'#667eea' });
      saveUsers(users);
    }
  }

  // App shell hide/show
  function hideApp() {
    if (!document.getElementById('sag-hide')) {
      var s = document.createElement('style');
      s.id = 'sag-hide';
      s.textContent = '.top-header,.app-container,#settingsOverlay{display:none!important}';
      document.head.appendChild(s);
    }
  }
  function showApp() { var s=document.getElementById('sag-hide'); if(s) s.remove(); }

  // Field focus helper (no inline events needed)
  function addFocusStyles(inp, focusColor, blurColor) {
    inp.addEventListener('focus', function(){ inp.style.borderColor = focusColor; });
    inp.addEventListener('blur',  function(){ inp.style.borderColor = blurColor;  });
  }

  // Create a styled input
  function mkInput(id, type, placeholder, autocomplete) {
    var inp = document.createElement('input');
    inp.id = id; inp.type = type; inp.placeholder = placeholder;
    if (autocomplete) inp.autocomplete = autocomplete;
    inp.style.cssText = 'width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;transition:.2s;';
    addFocusStyles(inp, '#667eea', '#e2e8f0');
    return inp;
  }
  function mkLabel(text) {
    var l = document.createElement('label');
    l.textContent = text;
    l.style.cssText = 'display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;';
    return l;
  }
  function mkField(labelText, input) {
    var d = document.createElement('div');
    d.style.marginBottom = '16px';
    d.appendChild(mkLabel(labelText));
    d.appendChild(input);
    return d;
  }
  function mkBtn(text, primary) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = text;
    b.style.cssText = 'width:100%;padding:12px;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:.2s;';
    if (primary) {
      b.style.background = 'linear-gradient(135deg,#667eea,#764ba2)';
      b.style.color = '#fff';
    } else {
      b.style.background = 'none';
      b.style.border = '1.5px solid #e2e8f0';
      b.style.color = '#64748b';
    }
    return b;
  }
  function mkErr(id) {
    var p = document.createElement('p');
    p.id = id; p.style.cssText = 'color:#ef4444;font-size:13px;margin:0 0 12px;display:none;';
    return p;
  }
  function showErr(errEl, msg) { errEl.textContent = msg; errEl.style.display = 'block'; }
  function hideErr(errEl) { errEl.style.display = 'none'; }

  var _wall, _formLogin, _formReg, _forgotDiv, _subEl;
  var _emailInp, _passInp, _errLogin, _loginBtn;
  var _regName, _regEmail, _regPass, _errReg;
  var _forgotEmail, _forgotMsg;
  var _tabLogin, _tabReg, _tabsDiv;

  function buildWall() {
    var old = document.getElementById('sag-wall');
    if (old) old.remove();
    var old2 = document.getElementById('shadow-auth-overlay');
    if (old2) old2.remove();

    _wall = document.createElement('div');
    _wall.id = 'sag-wall';
    _wall.style.cssText = 'position:fixed;inset:0;z-index:999999;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';

    // Card
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:16px;padding:40px 36px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.4);margin:16px;';

    // Logo area
    var logoDiv = document.createElement('div');
    logoDiv.style.cssText = 'text-align:center;margin-bottom:24px;';
    var logoIcon = document.createElement('div');
    logoIcon.style.cssText = 'width:52px;height:52px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;';
    logoIcon.innerHTML = '<i class="fa-solid fa-check-double" style="color:#fff;font-size:22px;"></i>';
    var h1 = document.createElement('h1');
    h1.textContent = 'ToDo'; h1.style.cssText = 'margin:0;font-size:26px;font-weight:700;color:#1a1a2e;';
    _subEl = document.createElement('p');
    _subEl.textContent = 'Sign in to your workspace';
    _subEl.style.cssText = 'margin:4px 0 0;color:#64748b;font-size:14px;';
    logoDiv.appendChild(logoIcon); logoDiv.appendChild(h1); logoDiv.appendChild(_subEl);

    // Tabs
    _tabsDiv = document.createElement('div');
    _tabsDiv.style.cssText = 'display:flex;border-bottom:2px solid #f1f5f9;margin-bottom:24px;';
    var activeTabStyle = 'flex:1;padding:10px;border:none;background:none;font-size:14px;font-weight:600;cursor:pointer;color:#667eea;border-bottom:2px solid #667eea;margin-bottom:-2px;';
    var inactiveTabStyle = 'flex:1;padding:10px;border:none;background:none;font-size:14px;font-weight:500;cursor:pointer;color:#94a3b8;';
    _tabLogin = document.createElement('button'); _tabLogin.type='button'; _tabLogin.textContent='Sign In'; _tabLogin.style.cssText = activeTabStyle;
    _tabReg = document.createElement('button'); _tabReg.type='button'; _tabReg.textContent='Register'; _tabReg.style.cssText = inactiveTabStyle;
    _tabLogin.addEventListener('click', function(){ switchTab('login', activeTabStyle, inactiveTabStyle); });
    _tabReg.addEventListener('click', function(){ switchTab('register', activeTabStyle, inactiveTabStyle); });
    _tabsDiv.appendChild(_tabLogin); _tabsDiv.appendChild(_tabReg);

    // LOGIN FORM
    _formLogin = document.createElement('form');
    _emailInp = mkInput('sag-email','email','you@company.com','email');
    _passInp  = mkInput('sag-pass','password','Password','current-password');
    var forgotLink = document.createElement('a'); forgotLink.href='#'; forgotLink.textContent='Forgot password?';
    forgotLink.style.cssText='font-size:12px;color:#667eea;text-decoration:none;display:block;text-align:right;margin-bottom:20px;';
    forgotLink.addEventListener('click', function(e){ e.preventDefault(); showForgotPanel(activeTabStyle, inactiveTabStyle); });
    _errLogin = mkErr('sag-err-login');
    _loginBtn = mkBtn('Sign In', true);
    _formLogin.appendChild(mkField('Email', _emailInp));
    _formLogin.appendChild(mkField('Password', _passInp));
    _formLogin.appendChild(forgotLink);
    _formLogin.appendChild(_errLogin);
    _formLogin.appendChild(_loginBtn);
    _formLogin.addEventListener('submit', function(e){ e.preventDefault(); doLogin(); });
    _loginBtn.addEventListener('click', function(){ doLogin(); });

    // REGISTER FORM
    _formReg = document.createElement('form');
    _formReg.style.display = 'none';
    _regName  = mkInput('sag-reg-name','text','Your full name','name');
    _regEmail = mkInput('sag-reg-email','email','you@company.com','email');
    _regPass  = mkInput('sag-reg-pass','password','Min 6 characters','new-password');
    _errReg = mkErr('sag-err-reg');
    var regBtn = mkBtn('Create Account', true);
    _formReg.appendChild(mkField('Full Name', _regName));
    _formReg.appendChild(mkField('Email', _regEmail));
    var passField = mkField('Password', _regPass);
    passField.style.marginBottom = '20px';
    _formReg.appendChild(passField);
    _formReg.appendChild(_errReg);
    _formReg.appendChild(regBtn);
    _formReg.addEventListener('submit', function(e){ e.preventDefault(); doRegister(); });
    regBtn.addEventListener('click', function(){ doRegister(); });

    // FORGOT PASSWORD
    _forgotDiv = document.createElement('div');
    _forgotDiv.style.display = 'none';
    var fp = document.createElement('p');
    fp.textContent = 'Enter your email to get a temporary password.';
    fp.style.cssText = 'font-size:14px;color:#374151;margin-bottom:16px;';
    _forgotEmail = mkInput('sag-forgot-email','email','you@company.com','email');
    _forgotMsg = document.createElement('p');
    _forgotMsg.style.cssText = 'font-size:13px;margin:0 0 12px;display:none;';
    var resetBtn = mkBtn('Reset Password', true); resetBtn.style.marginBottom='8px';
    var backBtn  = mkBtn('Back to Sign In', false);
    resetBtn.addEventListener('click', function(){ doForgot(); });
    backBtn.addEventListener('click', function(){ switchTab('login', activeTabStyle, inactiveTabStyle); });
    _forgotDiv.appendChild(fp);
    _forgotDiv.appendChild(mkField('Email', _forgotEmail));
    _forgotDiv.appendChild(_forgotMsg);
    _forgotDiv.appendChild(resetBtn);
    _forgotDiv.appendChild(backBtn);

    // Footer
    var footer = document.createElement('p');
    footer.textContent = 'Your account is managed by your workspace admin.';
    footer.style.cssText = 'text-align:center;margin:20px 0 0;font-size:12px;color:#94a3b8;';

    card.appendChild(logoDiv); card.appendChild(_tabsDiv);
    card.appendChild(_formLogin); card.appendChild(_formReg); card.appendChild(_forgotDiv);
    card.appendChild(footer);
    _wall.appendChild(card);
    document.body.appendChild(_wall);
  }

  function switchTab(tab, activeStyle, inactiveStyle) {
    _formLogin.style.display  = tab==='login' ? 'block' : 'none';
    _formReg.style.display    = tab==='register' ? 'block' : 'none';
    _forgotDiv.style.display  = 'none';
    _tabsDiv.style.display    = 'flex';
    _tabLogin.style.cssText   = tab==='login' ? activeStyle : inactiveStyle;
    _tabReg.style.cssText     = tab==='register' ? activeStyle : inactiveStyle;
    _subEl.textContent        = tab==='login' ? 'Sign in to your workspace' : 'Create your account';
  }

  function showForgotPanel(activeStyle, inactiveStyle) {
    _formLogin.style.display = 'none';
    _formReg.style.display   = 'none';
    _tabsDiv.style.display   = 'none';
    _forgotDiv.style.display = 'block';
    _subEl.textContent       = 'Reset your password';
  }

  function doLogin() {
    var email = (_emailInp.value||'').trim().toLowerCase();
    var pass  = _passInp.value || '';
    hideErr(_errLogin);
    _loginBtn.textContent = 'Signing in...'; _loginBtn.disabled = true;
    var users = getUsers();
    var user  = users.find(function(u){ return u.email.toLowerCase()===email && u.password===hashPass(pass); });
    setTimeout(function(){
      _loginBtn.textContent = 'Sign In'; _loginBtn.disabled = false;
      if (!user) { showErr(_errLogin, 'Invalid email or password.'); return; }
      setSession(user); onAuthSuccess(user);
    }, 300);
  }

  function doRegister() {
    var name  = (_regName.value||'').trim();
    var email = (_regEmail.value||'').trim().toLowerCase();
    var pass  = _regPass.value || '';
    hideErr(_errReg);
    if (!name)              { showErr(_errReg, 'Name is required.');         return; }
    if (!email.includes('@')){ showErr(_errReg, 'Valid email required.');    return; }
    if (pass.length < 6)    { showErr(_errReg, 'Password: min 6 chars.');   return; }
    var users = getUsers();
    if (users.find(function(u){ return u.email.toLowerCase()===email; })) {
      showErr(_errReg, 'Email already registered.'); return;
    }
    var COLORS = ['#667eea','#764ba2','#f093fb','#4facfe','#43e97b','#fa709a','#fee140','#30cfd0'];
    var newUser = { id:genId(), name:name, email:email, password:hashPass(pass),
      role: users.length===0 ? 'admin' : 'member',
      avatar: getInitials(name), color: COLORS[users.length % COLORS.length] };
    users.push(newUser); saveUsers(users);
    setSession(newUser); onAuthSuccess(newUser);
  }

  function doForgot() {
    var email = (_forgotEmail.value||'').trim().toLowerCase();
    var users = getUsers();
    var user  = users.find(function(u){ return u.email.toLowerCase()===email; });
    _forgotMsg.style.display = 'block';
    if (!user) {
      _forgotMsg.style.color = '#ef4444';
      _forgotMsg.textContent = 'No account found with that email.';
    } else {
      var tmp = 'tmp' + Math.random().toString(36).slice(2,8);
      user.password = hashPass(tmp); saveUsers(users);
      _forgotMsg.style.color = '#22c55e';
      _forgotMsg.textContent = 'Temp password: ' + tmp + ' (sign in, then update in profile)';
    }
  }

  window.sagLogout = function() {
    clearSession();
    if (window.state) { window.state.tasks=[]; window.state.groups=[]; window.state.currentUserId=null; }
    showLoginWall();
  };

  function onAuthSuccess(user) {
    var wall = document.getElementById('sag-wall');
    if (wall) wall.remove();
    showApp();
    function applyUser() {
      if (window.state) { window.state.currentUserId=user.id; window.state.currentUserName=user.name; window.state.currentUserRole=user.role; }
      if (typeof window.ShadowAuth !== 'undefined' && typeof window.ShadowAuth.updateUserUI === 'function') window.ShadowAuth.updateUserUI();
      updateHeaderUser(user);
    }
    if (!window._sagAppStarted) {
      window._sagAppStarted = true;
      window.dispatchEvent(new CustomEvent(APP_READY_EVENT, { detail: { user: user } }));
      setTimeout(function(){ applyUser(); if (typeof window._appInit==='function') window._appInit(); }, 100);
    } else {
      applyUser();
      if (typeof window.renderView==='function') window.renderView();
      if (typeof window.renderSidebar==='function') window.renderSidebar();
    }
  }

  function updateHeaderUser(user) {
    var avatarEl = document.querySelector('.top-header .avatar');
    if (avatarEl) { avatarEl.textContent=getInitials(user.name); avatarEl.title=user.name+' ('+user.email+')'; avatarEl.style.background=user.color||'#667eea'; }
    var hdr = document.querySelector('.header-right');
    if (hdr && !document.getElementById('sag-logout-btn')) {
      var btn = document.createElement('button');
      btn.id = 'sag-logout-btn'; btn.title = 'Sign out ('+user.name+')';
      btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600;color:#64748b;display:flex;align-items:center;gap:4px;transition:.2s;';
      btn.innerHTML = '<i class="fa-solid fa-right-from-bracket" style="font-size:14px;"></i>';
      btn.addEventListener('mouseenter', function(){ this.style.background='#f1f5f9'; this.style.color='#ef4444'; });
      btn.addEventListener('mouseleave', function(){ this.style.background='none'; this.style.color='#64748b'; });
      btn.addEventListener('click', function(){ if(confirm('Sign out of ToDo?')) window.sagLogout(); });
      hdr.insertBefore(btn, hdr.firstChild);
    }
  }

  function showLoginWall() {
    hideApp();
    setInterval(function(){ var o=document.getElementById('shadow-auth-overlay'); if(o) o.style.display='none'; }, 200);
    if (document.body) { buildWall(); }
    else { document.addEventListener('DOMContentLoaded', function(){ buildWall(); }); }
  }

  function gate() {
    var session = getSession();
    if (session && session.id && session.email) { showApp(); onAuthSuccess(session); }
    else { showLoginWall(); }
  }

  window._sagAppStarted = false;
  window._sagGateReady  = false;

  document.addEventListener('DOMContentLoaded', function() {
    hideApp(); seedAdmin(); gate();
    window._sagGateReady = true;
    // Patch ShadowAuth.logout
    if (typeof window.ShadowAuth !== 'undefined' && typeof window.ShadowAuth.logout === 'function') {
      var origLogout = window.ShadowAuth.logout;
      window.ShadowAuth.logout = function(){ origLogout(); showLoginWall(); };
    }
  }, true);

  console.log('[AuthGate] Installed');
})();
