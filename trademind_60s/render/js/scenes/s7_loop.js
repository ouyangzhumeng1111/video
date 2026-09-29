// 07 | 45–53 s  让纠错留下可复用的依据
// A salesperson corrects one field of a research report; the feedback is kept
// with its original source. Later the user starts a new background check; the
// system recalls the feedback, re-checks it against fresh evidence, and only
// then adopts it — the old version stays traceable. Gold loop: 反馈 → 复核 → 采用.
import * as THREE from 'three';
import {
  C, FONT, W, H, lerp, ss, ep, ease, clamp, makePanel, glass, text, pill, icon, lines, roundRect, measure,
  GoldLine, makeStage, px2w, thinLine, glowSprite, statusPill, pillWidth, typed,
} from '../lib.js';

const RP = { x: 470, y: 470, w: 540, h: 390 };
const LOOP = { x: 1010, y: 520, r: 125 };
const NODES = [
  { label: '反馈', a: -Math.PI / 2 },
  { label: '复核', a: -Math.PI / 2 + (2 * Math.PI) / 3 },
  { label: '采用', a: -Math.PI / 2 + (4 * Math.PI) / 3 },
];
const nodePx = (i, r = LOOP.r) => [LOOP.x + Math.cos(NODES[i].a) * r, LOOP.y + Math.sin(NODES[i].a) * r];

function cursor(ctx, x, y, a, press = 0) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(1 - 0.1 * press, 1 - 0.1 * press);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.lineTo(7, 20); ctx.lineTo(12, 31); ctx.lineTo(17, 29); ctx.lineTo(12, 18); ctx.lineTo(21, 18); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#0b2146'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
}

