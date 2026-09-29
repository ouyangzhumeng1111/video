// 08 | 53–60 s  品牌收束
// Pull back from the workbench: product → market → company → outreach →
// opportunity become one path above a real-world horizon (plant, port, city).
// Sunrise lights the sea; the gold line converges to the centre and opens onto
// the warm-white brand card (lockup drawn by overlay.js from 56.2 s).
import * as THREE from 'three';
import {
  C, FONT, W, H, lerp, ss, ep, ease, clamp, mulberry32, makePanel, glass, text, icon, lines, roundRect,
  GoldLine, pxCamera, px2w, glowSprite, backdrop, curvePoints, softPoints,
} from '../lib.js';

const HORIZON = 640; // px
const NODES = [
  { label: '产品', ic: 'bearing', x: 250, y: 470 },
  { label: '市场', ic: 'globe', x: 600, y: 405 },
  { label: '企业', ic: 'factory', x: 960, y: 380 },
  { label: '沟通', ic: 'mail', x: 1320, y: 405 },
  { label: '商机', ic: 'flag', x: 1670, y: 470 },
];

function drawSky(ctx, w, h, k) {
  // k: sunrise progress 0..1
  const hy = (HORIZON / H) * h;
  const g = ctx.createLinearGradient(0, 0, 0, hy);
  const top = `rgb(${Math.round(lerp(4, 14, k))},${Math.round(lerp(12, 34, k))},${Math.round(lerp(28, 70, k))})`;
  g.addColorStop(0, top);
  g.addColorStop(0.55, `rgb(${Math.round(lerp(10, 58, k))},${Math.round(lerp(28, 70, k))},${Math.round(lerp(62, 110, k))})`);
  g.addColorStop(0.86, `rgb(${Math.round(lerp(40, 196, k))},${Math.round(lerp(50, 132, k))},${Math.round(lerp(80, 110, k))})`);
  g.addColorStop(1, `rgb(${Math.round(lerp(90, 246, k))},${Math.round(lerp(80, 190, k))},${Math.round(lerp(90, 128, k))})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy);
  // sea
  const s = ctx.createLinearGradient(0, hy, 0, h);
  s.addColorStop(0, `rgb(${Math.round(lerp(20, 120, k))},${Math.round(lerp(34, 96, k))},${Math.round(lerp(64, 96, k))})`);
  s.addColorStop(0.25, `rgb(${Math.round(lerp(6, 22, k))},${Math.round(lerp(18, 44, k))},${Math.round(lerp(42, 80, k))})`);
  s.addColorStop(1, '#030a18');
  ctx.fillStyle = s; ctx.fillRect(0, hy, w, h - hy);
}

export async function create() {
  const scene = new THREE.Scene();
  const camera = pxCamera();
  scene.add(camera);
  let sunK = 0;
  const bd = backdrop(camera, (ctx, w, h) => drawSky(ctx, w, h, 0), 900);

  // sun + sea glitter
  const sun = glowSprite('#ffd9a0', 9, 0); sun.renderOrder = -40; scene.add(sun);
  const sunCore = glowSprite('#fff6e6', 2.2, 0); sunCore.renderOrder = -39; scene.add(sunCore);
  const glitterCv = document.createElement('canvas'); glitterCv.width = 512; glitterCv.height = 512;
  const glitterTex = new THREE.CanvasTexture(glitterCv); glitterTex.colorSpace = THREE.SRGBColorSpace;
  const glitter = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.6), new THREE.MeshBasicMaterial({ map: glitterTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glitter.position.copy(px2w(960, HORIZON + 230, -2)); glitter.renderOrder = -30; scene.add(glitter);
  const gr = mulberry32(2);
  const gl = Array.from({ length: 260 }, () => [gr(), gr(), gr()]);
  function drawGlitter(t, k) {
    const ctx = glitterCv.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);
    for (const [a, b, c] of gl) {
      const y = Math.pow(a, 1.6) * 512;
      const spread = 20 + (y / 512) * 230;
      const x = 256 + (b - 0.5) * 2 * spread * (0.6 + 0.4 * Math.sin(t * 3 + c * 20));
      const len = 6 + (y / 512) * 40 * c;
      ctx.fillStyle = `rgba(255,${Math.round(200 + 40 * c)},150,${(0.25 + 0.6 * c) * k * (1 - y / 700)})`;
      ctx.fillRect(x - len / 2, y, len, 1.5 + (y / 512) * 2);
    }
    glitterTex.needsUpdate = true;
  }

  // silhouettes: plant (left), port cranes + stacks, city (right)
  const sil = makePanel(2400, 360, (ctx, s, w, h) => {
    const r = mulberry32(8);
    const base = h;
    ctx.fillStyle = '#071631';
    // plant
    ctx.fillRect(40, base - 120, 380, 120);
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(40 + i * 63, base - 120); ctx.lineTo(40 + i * 63, base - 160); ctx.lineTo(103 + i * 63, base - 120); ctx.fill(); }
    ctx.fillRect(330, base - 250, 22, 130); ctx.fillRect(380, base - 220, 18, 100);
    ctx.fillRect(450, base - 70, 200, 70);
    // port cranes
    const crane = (x, hgt) => {
      ctx.fillRect(x, base - hgt, 10, hgt); ctx.fillRect(x + 60, base - hgt, 10, hgt);
      ctx.fillRect(x - 40, base - hgt - 10, 200, 12); ctx.fillRect(x + 20, base - hgt - 60, 8, 50);
      ctx.beginPath(); ctx.moveTo(x + 24, base - hgt - 60); ctx.lineTo(x + 150, base - hgt - 8); ctx.lineTo(x + 140, base - hgt - 6); ctx.closePath(); ctx.fill();
    };
    crane(700, 180); crane(880, 200);
    for (let i = 0; i < 24; i++) { const hh = 14 + Math.floor(r() * 3) * 14; ctx.fillRect(660 + i * 14, base - hh, 12, hh); }
    // city skyline
    let x = 1560;
    while (x < 2360) { const bw = 30 + r() * 50, bh = 90 + r() * 200; ctx.fillRect(x, base - bh, bw - 4, bh); x += bw; }
    // warm window lights
    ctx.fillStyle = 'rgba(255,210,140,0.75)';
    for (let i = 0; i < 180; i++) { const xx = 1560 + r() * 780, yy = base - 20 - r() * 200; ctx.fillRect(xx, yy, 3, 3); }
    for (let i = 0; i < 40; i++) ctx.fillRect(50 + r() * 360, base - 20 - r() * 90, 4, 3);
  }, { res: 1 });
  sil.mesh.position.copy(px2w(960, HORIZON - 180, -1.2));
  sil.mesh.renderOrder = -20;
  scene.add(sil.mesh);

  // workbench window that we pull back from (ends as the 商机 node)
  const bench = makePanel(1500, 860, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h, { r: 26, alpha: 0.92 });
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, w, 60);
    ['#e7a45a', '#d9b373', '#9dbad9'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(34 + i * 24, 30, 7, 0, Math.PI * 2); ctx.fill(); });
    text(ctx, 'TradeMind · 客户工作台', 130, 39, { size: 22, weight: 500, color: C.ice });
    const cols = [[40, 330], [400, 700], [1130, 330]];
    cols.forEach(([x, cw], i) => { glass(ctx, x, 100, cw, 700, { r: 16, alpha: 0.5 }); lines(ctx, x + 30, 150, cw - 60, 9, { seed: 90 + i, gap: 40, th: 12 }); });
  }, { res: 1 });
  bench.mesh.renderOrder = 40; scene.add(bench.mesh);

  const nodes = NODES.map((n) => {
    const p = makePanel(170, 170, (ctx, s, w, h) => {
      ctx.fillStyle = 'rgba(8,24,52,0.92)'; ctx.beginPath(); ctx.arc(w / 2, 62, 42, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,224,160,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      icon(ctx, n.ic, w / 2, 62, 34, C.goldHi);
      text(ctx, n.label, w / 2, 142, { size: 22, weight: 500, align: 'center', color: C.warm });
    });
    p.mesh.position.copy(px2w(n.x, n.y + 18, 0.1)); p.mesh.renderOrder = 30; p.opacity = 0; scene.add(p.mesh);
    const g = glowSprite(C.goldHi, 2.2, 0); g.position.copy(px2w(n.x, n.y - 2, 0)); g.renderOrder = 29; scene.add(g);
    return { p, g, n };
  });
  const pathPts = curvePoints(NODES.map((n) => px2w(n.x, n.y - 2, 0.05)), 160);
  const path = new GoldLine(pathPts, { width: 3, headSize: 1.0, order: 28 });
  scene.add(path.group);

  // convergence: a burst at centre, then warm white
  const burst = glowSprite('#fff1d6', 1, 0); burst.position.copy(px2w(960, 540, 1)); burst.renderOrder = 50; scene.add(burst);
  const whiteCv = document.createElement('canvas'); whiteCv.width = 960; whiteCv.height = 540;
  { const c = whiteCv.getContext('2d'); const g = c.createRadialGradient(480, 250, 60, 480, 270, 620); g.addColorStop(0, '#fbf8f1'); g.addColorStop(0.6, '#f6f1e8'); g.addColorStop(1, '#ece3d2'); c.fillStyle = g; c.fillRect(0, 0, 960, 540); }
  const whiteTex = new THREE.CanvasTexture(whiteCv); whiteTex.colorSpace = THREE.SRGBColorSpace;
  const white = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.01 * 1.02, H * 0.01 * 1.02), new THREE.MeshBasicMaterial({ map: whiteTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
  white.position.set(0, 0, 0); white.renderOrder = 100;
  scene.add(white);
  // faint champagne motes on the brand card
  const mr = mulberry32(12); const mp = [], ms = [], ma = [];
  for (let i = 0; i < 70; i++) { mp.push((mr() - 0.5) * 18, (mr() - 0.5) * 10, 1.5 + mr()); ms.push(0.03 + mr() * 0.05); ma.push(0.25 + mr() * 0.5); }
  const motes = softPoints(mp, { sizes: new Float32Array(ms), alphas: new Float32Array(ma), color: '#c9a45e', opacity: 0 });
  motes.renderOrder = 101; motes.material.depthTest = false; scene.add(motes);

  const shot = { scene, camera, update, bloom: 0.9, threshold: 0.72, vignette: 0.5 };
  function update(t) {
    // camera: continuous pull back
    const pb = ep(t, 52.7, 55.4, ease.out);
    camera.position.set(0, lerp(-0.2, 0, pb), lerp(12.5, 17.13, pb));
    camera.lookAt(0, lerp(-0.2, 0, pb), 0);

    sunK = ep(t, 53.0, 56.0, ease.inOut);
    bd.redraw((ctx, w, h) => drawSky(ctx, w, h, Math.round(sunK * 60) / 60));
    const sunY = lerp(HORIZON + 40, HORIZON - 70, sunK);
    sun.position.copy(px2w(960, sunY, -6)); sunCore.position.copy(px2w(960, sunY, -5.9));
    sun.material.opacity = 0.9 * sunK; sun.scale.setScalar(lerp(7, 12, sunK));
    sunCore.material.opacity = sunK;
    drawGlitter(t, sunK);
    glitter.material.opacity = 1;

    // workbench shrinks into the 商机 node
    const bk = ep(t, 52.8, 54.1, ease.inOut);
    const target = px2w(NODES[4].x, NODES[4].y - 2, 0.3);
    bench.mesh.position.copy(new THREE.Vector3(0, 0, 0.5).lerp(target, bk));
    bench.mesh.scale.setScalar(lerp(1, 0.06, bk));
    bench.opacity = 1 - ss(53.8, 54.15, t);

    const conv = ep(t, 55.35, 56.15, ease.in); // converge to centre
    nodes.forEach(({ p, g, n }, i) => {
      const a = ss(53.4 + i * 0.22, 53.8 + i * 0.22, t);
      const home = px2w(n.x, n.y + 18, 0.1);
      p.mesh.position.copy(home.clone().lerp(px2w(960, 540, 0.1), conv));
      p.mesh.scale.setScalar(lerp(1, 0.3, conv));
      p.opacity = a * (1 - ss(55.5, 56.0, t));
      g.position.copy(px2w(n.x, n.y - 2, 0).lerp(px2w(960, 540, 0), conv));
      g.material.opacity = 0.35 * a;
    });
    path.group.position.set(0, 0, 0);
    const pk = ep(t, 53.5, 55.0, ease.inOut);
    path.set(0, pk, 1);
    path.headOn = pk < 1;
    // squeeze the path toward the centre
    const cc = px2w(960, 540, 0);
    path.group.scale.setScalar(lerp(1, 0.02, conv));
    path.group.position.copy(cc.clone().multiplyScalar(conv)).add(new THREE.Vector3(0, 0, 0));
    burst.material.opacity = ss(55.5, 55.95, t);
    burst.scale.setScalar(lerp(0.5, 30, ep(t, 55.6, 56.2, ease.in)));
    white.material.opacity = ss(56.0, 56.2, t);
    motes.material.uniforms.uOpacity.value = 0.6 * ss(56.5, 57.2, t);
    motes.position.y = (t - 56) * 0.04;

    // grade: glow on the dawn, calm and clean on the brand card
    const wb = ss(56.0, 56.25, t);
    shot.bloom = lerp(0.95, 0.0, wb);
    shot.vignette = lerp(0.45, 0.1, wb);
    shot.threshold = lerp(0.72, 1.5, wb);
  }
  return shot;
}
