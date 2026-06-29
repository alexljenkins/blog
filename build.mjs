import { marked } from 'marked';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'docs');

/* ----------------------------------------------------------------
   Site config — edit me
   ---------------------------------------------------------------- */
const SITE = {
  title: 'Alex Jenkins',
  tagline: 'Ideas from the building things that build themselves.',
  author: 'Alex Jenkins',
  url: '',
  social: [
    { label: 'GitHub', href: 'https://github.com/alexljenkins', icon: 'github' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/alexljenkins', icon: 'linkedin' },
  ],
};

const PAGE_SIZE = 6;   // posts rendered before lazy-load kicks in

const NAV = [
  { label: 'Blogs', key: 'home', href: (r) => r || './' },
  { label: 'About', key: 'about', href: (r) => `${r}about/` },
];

/* ----------------------------------------------------------------
   Icons
   ---------------------------------------------------------------- */
const ICON = {
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 8.84 21.5c.5.08.66-.22.66-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.9.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.57.67.48A10 10 0 0 0 12 2Z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.64h.05c.53-1 1.83-2.06 3.76-2.06C20.6 8.58 22 10.2 22 13.3V21h-4v-6.83c0-1.63-.03-3.72-2.27-3.72-2.27 0-2.62 1.77-2.62 3.6V21H9V9Z"/></svg>',
  menu: '<svg class="open-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg class="close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */
const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function parseFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!mm) continue;
    let [, k, v] = mm;
    v = v.trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      data[k] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      data[k] = v.replace(/^["']|["']$/g, '');
    }
  }
  return { data, body: raw.slice(m[0].length) };
}

const readingTime = (text) => Math.max(1, Math.round(text.split(/\s+/).length / 200));

