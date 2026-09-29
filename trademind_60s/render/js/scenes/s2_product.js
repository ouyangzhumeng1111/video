// 02 | 6–13 s  先理解你的产品
// Bearing rotates in deep-blue space; manual / specs / applications / company
// profile unfold around it, then organise into 产品 → 应用 → 目标行业 with the
// gold line tracing the relation that matters.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import {
  C, FONT, W, H, DPR, PX, clamp, lerp, ss, ep, ease, prog, mulberry32, makePanel, glass, text, pill, icon, lines,
  GoldLine, softPoints, backdrop, deepSpaceBackdrop, bendPoints, glowSprite, roundRect, measure,
} from '../lib.js';
import { makeBearing, bearingPose, bearingLights } from '../bearing.js';

export const BEARING_TILT = (t) => new THREE.Euler(1.2, 0, -0.3 + (t - 6) * 0.035);
export const START_CAM = { pos: new THREE.Vector3(0, 0.3, 11), target: new THREE.Vector3(0, 0, 0) };

function faintLine(points, color = C.steel, opacity = 0.5, width = 1.6) {
  const m = new LineMaterial({ color: new THREE.Color(color), linewidth: width * DPR, transparent: true, opacity, depthWrite: false, toneMapped: false });
  m.resolution.set(W * DPR, H * DPR);
  const g = new LineGeometry();
  g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
  const l = new Line2(g, m);
  l.computeLineDistances();
  return l;
}

