// Dev server: rebuild on change + live-reload the browser. Zero dependencies.
// Run with `npm run dev`, open http://localhost:8099
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'docs');
const PORT = 8099;
const IGNORE = ['docs', 'node_modules', '.git', '.cache'];

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// injected into every served HTML page; reconnects + reloads on rebuild
const RELOAD_SNIPPET = `<script>
(function(){var s=new EventSource('/__reload');s.onmessage=function(){location.reload()};
s.onerror=function(){s.close();setTimeout(function(){location.reload()},1000)};})();
</script>`;

let clients = [];
function build() {
  try {
    const out = execSync('node build.mjs', { cwd: ROOT }).toString().trim();
    console.log(`\x1b[32m✓\x1b[0m rebuilt — ${out.split('\n')[0]}`);
  } catch (e) {
    console.error(`\x1b[31m✗ build failed\x1b[0m\n${e.stdout || ''}${e.stderr || ''}`);
  }
}
function reload() { clients.forEach((res) => res.write('data: reload\n\n')); }

const server = http.createServer((req, res) => {
  if (req.url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('\n');
    clients.push(res);
    req.on('close', () => { clients = clients.filter((c) => c !== res); });
    return;
  }
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(OUT, urlPath);
  if (urlPath.endsWith('/') || !path.extname(file)) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(file);
    let body = data;
    if (ext === '.html') body = data.toString().replace('</body>', `${RELOAD_SNIPPET}</body>`);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
});

let timer = null;
fs.watch(ROOT, { recursive: true }, (_e, name) => {
  if (!name || IGNORE.some((d) => name.split(path.sep)[0] === d)) return;
  clearTimeout(timer);
  timer = setTimeout(() => { build(); reload(); }, 80);  // debounce bursts
});

build();
server.listen(PORT, () => console.log(`\x1b[36m▶ dev server\x1b[0m  http://localhost:${PORT}  (watching for changes)`));
