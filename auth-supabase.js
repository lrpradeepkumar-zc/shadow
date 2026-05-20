// auth-supabase.js — Supabase auth helpers for Shadow ToDo.
// Exposed as window.ShadowCloudAuth. No anonymous auth (prevents session deadlocks).

(function () {
  function whenReady(cb) {
    if (window.ShadowDB && window.ShadowDB._sb) return cb(window.ShadowDB._sb);
    document.addEventListener('shadow_app_ready', function() {
      if (window.ShadowDB && window.ShadowDB._sb) cb(window.ShadowDB._sb);
    });
  }

  whenReady(function(sb) {
    window.ShadowCloudAuth = {
      current: async () => (await sb.auth.getUser()).data.user,
      signUpWithEmail: async (email, password, name) => {
        var { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: name || email.split('@')[0] } } });
        if (error) throw error; return data.user;
      },
      signInWithEmail: async (email, password) => {
        var { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error; return data.user;
      },
      signOut: async () => { await sb.auth.signOut(); },
      onChange: (fn) => sb.auth.onAuthStateChange((_evt, sess) => fn(sess ? sess.user : null))
    };

    sb.auth.onAuthStateChange(function(_evt, sess) {
      document.dispatchEvent(new CustomEvent('shadowauth:changed', { detail: sess ? sess.user : null }));
    });
  });
})();
