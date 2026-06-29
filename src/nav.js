// Smooth fade between pages: fade the main panel out before an internal navigation.
// Pages fade back in via the main-fade-in CSS animation on load.
(function () {
  const main = document.querySelector('.main');
  if (!main) return;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || a.target === '_blank' || href.startsWith('#') || href.startsWith('mailto:')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.href === location.href) return;  // external / same page
    e.preventDefault();
    main.classList.add('is-leaving');
    setTimeout(() => { location.href = a.href; }, 180);
  });

  // bfcache restore — make sure we're visible again
  window.addEventListener('pageshow', () => main.classList.remove('is-leaving'));
})();
