// Render the 4K inserts: node render_inserts.mjs ui|end [--dur 3] [--stills 0.5,1.5]
import { chromium } from '../../trademind_60s/render/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const shot = process.argv[2] ?? 'ui';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const fps = 24, dur = Number(arg('dur', shot === 'end' ? 3.5 : 3.0));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--font-render-hinting=none', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/captain_ad/render/inserts.html?shot=${shot}`);
await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
const out = path.join(root, 'captain_ad/output');
fs.mkdirSync(out, { recursive: true });
const stills = arg('stills', null);
if (stills) {
  for (const t of stills.split(',').map(Number)) {
    await page.evaluate((tt) => window.renderAt(tt), t);
    fs.writeFileSync(path.join(out, `still_${shot}_${t.toFixed(2)}.jpg`), await page.screenshot({ type: 'jpeg', quality: 92 }));
  }
} else {
  const file = path.join(out, `insert_${shot}_4k.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(dur * fps);
  for (let f = 0; f < n; f++) {
    await page.evaluate((tt) => window.renderAt(tt), f / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', file, n, 'frames');
}
await browser.close(); server.close();
