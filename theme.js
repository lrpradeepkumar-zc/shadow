(function () {
  function init() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    const saved = localStorage.getItem('shadow_theme');
    let isLight;
    if (saved === 'light' || saved === 'dark') {
      isLight = saved === 'light';
    } else {
      isLight = window.matchMedia &&
                window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    document.body.classList.toggle('light-theme', isLight);

    btn.addEventListener('click', () => {
      const nowLight = document.body.classList.toggle('light-theme');
      localStorage.setItem('shadow_theme', nowLight ? 'light' : 'dark');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
