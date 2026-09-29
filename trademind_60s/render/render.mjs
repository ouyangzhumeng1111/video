// Frame driver: serves this folder, opens index.html in headless Chromium,
// calls window.renderAt(t) per frame and pipes screenshots into ffmpeg.
//
//   node render.mjs --stills 3,7.5,12 --outdir ../output/stills
//   node render.mjs --from 0 --to 60 --fps 30 --out ../output/video_only.mp4
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const argv = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const fps = Number(argv.fps ?? 30);
const dpr = Number(argv.dpr ?? 1);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, url.startsWith('/render/') || url.startsWith('/assets/') ? url : '/render' + url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--font-render-hinting=none', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/render/index.html`);
await page.waitForFunction('window.__ready === true || window.__error', null, { timeout: 180000 });
const err = await page.evaluate('window.__error');
if (err) { console.error(err); process.exit(1); }

const shot = (png = false) => page.screenshot(png ? { type: 'png' } : { type: 'jpeg', quality: Number(argv.q ?? 97) });

if (argv.stills) {
  const outdir = path.resolve(argv.outdir ?? path.join(root, 'output/stills'));
  fs.mkdirSync(outdir, { recursive: true });
  for (const ts of String(argv.stills).split(',')) {
    const t = Number(ts);
    const t0 = Date.now();
    await page.evaluate((tt) => window.renderAt(tt), t);
    fs.writeFileSync(path.join(outdir, `t_${t.toFixed(2).padStart(5, '0')}.jpg`), await shot());
    console.log(`still t=${t} ${Date.now() - t0}ms`);
  }
} else {
  const from = Number(argv.from ?? 0), to = Number(argv.to ?? 60);
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  const out = path.resolve(argv.out ?? path.join(root, 'output/video_only.mp4'));
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(argv.crf ?? 12), '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const tStart = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate((tt) => window.renderAt(tt), f / fps);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 30 === 0) {
      const el = (Date.now() - tStart) / 1000, done = f - f0 + 1;
      console.log(`frame ${f}/${f1} ${(el / done).toFixed(2)}s/frame eta ${((f1 - f) * el / done / 60).toFixed(1)}min`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', out);
}
await browser.close();
server.close();
