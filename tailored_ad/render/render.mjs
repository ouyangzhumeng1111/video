// Render 《原来，你对谁都这么说》 from film.html.
//   node render.mjs stills 0.5,3,12.5       -> output/stills/still_<t>.jpg (2160x3840)
//   node render.mjs events                   -> output/events.json (sound cues for audio/sound_design.py)
//   node render.mjs video [--from 0 --to 60] -> output/picture_4k.mp4 (2160x3840, 30 fps, no audio)
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.resolve(here, '../output');
const mode = process.argv[2] ?? 'video';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = 30;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--font-render-hinting=none', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/tailored_ad/render/film.html`);
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
fs.mkdirSync(out, { recursive: true });
const shot = async (t) => { await page.evaluate((tt) => window.renderAt(tt), t); return page.screenshot({ type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1080, height: 1920 } }); };

if (mode === 'stills') {
  fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
  for (const t of process.argv[3].split(',').map(Number)) fs.writeFileSync(path.join(out, 'stills', `still_${t.toFixed(2)}.jpg`), await shot(t));
} else if (mode === 'events') {
  fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify(await page.evaluate(() => window.EVENTS), null, 1));
} else {
  const from = Number(arg('from', 0)), to = Number(arg('to', 60));
  const file = path.join(out, arg('out', 'picture_4k.mp4'));
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
  const t0 = Date.now();
  for (let f = n0; f < n1; f++) {
    const buf = await shot(f / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - n0) % 150 === 0) console.log(`frame ${f}/${n1} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', file, n1 - n0, 'frames');
}
await browser.close(); server.close();
