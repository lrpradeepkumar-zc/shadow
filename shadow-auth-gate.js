/**
 * shadow-auth-gate.js v2
 * ---------------------------------------------------------------------------
 * Authentication wall. Loaded FIRST (before all other scripts).
 *
 * Gate logic:
 *   1. Immediately hide the app shell (CSS inject).
 *   2. Wait for ShadowDB / Supabase client to be available.
 *   3. Call sbClient.auth.getSession() — the ONLY source of truth.
 *   4a. Valid session → fetch profile, sync RBAC, show app.
 *   4b. No session   → show login wall.
 *
 * localStorage is used ONLY as a fast-path UX hint (to prevent the login
 * wall flashing on returning users while Supabase resolves).  It is NOT
 * trusted for access decisions — Supabase session validation always runs.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var APP_READY_EVENT = 'shadow_app_ready';
  var SESSION_HINT_KEY = 'shadow_session_hint'; // fast-path hint only (non-authoritative)

  // ── App shell visibility ──────────────────────────────────────────────────
  function hideApp() {
    if (!document.getElementById('sag-hide')) {
      var s = document.createElement('style');
      s.id = 'sag-hide';
      s.textContent = '.top-header,.app-container,#settingsOverlay{display:none!important}';
      document.head.appendChild(s);
    }
  }
  function showApp() { var s = document.getElementById('sag-hide'); if (s) s.remove(); }

  // ── Fast-path hint helpers (UX only, not security) ────────────────────────
  function getHint()   { try { return JSON.parse(localStorage.getItem(SESSION_HINT_KEY) || 'null'); } catch(_) { return null; } }
  function setHint(u)  { try { localStorage.setItem(SESSION_HINT_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email, role: u.role })); } catch(_) {} }
  function clearHint() { try { localStorage.removeItem(SESSION_HINT_KEY); localStorage.removeItem('shadow_session'); } catch(_) {} }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function addFocusStyles(inp, fc, bc) {
    inp.addEventListener('focus', function () { inp.style.borderColor = fc; inp.style.boxShadow = '0 0 0 3px ' + fc + '33'; });
    inp.addEventListener('blur',  function () { inp.style.borderColor = bc; inp.style.boxShadow = 'none'; });
  }
  function mkInput(id, type, placeholder, ac) {
    var i = document.createElement('input');
    i.id = id; i.type = type; i.placeholder = placeholder; i.autocomplete = ac || 'off';
    Object.assign(i.style, { width:'100%', padding:'12px 16px', border:'2px solid #e2e8f0',
      borderRadius:'10px', fontSize:'14px', outline:'none', boxSizing:'border-box',
      transition:'border-color .2s,box-shadow .2s', background:'#fff', color:'#2d3748' });
    addFocusStyles(i, '#667eea', '#e2e8f0');
    return i;
  }
  function mkLabel(text) {
    var l = document.createElement('label');
    l.textContent = text;
    Object.assign(l.style, { fontSize:'13px', fontWeight:'600', color:'#4a5568', marginBottom:'6px', display:'block' });
    return l;
  }
  function mkField(labelText, input) {
    var d = document.createElement('div'); d.style.marginBottom = '16px';
    d.appendChild(mkLabel(labelText)); d.appendChild(input); return d;
  }
  function mkBtn(text, primary) {
    var b = document.createElement('button');
    b.textContent = text; b.type = 'button';
    Object.assign(b.style, { width:'100%', padding:'13px', border:'none', borderRadius:'10px',
      fontSize:'14px', fontWeight:'600', cursor:'pointer', transition:'all .2s', marginBottom:'8px',
      background: primary ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#f7fafc',
      color: primary ? '#fff' : '#4a5568' });
    if (primary) {
      b.addEventListener('mouseenter', function () { b.style.transform = 'translateY(-1px)'; b.style.boxShadow = '0 4px 15px rgba(102,126,234,.4)'; });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; b.style.boxShadow = ''; });
    }
    return b;
  }
  function mkErr(id) {
    var e = document.createElement('div'); e.id = id;
    Object.assign(e.style, { color:'#e53e3e', fontSize:'13px', padding:'10px 14px',
      background:'#fff5f5', border:'1px solid #fed7d7', borderRadius:'8px',
      marginBottom:'12px', display:'none' });
    return e;
  }
  function mkSpinner() {
    var d = document.createElement('div');
    Object.assign(d.style, { position:'fixed', inset:'0', display:'flex', alignItems:'center',
      justifyContent:'center', background:'linear-gradient(135deg,#667eea,#764ba2)', zIndex:'99998' });
    d.innerHTML = '<div style="width:44px;height:44px;border:4px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sag-spin .8s linear infinite"></div>';
    d.id = 'sag-spinner';
    if (!document.getElementById('sag-spin-kf')) {
      var st = document.createElement('style');
      st.id = 'sag-spin-kf';
      st.textContent = '@keyframes sag-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    return d;
  }

  // ── Login wall ────────────────────────────────────────────────────────────
  var _emailInp, _passInp, _errLogin;

  function buildWall() {
    if (document.getElementById('sag-wall')) return;
    var spinner = document.getElementById('sag-spinner');
    if (spinner) spinner.remove();

    var overlay = document.createElement('div');
    overlay.id = 'sag-wall';
    Object.assign(overlay.style, { position:'fixed', inset:'0', display:'flex', alignItems:'center',
      justifyContent:'center', background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
      zIndex:'99999', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' });

    var card = document.createElement('div');
    Object.assign(card.style, { background:'#fff', borderRadius:'20px', padding:'40px', width:'100%',
      maxWidth:'420px', boxShadow:'0 25px 50px rgba(0,0,0,.25)', boxSizing:'border-box' });

    var title = document.createElement('h1');
    title.textContent = '✓ ToDo';
    Object.assign(title.style, { margin:'0 0 6px', fontSize:'28px', fontWeight:'700',
      background:'linear-gradient(135deg,#667eea,#764ba2)',
      WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' });
    var sub = document.createElement('p');
    sub.textContent = 'Sign in to your workspace';
    Object.assign(sub.style, { margin:'0 0 28px', fontSize:'14px', color:'#718096' });

    _emailInp = mkInput('sag-email', 'email', 'Email address', 'email');
    _passInp  = mkInput('sag-pass',  'password', 'Password', 'current-password');
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
    setTimeout(function () { _emailInp.focus(); }, 100);
  }

  function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }
  function hideErr(el)      { el.style.display = 'none'; }

  // ── Login via Supabase ────────────────────────────────────────────────────
  function doLogin() {
    var email = (_emailInp.value || '').trim().toLowerCase();
    var pass  = (_passInp.value  || '');
    hideErr(_errLogin);
    if (!email) { showErr(_errLogin, 'Email is required.'); return; }
    if (!pass)  { showErr(_errLogin, 'Password is required.'); return; }

    var sbClient = window.ShadowDB && window.ShadowDB._sb;
    if (!sbClient) { showErr(_errLogin, 'Auth service not ready — please wait a moment.'); return; }

    var loginBtn = document.querySelector('#sag-wall button');
    if (loginBtn) { loginBtn.textContent = 'Signing in…'; loginBtn.disabled = true; }

    sbClient.auth.signInWithPassword({ email: email, password: pass })
      .then(function (result) {
        if (loginBtn) { loginBtn.textContent = 'Sign In'; loginBtn.disabled = false; }
        if (result.error || !result.data.user) {
          showErr(_errLogin, result.error ? result.error.message : 'Invalid email or password.');
          return;
        }
        _afterSupabaseLogin(sbClient, result.data.user);
      })
      .catch(function (err) {
        if (loginBtn) { loginBtn.textContent = 'Sign In'; loginBtn.disabled = false; }
        showErr(_errLogin, err.message || 'Sign-in failed. Please try again.');
      });
  }

  function _afterSupabaseLogin(sbClient, sbUser) {
    var meta = sbUser.user_metadata || {};
    var name = meta.name || sbUser.email.split('@')[0];

    sbClient.from('users').select('name,role,avatar,color').eq('id', sbUser.id).maybeSingle()
      .then(function (pr) {
        var role   = (pr.data && pr.data.role)   || meta.role || 'user';
        // Normalise legacy role names
        if (role === 'member') role = 'user';
        if (role === 'viewer') role = 'guest';
        var user = {
          id:     sbUser.id,
          name:   (pr.data && pr.data.name)   || name,
          email:  sbUser.email,
          role:   role,
          avatar: (pr.data && pr.data.avatar) || _initials(name),
          color:  (pr.data && pr.data.color)  || '#667eea'
        };
        setHint(user);
        onAuthSuccess(user);
      })
      .catch(function () {
        var user = { id: sbUser.id, name: name, email: sbUser.email,
                     role: meta.role || 'user', avatar: _initials(name), color: '#667eea' };
        setHint(user);
        onAuthSuccess(user);
      });
  }

  function _initials(n) {
    return (n || '').trim().split(/\s+/).map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2) || '?';
  }

  // ── Post-login / reveal app ───────────────────────────────────────────────
  function onAuthSuccess(user) {
    var wall = document.getElementById('sag-wall');
    if (wall) wall.remove();
    showApp();
    // Sync RBAC before firing app_ready so all modules see correct role
    if (window.RBAC && typeof RBAC._syncFromAuth === 'function') RBAC._syncFromAuth(user);
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
      btn.textContent = '← Sign Out';
      Object.assign(btn.style, { marginRight:'8px', padding:'6px 14px', borderRadius:'8px',
        border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer',
        fontSize:'12px', color:'#4a5568', fontWeight:'500' });
      btn.addEventListener('click', function () { if (confirm('Sign out of ToDo?')) window.sagLogout(); });
      hdr.insertBefore(btn, hdr.firstChild);
    }
  }

  // ── Main gate ─────────────────────────────────────────────────────────────
  /**
   * 1. Show spinner while we wait for Supabase.
   * 2. If there is a fast-path hint and ShadowDB is already ready, use the
   *    hint to reveal the app immediately — then validate in the background.
   * 3. Otherwise, wait for `shadowdb:ready`, then call getSession().
   */
  function gate() {
    hideApp();

    function runGate(sbClient) {
      sbClient.auth.getSession().then(function (r) {
        var session = r.data && r.data.session;
        if (session && session.user) {
          _afterSupabaseLogin(sbClient, session.user);
        } else {
          clearHint();
          showLoginWall();
        }
      }).catch(function () {
        clearHint();
        showLoginWall();
      });
    }

    function waitForSB() {
      var hint = getHint();
      if (hint && hint.id && hint.email) {
        // Fast path: show app immediately, validate Supabase session in background
        onAuthSuccess(hint);
        // Background validation — re-gate if session is actually invalid
        var waitInterval = setInterval(function () {
          var sb = window.ShadowDB && window.ShadowDB._sb;
          if (!sb) return;
          clearInterval(waitInterval);
          sb.auth.getSession().then(function (r) {
            if (!r.data || !r.data.session) {
              // Session gone — force re-auth without reload flash
              clearHint();
              window._sagAppStarted = false;
              hideApp();
              showLoginWall();
            }
          });
        }, 500);
        return;
      }

      // No hint — show spinner and wait for ShadowDB
      if (document.body && !document.getElementById('sag-spinner')) {
        document.body.appendChild(mkSpinner());
      }
      var interval = setInterval(function () {
        var sb = window.ShadowDB && window.ShadowDB._sb;
        if (!sb) return;
        clearInterval(interval);
        runGate(sb);
      }, 100);
    }

    if (document.body) { waitForSB(); }
    else { document.addEventListener('DOMContentLoaded', waitForSB); }
  }

  function showLoginWall() {
    hideApp();
    if (document.body) { buildWall(); }
    else { document.addEventListener('DOMContentLoaded', buildWall); }
  }

  // ── Global logout ─────────────────────────────────────────────────────────
  window.sagLogout = function () {
    clearHint();
    var sb = window.ShadowDB && window.ShadowDB._sb;
    var doSignOut = sb ? sb.auth.signOut() : Promise.resolve();
    doSignOut.finally(function () { location.reload(); });
  };

  // ── Supabase token expiry listener ────────────────────────────────────────
  document.addEventListener('shadowdb:ready', function () {
    var sb = window.ShadowDB && window.ShadowDB._sb;
    if (!sb) return;
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT') { clearHint(); showLoginWall(); }
      else if (event === 'TOKEN_REFRESHED' && session && session.user) {
        _afterSupabaseLogin(sb, session.user);
      }
    });
    // Wire ShadowAuth.logout() to also clear our hint
    setTimeout(function () {
      if (window.ShadowAuth && window.ShadowAuth.logout) {
        var orig = window.ShadowAuth.logout;
        window.ShadowAuth.logout = function () { clearHint(); return orig.apply(this, arguments); };
      }
    }, 500);
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () { gate(); }, true);

  console.log('[AuthGate v2] Supabase-only session gate installed.');
})();
