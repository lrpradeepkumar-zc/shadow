// auth-supabase.js — Supabase auth helpers for Shadow ToDo.
// Exposed as window.ShadowCloudAuth (does NOT touch your existing ShadowAuth).

(function () {
  function whenReady(cb) {
    if (window.ShadowDB && window.ShadowDB._sb) return cb(window.ShadowDB._sb);
    document.addEventListener('shadowdb:ready', () => cb(window.ShadowDB._sb), { once: true });
  }

  whenReady(async (sb) => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      try { await sb.auth.signInAnonymously(); }
      catch (e) { console.warn('Anonymous sign-in failed — enable it in Supabase → Auth → Providers.', e); }
    }

    window.ShadowCloudAuth = {
      current: async () => (await sb.auth.getUser()).data.user,
      isAnonymous: async () => {
        const u = (await sb.auth.getUser()).data.user;
        return !!u && (u.is_anonymous === true || !u.email);
      },
      signUpWithEmail: async (email, password) => {
        const { data, error } = await sb.auth.updateUser({ email, password });
        if (error) throw error; return data.user;
      },
      signInWithEmail: async (email, password) => {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error; return data.user;
      },
      signInWithMagicLink: async (email) => {
        const { error } = await sb.auth.signInWithOtp({ email });
        if (error) throw error; return true;
      },
      signOut: async () => {
        await sb.auth.signOut();
        try { await sb.auth.signInAnonymously(); } catch(_){}
      },
      onChange: (fn) => sb.auth.onAuthStateChange((_evt, sess) => fn(sess?.user || null))
    };

    sb.auth.onAuthStateChange((_evt, sess) => {
      document.dispatchEvent(new CustomEvent('shadowauth:changed', { detail: sess?.user || null }));
    });
  });
})();
