// 03 | 13–21 s  从市场，看见匹配买家
// Product outline ripples into a 3D dot-matrix world map. Trade flows, industry
// distribution and market tags layer in; the camera follows one route into the
// target market, factories rise, and trade records / websites / public sources
// converge into candidate company cards. No invented figures.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import {
  C, FONT, W, H, DPR, clamp, lerp, ss, ep, ease, prog, mulberry32, makePanel, glass, text, pill, icon, roundRect,
  GoldLine, softPoints, glowSprite, measure,
} from '../lib.js';
import { CITIES } from '../geo.js';

const S = 0.2; // world units per degree
const X = (lon) => lon * S, Z = (lat) => -lat * S;
const V = (lat, lon, y = 0) => new THREE.Vector3(X(lon), y, Z(lat));
const TANH = Math.tan((35 * Math.PI) / 360);

export const CANDIDATES = [
  { name: '示例客户 A', where: '德国 · 农业机械制造', src: ['贸易记录', '官网', '公开资料'], tag: '高度匹配', match: 2, lat: 52.1, lon: 9.4 },
  { name: '候选企业 B', where: '波兰 · 输送设备', src: ['官网', '公开资料'], tag: '匹配', match: 1, lat: 52.3, lon: 17.0 },
  { name: '候选企业 C', where: '荷兰 · 五金贸易', src: ['贸易记录'], tag: '待评估', match: 0, lat: 51.9, lon: 5.2 },
  { name: '候选企业 D', where: '意大利 · 农机零部件', src: ['贸易记录', '官网'], tag: '匹配', match: 1, lat: 45.2, lon: 10.4 },
  { name: '候选企业 E', where: '法国 · 建材分销', src: ['公开资料'], tag: '不相关', match: -1, lat: 47.1, lon: 2.6 },
];

export function candidateCard(c) {
  return makePanel(360, 138, (ctx, s, w, h) => {
    const hl = s.hl ?? 0;
    glass(ctx, 1, 1, w - 2, h - 2, { r: 14, highlight: hl, alpha: 0.88 });
    icon(ctx, 'factory', 36, 40, 26, hl > 0.5 ? C.goldHi : C.mist);
    text(ctx, c.name, 66, 46, { size: 23, weight: 500 });
    text(ctx, c.where, 66, 74, { size: 16, color: C.mist });
    // match tag
    const good = c.match > 0;
    const tagA = s.tag ?? 0;
    if (tagA > 0) {
      const tw = measure(ctx, c.tag, { size: 15, weight: 500 }) + 24;
      pill(ctx, c.tag, w - tw - 16, 20, {
        size: 15, alpha: tagA,
        fill: good ? 'rgba(217,179,115,0.18)' : 'rgba(157,186,217,0.08)',
        stroke: good ? 'rgba(255,224,160,0.8)' : 'rgba(157,186,217,0.35)',
        color: good ? C.goldHi : C.pending, dashed: !good,
      });
    }
    // source marks
    let x = 66;
    for (const src of c.src) {
      const pw = pill(ctx, src, x, 92, { size: 13, h: 26, padX: 9, fill: 'rgba(157,186,217,0.1)', stroke: 'rgba(157,186,217,0.4)', color: C.ice, icon: src === '官网' ? 'globe' : src === '贸易记录' ? 'table' : 'doc', iconColor: C.gold });
      x += pw + 8;
    }
  }, { state: { hl: 0, tag: 0 } });
}

function sourceChip(title, sub, ic) {
  return makePanel(270, 70, (ctx, s, w, h) => {
    glass(ctx, 1, 1, w - 2, h - 2, { r: 14, alpha: 0.85, highlight: s.hl ?? 0 });
    icon(ctx, ic, 34, h / 2, 24, C.goldHi);
    text(ctx, title, 62, 31, { size: 20, weight: 500 });
    text(ctx, sub, 62, 54, { size: 14, color: C.mist });
  }, { state: { hl: 0 } });
}