export async function create({ renderer }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 2000);
  scene.add(camera);
  backdrop(camera, (ctx, w, h) => deepSpaceBackdrop(ctx, w, h, { cx: 0.42, cy: 0.45, c0: '#143a6e', c1: '#0a1f42', c2: '#030a18' }));
  bearingLights(scene);

  const bearing = makeBearing(renderer, { scale: 2 });
  scene.add(bearing);
  const halo = glowSprite(C.gold, 9, 0.0);
  scene.add(halo);

  // dust
  const r = mulberry32(7);
  const dp = [], ds = [], da = [];
  for (let i = 0; i < 500; i++) { dp.push((r() - 0.5) * 40, (r() - 0.5) * 22, -r() * 25 + 6); ds.push(0.02 + r() * 0.05); da.push(0.2 + r() * 0.5); }
  const dust = softPoints(dp, { sizes: new Float32Array(ds), alphas: new Float32Array(da), color: '#9dbad9', additive: true });
  scene.add(dust);

  // ------------------------------------------------------------ doc panels
  const docs = [];
  const manual = makePanel(400, 270, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h);
    icon(ctx, 'doc', 34, 36, 24, C.goldHi);
    text(ctx, '产品手册', 58, 45, { size: 24, weight: 500 });
    text(ctx, '深沟球轴承系列', 58, 76, { size: 16, color: C.mist });
    // cross-section drawing
    ctx.save(); ctx.translate(96, 175); ctx.strokeStyle = 'rgba(207,224,242,0.7)'; ctx.lineWidth = 1.5;
    for (const rr of [58, 44, 28, 16]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(217,179,115,0.8)';
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 36, Math.sin(a) * 36, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    lines(ctx, 180, 128, 190, 5, { seed: 3, gap: 22, th: 7 });
  });
  const specs = makePanel(430, 320, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h);
    icon(ctx, 'table', 34, 36, 22, C.goldHi);
    text(ctx, '规格参数', 58, 45, { size: 24, weight: 500 });
    const rows = [['型号', '6205'], ['内径', '25 mm'], ['外径', '52 mm'], ['宽度', '15 mm'], ['精度等级', 'P5'], ['保持架', '黄铜']];
    rows.forEach(([k, v], i) => {
      const y = 96 + i * 36;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(22, y - 24, w - 44, 34);
      text(ctx, k, 38, y, { size: 18, color: C.mist });
      text(ctx, v, w - 38, y, { size: 19, font: FONT.mono, color: C.warm, align: 'right' });
    });
  });
  const apps = makePanel(400, 230, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h);
    icon(ctx, 'factory', 34, 38, 24, C.goldHi);
    text(ctx, '应用场景', 58, 45, { size: 24, weight: 500 });
    const chips = ['农业机械', '输送设备', '电机与泵', '减速机'];
    let x = 28, y = 88;
    for (const c of chips) { const cw = pill(ctx, c, x, y, { size: 18, fill: 'rgba(157,186,217,0.12)', stroke: 'rgba(157,186,217,0.45)', color: C.ice }); x += cw + 12; if (x > 260) { x = 28; y += 50; } }
  });
  const company = makePanel(400, 230, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h);
    icon(ctx, 'globe', 34, 38, 24, C.goldHi);
    text(ctx, '企业资料', 58, 45, { size: 24, weight: 500 });
    ['工厂介绍', '质量体系', '出口市场', '典型案例（脱敏）'].forEach((l, i) => {
      icon(ctx, 'dot', 40, 90 + i * 34, 12, C.gold);
      text(ctx, l, 56, 96 + i * 34, { size: 18, color: C.ice });
    });
  });
  const docDefs = [
    { p: manual, from: new THREE.Vector3(-5.6, 2.6, -1.5), rot: [0.05, 0.28, 0.02], at: 7.25 },
    { p: specs, from: new THREE.Vector3(5.4, 1.9, -1.0), rot: [0.02, -0.3, -0.02], at: 7.45 },
    { p: apps, from: new THREE.Vector3(5.4, -2.3, -0.5), rot: [-0.05, -0.25, 0.02], at: 7.65 },
    { p: company, from: new THREE.Vector3(-6.2, -1.25, -0.8), rot: [-0.04, 0.3, -0.01], at: 7.85 },
  ];
  for (const d of docDefs) { scene.add(d.p.mesh); d.p.mesh.renderOrder = 5; docs.push(d); }

  // ---------------------------------------------------- knowledge structure
  const COLX = { prod: -7.4, know: -3.7, app: 1.2, ind: 6.4 };
  const chipNames = ['产品手册', '规格参数', '应用场景', '企业资料'];
  const chipIcons = ['doc', 'table', 'factory', 'globe'];
  const chips = chipNames.map((n, i) => {
    const p = makePanel(220, 52, (ctx, s, w, h) => {
      glass(ctx, 1, 1, w - 2, h - 2, { r: 12, alpha: 0.9 });
      icon(ctx, chipIcons[i], 28, h / 2, 18, C.goldHi);
      text(ctx, n, 48, h / 2 + 1, { size: 19, baseline: 'middle', color: C.warm });
    });
    p.mesh.position.set(COLX.know, 1.35 - i * 0.78, 0);
    p.mesh.renderOrder = 10;
    p.opacity = 0;
    scene.add(p.mesh);
    return p;
  });
  const kbLabel = makePanel(220, 30, (ctx) => text(ctx, '企业知识 · 共同基础', 110, 20, { size: 16, color: C.gold, align: 'center', ls: 1 }));
  kbLabel.mesh.position.set(COLX.know, -1.95, 0); kbLabel.opacity = 0; scene.add(kbLabel.mesh);

  const card = (title, sub, ic, w = 300) => makePanel(w, 86, (ctx, s, cw, ch) => {
    glass(ctx, 1, 1, cw - 2, ch - 2, { r: 14, highlight: s.hl ?? 0, alpha: 0.9 });
    icon(ctx, ic, 38, ch / 2, 26, s.hl ? C.goldHi : C.mist);
    text(ctx, title, 70, 38, { size: 23, weight: 500, color: C.warm });
    text(ctx, sub, 70, 66, { size: 15, color: C.mist });
  }, { state: { hl: 0 } });
  const appDefs = [['农业机械', '变速箱 · 传动系统', 'factory'], ['输送设备', '滚筒 · 张紧轮', 'chart'], ['电机与泵', '转子支撑', 'bearing']];
  const indDefs = [['农机制造商', '拖拉机 · 收获机械', 'factory'], ['物流装备制造商', '输送与分拣系统', 'table'], ['电机 / 泵制造商', '工业电机 · 水泵', 'bearing']];
  const rowsY = [1.35, -0.25, -1.85];
  const appCards = appDefs.map(([a, b, c], i) => { const p = card(a, b, c); p.mesh.renderOrder = 10; p.mesh.position.set(COLX.app, rowsY[i], 0); p.opacity = 0; scene.add(p.mesh); return p; });
  const indCards = indDefs.map(([a, b, c], i) => { const p = card(a, b, c); p.mesh.renderOrder = 10; p.mesh.position.set(COLX.ind, rowsY[i], 0); p.opacity = 0; scene.add(p.mesh); return p; });
  const heads = [['产品', COLX.prod], ['企业知识', COLX.know], ['应用', COLX.app], ['目标行业', COLX.ind]].map(([n, x]) => {
    const p = makePanel(240, 34, (ctx) => { text(ctx, n, 120, 24, { size: 18, weight: 500, color: C.gold, align: 'center', ls: 3 }); });
    p.mesh.position.set(x, 2.55, 0); p.opacity = 0; scene.add(p.mesh); return p;
  });
  const prodLabel = makePanel(300, 60, (ctx) => {
    text(ctx, '6205 深沟球轴承', 150, 26, { size: 22, weight: 500, align: 'center' });
    text(ctx, '示例产品', 150, 52, { size: 15, color: C.mist, align: 'center' });
  });
  prodLabel.mesh.position.set(COLX.prod, -1.75, 0); prodLabel.opacity = 0; scene.add(prodLabel.mesh);

  // relation lines
  const V = (x, y) => new THREE.Vector3(x, y, 0);
  const faint = [];
  const addFaint = (a, b) => { const l = faintLine(bendPoints(a, b, 30), C.steel, 0, 1.4); l.renderOrder = 1; scene.add(l); faint.push(l); return l; };
  // bearing -> knowledge chips
  for (let i = 0; i < 4; i++) addFaint(V(COLX.prod + 1.25, 0.3), V(COLX.know - 1.12, 1.35 - i * 0.78));
  // knowledge -> applications
  for (let i = 0; i < 3; i++) addFaint(V(COLX.know + 1.12, 0.2), V(COLX.app - 1.52, rowsY[i]));
  // applications -> industries
  for (let i = 1; i < 3; i++) addFaint(V(COLX.app + 1.52, rowsY[i]), V(COLX.ind - 1.52, rowsY[i]));

  const gy = 0.18; // gap between 规格参数 and 应用场景 chips
  const goldPts = [
    ...bendPoints(V(COLX.prod + 1.2, 0.3), V(COLX.know - 1.3, gy), 16),
    ...bendPoints(V(COLX.know - 1.3, gy), V(COLX.know + 1.3, gy), 8).slice(1),
    ...bendPoints(V(COLX.know + 1.3, gy), V(COLX.app - 1.3, rowsY[0]), 24).slice(1),
    ...bendPoints(V(COLX.app - 1.3, rowsY[0]), V(COLX.ind - 1.3, rowsY[0]), 16).slice(1),
    ...bendPoints(V(COLX.ind - 1.3, rowsY[0]), V(COLX.ind + 1.3, rowsY[0]), 8).slice(1),
    ...bendPoints(V(COLX.ind + 1.3, rowsY[0]), V(COLX.ind + 6.5, rowsY[0] + 1.2), 16).slice(1),
  ].map((p) => p.setZ(-0.04));
  const gold = new GoldLine(goldPts, { width: 3, halo: 14, order: 2 });
  scene.add(gold.group);

  // ring of light traced around the bearing (continues from the factory shot)
  const ringPts = [];
  for (let i = 0; i <= 160; i++) { const a = -Math.PI / 2 + (i / 160) * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0)); }
  const ring = new GoldLine(ringPts, { width: 2.2, halo: 10, head: false, order: 21 });
  scene.add(ring.group);

  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  const P = (x, y, z) => new THREE.Vector3(x, y, z);

  function update(t) {
    // ---------------- camera
    const macro = ep(t, 6.0, 7.5, ease.inOut);
    const back = ep(t, 7.2, 9.0, ease.inOut);
    const wide = ep(t, 9.0, 11.2, ease.inOut);
    camPos.copy(START_CAM.pos);
    camPos.lerp(P(2.6, 1.3, 6.2), Math.sin(macro * Math.PI) * 0.85 + (macro > 0.5 ? 0 : 0));
    camTgt.set(0, 0, 0).lerp(P(1.0, 0.35, 0), Math.sin(macro * Math.PI) * 0.8);
    if (t > 7.2) { camPos.lerp(P(0, 0.2, 15.5), back); camTgt.lerp(P(0, 0, 0), back); }
    if (t > 9.0) { camPos.lerp(P(-0.4, 0.1, 19.6), wide); camTgt.lerp(P(-0.4, 0.1, 0), wide); }
    const drift = ep(t, 11.2, 13.4, ease.sine);
    camPos.x += drift * 0.5; camPos.z += drift * 0.9; camPos.y += drift * 0.15;
    camera.position.copy(camPos);
    camera.lookAt(camTgt);

    // ---------------- bearing
    bearingPose(bearing, t);
    bearing.rotation.copy(BEARING_TILT(t));
    const move = ep(t, 9.0, 10.8, ease.inOut);
    bearing.position.set(lerp(0, COLX.prod, move), lerp(0, 0.3, move), 0);
    bearing.scale.setScalar(lerp(2.0, 0.85, move));
    for (const [m, base] of bearing.userData.mats) m.envMapIntensity = base * lerp(1, 2.6, move);
    halo.position.copy(bearing.position); halo.position.z -= 1.2;
    halo.material.opacity = 0.18 + 0.1 * move;
    halo.scale.setScalar(lerp(10, 4.5, move));

    // ring of light around bearing
    ring.group.position.copy(bearing.position);
    ring.group.scale.setScalar(bearing.scale.x * 1.42);
    ring.group.lookAt(camera.position);
    const ringA = 1 - ss(8.6, 9.4, t);
    ring.set(0, 1, ringA * 0.9);

    // ---------------- docs unfold then collapse into chips
    docs.forEach((d, i) => {
      const inK = ep(t, d.at, d.at + 0.8, ease.out);
      const col = ep(t, 9.0 + i * 0.08, 10.0 + i * 0.08, ease.inOut);
      const m = d.p.mesh;
      const target = chips[i].mesh.position;
      m.position.copy(d.from).multiplyScalar(lerp(0.55, 1, inK));
      m.position.lerp(target, col);
      m.rotation.set(d.rot[0] * (1 - col), d.rot[1] * (1 - col) + (1 - inK) * 0.6 * Math.sign(d.rot[1]), d.rot[2] * (1 - col));
      m.scale.setScalar(lerp(0.7 + 0.3 * inK, 0.5, col));
      d.p.opacity = inK * (1 - ss(0.55, 1, col));
      // gentle float
      m.position.y += Math.sin(t * 1.3 + i) * 0.05 * (1 - col);
    });
    chips.forEach((c, i) => { c.opacity = ss(9.7 + i * 0.08, 10.2 + i * 0.08, t); });
    kbLabel.opacity = ss(10.3, 10.8, t);
    heads.forEach((h, i) => { h.opacity = ss(9.9 + i * 0.15, 10.4 + i * 0.15, t) * 0.95; });
    prodLabel.opacity = ss(10.2, 10.8, t);
    appCards.forEach((c, i) => { const k = ep(t, 10.1 + i * 0.12, 10.7 + i * 0.12, ease.out); c.opacity = k; c.mesh.position.x = COLX.app + (1 - k) * 0.6; c.redraw({ hl: i === 0 ? ss(11.2, 11.6, t) : 0 }); });
    indCards.forEach((c, i) => { const k = ep(t, 10.4 + i * 0.12, 11.0 + i * 0.12, ease.out); c.opacity = k; c.mesh.position.x = COLX.ind + (1 - k) * 0.6; c.redraw({ hl: i === 0 ? ss(11.9, 12.3, t) : 0 }); });
    faint.forEach((l, i) => { l.material.opacity = 0.55 * ss(10.0 + i * 0.05, 10.6 + i * 0.05, t); });
    // dim the non-highlighted rows once the gold path lands
    const focus = ss(12.0, 12.6, t);
    appCards.forEach((c, i) => { if (i) c.opacity *= 1 - 0.45 * focus; });
    indCards.forEach((c, i) => { if (i) c.opacity *= 1 - 0.45 * focus; });

    gold.set(0, ep(t, 10.6, 12.9, ease.inOut), 1);

    dust.rotation.y = t * 0.01;
    dust.position.y = Math.sin(t * 0.2) * 0.2;
  }

  return { scene, camera, update, bloom: 0.9, threshold: 0.7, vignette: 0.45 };
}
