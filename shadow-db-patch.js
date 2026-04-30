/**
 * shadow-db-patch.js
 * Unifies the Shadow ToDo demo environment with Supabase as the single source of truth.
 *
 * What this file does:
 *   1. Replaces auth.js's hardcoded login picker with a DB-driven card + password UI
 *   2. Syncs RBAC.MockUsers from the Supabase `settings` table on every page load
 *   3. Patches ShadowDB CRUD so the JSONB `data` column is correctly merged on reads
 *   4. Exposes helpers: ShadowDB.getUserProfiles(), Settings.getByPattern(), Settings.setKey()
 *
 * Load order in index.html (the only required change):
 *   ..., group-ui.js, rbac.js, shadow-db-patch.js, theme.js
 */
(function ShadowDBPatch() {
  'use strict';

  /* =========================================================================
     CONSTANTS
     ========================================================================= */

  var ROLE_META = {
    org_admin:    { icon: '👑', label: 'Org Admin',    color: '#d946ef' },
    group_admin:  { icon: '🛡️', label: 'Group Admin',  color: '#f59e0b' },
    group_member: { icon: '👥', label: 'Group Member', color: '#10b981' },
    user:         { icon: '👤', label: 'User',         color: '#3b82f6' },
    viewer:       { icon: '👁️', label: 'Viewer',       color: '#6b7280' },
  };

  /* =========================================================================
     UTILITY: wait for ShadowDB to be ready
     ========================================================================= */

  function whenDBReady(fn) {
    if (window.__shadowdbReady) {
      fn();
    } else {
      window.addEventListener('shadowdb:ready', fn, { once: true });
    }
  }

  /* =========================================================================
     STEP 1 — LOAD USER PROFILES FROM SUPABASE
     Profiles are stored in the `settings` table as:
       key   = "profile:{uid}"
       value = JSON string of { uid, name, email, role, avatar, color, password }
     ========================================================================= */

  function loadProfilesFromDB() {
    var sb = window.ShadowDB && window.ShadowDB._sb;
    if (!sb) return Promise.resolve(null);
    return sb
      .from('settings')
      .select('key,value')
      .like('key', 'profile:%')
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return null;
        var profiles = res.data.map(function (row) {
          try { return JSON.parse(row.value); } catch (e) { return null; }
        }).filter(Boolean);
        return profiles.length ? profiles : null;
      });
  }

  /* =========================================================================
     STEP 2 — SYNC RBAC.MockUsers FROM DB PROFILES
     Replaces the hardcoded Olivia/Gary/Ursula/Max/Vera placeholders with the
     real auth.js users loaded from Supabase. Also restores the current user
     from the active session if one exists.
     ========================================================================= */

  function syncRBACUsers(profiles) {
    if (!window.RBAC || !profiles) return;
    var mu = window.RBAC.MockUsers;
    mu.length = 0;
    profiles.forEach(function (p) {
      mu.push({
        id:         p.uid,
        name:       p.name,
        email:      p.email,
        globalRole: p.role,
        color:      p.color,
        avatar:     p.avatar || p.name.charAt(0),
      });
    });
    // Restore current user from session
    var raw = localStorage.getItem('shadow_session');
    if (raw) {
      try {
        var sess = JSON.parse(raw);
        if (sess && sess.userId) {
          window.RBAC.setCurrentUser(sess.userId);
        }
      } catch (e) { /* ignore */ }
    }
    console.log(
      '[ShadowPatch] RBAC synced from DB:',
      mu.map(function (u) { return u.name + ' (' + u.globalRole + ')'; }).join(', ')
    );
  }

  /* =========================================================================
     STEP 3 — PATCH ShadowDB CRUD
     backend.js's `joinRow` correctly maps DB columns → JS fields (e.g.
     assignee_id → assigneeId). However, extra fields stored in the JSONB
     `data` column (title, description, priority, tags, subtasks, etc.) need to
     be merged into the returned object.  The patch below spreads `data` under
     the already-joined top-level fields so neither is lost.
     ========================================================================= */

  function spreadRow(row) {
    if (!row) return row;
    // Already merged (has title directly) — skip double-processing
    if (row.title !== undefined) return row;
    if (row.data && typeof row.data === 'object') {
      var data = row.data;
      var rest = {};
      Object.keys(row).forEach(function (k) {
        if (k !== 'data') rest[k] = row[k];
      });
      // data JSONB first, then top-level columns override (so id/status/assigneeId win)
      return Object.assign({}, data, rest);
    }
    return row;
  }

  function spreadAll(rows) {
    return rows.map(spreadRow);
  }

  function patchShadowDB() {
    var db = window.ShadowDB;
    if (!db || db._shadowPatchApplied) return;
    db._shadowPatchApplied = true;

    // ── Tasks ──────────────────────────────────────────────────────────────
    var _tGetAll  = db.Tasks.getAll.bind(db.Tasks);
    var _tGetById = db.Tasks.getById.bind(db.Tasks);
    db.Tasks.getAll  = function () { return _tGetAll().then(spreadAll); };
    db.Tasks.getById = function (id) { return _tGetById(id).then(spreadRow); };

    // ── Groups ─────────────────────────────────────────────────────────────
    var _gGetAll  = db.Groups.getAll.bind(db.Groups);
    var _gGetById = db.Groups.getById.bind(db.Groups);
    db.Groups.getAll  = function () { return _gGetAll().then(spreadAll); };
    db.Groups.getById = function (id) { return _gGetById(id).then(spreadRow); };

    // ── Members ────────────────────────────────────────────────────────────
    var _mGetAll = db.Members.getAll.bind(db.Members);
    db.Members.getAll = function () { return _mGetAll().then(spreadAll); };

    // ── Tags ───────────────────────────────────────────────────────────────
    var _taGetAll = db.Tags.getAll.bind(db.Tags);
    db.Tags.getAll = function () { return _taGetAll().then(spreadAll); };

    // ── Categories ─────────────────────────────────────────────────────────
    var _cGetAll = db.Categories.getAll.bind(db.Categories);
    db.Categories.getAll = function () { return _cGetAll().then(spreadAll); };

    console.log('[ShadowPatch] ShadowDB CRUD patched (JSONB spread enabled)');
  }

  /* =========================================================================
     STEP 4 — EXPOSE EXTRA HELPERS ON ShadowDB
     ========================================================================= */

  function exposeHelpers(profiles) {
    var db = window.ShadowDB;
    if (!db) return;

    // getUserProfiles() — returns the cached profiles array
    db.getUserProfiles = function () {
      return loadProfilesFromDB();
    };

    // getUserById(uid) — synchronous lookup in RBAC.MockUsers
    db.getUserById = function (uid) {
      if (!window.RBAC) return null;
      return window.RBAC.MockUsers.find(function (u) { return u.id === uid; }) || null;
    };

    // Settings.getByPattern(pattern) — fetch all settings rows matching a LIKE pattern
    db.Settings.getByPattern = function (pattern) {
      return db._sb
        .from('settings')
        .select('key,value')
        .like('key', pattern)
        .then(function (res) {
          if (!res.data) return {};
          return res.data.reduce(function (acc, row) {
            try { acc[row.key] = JSON.parse(row.value); }
            catch (e) { acc[row.key] = row.value; }
            return acc;
          }, {});
        });
    };

    // Settings.setKey(key, value) — upsert a single settings row
    db.Settings.setKey = function (key, value) {
      return db._sb.auth.getUser().then(function (res) {
        var ownerId = (res.data && res.data.user && res.data.user.id) || '';
        var v = (typeof value === 'string') ? value : JSON.stringify(value);
        return db._sb
          .from('settings')
          .upsert({ owner_id: ownerId, key: key, value: v }, { onConflict: 'owner_id,key' });
      });
    };

    console.log('[ShadowPatch] ShadowDB helpers exposed (getUserProfiles, getUserById, Settings.getByPattern, Settings.setKey)');
  }

  /* =========================================================================
     STEP 5 — DB-DRIVEN LOGIN SCREEN
     Intercepts auth.js's renderLoginScreen() via MutationObserver.
     When auth.js injects its card list (.user-cards / #login-user-cards),
     the observer fires, wipes the DOM, and renders our DB version instead.
     After a successful password check it calls window.location.reload() so
     the full app shell re-mounts cleanly with the session already in localStorage.
     ========================================================================= */

  function buildLoginScreen(profiles) {
    // ── Outer page styles ───────────────────────────────────────────────────
    document.body.style.cssText = [
      'margin:0',
      'padding:24px',
      'box-sizing:border-box',
      'min-height:100vh',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%)',
    ].join(';');

    document.body.innerHTML = '';

    // ── Card shell ──────────────────────────────────────────────────────────
    var wrap = document.createElement('div');
    wrap.style.cssText = [
      'background:#fff',
      'border-radius:20px',
      'box-shadow:0 25px 60px rgba(0,0,0,.35)',
      'width:100%',
      'max-width:500px',
      'overflow:hidden',
    ].join(';');

    wrap.innerHTML = ''
      + '<div style="background:linear-gradient(135deg,#e74c3c,#c0392b);padding:32px 32px 24px;text-align:center;">'
      +   '<div style="width:56px;height:56px;background:rgba(255,255,255,.18);border-radius:16px;'
      +       'display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:28px;">✅</div>'
      +   '<h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-.5px;">Shadow ToDo</h1>'
      +   '<p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:13px;">Task Management Application</p>'
      + '</div>'

      + '<div style="padding:28px 32px 24px;">'

      /* ── User card list ── */
      +   '<h2 style="margin:0 0 4px;font-size:17px;font-weight:600;color:#111;">Sign In</h2>'
      +   '<p style="margin:0 0 18px;font-size:13px;color:#6b7280;">Choose your account to continue</p>'
      +   '<div id="sp-cards" style="display:flex;flex-direction:column;gap:9px;'
      +       'max-height:310px;overflow-y:auto;padding-right:4px;margin-bottom:4px;"></div>'

      /* ── Password step (hidden initially) ── */
      +   '<div id="sp-pwd-step" style="display:none;">'
      +     '<div style="border-top:1px solid #f0f0f0;padding-top:18px;margin-top:4px;">'
      +       '<div id="sp-sel-user" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"></div>'
      +       '<input id="sp-pwd" type="password" placeholder="Password (default: password)"'
      +           ' autocomplete="current-password"'
      +           ' style="width:100%;box-sizing:border-box;padding:11px 14px;border:1.5px solid #e5e7eb;'
      +               'border-radius:10px;font-size:14px;outline:none;transition:border-color .15s;" />'
      +       '<div id="sp-err" style="color:#ef4444;font-size:12px;margin-top:6px;display:none;"></div>'
      +       '<div style="display:flex;gap:10px;margin-top:14px;">'
      +         '<button id="sp-back" style="flex:1;padding:10px;border:1.5px solid #e5e7eb;background:#fff;'
      +             'border-radius:10px;font-size:14px;cursor:pointer;color:#374151;'
      +             'transition:background .15s;">← Back</button>'
      +         '<button id="sp-go" style="flex:2;padding:10px;background:#e74c3c;color:#fff;border:none;'
      +             'border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;'
      +             'transition:opacity .15s;">Sign In</button>'
      +       '</div>'
      +     '</div>'
      +   '</div>'

      /* ── Demo hint ── */
      +   '<div style="border-top:1px solid #f3f4f6;padding-top:14px;margin-top:16px;">'
      +     '<p style="font-size:11px;color:#9ca3af;text-align:center;margin:0;">'
      +       '<strong>Demo environment</strong> · Default password: '
      +       '<code style="background:#f9fafb;padding:1px 6px;border-radius:4px;font-size:11px;">password</code>'
      +     '</p>'
      +   '</div>'

      + '</div>';

    document.body.appendChild(wrap);

    // ── Render user cards ────────────────────────────────────────────────────
    var cardsEl  = document.getElementById('sp-cards');
    var pwdStep  = document.getElementById('sp-pwd-step');
    var selUserEl = document.getElementById('sp-sel-user');
    var pwdInput = document.getElementById('sp-pwd');
    var errEl    = document.getElementById('sp-err');
    var backBtn  = document.getElementById('sp-back');
    var goBtn    = document.getElementById('sp-go');
    var selected = null;

    profiles.forEach(function (u) {
      var meta = ROLE_META[u.role] || ROLE_META.viewer;
      var card = document.createElement('div');
      card.style.cssText = [
        'display:flex', 'align-items:center', 'gap:12px',
        'padding:11px 14px',
        'border:1.5px solid #f0f0f0',
        'border-radius:12px',
        'cursor:pointer',
        'transition:border-color .15s,box-shadow .15s',
      ].join(';');

      card.innerHTML = ''
        + '<div style="width:40px;height:40px;border-radius:50%;background:' + u.color + ';'
        +     'display:flex;align-items:center;justify-content:center;'
        +     'font-weight:700;font-size:16px;color:#fff;flex-shrink:0;">'
        +   (u.avatar || u.name.charAt(0))
        + '</div>'
        + '<div style="flex:1;min-width:0;">'
        +   '<div style="font-weight:600;font-size:14px;color:#111;">' + u.name + '</div>'
        +   '<div style="font-size:12px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + u.email + '</div>'
        + '</div>'
        + '<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;'
        +     'white-space:nowrap;background:' + meta.color + '22;color:' + meta.color + ';">'
        +   meta.icon + ' ' + meta.label
        + '</span>';

      card.addEventListener('mouseenter', function () {
        card.style.borderColor = u.color;
        card.style.boxShadow = '0 2px 10px ' + u.color + '33';
      });
      card.addEventListener('mouseleave', function () {
        card.style.borderColor = '#f0f0f0';
        card.style.boxShadow = 'none';
      });
      card.addEventListener('click', function () { selectUser(u); });
      cardsEl.appendChild(card);
    });

    // ── Select a user → show password step ───────────────────────────────────
    function selectUser(u) {
      selected = u;
      cardsEl.parentElement.querySelector('[id="sp-cards"]').style.display = 'none';
      var h2 = wrap.querySelector('h2');
      var p  = h2 && h2.nextElementSibling;
      if (h2) h2.style.display = 'none';
      if (p)  p.style.display  = 'none';
      pwdStep.style.display = 'block';

      var meta = ROLE_META[u.role] || ROLE_META.viewer;
      selUserEl.innerHTML = ''
        + '<div style="width:38px;height:38px;border-radius:50%;background:' + u.color + ';'
        +     'display:flex;align-items:center;justify-content:center;'
        +     'font-weight:700;font-size:15px;color:#fff;flex-shrink:0;">'
        +   (u.avatar || u.name.charAt(0))
        + '</div>'
        + '<div>'
        +   '<div style="font-weight:600;font-size:14px;color:#111;">' + u.name + '</div>'
        +   '<div style="font-size:12px;color:#9ca3af;">' + meta.label + '</div>'
        + '</div>';

      errEl.style.display = 'none';
      pwdInput.value = '';
      pwdInput.style.borderColor = '#e5e7eb';
      setTimeout(function () { pwdInput.focus(); }, 60);
    }

    // ── Back button ───────────────────────────────────────────────────────────
    backBtn.addEventListener('click', function () {
      selected = null;
      pwdStep.style.display = 'none';
      cardsEl.style.display = 'flex';
      var h2 = wrap.querySelector('h2');
      var p  = h2 && h2.nextElementSibling;
      if (h2) h2.style.display = '';
      if (p)  p.style.display  = '';
      errEl.style.display = 'none';
    });

    // ── Sign-in ───────────────────────────────────────────────────────────────
    function attemptLogin() {
      if (!selected) return;
      var pwd = pwdInput.value;
      var expected = selected.password || 'password';

      if (pwd !== expected) {
        errEl.textContent = 'Incorrect password. Hint: try "password"';
        errEl.style.display = 'block';
        pwdInput.style.borderColor = '#ef4444';
        return;
      }

      goBtn.textContent = 'Signing in…';
      goBtn.disabled = true;
      errEl.style.display = 'none';

      // Write session so auth.js sees isLoggedIn() = true on reload
      var session = {
        userId:  selected.uid,
        id:      selected.uid,
        name:    selected.name,
        email:   selected.email,
        role:    selected.role,
        avatar:  selected.avatar || selected.name.charAt(0),
        color:   selected.color,
        loginAt: new Date().toISOString(),
      };
      localStorage.setItem('shadow_session', JSON.stringify(session));
      localStorage.setItem('shadow_rbac_current_user', JSON.stringify({ id: selected.uid }));

      // Reload — auth.js will skip login screen, app shell will mount, patches will re-run
      window.location.reload();
    }

    goBtn.addEventListener('click', attemptLogin);
    pwdInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') attemptLogin();
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * INSTALL LOGIN INTERCEPTOR
   * Watches for auth.js injecting its login DOM, then replaces it.
   * auth.js calls: setTimeout(() => ShadowAuth.checkAuth(), 50) on DOMContentLoaded.
   * Our observer fires synchronously on any childList mutation, well inside that window.
   * ───────────────────────────────────────────────────────────────────────── */
  function installLoginInterceptor(profiles) {
    if (!profiles) return; // no DB profiles — let auth.js handle it normally

    var intercepted = false;

    var observer = new MutationObserver(function () {
      if (intercepted) return;
      // auth.js injects either .user-cards or #login-user-cards as part of its login HTML
      var loginEl = document.querySelector('#login-user-cards, .user-cards, .login-container');
      if (!loginEl) return;
      intercepted = true;
      observer.disconnect();
      buildLoginScreen(profiles);
    });

    // Start watching immediately — auth.js fires 50 ms after DOMContentLoaded
    observer.observe(document.body, { childList: true, subtree: true });
    window.__spLoginObserver = observer; // expose for debugging
  }

  /* =========================================================================
     MAIN INIT SEQUENCE
     ========================================================================= */

  // ── A) On DOMContentLoaded: install the login interceptor synchronously
  //       (profiles will be fetched async; if DB is already ready, we use it
  //        immediately — otherwise the interceptor activates once the DB is up)
  document.addEventListener('DOMContentLoaded', function () {
    // If user is already logged in, skip the interceptor entirely
    var rawSession = localStorage.getItem('shadow_session');
    var isLoggedIn = false;
    if (rawSession) {
      try { isLoggedIn = !!JSON.parse(rawSession); } catch (e) {}
    }
    if (isLoggedIn) return;

    // Not logged in — set up the interceptor.
    // We need the profiles to build the screen. Two cases:
    // 1. DB already ready (page reload path): fetch immediately.
    // 2. DB not yet ready: wait, then fetch. The observer is already watching.

    function activateInterceptor() {
      loadProfilesFromDB().then(function (profiles) {
        installLoginInterceptor(profiles);
      });
    }

    whenDBReady(activateInterceptor);
  });

  // ── B) On shadowdb:ready: sync RBAC + patch DB layer + expose helpers
  whenDBReady(function onDBReady() {
    loadProfilesFromDB().then(function (profiles) {
      syncRBACUsers(profiles);
      patchShadowDB();
      exposeHelpers(profiles);
      console.log('[ShadowPatch] Initialised. DB connected. ' + (profiles ? profiles.length : 0) + ' profiles loaded.');
    });
  });

})();
