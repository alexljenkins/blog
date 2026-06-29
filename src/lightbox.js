// Click any content image to open a zoomable lightbox; click outside (or Esc) to close.
(function () {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('aria-hidden', 'true');
  const big = document.createElement('img');
  big.alt = '';
  overlay.appendChild(big);
  document.body.appendChild(overlay);

  const open = (src, alt) => {
    big.src = src; big.alt = alt || '';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  };
  const close = () => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  };

  document.addEventListener('click', (e) => {
    const img = e.target.closest('.prose img, .img-row img, .bento img');
    if (!img || img.closest('a')) return;   // never hijack images wrapped in a link
    e.preventDefault();
    open(img.currentSrc || img.src, img.alt);
  });

  big.addEventListener('click', (e) => e.stopPropagation());  // clicks on the image stay open
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
