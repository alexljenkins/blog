// Theme toggle — persists choice; light by default.
(function () {
  const btn = document.querySelector('.theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  // Mobile hamburger — toggles the collapsible nav cluster.
  const sidebar = document.querySelector('.sidebar');
  const menu = document.querySelector('.menu-toggle');
  if (sidebar && menu) {
    menu.addEventListener('click', () => {
      const open = sidebar.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
    sidebar.querySelectorAll('.nav a').forEach((a) =>
      a.addEventListener('click', () => sidebar.classList.remove('open')));
  }
})();
