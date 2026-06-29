// Lazy-loading endless scroll for the blog list.
// First page is server-rendered; subsequent batches are fetched from posts.json.
(function () {
  const list = document.getElementById('post-list');
  const sentinel = document.getElementById('scroll-sentinel');
  if (!list || !sentinel) return;

  const total = +list.dataset.total;
  const batch = +list.dataset.batch || 6;
  let rendered = +list.dataset.rendered;
  let posts = null, loading = false, done = rendered >= total;

  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function card(d) {
    const img = d.cover ? `<div class="card-media"><img src="${esc(d.cover)}" alt="${esc(d.title)}" loading="lazy"></div>` : '';
    const tags = (d.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    return `<a class="card" href="${esc(d.url)}">${img}<div class="card-body">` +
      `<div class="card-meta">${esc(d.date)}<span class="dot"></span>${esc(d.read)} min read</div>` +
      `<h2>${esc(d.title)}</h2><p>${esc(d.excerpt)}</p>` +
      `<div class="tag-row">${tags}</div>` +
      `<span class="read-more">Read more ${ARROW}</span></div></a>`;
  }

  async function loadMore() {
    if (loading || done) return;
    loading = true;
    if (!posts) {
      try { posts = await (await fetch(new URL('posts.json', location.href))).json(); }
      catch (e) { done = true; loading = false; io.disconnect(); return; }
    }
    const next = posts.slice(rendered, rendered + batch);
    if (next.length) {
      list.insertAdjacentHTML('beforeend', next.map(card).join(''));
      rendered += next.length;
    }
    loading = false;
    if (rendered >= total) { done = true; io.disconnect(); }
  }

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) loadMore(); }),
    { rootMargin: '500px 0px' }
  );
  io.observe(sentinel);
})();
