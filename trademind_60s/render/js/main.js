// Timeline + frame entry point. window.renderAt(t) draws the frame at time t
// (seconds) deterministically; the Playwright driver screenshots it.
import * as THREE from 'three';
import { W, H, DPR, ss, ease, prog } from './lib.js';
import { Compositor } from './compositor.js';
import { Overlay } from './overlay.js';
import { loadLand } from './geo.js';
import * as Earth from './scenes/s1_earth.js';
import * as Ship from './scenes/s1_ship.js';
import * as Factory from './scenes/s1_factory.js';
import * as Product from './scenes/s2_product.js';
import * as Market from './scenes/s3_market.js';
import * as Evidence from './scenes/s4_evidence.js';
import * as Agents from './scenes/s5_agents.js';
import * as Pipeline from './scenes/s6_pipeline.js';
import * as Loop from './scenes/s7_loop.js';
import * as Brand from './scenes/s8_brand.js';

// Shots overlap during transitions; `trans` is the transition INTO the shot.
const SHOTS = [
  { id: 'earth', mod: Earth, t0: 0.0, t1: 2.75 },
  { id: 'ship', mod: Ship, t0: 2.45, t1: 4.2, trans: 'zoom' },
  { id: 'factory', mod: Factory, t0: 4.0, t1: 6.3, trans: 'flash' },
  { id: 'product', mod: Product, t0: 5.7, t1: 13.4, trans: 'dissolve' },
  { id: 'market', mod: Market, t0: 12.8, t1: 21.3, trans: 'zoom' },
  { id: 'evidence', mod: Evidence, t0: 20.75, t1: 29.3, trans: 'push' },
  { id: 'agents', mod: Agents, t0: 28.75, t1: 37.3, trans: 'push' },
  { id: 'pipeline', mod: Pipeline, t0: 36.75, t1: 45.3, trans: 'push' },
  { id: 'loop', mod: Loop, t0: 44.75, t1: 53.3, trans: 'push' },
  { id: 'brand', mod: Brand, t0: 52.7, t1: 60.5, trans: 'dissolve' },
];

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function boot() {
  const faces = ['300 40px "Noto Sans CJK SC"', '400 40px "Noto Sans CJK SC"', '500 40px "Noto Sans CJK SC"', '700 40px "Noto Sans CJK SC"',
    '400 40px Inter', '500 40px Inter', '600 40px Inter', '700 40px Inter', '400 40px "IBM Plex Mono"', '500 40px "IBM Plex Mono"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, '中文AI')));
  await document.fonts.ready;

  const glCanvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  renderer.autoClear = false;

  const assets = {
    land: await loadLand(),
    logo: await loadImage('../assets/logo_rgba.png'),
  };
  const env = { renderer, assets };
  for (const s of SHOTS) {
    s.shot = await s.mod.create(env);
  }
  const comp = new Compositor(renderer, W * DPR, H * DPR);
  const overlay = new Overlay(document.getElementById('ui'), assets);

  // Edit timeline: the picture is authored on the 60 s design timeline and
  // re-cut to the narration (output/timeline.json, built by audio/timeline.py).
  let tl = null;
  try { const r = await fetch('../output/timeline.json'); if (r.ok) tl = await r.json(); } catch (e) { tl = null; }
  const warp = (x, src, dst) => {
    if (x <= src[0]) return dst[0] + (x - src[0]);
    for (let i = 0; i < src.length - 1; i++) {
      if (x <= src[i + 1]) return dst[i] + ((x - src[i]) / (src[i + 1] - src[i])) * (dst[i + 1] - dst[i]);
    }
    return dst[dst.length - 1] + (x - src[src.length - 1]);
  };
  window.__duration = tl ? tl.total : 60;
  window.renderAt = (tEdit) => {
    const t = tl ? warp(tEdit, tl.new, tl.old) : tEdit;
    const active = SHOTS.filter((s) => t >= s.t0 && t < s.t1);
    if (!active.length) active.push(SHOTS[SHOTS.length - 1]);
    const A = active[0], B = active[1];
    for (const s of active) s.shot.update(t);
    const fx = { time: t, bloom: A.shot.bloom ?? 0.8, vignette: A.shot.vignette ?? 0.4, threshold: A.shot.threshold ?? 0.72, warmth: A.shot.warmth ?? 0 };
    let a = { shot: A.shot }, b = null;
    if (B) {
      const k = prog(t, B.t0, A.t1);
      const kk = ease.inOut(k);
      b = { shot: B.shot };
      const mixN = (x, y) => x + (y - x) * kk;
      fx.bloom = mixN(fx.bloom, B.shot.bloom ?? 0.8);
      fx.vignette = mixN(fx.vignette, B.shot.vignette ?? 0.4);
      fx.threshold = mixN(fx.threshold, B.shot.threshold ?? 0.72);
      fx.warmth = mixN(fx.warmth, B.shot.warmth ?? 0);
      switch (B.trans) {
        case 'zoom':
          a.z = 1 + 1.4 * ease.in(k); a.blur = 0.35 * k;
          b.z = 1 + 0.9 * Math.pow(1 - k, 2); b.blur = 0.3 * (1 - k);
          fx.k = ss(0.3, 0.7, k);
          fx.flash = 0.015 * Math.sin(Math.PI * k);
          break;
        case 'flash':
          fx.k = ss(0.35, 0.6, k);
          fx.flash = 0.35 * Math.pow(Math.sin(Math.PI * k), 3);
          a.z = 1 + 0.08 * k; b.z = 1.06 - 0.06 * k;
          break;
        case 'push':
          a.z = 1 + 0.25 * ease.in(k); a.blur = 0.12 * k;
          b.z = 0.94 + 0.06 * ease.out(k);
          fx.k = kk;
          break;
        default:
          fx.k = kk;
      }
    }
    fx.fade = ss(0, 0.6, t);
    comp.render(a, b, fx);
    overlay.draw(t);
  };
  window.__ready = true;
}

boot().catch((e) => { window.__error = String(e && e.stack || e); console.error(e); });
