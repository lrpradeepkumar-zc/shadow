// shadow-auth-gate.js
// Authentication wall â uses ONLY Supabase Auth (no localStorage users)
// Loaded FIRST before all other scripts
(function () {
  'use strict';

  var SESSION_KEY    = 'shadow_session';
  var APP_READY_EVENT = 'shadow_app_ready';

  // Session helpers â stored as simple metadata only (no passwords ever)
  function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(e) { return null; } }
  function setSession(u) { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  // Helpers
  function getInitials(n) { return (n||'').trim().split(/\s+/).map(function(w){return w[0];}).join('').toUpperCase().slice(0,2)||'?'; }

  // App shell show / hide
  function hideApp() {
    if (!document.getElementById('sag-hide')) {
      var s = document.createElement('style');
      s.id = 'sag-hide';
      s.textContent = '.top-header,.app-container,#settingsOverlay{display:none!important}';
      document.head.appendChild(s);
    }
  }
  function showApp() { var s=document.getElementById('sag-hide'); if(s) s.remove(); }

  // ââ UI helpers âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function addFocusStyles(inp, focusColor, blurColor) {
    inp.addEventListener('focus', function() { inp.style.borderColor = focusColor; inp.style.boxShadow = '0 0 0 3px '+focusColor+'33'; });
    inp.addEventListener('blur',  function() { inp.style.borderColor = blurColor;  inp.style.boxShadow = 'none'; });
  }
  function mkInput(id, type, placeholder, autocomplete) {
    var i = document.createElement('input');
    i.id = id; i.type = type; i.placeholder = placeholder;
    i.autocomplete = autocomplete || 'off';
    Object.assign(i.style, {width:'100%',padding:'12px 16px',border:'2px solid #e2e8f0',borderRadius:'10px',
      fontSize:'14px',outline:'none',boxSizing:'border-box',transition:'border-color .2s,box-shadow .2s',background:'#fff',color:'#2d3748'});
    addFocusStyles(i, '#667eea', '#e2e8f0');
    return i;
  }
  function mkLabel(text) {
    var l = document.createElement('label');
    l.textContent = text;
    Object.assign(l.style, {fontSize:'13px',fontWeight:'600',color:'#4a5568',marginBottom:'6px',display:'block'});
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
    b.textContent = text; b.type = 'button';
    Object.assign(b.style, {width:'100%',padding:'13px',border:'none',borderRadius:'10px',fontSize:'14px',
      fontWeight:'600',cursor:'pointer',transition:'all .2s',marginBottom:'8px',
      background: primary ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#f7fafc',
      color: primary ? '#fff' : '#4a5568'});
    if (primary) {
      b.addEventListener('mouseenter', function(){ b.style.transform='translateY(-1px)'; b.style.boxShadow='0 4px 15px rgba(102,126,234,.4)'; });
      b.addEventListener('mouseleave', function(){ b.style.transform=''; b.style.boxShadow=''; });
    }
    return b;
  }
  function mkErr(id) {
    var e = document.createElement('div');
    e.id = id;
    Object.assign(e.style, {color:'#e53e3e',fontSize:'13px',padding:'10px 14px',background:'#fff5f5',
      border:'1px solid #fed7d7',borderRadius:'8px',marginBottom:'12px',display:'none'});
    return e;
  }

  // ââ Login wall âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  var _emailInp, _passInp, _errLogin;

  function buildWall() {
    var existing = document.getElementById('sag-wall');
    if (existing) return;

    var overlay = document.createElement('div');
    overlay.id = 'sag-wall';
    Object.assign(overlay.style, {position:'fixed',inset:'0',display:'flex',alignItems:'center',
      justifyContent:'center',background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',zIndex:'99999',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'});

    var card = document.createElement('div');
    Object.assign(card.style, {background:'#fff',borderRadius:'20px',padding:'40px',width:'100%',
      maxWidth:'420px',boxShadow:'0 25px 50px rgba(0,0,0,.25)',boxSizing:'border-box'});

    var title = document.createElement('h1');
    title.textContent = '\u2713 ToDo';
    Object.assign(title.style, {margin:'0 0 6px',fontSize:'28px',fontWeight:'700',
      background:'linear-gradient(135deg,#667eea,#764ba2)',WebkitBackgroundClip:'text',
      WebkitTextFillColor:'transparent',backgroundClip:'text'});
    var sub = document.createElement('p');
    sub.textContent = 'Sign in to your account';
    Object.assign(sub.style, {margin:'0 0 28px',fontSize:'14px',color:'#718096'});

    _emailInp = mkInput('sag-email','email','Email address','email');
    _passInp  = mkInput('sag-pass','password','Password','current-password');
    _errLogin = mkErr('sag-err-login');

    var loginBtn = mkBtn('Sign In', true);
    loginBtn.addEventListener('click', doLogin);

    function onEnter(e) { if (e.key === 'Enter') doLogin(); }
    _emailInp.addEventListener('keydown', onEnter);
    _passInp.addEventListener('keydown', onEnter);

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(_errLogin);
    card.appendChild(mkField('Email', _emailInp));
    card.appendChild(mkField('Password', _passInp));
    card.appendChild(loginBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    setTimeout(function(){ _emailInp.focus(); }, 100);
  }

  function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }
  function hideErr(el) { el.style.display = 'none'; }

  // ââ Supabase-only login âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function doLogin() {
    var email = (_emailInp.value||'').trim().toLowerCase();
    var pass  = (_passInp.value||'');
    hideErr(_errLogin);
    if (!email) { showErr(_errLogin, 'Email is required.'); return; }
    if (!pass)  { showErr(_errLogin, 'Password is required.'); return; }

    var sbClient = window.ShadowDB && window.ShadowDB._sb;
    if (!sbClient) {
      showErr(_errLogin, 'Auth service not ready â please wait and try again.');
      return;
    }

    var loginBtn = document.querySelector('#sag-wall button');
    if (loginBtn) { loginBtn.textContent = 'Signing inâ¦'; loginBtn.disabled = true; }

    sbClient.auth.signInWithPassword({ email: email, password: pass })
      .then(function(result) {
        if (loginBtn) { loginBtn.textContent = 'Sign In'; loginBtn.disabled = false; }
        if (result.error || !result.data.user) {
          showErr(_errLogin, result.error ? result.error.message : 'Invalid email or password.');
          return;
        }
        var sbUser = result.data.user;
        var meta   = sbUser.user_metadata || {};
        var name   = meta.name || sbUser.email.split('@')[0];
        var user   = { id: sbUser.id, name: name, email: sbUser.email, role: meta.role || 'member',
                       avatar: getInitials(name), color: meta.color || '#667eea' };
        sbClient.from('users').select('name,role,avatar,color').eq('id', sbUser.id).maybeSingle()
          .then(function(pr) {
            if (pr.data) {
              user.name   = pr.data.name   || user.name;
              user.role   = pr.data.role   || user.role;
              user.avatar = pr.data.avatar || user.avatar;
              user.color  = pr.data.color  || user.color;
            }
            setSession(user);
            location.reload();
          })
          .catch(function() { setSession(user); onAuthSuccess(user); });
      })
      .catch(function(err) {
        if (loginBtn) { loginBtn.textContent = 'Sign In'; loginBtn.disabled = false; }
        showErr(_errLogin, err.message || 'Sign-in failed. Please try again.');
      });
  }

  // ââ Post-login âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  function onAuthSuccess(user) {
    var wall = document.getElementById('sag-wall');
    if (wall) wall.remove();
    showApp();
    if (!window._sagAppStarted) {
      window._sagAppStarted = true;
      window.dispatchEvent(new CustomEvent(APP_READY_EVENT, { detail: { user: user } }));
    }
    updateHeaderUser(user);
  }

  function updateHeaderUser(user) {
    var hdr = document.querySelector('.top-header');
    if (hdr && !document.getElementById('sag-logout-btn')) {
      var btn = document.createElement('button');
      btn.id = 'sag-logout-btn';
      btn.textContent = '\u2190 Sign Out';
      Object.assign(btn.style, {marginRight:'8px',padding:'6px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',
        background:'#fff',cursor:'pointer',fontSize:'12px',color:'#4a5568',fontWeight:'500'});
      btn.addEventListener('click', function(){ if(confirm('Sign out of ToDo?')) window.sagLogout(); });
      hdr.insertBefore(btn, hdr.firstChild);
    }
  }

  function showLoginWall() {
    hideApp();
    if (document.body) { buildWall(); }
    else { document.addEventListener('DOMContentLoaded', function(){ buildWall(); }); }
  }

  function gate() {
    var session = getSession();
    if (session && session.id && session.email) { showApp(); onAuthSuccess(session); }
    else { showLoginWall(); }
  }

  // ââ Global logout âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  window.sagLogout = function() {
    clearSession();
    var sb = window.ShadowDB && window.ShadowDB._sb;
    var doSignOut = sb ? sb.auth.signOut() : Promise.resolve();
    doSignOut.finally(function() { location.reload(); });
  };

  // ââ Boot âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  document.addEventListener('DOMContentLoaded', function() {
    hideApp(); gate();
    setTimeout(function() {
      if (window.ShadowAuth && window.ShadowAuth.logout) {
        var orig = window.ShadowAuth.logout;
        window.ShadowAuth.logout = function() { clearSession(); return orig.apply(this, arguments); };
      }
    }, 500);
  }, true);

  // Handle Supabase token expiry
  document.addEventListener('DOMContentLoaded', function() {
    var waitForSB = setInterval(function() {
      var sb = window.ShadowDB && window.ShadowDB._sb;
      if (!sb) return;
      clearInterval(waitForSB);
      sb.auth.onAuthStateChange(function(event, session) {
        if (event === 'SIGNED_OUT') { clearSession(); showLoginWall(); }
      });
    }, 500);
  });

  console.log('[AuthGate] Supabase-only auth installed');
})();