function marketTag(label) {
  return makePanel(230, 44, (ctx, s, w, h) => {
    ctx.fillStyle = 'rgba(6,21,48,0.72)'; roundRect(ctx, 2, 2, w - 4, h - 4, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(217,179,115,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = C.gold; ctx.fillRect(12, 14, 3, h - 28);
    text(ctx, label, 24, h / 2 + 1, { size: 18, weight: 500, baseline: 'middle', color: C.warm });
  });
}

function arcPoints(a, b, n = 72, lift = 0.22) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y = a.distanceTo(b) * lift;
  const c = new THREE.QuadraticBezierCurve3(a, mid, b);
  return c.getPoints(n);
}

function thinLine(points, color, opacity, width = 1.4) {
  const m = new LineMaterial({ color: new THREE.Color(color), linewidth: width * DPR, transparent: true, opacity, depthWrite: false, toneMapped: false });
  m.resolution.set(W * DPR, H * DPR);
  const g = new LineGeometry(); g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
  return new Line2(g, m);
}

export async function create({ renderer, assets }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030b1a');
  scene.fog = new THREE.Fog('#030b1a', 40, 95);
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 500);
  scene.add(camera);

  // soft radial floor glow under the map
  const floorCv = document.createElement('canvas'); floorCv.width = floorCv.height = 512;
  { const c = floorCv.getContext('2d'); const g = c.createRadialGradient(256, 256, 0, 256, 256, 256); g.addColorStop(0, 'rgba(22,63,120,0.55)'); g.addColorStop(1, 'rgba(3,11,26,0)'); c.fillStyle = g; c.fillRect(0, 0, 512, 512); }
  const floorTex = new THREE.CanvasTexture(floorCv); floorTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(110, 70).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false }));
  floor.position.set(4, -0.05, -4); scene.add(floor);

  // graticule
  const grat = new THREE.Group(); scene.add(grat);
  const gm = new THREE.LineBasicMaterial({ color: '#3d6c9e', transparent: true, opacity: 0.12, depthWrite: false });
  for (let lat = -60; lat <= 75; lat += 15) grat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(lat, -180), V(lat, 180)]), gm));
  for (let lon = -180; lon <= 180; lon += 15) grat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(-60, lon), V(78, lon)]), gm));

  // land dots
  const land = assets.land;
  const pos = [], cols = [], sizes = [], hiPos = [], hiSizes = [];
  const clusters = [[51, 10, 9], [45, 10, 4], [52, 19, 4], [41, -88, 9], [-22, -48, 7], [22, 78, 8], [12, 104, 7], [35, 115, 7], [30, 45, 5]];
  const baseC = new THREE.Color('#3f6d9f');
  for (let lat = -58; lat <= 76; lat += 0.75) {
    for (let lon = -180; lon < 180; lon += 0.75) {
      if (!land.isLand(lat, lon)) continue;
      pos.push(X(lon), 0, Z(lat));
      const k = 0.75 + 0.25 * Math.sin(lat * 0.3 + lon * 0.2);
      cols.push(baseC.r * k, baseC.g * k, baseC.b * k);
      sizes.push(0.085);
      let w = 0;
      for (const [cl, co, rad] of clusters) { const d = Math.hypot(lat - cl, (lon - co) * Math.cos((lat * Math.PI) / 180)); w = Math.max(w, Math.exp(-(d * d) / (rad * rad))); }
      if (w > 0.25) { hiPos.push(X(lon), 0.02, Z(lat)); hiSizes.push(0.06 + 0.07 * w); }
    }
  }
  const dots = softPoints(pos, { colors: new Float32Array(cols), sizes: new Float32Array(sizes), hard: 0.5 });
  scene.add(dots);
  const hi = softPoints(hiPos, { sizes: new Float32Array(hiSizes), color: '#9fd0ff', additive: true, opacity: 0, hard: 0.2 });
  scene.add(hi);

  // trade flows from the Yangtze delta
  const origin = V(30.0, 121.8);
  const dests = [['hamburg', true], ['rotterdam'], ['santos'], ['losangeles'], ['dubai'], ['mumbai'], ['singapore'], ['lagos'], ['houston'], ['istanbul']];
  const flows = dests.map(([k, main], i) => {
    const [lat, lon] = CITIES[k];
    let b = V(lat, lon);
    if (lon < -30) b = V(lat, lon); // Americas drawn going east across the Pacific map edge is messy; keep direct
    const pts = arcPoints(origin, b, 90, main ? 0.2 : 0.16);
    const line = thinLine(pts, '#6fa3de', 0, 1.3);
    scene.add(line);
    const sparks = [0, 1, 2].map(() => { const s = glowSprite(C.goldHi, 0.9, 0); scene.add(s); return s; });
    return { pts, line, sparks, main: !!main, at: 13.7 + i * 0.1, curve: new THREE.CatmullRomCurve3(pts) };
  });
  const mainFlow = flows[0];
  const route = new GoldLine(mainFlow.pts, { width: 3, headSize: 1.6, order: 5 });
  scene.add(route.group);
  const originGlow = glowSprite(C.goldHi, 2.4, 0); originGlow.position.copy(origin); scene.add(originGlow);

  // market tags (billboards anchored on the map)
  const tagDefs = [['欧洲 · 农业机械', 60, 4, 14.9], ['中东 · 电机与泵', 33, 44, 15.05], ['非洲 · 农业机械', 6, 14, 15.2], ['南亚 · 农业机械', 28, 74, 15.35], ['东南亚 · 输送设备', 17, 104, 15.5]];
  const tags = tagDefs.map(([label, lat, lon, at]) => { const p = marketTag(label); p.mesh.geometry.translate(1.15, 0.22, 0); scene.add(p.mesh); p.opacity = 0; return { p, anchor: V(lat, lon, 0.6), at }; });

  // factories + pins at candidate locations
  const bMat = new THREE.MeshStandardMaterial({ color: '#27476f', roughness: 0.6, metalness: 0.3 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#3d6c9e', roughness: 0.5, metalness: 0.4 });
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28f').multiplyScalar(1.6), toneMapped: false });
  const rr = mulberry32(31);
  const sites = CANDIDATES.map((c, ci) => {
    const g = new THREE.Group();
    const center = V(c.lat, c.lon);
    g.position.copy(center);
    const n = ci === 0 ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const w = 0.16 + rr() * 0.16, d = 0.2 + rr() * 0.22, h = 0.08 + rr() * 0.12 + (ci === 0 && i === 0 ? 0.06 : 0);
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat); body.position.y = h / 2; b.add(body);
      // sawtooth roof
      const teeth = 3;
      for (let k = 0; k < teeth; k++) {
        const shp = new THREE.Shape(); shp.moveTo(0, 0); shp.lineTo(d / teeth, 0); shp.lineTo(0, h * 0.35); shp.closePath();
        const tg = new THREE.ExtrudeGeometry(shp, { depth: w, bevelEnabled: false });
        const tm = new THREE.Mesh(tg, roofMat); tm.rotation.y = Math.PI / 2; tm.position.set(w / 2, h, -d / 2 + (k * d) / teeth); b.add(tm);
      }
      const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.18), winMat); win.position.set(0, h * 0.45, d / 2 + 0.002); b.add(win);
      if (i === 0) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, h * 2.2, 10), bMat); ch.position.set(w * 0.3, h * 1.1, -d * 0.25); b.add(ch); }
      const ang = rr() * Math.PI * 2, rad = i === 0 ? 0 : 0.18 + rr() * 0.28;
      b.position.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad);
      b.rotation.y = rr() * 0.6 - 0.3;
      g.add(b);
    }
    g.scale.set(1, 0.001, 1);
    scene.add(g);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.match > 0 ? '#ffe0a0' : '#9dbad9').multiplyScalar(1.8), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    beam.position.copy(center).add(new THREE.Vector3(0, 0.7, 0)); scene.add(beam);
    const cap = glowSprite(c.match > 0 ? C.goldHi : C.mist, 0.5, 0); cap.position.copy(center).add(new THREE.Vector3(0, 1.42, 0)); scene.add(cap);
    return { g, beam, cap, center, c };
  });
  const sun = new THREE.DirectionalLight('#ffd6a0', 2.2); sun.position.set(-10, 8, 6); scene.add(sun);
  scene.add(new THREE.HemisphereLight('#7fa6de', '#0a1830', 1.0));

  // ---------------- camera-relative UI: source chips, candidate cards
  const chips = [
    sourceChip('贸易记录', '进出口与提单数据', 'table'),
    sourceChip('企业官网', '产品与业务页面', 'globe'),
    sourceChip('公开资料', '新闻 · 招聘 · 展会', 'doc'),
  ];
  const chipXY = [[250, 330], [250, 440], [250, 550]];
  chips.forEach((p) => { p.mesh.renderOrder = 30; p.mat = p.mesh.material; p.mat.depthTest = false; scene.add(p.mesh); p.opacity = 0; });
  const cards = CANDIDATES.map((c) => { const p = candidateCard(c); p.mesh.renderOrder = 31; p.mesh.material.depthTest = false; scene.add(p.mesh); p.opacity = 0; return p; });
  const cardXY = [[1520, 190], [1520, 350], [1520, 510], [1520, 670], [1520, 830]];
  // streams: source -> card (only where the card lists that source)
  const srcIndex = { '贸易记录': 0, '官网': 1, '公开资料': 2 };
  const streams = [];
  CANDIDATES.forEach((c, ci) => c.src.forEach((s) => streams.push([srcIndex[s], ci])));
  const streamLines = streams.map(([si, ci]) => {
    const a = new THREE.Vector2(chipXY[si][0] + 135, chipXY[si][1]), b = new THREE.Vector2(cardXY[ci][0] - 180, cardXY[ci][1]);
    const pts2 = new THREE.CubicBezierCurve(a, new THREE.Vector2(lerp(a.x, b.x, 0.45), a.y), new THREE.Vector2(lerp(a.x, b.x, 0.55), b.y), b).getPoints(40);
    const l = thinLine(pts2.map(() => new THREE.Vector3()), CANDIDATES[ci].match > 0 ? '#d9b373' : '#6f93bf', 0, 1.4);
    l.renderOrder = 29; l.material.depthTest = false;
    scene.add(l);
    const sparks = [0, 1].map(() => { const s = glowSprite(C.goldHi, 0.25, 0); s.renderOrder = 32; s.material.depthTest = false; scene.add(s); return s; });
    return { pts2, l, sparks, si, ci };
  });

  const D = 10; // UI depth in front of camera
  const screen = (px, py, d = D) => camera.localToWorld(new THREE.Vector3(((px - 960) / 960) * d * TANH * (W / H), (-(py - 540) / 540) * d * TANH, -d));
  const place = (panel, px, py, d = D, scale = 1) => {
    panel.mesh.position.copy(screen(px, py, d));
    panel.mesh.quaternion.copy(camera.quaternion);
    panel.mesh.scale.setScalar((d / 17.13) * scale);
  };

  // product outline ripple (ties the bearing ring to the map)
  const ringPts = [];
  for (let i = 0; i <= 180; i++) { const a = (i / 180) * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
  const ripple = new GoldLine(ringPts, { width: 2.4, head: false, order: 40, depthTest: false });
  scene.add(ripple.group);

  const K = [
    { t: 12.8, pos: [9, 40, 27], look: [9, 0, -4] },
    { t: 15.7, pos: [13, 31, 19], look: [11, 0, -5.5] },
    { t: 17.7, pos: [4.6, 6.6, -4.2], look: [2.4, 0, -10.2] },
    { t: 21.3, pos: [4.0, 5.6, -5.0], look: [2.3, 0, -10.3] },
  ];
  const cp = new THREE.Vector3(), cl = new THREE.Vector3();
  function camAt(t) {
    let i = 0;
    while (i < K.length - 2 && t > K[i + 1].t) i++;
    const a = K[i], b = K[i + 1];
    const k = i === 1 ? ep(t, a.t, b.t, ease.inOut) : ep(t, a.t, b.t, ease.sine);
    cp.fromArray(a.pos).lerp(new THREE.Vector3().fromArray(b.pos), k);
    cl.fromArray(a.look).lerp(new THREE.Vector3().fromArray(b.look), k);
    if (i === 1) cp.y += Math.sin(k * Math.PI) * 4; // arc over the route
    camera.position.copy(cp); camera.lookAt(cl); camera.updateMatrixWorld();
  }

  function update(t) {
    camAt(t);
    // ripple: product outline expanding into the map
    const rk = ep(t, 12.8, 14.0, ease.out);
    ripple.group.position.copy(screen(960, 540, 12));
    ripple.group.quaternion.copy(camera.quaternion);
    ripple.group.scale.setScalar(lerp(1.3, 9, rk));
    ripple.set(0, 1, 1 - ss(13.3, 14.0, t));

    dots.material.uniforms.uOpacity.value = ep(t, 12.9, 13.8, ease.out);
    hi.material.uniforms.uOpacity.value = 0.9 * ss(14.4, 15.2, t) * (1 - 0.5 * ss(17.5, 18.5, t));
    grat.children.forEach((l) => { l.material.opacity = 0.12 * ss(13.0, 13.8, t); });
    originGlow.material.opacity = ss(13.6, 14.0, t) * (0.7 + 0.3 * Math.sin(t * 6));

    flows.forEach((f, i) => {
      const a = ss(f.at, f.at + 0.5, t) * (1 - 0.6 * ss(17.2, 18.0, t));
      f.line.material.opacity = (f.main ? 0.25 : 0.4) * a;
      f.sparks.forEach((s, j) => {
        const u = ((t - f.at) * 0.35 + j / 3) % 1;
        s.position.copy(f.curve.getPointAt(clamp(u)));
        s.material.opacity = a * Math.sin(u * Math.PI) * 0.9;
        s.scale.setScalar(0.7);
      });
    });
    route.set(0, ep(t, 15.4, 17.3, ease.inOut), 1);
    route.headOn = t < 17.3;

    tags.forEach(({ p, anchor, at }) => {
      p.mesh.position.copy(anchor);
      p.mesh.quaternion.copy(camera.quaternion);
      p.mesh.scale.setScalar(camera.position.distanceTo(anchor) / 17.13);
      p.opacity = ss(at, at + 0.4, t) * (1 - ss(15.9, 16.4, t));
    });

    sites.forEach((s, i) => {
      const k = ep(t, 17.0 + i * 0.12, 17.7 + i * 0.12, ease.outBack);
      s.g.scale.set(1, Math.max(0.001, k), 1);
      const b = ss(17.3 + i * 0.12, 17.7 + i * 0.12, t) * (s.c.match > 0 ? 0.85 : 0.35) * (1 - ss(20.1, 20.6, t));
      s.beam.material.opacity = b;
      s.cap.material.opacity = b;
    });

    // source chips + cards
    chips.forEach((p, i) => {
      const k = ep(t, 17.9 + i * 0.12, 18.4 + i * 0.12, ease.out);
      place(p, chipXY[i][0] - (1 - k) * 60, chipXY[i][1]);
      p.opacity = k * (1 - ss(20.0, 20.5, t));
      p.redraw({ hl: ss(18.4, 18.8, t) * (1 - ss(19.6, 20.0, t)) * 0.6 });
    });
    streamLines.forEach((sl, n) => {
      const pts = sl.pts2.map((q) => screen(q.x, q.y, D + 0.02));
      sl.l.geometry.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
      const a = ss(18.4 + n * 0.03, 18.8 + n * 0.03, t) * (1 - ss(19.8, 20.3, t));
      sl.l.material.opacity = a * (CANDIDATES[sl.ci].match > 0 ? 0.6 : 0.25);
      sl.sparks.forEach((sp, j) => {
        const u = clamp(((t - 18.45 - n * 0.02) * 0.9 + j * 0.5) % 1.0);
        const q = sl.pts2[Math.min(sl.pts2.length - 1, Math.floor(u * (sl.pts2.length - 1)))];
        sp.position.copy(screen(q.x, q.y, D - 0.05));
        sp.material.opacity = a * Math.sin(u * Math.PI);
        sp.scale.setScalar(0.28);
      });
    });
    const order = [0, 1, 3, 2, 4]; // highlight sequence: relevant ones first
    cards.forEach((p, i) => {
      const k = ep(t, 18.7 + i * 0.1, 19.2 + i * 0.1, ease.out);
      const c = CANDIDATES[i];
      const hlAt = 19.35 + order.indexOf(i) * 0.22;
      const hl = c.match > 0 ? ss(hlAt, hlAt + 0.25, t) * (c.match === 2 ? 1 : 0.6) : 0;
      const dim = c.match <= 0 ? 0.55 * ss(19.9, 20.2, t) : 0;
      // main card travels to centre before the push into scene 04
      const go = i === 0 ? ep(t, 20.05, 20.85, ease.inOut) : 0;
      const x = lerp(cardXY[i][0] + (1 - k) * 60, 960, go), y = lerp(cardXY[i][1], 540, go);
      place(p, x, y, D, lerp(1, 1.55, go));
      p.opacity = k * (1 - dim) * (i === 0 ? 1 : 1 - ss(20.0, 20.4, t));
      p.redraw({ hl: Math.round(hl * 20) / 20, tag: Math.round(ss(hlAt - 0.1, hlAt + 0.2, t) * 20) / 20 });
    });
  }

  return { scene, camera, update, bloom: 0.85, threshold: 0.7, vignette: 0.5 };
}