export async function create() {
  const st = makeStage({ seed: 71 });
  const { scene, camera } = st;

  // ---------------- report (v1 -> v2)
  const report = makePanel(RP.w, RP.h, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h, { r: 18, alpha: 0.9, highlight: s.v2hl ?? 0 });
    icon(ctx, 'doc', 36, 42, 24, C.goldHi);
    text(ctx, '客户研究报告', 62, 50, { size: 23, weight: 500 });
    text(ctx, '示例客户 A', 64, 78, { size: 15, color: C.mist });
    pill(ctx, s.v2 ? 'v2' : 'v1', w - 74, 28, { size: 15, font: FONT.en, fill: s.v2 ? 'rgba(217,179,115,0.2)' : 'rgba(157,186,217,0.1)', stroke: s.v2 ? 'rgba(255,224,160,0.8)' : 'rgba(157,186,217,0.5)', color: s.v2 ? C.goldHi : C.ice });
    ctx.fillStyle = 'rgba(157,186,217,0.15)'; ctx.fillRect(24, 100, w - 48, 1);
    const rows = [
      ['主营业务', '拖拉机 · 收获机械', 'ok'],
      ['采购对接', s.v2 ? '供应链负责人' : '采购经理', s.v2 ? 'adopt' : 'none'],
      ['近期动态', '产线扩建公告', 'pending'],
    ];
    rows.forEach(([k, v, state], i) => {
      const y = 150 + i * 82;
      if (i === 1 && (s.flag ?? 0) > 0) {
        roundRect(ctx, 14, y - 36, w - 28, 74, 12);
        ctx.fillStyle = s.v2 ? `rgba(217,179,115,${0.12 * s.flag})` : `rgba(231,164,90,${0.12 * s.flag})`; ctx.fill();
        ctx.strokeStyle = s.v2 ? `rgba(255,224,160,${0.8 * s.flag})` : `rgba(231,164,90,${0.8 * s.flag})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
      text(ctx, k, 32, y - 8, { size: 15, color: C.mist });
      text(ctx, v, 32, y + 22, { size: 20, color: C.warm });
      if (state === 'adopt') {
        const pw = pillWidth(ctx, '经复核采用', 14, true);
        statusPill(ctx, 'ok', w - pw - 28, y - 14, { size: 14, okText: '经复核采用' });
      } else if (state !== 'none') {
        const lbl = state === 'ok' ? '已核实' : '待确认';
        const pw = pillWidth(ctx, lbl, 14, true);
        statusPill(ctx, state, w - pw - 28, y - 14, { size: 14 });
      }
    });
    if ((s.hist ?? 0) > 0) {
      ctx.save(); ctx.globalAlpha = s.hist;
      ctx.fillStyle = 'rgba(157,186,217,0.12)'; ctx.fillRect(24, 330, w - 48, 1);
      icon(ctx, 'loop', 38, 358, 16, C.mist);
      const t0 = '历史版本 v1：';
      text(ctx, t0, 56, 364, { size: 15, color: C.mist });
      const x0 = 56 + measure(ctx, t0, { size: 15 });
      text(ctx, '采购经理', x0, 364, { size: 15, color: C.mist });
      const sw = measure(ctx, '采购经理', { size: 15 });
      ctx.fillStyle = C.mist; ctx.fillRect(x0, 358, sw, 1.3);
      text(ctx, '· 可追溯', x0 + sw + 8, 364, { size: 15, color: C.gold });
      ctx.restore();
    }
    if ((s.cur ?? 0) > 0) cursor(ctx, lerp(w - 40, 300, s.curK ?? 0), lerp(h + 10, 240, s.curK ?? 0), s.cur);
  }, { state: {} });
  st.add(report, RP.x, RP.y, 0, 10);

  // correction popover
  const pop = makePanel(470, 170, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h, { r: 14, alpha: 0.96, stroke: 'rgba(231,164,90,0.7)' });
    icon(ctx, 'pen', 30, 32, 20, C.amber);
    text(ctx, '提交纠错', 52, 39, { size: 18, weight: 500, color: C.amber });
    text(ctx, typed('采购对接已调整为供应链负责人', s.type ?? 0), 28, 78, { size: 18, color: C.warm });
    icon(ctx, 'link', 36, 112, 16, C.gold);
    text(ctx, '附：原始来源 · 官网团队页', 52, 118, { size: 15, color: C.mist });
    const bx = w - 120, by = 124, bw = 96, bh = 34;
    roundRect(ctx, bx, by, bw, bh, 9); ctx.fillStyle = `rgba(231,164,90,${0.75 + 0.25 * (s.press ?? 0)})`; ctx.fill();
    text(ctx, s.sent ? '已保存' : '提交', bx + bw / 2, by + bh / 2 + 1, { size: 15, weight: 500, color: '#1a1408', align: 'center', baseline: 'middle' });
  }, { state: {} });
  st.add(pop, 930, 470, 0.6, 20);

  // feedback note that travels: popover -> archive -> loop
  const note = makePanel(280, 92, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h, { r: 12, alpha: 0.95, stroke: 'rgba(231,164,90,0.7)' });
    icon(ctx, 'pen', 26, 28, 16, C.amber);
    text(ctx, '纠错反馈', 44, 34, { size: 16, weight: 500, color: C.amber });
    text(ctx, '含原始来源', w - 18, 34, { size: 13, color: C.mist, align: 'right' });
    text(ctx, '采购对接 → 供应链负责人', 20, 70, { size: 16, color: C.warm });
  });
  note.mesh.renderOrder = 25; scene.add(note.mesh);

  // archive
  const archive = makePanel(330, 140, (ctx, s, w, h) => {
    for (let k = 2; k >= 1; k--) { roundRect(ctx, 8 + k * 6, 8 - k * 5 + 10, w - 16 - k * 12, h - 30, 12); ctx.fillStyle = `rgba(22,52,98,${0.4 - k * 0.1})`; ctx.fill(); }
    glass(ctx, 4, 14, w - 8, h - 18, { r: 14, alpha: 0.9, highlight: s.hl ?? 0 });
    icon(ctx, 'table', 32, 50, 20, C.goldHi);
    text(ctx, '反馈记录', 54, 56, { size: 19, weight: 500 });
    text(ctx, (s.saved ?? 0) > 0.5 ? '已保存 · 含原始来源' : '暂无新反馈', 30, 98, { size: 15, color: (s.saved ?? 0) > 0.5 ? C.gold : C.mist });
  }, { state: {} });
  st.add(archive, 1590, 300, -0.2, 10);

  // timeline across the top
  const TLY = 120;
  const tlLine = thinLine([px2w(250, TLY, 0), px2w(1700, TLY, 0)], C.mist, 0, 1.4, { order: 9 });
  scene.add(tlLine);
  const tlLabels = makePanel(1600, 90, (ctx, s, w, h) => {
    const off = s.off ?? 0;
    for (let x = 0; x < w + 200; x += 60) { const xx = x - off; if (xx < 0 || xx > w) continue; ctx.fillStyle = 'rgba(157,186,217,0.35)'; ctx.fillRect(xx, 38, 1.2, 10); }
    text(ctx, '本轮背调', 190 - off * 0.2, 28, { size: 15, color: C.mist, align: 'center' });
    text(ctx, '下一轮背调', 1050, 28, { size: 15, color: (s.next ?? 0) > 0.5 ? C.goldHi : C.mist, align: 'center' });
    // start button under "next"
    const bx = 985, by = 56, bw = 130, bh = 32;
    ctx.globalAlpha = s.btn ?? 0;
    roundRect(ctx, bx, by, bw, bh, 16); ctx.fillStyle = `rgba(217,179,115,${0.2 + 0.6 * (s.press ?? 0)})`; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,160,0.8)'; ctx.lineWidth = 1.3; ctx.stroke();
    text(ctx, '发起背调', bx + bw / 2, by + bh / 2 + 1, { size: 15, weight: 500, align: 'center', baseline: 'middle', color: (s.press ?? 0) > 0.5 ? '#1a1408' : C.goldHi });
    if ((s.cur ?? 0) > 0) cursor(ctx, lerp(1180, 1060, s.curK ?? 0), lerp(95, 74, s.curK ?? 0), s.cur, s.press ?? 0);
  }, { state: {} });
  st.add(tlLabels, 960, TLY + 4, 0, 11);
  const marker = glowSprite(C.goldHi, 0.8, 0); marker.renderOrder = 12; scene.add(marker);

  // loop diagram
  const loopPts = [];
  for (let i = 0; i <= 180; i++) { const a = -Math.PI / 2 + (i / 180) * Math.PI * 2; loopPts.push(px2w(LOOP.x + Math.cos(a) * LOOP.r, LOOP.y + Math.sin(a) * LOOP.r, 0.05)); }
  const ring = thinLine(loopPts, C.steel, 0, 1.4, { order: 8 });
  scene.add(ring);
  const loopGold = new GoldLine(loopPts, { width: 3, headSize: 0.8, order: 9 });
  scene.add(loopGold.group);
  const nodes = NODES.map((n, i) => {
    const p = makePanel(150, 150, (ctx, s, w, h) => {
      const on = s.on ?? 0;
      ctx.fillStyle = 'rgba(10,29,61,0.95)'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = on > 0.5 ? 'rgba(255,224,160,0.95)' : 'rgba(157,186,217,0.45)'; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, n.label, w / 2, h / 2 + 1, { size: 22, weight: 500, align: 'center', baseline: 'middle', color: on > 0.5 ? C.goldHi : C.ice });
    }, { state: {} });
    const [x, y] = nodePx(i);
    st.add(p, x, y, 0.1, 14);
    const g = glowSprite(C.goldHi, 2.6, 0); g.position.copy(px2w(x, y, 0)); g.renderOrder = 13; scene.add(g);
    return { p, g };
  });

  // fresh evidence
  const evid = makePanel(400, 190, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h, { r: 14, alpha: 0.88 });
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, w, 40);
    icon(ctx, 'globe', 26, 20, 18, C.goldHi);
    text(ctx, '新获取证据 · 官网团队页（最新）', 46, 27, { size: 15, weight: 500, color: C.ice });
    lines(ctx, 22, 62, w - 60, 1, { seed: 77, th: 6 });
    text(ctx, '供应链负责人 · 负责采购对接', 30, 110, { size: 18, color: C.warm });
    lines(ctx, 22, 138, w - 80, 2, { seed: 78, gap: 18, th: 6 });
    if ((s.frame ?? 0) > 0) { ctx.save(); ctx.globalAlpha = s.frame; ctx.strokeStyle = 'rgba(255,224,160,0.95)'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(217,179,115,0.8)'; ctx.shadowBlur = 10; roundRect(ctx, 18, 84, w - 60, 38, 6); ctx.stroke(); ctx.restore(); }
  }, { state: {} });
  st.add(evid, 1560, 640, -0.1, 10);
  const cmp = thinLine([px2w(1360, 640, 0.05), px2w(nodePx(1)[0] + 50, nodePx(1)[1], 0.05)], C.gold, 0, 1.6, { dashed: true, order: 9 });
  scene.add(cmp);
  const stamp = makePanel(190, 44, (ctx) => pill(ctx, '证据一致 · 复核通过', 2, 4, { size: 15, icon: 'check' }));
  st.add(stamp, 1210, 700, 0.3, 16);

  // adopt link: 采用 node -> report row
  const adoptLine = new GoldLine([px2w(nodePx(2)[0] - 46, nodePx(2)[1], 0.05), px2w(RP.x + RP.w / 2 - 6, RP.y - RP.h / 2 + 232, 0.05)], { width: 2.6, headSize: 0.6, order: 12 });
  scene.add(adoptLine.group);

  const tmp = new THREE.Vector3();
  function update(t) {
    const k = ep(t, 44.75, 53.3, ease.sine);
    camera.position.set(lerp(0.5, -0.3, k), lerp(-0.1, 0.2, k), lerp(18.0, 17.0, k));
    camera.lookAt(lerp(0.2, -0.1, k), 0, 0);
    st.grid.position.x = -camera.position.x * 0.3;

    const v2 = t > 51.2;
    const curK = ep(t, 45.3, 45.9, ease.inOut);
    report.opacity = ss(44.8, 45.3, t);
    report.redraw({
      flag: Math.round(ss(45.8, 46.1, t) * (v2 ? 1 : 1 - 0.6 * ss(47.0, 47.6, t)) * 10) / 10 + (v2 ? 0 : 0),
      v2, v2hl: v2 ? Math.round(ss(51.2, 51.5, t) * 10) / 10 * 0.8 : 0,
      hist: Math.round(ss(51.6, 52.0, t) * 10) / 10,
      cur: Math.round(ss(45.2, 45.4, t) * (1 - ss(45.9, 46.1, t)) * 10) / 10,
      curK: Math.round(curK * 30) / 30,
    });
    // popover
    const pk = ep(t, 45.95, 46.3, ease.out);
    pop.opacity = pk * (1 - ss(47.0, 47.3, t));
    pop.mesh.scale.setScalar(lerp(0.9, 1, pk));
    pop.redraw({ type: Math.round(ep(t, 46.1, 46.6, (x) => x) * 20) / 20, press: t > 46.75 && t < 46.95 ? 1 : 0, sent: t > 46.95 });

    // note: popover -> archive (47.0–47.7) -> 反馈 node (49.0–49.7)
    const n1 = ep(t, 47.0, 47.7, ease.inOut), n2 = ep(t, 49.0, 49.7, ease.inOut);
    const pA = px2w(930, 470, 1.0), pB = px2w(1590, 300, 0.8), pC = px2w(nodePx(0)[0], nodePx(0)[1] - 100, 1.0);
    tmp.copy(pA).lerp(pB, n1);
    if (t > 49.0) tmp.copy(pB).lerp(pC, n2);
    tmp.y += Math.sin(n1 * Math.PI) * 0.8 * (t < 49 ? 1 : 0);
    note.mesh.position.copy(tmp);
    note.mesh.scale.setScalar(t < 49 ? lerp(1, 0.55, n1) : lerp(0.55, 0.8, n2));
    note.opacity = ss(46.95, 47.1, t) * (t < 49 ? 1 - 0.8 * ss(47.6, 47.75, t) : 1) * (1 - ss(50.4, 50.7, t)) + (t >= 48.95 && t < 49.1 ? 0.2 : 0);

    archive.opacity = ss(45.0, 45.4, t);
    archive.redraw({ saved: t > 47.6 ? 1 : 0, hl: Math.round(ss(47.6, 47.8, t) * (1 - ss(48.2, 48.6, t)) * 10) / 10 });

    // timeline moves forward, user starts a new check
    tlLine.material.opacity = 0.45 * ss(45.0, 45.4, t);
    const mv = ep(t, 47.7, 48.6, ease.inOut);
    tlLabels.opacity = ss(45.0, 45.4, t);
    const press = t > 48.75 && t < 48.95 ? 1 : 0;
    tlLabels.redraw({
      off: Math.round(mv * 60) / 1, next: mv > 0.9 ? 1 : 0,
      btn: Math.round(ss(48.2, 48.4, t) * 10) / 10, press: t > 48.75 ? (press ? 1 : 0.6) : 0,
      cur: Math.round(ss(48.3, 48.45, t) * (1 - ss(49.1, 49.3, t)) * 10) / 10, curK: Math.round(ep(t, 48.35, 48.75, ease.inOut) * 20) / 20,
    });
    marker.position.copy(px2w(lerp(350, 1210, mv), TLY + 3, 0.1));
    marker.material.opacity = ss(45.2, 45.5, t) * 0.9;

    // loop: 反馈 lights on note arrival, 复核 on evidence match, 采用 after
    ring.material.opacity = 0.5 * ss(47.3, 47.8, t);
    const on = [ss(49.6, 49.8, t), ss(50.5, 50.7, t), ss(51.0, 51.2, t)];
    nodes.forEach(({ p, g }, i) => {
      p.opacity = ss(47.4 + i * 0.12, 47.8 + i * 0.12, t);
      p.redraw({ on: on[i] > 0.5 ? 1 : 0 });
      g.material.opacity = 0.35 * on[i];
    });
    loopGold.set(0, ep(t, 49.6, 51.3, ease.inOut), 1);
    loopGold.headOn = t < 51.3;

    const ek = ep(t, 49.4, 49.9, ease.out);
    evid.opacity = ek;
    evid.mesh.position.x = px2w(1560 + (1 - ek) * 80, 0).x;
    evid.redraw({ frame: Math.round(ss(49.9, 50.2, t) * 10) / 10 });
    cmp.material.opacity = 0.85 * ss(50.0, 50.3, t) * (1 - 0.6 * ss(51.5, 52, t));
    const sk = ep(t, 50.45, 50.75, ease.outBack);
    stamp.opacity = ss(50.45, 50.6, t);
    stamp.mesh.scale.setScalar(lerp(0.8, 1, sk));
    adoptLine.set(0, ep(t, 50.9, 51.3, ease.inOut), 1);
  }

  return { scene, camera, update, bloom: 0.8, threshold: 0.72, vignette: 0.45 };
}