function gitDate(file) {
  try {
    const iso = execSync(`git log --format=%aI -1 -- "${file}"`, { cwd: ROOT }).toString().trim();
    if (iso) return new Date(iso);
  } catch (e) {}
  return new Date(fs.statSync(file).mtime);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

/* turn `[PLACEHOLDER: ...]` code chips into styled callouts */
function dressPlaceholders(html) {
  return html.replace(/<code>\[PLACEHOLDER:([\s\S]*?)\]<\/code>/g,
    (_, t) => `<span class="placeholder">PLACEHOLDER:${t}</span>`);
}

/* ----------------------------------------------------------------
   Templates
   ---------------------------------------------------------------- */
function sidebar(root, active) {
  const links = NAV.map((n) =>
    `<a href="${n.href(root)}" class="${n.key === active ? 'is-active' : ''}"><span class="label">${n.label}</span></a>`
  ).join('');
  const social = SITE.social.map((s) =>
    `<a href="${s.href}" aria-label="${s.label}" title="${s.label}">${ICON[s.icon]}</a>`
  ).join('');
  return `<aside class="sidebar">
  <a class="brand" href="${root || './'}">
    <span class="mark">${SITE.title}</span>
    <span class="tagline">${SITE.tagline}</span>
  </a>
  <button class="menu-toggle" aria-label="Toggle menu" aria-expanded="false">${ICON.menu}</button>
  <div class="side-menu">
    <nav class="nav">${links}</nav>
    <div class="side-foot">
      <div class="social">${social}</div>
      <button class="theme-toggle" aria-label="Toggle dark mode">
        <span class="sun">${ICON.sun}</span><span class="moon">${ICON.moon}</span>
      </button>
    </div>
  </div>
</aside>`;
}

function footer(root) {
  return `<footer class="site-foot"><div class="site-foot-inner">
    <span>© ${new Date().getFullYear()} ${SITE.author}</span>
  </div></footer>`;
}

function page({ root, active, title, desc, body, bodyClass = '', scripts = '' }) {
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${(desc || SITE.tagline).replace(/"/g, '&quot;')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${root}assets/style.css">
<script>try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
</head>
<body class="${bodyClass}">
<div class="layout">
${sidebar(root, active)}
<main class="main">
${body}
${footer(root)}
</main>
</div>
<script src="${root}assets/theme.js"></script>
<script src="${root}assets/lightbox.js"></script>
<script src="${root}assets/nav.js"></script>
${scripts}
</body>
</html>`;
}

/* ----------------------------------------------------------------
   Content discovery
   ---------------------------------------------------------------- */
const SKIP = new Set(['docs', 'src', 'node_modules', 'zz_scripts', '.git', '.claude']);

function discoverPosts() {
  const posts = [];
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name.startsWith('_') || SKIP.has(e.name)) continue;
    const dir = path.join(ROOT, e.name);
    const md = fs.readdirSync(dir).find((f) => f.endsWith('.md'));
    if (!md) continue;
    const raw = fs.readFileSync(path.join(dir, md), 'utf8');
    const { data, body } = parseFrontMatter(raw);
    const h1 = body.match(/^#\s+(.+)$/m);
    const title = data.title || (h1 ? h1[1].trim() : e.name);
    const slug = data.slug || slugify(e.name);
    const date = data.date ? new Date(data.date) : gitDate(path.join(dir, md));
    // strip a leading H1 when we already have a title (tolerate leading blank lines)
    let mdBody = body.replace(/^\s*#\s+.+\n+/, '');
    const firstImg = (body.match(/!\[[^\]]*\]\(([^)]+)\)/) || body.match(/<img[^>]+src=["']([^"']+)["']/) || [])[1];
    const cover = data.cover || data.hero || firstImg || null;
    const firstPara = mdBody.replace(/^##?\s+.+\n+/, '').match(/^([A-Za-z*[][^\n]+)/m);
    const excerpt = data.excerpt || (firstPara ? firstPara[1].replace(/[*_`>#]/g, '').slice(0, 180) : '');
    posts.push({
      dir, slug, title, date, cover,
      excerpt,
      hero: data.hero || null,
      tags: data.tags || [],
      read: data.read ? Number(data.read) : readingTime(mdBody),
      mdBody,
    });
  }
  posts.sort((a, b) => b.date - a.date);
  return posts;
}

/* ----------------------------------------------------------------
   Render
   ---------------------------------------------------------------- */
marked.setOptions({ gfm: true, breaks: false });

function renderPost(p) {
  const root = '../../';
  const html = dressPlaceholders(marked.parse(p.mdBody));
  const tags = p.tags.map((t) => `<span class="tag">${t}</span>`).join('');
  const heroSrc = p.hero ? `./${p.hero.replace(/^\.?\//, '')}` : '';
  const headerClass = heroSrc ? 'post-header has-hero' : 'post-header';
  const headerStyle = heroSrc ? ` style="background-image:url('${heroSrc}')"` : '';
  const body = `<article class="post">
  <header class="${headerClass}"${headerStyle}><div class="post-header-inner">
    <p class="eyebrow">${fmtDate(p.date)} · ${p.read} min read</p>
    <h1>${p.title}</h1>
    ${p.excerpt ? `<p class="post-sub">${p.excerpt}</p>` : ''}
    <p class="byline"><strong>${SITE.author}</strong>${tags ? '<span class="dot"></span>' : ''}<span class="tag-row">${tags}</span></p>
  </div></header>
  <div class="prose">
${html}
  </div>
</article>`;
  const dest = path.join(OUT, 'blog', p.slug);
  fs.mkdirSync(dest, { recursive: true });
  // copy this post's assets alongside the page so ./assets/* resolves
  const assetsSrc = path.join(p.dir, 'assets');
  if (fs.existsSync(assetsSrc)) copyDir(assetsSrc, path.join(dest, 'assets'));
  fs.writeFileSync(path.join(dest, 'index.html'),
    page({ root, active: '', title: `${p.title} — ${SITE.title}`, desc: p.excerpt, body }));
}

const cardData = (p) => ({
  url: `blog/${p.slug}/`,
  cover: p.cover ? `blog/${p.slug}/${p.cover.replace(/^\.?\//, '')}` : '',
  date: fmtDate(p.date),
  read: p.read,
  title: p.title,
  excerpt: p.excerpt,
  tags: p.tags.slice(0, 3),
});

function cardHTML(d) {
  const img = d.cover ? `<div class="card-media"><img src="${d.cover}" alt="${d.title}" loading="lazy"></div>` : '';
  const tags = d.tags.map((t) => `<span class="tag">${t}</span>`).join('');
  return `<a class="card" href="${d.url}">
    ${img}
    <div class="card-body">
      <div class="card-meta">${d.date}<span class="dot"></span>${d.read} min read</div>
      <h2>${d.title}</h2>
      <p>${d.excerpt}</p>
      <div class="tag-row">${tags}</div>
      <span class="read-more">Read more ${ICON.arrow}</span>
    </div>
  </a>`;
}

function renderIndex(posts) {
  const root = '';
  const data = posts.map(cardData);
  fs.writeFileSync(path.join(OUT, 'posts.json'), JSON.stringify(data));
  const initial = data.slice(0, PAGE_SIZE).map(cardHTML).join('\n');
  const body = `<div class="page-head">
    <p class="eyebrow">Writing</p>
    <h1>Blogs</h1>
    <p>Ideas from the building things that build themselves.</p>
  </div>
  <div class="post-list" id="post-list" data-rendered="${Math.min(PAGE_SIZE, data.length)}" data-total="${data.length}" data-batch="${PAGE_SIZE}">${initial}</div>
  <div id="scroll-sentinel" aria-hidden="true"></div>`;
  fs.writeFileSync(path.join(OUT, 'index.html'),
    page({ root, active: 'home', title: `${SITE.title} — ${SITE.tagline}`, body,
      scripts: `<script src="${root}assets/infinite.js"></script>` }));
}

/* ----------------------------------------------------------------
   About — parse cv.md into structured fields, render a designed page.
   cv.md stays the single editable source of truth; this just shapes it.
   ---------------------------------------------------------------- */
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const yearsOf = (d) => d.match(/\d{4}/g) || [];
const isPresent = (d) => /present|now|current/i.test(d);
const startYear = (d) => {                        // role node label: just the start year, e.g. "’24"
  const ys = yearsOf(d);
  return ys.length ? `’${ys[0].slice(2)}` : d;
};
function compactSpan(roles) {                     // whole-company range, e.g. "2024 — Present"
  const all = roles.flatMap((r) => yearsOf(r.dates)).map(Number).filter(Boolean);
  if (!all.length) return '';
  const start = Math.min(...all);
  if (roles.some((r) => isPresent(r.dates))) return `${start} — Present`;
  const end = Math.max(...all);
  return end === start ? `${start}` : `${start} — ${end}`;
}

function parseCV(raw) {
  const strip = (s) => s.replace(/\\([.\-!&'])/g, '$1').replace(/[*_]/g, '').trim();
  const cv = { location: '', talentStack: [], ikigai: '', values: [], experience: [], projects: [], education: [] };
  let mode = 'head', sub = null, job = null, edu = null;
  const pushJob = () => { if (job && job.title) cv.experience.push(job); job = null; };
  const pushEdu = () => { if (edu && edu.school) cv.education.push(edu); edu = null; };

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const mH2 = line.match(/^##\s+(.+)/);
    const mH1 = !mH2 && line.match(/^#\s+(.+)/);

    if (mH1) {
      const t = strip(mH1[1]);
      if (!t) continue;                                          // skip empty spacer headers
      if (t === 'Professional Experience') { mode = 'xp'; continue; }
      if (t === 'Side Projects') { pushJob(); mode = 'proj'; continue; }
      if (t === 'Education') { pushJob(); mode = 'edu'; continue; }
      if (mode === 'xp') { pushJob(); job = { company: t, title: '', dates: '', quote: null, bullets: [], tech: [] }; continue; }
      if (mode === 'edu') { pushEdu(); edu = { school: t, course: '', dates: '' }; continue; }
      continue;
    }

    if (mH2) {
      const key = strip(mH2[1]);
      if (mode === 'head') { sub = { 'Talent Stack': 'talent', Ikigai: 'ikigai', Values: 'values' }[key] || null; continue; }
      if (mode === 'xp' && job) { const [t, d] = key.split('|').map((x) => x.trim()); job.title = t; job.dates = d || ''; continue; }
      if (mode === 'edu' && edu) { const [c, d] = key.split('|').map((x) => x.trim()); edu.course = c; edu.dates = d || ''; pushEdu(); continue; }
      continue;
    }

    if (mode === 'head') {
      const loc = line.match(/^\*\*Location:\*\*\s*(.+)/);
      if (loc) cv.location = strip(loc[1]);
      else if (sub === 'talent' && line.startsWith('*')) cv.talentStack.push(strip(line));
      else if (sub === 'ikigai') cv.ikigai = cv.ikigai || strip(line);
      else if (sub === 'values' && /^\d+\\?\./.test(line)) cv.values.push(strip(line.replace(/^\d+\\?\.\s*/, '')));
      continue;
    }

    if (mode === 'xp' && job) {
      if (/^\*?["“]/.test(line)) {                               // testimonial pull-quote
        const c = strip(line), i = c.indexOf('—');
        job.quote = i >= 0
          ? { text: c.slice(0, i).trim().replace(/^["“]|["”]$/g, ''), by: c.slice(i + 1).trim() }
          : { text: c.replace(/^["“]|["”]$/g, ''), by: '' };
        continue;
      }
      if (job.quote && !job.quote.by && /^—/.test(strip(line))) { job.quote.by = strip(line).replace(/^—\s*/, ''); continue; }
      const tech = line.match(/^\*\*Technologies:\*\*\s*(.+)/);
      if (tech) { job.tech = strip(tech[1]).split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean); continue; }
      if (line.startsWith('*')) {
        const indent = rawLine.match(/^[\t ]*/)[0];
        const depth = (indent.match(/\t/g) || []).length + Math.floor(indent.replace(/\t/g, '').length / 2);
        job.bullets.push({ text: strip(line), depth });
      }
      continue;
    }

    if (mode === 'proj' && line.startsWith('*')) {
      const item = line.replace(/^\*\s*/, '');
      const linked = item.match(/^\[\*\*(.+?)\*\*\]\((.+?)\)\s*:?\s*(.*)/);
      const plain = item.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)/);
      if (linked) cv.projects.push({ name: linked[1], url: linked[2], desc: strip(linked[3]) });
      else if (plain) cv.projects.push({ name: plain[1], url: '', desc: strip(plain[2]) });
    }
  }
  pushJob(); pushEdu();
  return cv;
}

function renderAbout() {
  const root = '../';
  const cv = parseCV(fs.readFileSync(path.join(ROOT, 'cv.md'), 'utf8'));

  const ikigai = esc(cv.ikigai || 'Make more things possible').replace(/(\w+)([.?!]?)$/, '<em>$1</em>$2');
  const chips = cv.talentStack.map((t) => `<span class="chip">${esc(t)}</span>`).join('');

  const values = cv.values.length ? `
    <section class="about-section">
      <h2 class="about-h">What I optimise for</h2>
      <ol class="values">${cv.values.map((v) => `<li>${esc(v)}</li>`).join('')}</ol>
    </section>` : '';

  // group consecutive roles at the same company so multi-role employers read as one block
  const groups = [];
  for (const j of cv.experience) {
    const last = groups[groups.length - 1];
    if (last && last.company === j.company) last.roles.push(j);
    else groups.push({ company: j.company, roles: [j] });
  }

  const renderBullets = (items) => {
    if (!items.length) return '';
    let html = '<ul class="role-bullets">';
    let depth = 0;
    items.forEach((b, i) => {
      if (b.depth > depth) for (let d = depth; d < b.depth; d++) html += '<ul class="role-bullets">';
      else if (b.depth < depth) { for (let d = b.depth; d < depth; d++) html += '</li></ul>'; html += '</li>'; }
      else if (i > 0) html += '</li>';
      html += `<li>${esc(b.text)}`;
      depth = b.depth;
    });
    html += '</li>';
    for (let d = 0; d < depth; d++) html += '</ul></li>';
    return html + '</ul>';
  };

  const renderRole = (j) => {
    const bullets = renderBullets(j.bullets);
    const tech = j.tech.length ? `<div class="role-tech">${j.tech.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : '';
    const quote = j.quote ? `<blockquote class="role-quote">${esc(j.quote.text)}${j.quote.by ? `<cite>${esc(j.quote.by)}</cite>` : ''}</blockquote>` : '';
    return `<div class="role">
      <span class="role-date" title="${esc(j.dates)}">${esc(startYear(j.dates))}</span>
      <div class="role-body">
        <h4 class="role-title">${esc(j.title)}</h4>
        ${bullets}${tech}${quote}
      </div>
    </div>`;
  };

  const timeline = groups.map((g) => `<section class="company">
      <div class="company-head">
        <h3 class="company-name">${esc(g.company)}</h3>
        <span class="company-meta">${esc(compactSpan(g.roles))}</span>
      </div>
      <div class="company-roles">${g.roles.map(renderRole).join('')}</div>
    </section>`).join('');

  const projects = cv.projects.map((p) => {
    const inner = `<h3>${esc(p.name)}${p.url ? ICON.arrow : ''}</h3><p>${esc(p.desc)}</p>`;
    return p.url
      ? `<a class="project" href="${p.url}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="project">${inner}</div>`;
  }).join('');

  const education = cv.education.map((e) => `
    <div class="edu-item">
      <div><span class="school">${esc(e.school)}</span> <span class="course">${esc(e.course)}</span></div>
      <span class="edu-date">${esc(e.dates)}</span>
    </div>`).join('');

  const body = `<div class="read-progress" id="readbar" aria-hidden="true"></div>
<article class="post about">
  <header class="post-header"><div class="post-header-inner">
    <p class="eyebrow">About</p>
    <h1>${esc(SITE.author)}</h1>
    <p class="post-sub">Agentic AI, data science, and product. Building systems that improve themselves.</p>
  </div></header>

  <div class="about-body">
    <section class="about-lede">
      <p class="ikigai">${ikigai}</p>
      <p>That's the whole brief. I build agentic AI systems. After a decade spent crossing data science, product, and marketing. The throughline: most limits are just tools nobody has built yet. This is where I write about closing that gap.</p>
    </section>

    <section class="about-section">
      <h2 class="about-h">Talent stack</h2>
      <div class="about-stack">${chips}</div>
    </section>
    ${values}
    <section class="about-section">
      <h2 class="about-h">Experience</h2>
      <div class="timeline">${timeline}</div>
    </section>

    <section class="about-section">
      <h2 class="about-h">Side projects</h2>
      <div class="projects">${projects}</div>
    </section>

    <section class="about-section">
      <h2 class="about-h">Education</h2>
      <div class="education">${education}</div>
    </section>
  </div>
</article>`;

  const scripts = `<script>
(function(){var b=document.getElementById('readbar');if(!b)return;
function u(){var h=document.documentElement,m=h.scrollHeight-h.clientHeight;
b.style.transform='scaleX('+(m>0?Math.min(1,h.scrollTop/m):0)+')';}
addEventListener('scroll',u,{passive:true});addEventListener('resize',u);u();})();
</script>`;

  fs.mkdirSync(path.join(OUT, 'about'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'about', 'index.html'),
    page({ root, active: 'about', title: `About — ${SITE.title}`, body, scripts }));
}

function renderStyleguide(posts) {
  const root = '../';
  // borrow real assets from the first post for the demo
  const a = posts[0] ? `../blog/${posts[0].slug}/assets` : '';
  const body = `<article class="post">
  <header class="post-header"><div class="post-header-inner">
    <p class="eyebrow">Reference</p>
    <h1>The styleguide</h1>
    <p class="post-sub">Every component, so alignment and the deliberate break-outs can be checked at a glance.</p>
    <p class="byline"><strong>${SITE.author}</strong></p>
  </div></header>
  <figure class="hero"><img src="${a}/arc_in_chat.png" alt="hero demo"><figcaption>A full-bleed hero spans the entire content column — a deliberate overflow.</figcaption></figure>
  <div class="prose">
    <p>Body text sits in a centred reading column with consistent margins. This paragraph,
    every heading, list, and inline image should align to the same left and right edges.
    Only the hero above, blockquotes, and bento grids are allowed to break out.</p>
    <h2>A second-level heading</h2>
    <p>Lorem-free copy: the column is capped near 720px for comfortable line length, and the
    serif face gives it an editorial feel. Links <a href="#">look like this</a> and turn warm on hover.</p>
    <h3>A third-level heading</h3>
    <ul><li>Lists keep the same left margin as paragraphs.</li><li>Markers are muted.</li><li>Spacing stays even.</li></ul>
    <blockquote><p>Blockquotes break out a touch wider to draw the eye — a deliberate, controlled overflow.</p></blockquote>
    <p>An inline image stays inside the column and is centred with a caption:</p>
    <figure><img src="${a}/arc_account_researcher.png" alt="inline demo"><figcaption>An inline figure, aligned to the reading column.</figcaption></figure>
    <h2>Bento grid</h2>
    <p>For galleries, a bento grid breaks out full width:</p>
  </div>
  <div class="bento" style="--cols:3">
    <img src="${a}/HubSpot_tools.png" alt="">
    <img src="${a}/relevanceai_notion_arc_tool.png" alt="">
    <img src="${a}/arc_in_chat_extended.png" alt="">
    <img src="${a}/old_dev_cycle_dark.png" alt="">
    <img src="${a}/new_dev_cycle_dark.png" alt="">
    <img src="${a}/relevanceai_hubspot_arc_agent.png" alt="">
  </div>
  <div class="prose">
    <h2>Code &amp; tables</h2>
    <p>Inline <code>code</code> and fenced blocks:</p>
    <pre><code>def hello(name):
    return f"hi {name}"</code></pre>
    <table><thead><tr><th>Thing</th><th>Aligned?</th></tr></thead>
    <tbody><tr><td>Text</td><td>Yes</td></tr><tr><td>Images</td><td>Yes</td></tr><tr><td>Hero / bento</td><td>Deliberately not</td></tr></tbody></table>
    <hr>
    <p>End of styleguide.</p>
  </div>
</article>`;
  fs.mkdirSync(path.join(OUT, 'styleguide'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'styleguide', 'index.html'),
    page({ root, active: '', title: `Styleguide — ${SITE.title}`, body }));
}

/* ----------------------------------------------------------------
   Build
   ---------------------------------------------------------------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src', 'style.css'), path.join(OUT, 'assets', 'style.css'));
fs.copyFileSync(path.join(ROOT, 'src', 'theme.js'), path.join(OUT, 'assets', 'theme.js'));
fs.copyFileSync(path.join(ROOT, 'src', 'infinite.js'), path.join(OUT, 'assets', 'infinite.js'));
fs.copyFileSync(path.join(ROOT, 'src', 'lightbox.js'), path.join(OUT, 'assets', 'lightbox.js'));
fs.copyFileSync(path.join(ROOT, 'src', 'nav.js'), path.join(OUT, 'assets', 'nav.js'));
fs.copyFileSync(path.join(ROOT, 'src', 'sidebar-bg.jpg'), path.join(OUT, 'assets', 'sidebar-bg.jpg'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const posts = discoverPosts();
posts.forEach(renderPost);
renderIndex(posts);
renderAbout();
renderStyleguide(posts);

console.log(`Built ${posts.length} post(s) → docs/`);
posts.forEach((p) => console.log(`  · ${p.slug}  (${fmtDate(p.date)}, ${p.read}m)`));
