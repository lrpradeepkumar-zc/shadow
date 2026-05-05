// Theme management - Light theme is default (Zoho Design)
function init() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  
  const saved = localStorage.getItem('shadow-theme');
  const isDark = saved === 'dark';
  
  if (isDark) {
    document.body.classList.add('dark-theme');
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-sun';
  } else {
    document.body.classList.remove('dark-theme');
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-moon';
  }
  
  btn.addEventListener('click', function() {
    const nowDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('shadow-theme', nowDark ? 'dark' : 'light');
    const icon = btn.querySelector('i');
    if (icon) icon.className = nowDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
