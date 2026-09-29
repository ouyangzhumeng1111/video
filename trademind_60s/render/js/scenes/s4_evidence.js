// 04 | 21–29 s  让机会判断有据可查
// The candidate card opens into a company profile. Snippets on source pages
// are framed and wired to the conclusions they support; verified and pending
// items keep different states. Purchase signals land on a timeline and the
// gold line strings 来源 → 依据 → 判断 together.
import * as THREE from 'three';
import {
  C, FONT, W, H, lerp, ss, ep, ease, clamp, makePanel, glass, text, pill, icon, lines, roundRect, measure,
  GoldLine, makeStage, px2w, thinLine, statusPill, pillWidth, glowSprite, bendPoints,
} from '../lib.js';

const ROWS = [
  { k: '企业主体', v: '注册信息与经营状态一致', s: 'ok' },
  { k: '业务范围', v: '拖拉机 · 收获机械 · 传动部件', s: 'ok' },
  { k: '采购记录', v: '轴承类进口记录（HS 8482）', s: 'ok' },
  { k: '公开动态', v: '传动部件产线扩建公告', s: 'pending' },
];
const PROFILE = { x: 600, y: 395, w: 620, h: 520 };
const rowY = (i) => PROFILE.y - PROFILE.h / 2 + 150 + i * 88; // centre y (px) of each row

export async function create() {
  const st = makeStage({ seed: 41 });
  const { scene, camera } = st;

  const profile = makePanel(PROFILE.w, PROFILE.h, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h, { r: 18, alpha: 0.9 });
    icon(ctx, 'factory', 44, 52, 30, C.goldHi);
    text(ctx, '示例客户 A', 80, 62, { size: 30, weight: 500 });
    text(ctx, '德国 · 农业机械制造', 82, 94, { size: 17, color: C.mist });
    const tw = pillWidth(ctx, '高度匹配', 15, false);
    pill(ctx, '高度匹配', w - tw - 26, 38, { size: 15 });
    ctx.fillStyle = 'rgba(157,186,217,0.18)'; ctx.fillRect(24, 118, w - 48, 1);
    ROWS.forEach((r, i) => {
      const a = s.rows?.[i] ?? 0;
      if (a <= 0) return;
      const cy = 150 + i * 88 - 18;
      ctx.save(); ctx.globalAlpha = a;
      if (s.focus === i) { roundRect(ctx, 16, cy - 30, w - 32, 76, 12); ctx.fillStyle = 'rgba(217,179,115,0.08)'; ctx.fill(); }
      text(ctx, r.k, 36, cy - 4, { size: 15, color: C.mist, ls: 1 });
      text(ctx, r.v, 36, cy + 28, { size: 21, color: C.warm });
      const st2 = (s.status?.[i] ?? 0) > 0.5 ? r.s : 'none';
      const pw = pillWidth(ctx, r.s === 'ok' ? '已核实' : '待确认', 15, true);
      statusPill(ctx, st2, w - pw - 28, cy - 2, { alpha: clamp((s.status?.[i] ?? 0) * 2 - 1) });
      if (i < ROWS.length - 1) { ctx.fillStyle = 'rgba(157,186,217,0.1)'; ctx.fillRect(28, cy + 50, w - 56, 1); }
      ctx.restore();
    });
  }, { state: {} });
  st.add(profile, PROFILE.x, PROFILE.y, 0, 10);

  // ---------------- source pages (right column, slightly angled toward centre)
  const DOCS = [
    { title: '企业官网 · 关于我们', ic: 'globe', y: 180, snippet: '专注拖拉机与收获机械的研发制造', row: 1, pending: false },
    { title: '贸易记录 · 进口明细', ic: 'table', y: 385, snippet: 'HS 8482 · 滚动轴承', row: 2, pending: false },
    { title: '公开新闻 · 企业动态', ic: 'doc', y: 590, snippet: '计划扩建传动部件产线', row: 3, pending: true },
  ];
  const DOC_W = 400, DOC_H = 200, DOC_X = 1470;
  const docs = DOCS.map((d, i) => {
    const p = makePanel(DOC_W, DOC_H, (ctx, s, w, h) => {
      glass(ctx, 0, 0, w, h, { r: 14, alpha: 0.82 });
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, w, 40);
      icon(ctx, d.ic, 26, 20, 18, C.goldHi);
      text(ctx, d.title, 46, 27, { size: 16, weight: 500, color: C.ice });
      text(ctx, '来源', w - 20, 27, { size: 13, color: C.mist, align: 'right' });
      lines(ctx, 22, 62, w - 60, 2, { seed: 10 + i, gap: 18, th: 6 });
      // the snippet that supports a conclusion
      const sy = 118;
      text(ctx, d.snippet, 30, sy, { size: 18, color: C.warm });
      lines(ctx, 22, 146, w - 60, 2, { seed: 20 + i, gap: 18, th: 6 });
      const k = s.frame ?? 0;
      if (k > 0) {
        const fw = measure(ctx, d.snippet, { size: 18 }) + 24;
        ctx.save();
        ctx.strokeStyle = d.pending ? 'rgba(142,165,195,0.9)' : 'rgba(255,224,160,0.95)';
        ctx.lineWidth = 2;
        if (d.pending) ctx.setLineDash([7, 5]);
        if (!d.pending) { ctx.shadowColor = 'rgba(217,179,115,0.8)'; ctx.shadowBlur = 12; }
        // draw the frame progressively (perimeter reveal)
        const x0 = 18, y0 = sy - 26, fh = 38, per = 2 * (fw + fh);
        ctx.beginPath();
        let rem = per * k;
        const seg = (x1, y1, x2, y2, len) => { const u = Math.min(1, rem / len); ctx.lineTo(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u); rem -= len; return rem > 0; };
        ctx.moveTo(x0, y0);
        seg(x0, y0, x0 + fw, y0, fw) && seg(x0 + fw, y0, x0 + fw, y0 + fh, fh) && seg(x0 + fw, y0 + fh, x0, y0 + fh, fw) && seg(x0, y0 + fh, x0, y0, fh);
        ctx.stroke();
        ctx.restore();
      }
    }, { state: { frame: 0 } });
    st.add(p, DOC_X, d.y, -0.4, 10);
    p.mesh.rotation.y = -0.18;
    return p;
  });

  // connectors doc snippet -> profile row (pending one dashed / blue)
  const snipAnchor = (i) => px2w(DOC_X - DOC_W / 2 + 14, DOCS[i].y + 118 - DOC_H / 2 - 8 + 0, -0.2);
  const rowAnchor = (row) => px2w(PROFILE.x + PROFILE.w / 2 - 4, rowY(row) - 14, 0);
  const conns = DOCS.map((d, i) => {
    const pts = bendPoints(snipAnchor(i), rowAnchor(d.row), 40, 0.4);
    if (d.pending) { const l = thinLine(pts, C.pending, 0, 1.8, { dashed: true, order: 12 }); scene.add(l); return { l, pts }; }
    const g = new GoldLine(pts, { width: 2.2, headSize: 0.5, order: 12 }); scene.add(g.group); return { g, pts };
  });

  // ---------------- timeline of purchase signals + judgement
  const TL = { x0: 330, x1: 1240, y: 760 };
  const tl = thinLine([px2w(TL.x0, TL.y, 0.1), px2w(TL.x1, TL.y, 0.1)], C.mist, 0, 1.6, { order: 11 });
  scene.add(tl);
  const SIGNALS = [
    { x: 470, label: '采购记录更新', sub: '贸易记录', pending: false },
    { x: 760, label: '招聘：采购工程师', sub: '公开资料', pending: false },
    { x: 1050, label: '产线扩建公告', sub: '待确认', pending: true },
  ];
  const sigs = SIGNALS.map((sg, i) => {
    const p = makePanel(230, 110, (ctx, s, w, h) => {
      const a = s.a ?? 0;
      ctx.globalAlpha = a;
      // pin
      ctx.strokeStyle = sg.pending ? 'rgba(142,165,195,0.8)' : 'rgba(255,224,160,0.9)'; ctx.lineWidth = 1.5;
      if (sg.pending) ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(w / 2, 56); ctx.lineTo(w / 2, 92); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = sg.pending ? C.pending : C.goldHi;
      ctx.beginPath(); ctx.arc(w / 2, 96, 6, 0, Math.PI * 2); ctx.fill();
      text(ctx, sg.label, w / 2, 24, { size: 17, weight: 500, align: 'center', color: sg.pending ? C.pending : C.warm });
      text(ctx, sg.sub, w / 2, 46, { size: 13, align: 'center', color: C.mist });
    }, { state: { a: 0 } });
    st.add(p, sg.x, TL.y - 42, 0.12, 13);
    const pulse = glowSprite(sg.pending ? C.mist : C.goldHi, 0.6, 0); pulse.position.copy(px2w(sg.x, TL.y, 0.2)); pulse.renderOrder = 14; scene.add(pulse);
    return { p, pulse, at: 25.5 + i * 0.45 };
  });
  const tlLabel = makePanel(200, 30, (ctx) => text(ctx, '采购信号 · 时间线', 0, 20, { size: 15, color: C.gold, ls: 2 }));
  st.add(tlLabel, TL.x0 + 100, TL.y + 32, 0.1, 13);

  const judge = makePanel(300, 120, (ctx, s, w, h) => {
    glass(ctx, 1, 1, w - 2, h - 2, { r: 16, alpha: 0.92, highlight: s.hl ?? 0 });
    icon(ctx, 'flag', 36, 44, 24, C.goldHi);
    text(ctx, '建议优先跟进', 62, 52, { size: 24, weight: 500, color: C.goldHi });
    text(ctx, '依据 3 条已核实 · 1 条待确认', 30, 92, { size: 15, color: C.mist });
  }, { state: { hl: 0 } });
  st.add(judge, 1450, TL.y + 20, 0.2, 15);

  // gold spine: trade-record snippet -> 采购记录 row -> timeline -> judgement
  const spine = new GoldLine([
    ...bendPoints(px2w(PROFILE.x - 40, PROFILE.y + PROFILE.h / 2, 0.05), px2w(TL.x0 + 140, TL.y, 0.05), 20, 0.5),
    ...bendPoints(px2w(TL.x0 + 140, TL.y, 0.05), px2w(1290, TL.y, 0.05), 30, 0.5).slice(1),
  ], { width: 2.8, headSize: 0.8, order: 12 });
  scene.add(spine.group);
  const judgeGlow = glowSprite(C.goldHi, 5, 0); judgeGlow.position.copy(px2w(1450, TL.y + 20, -0.3)); judgeGlow.renderOrder = 9; scene.add(judgeGlow);

  function update(t) {
    // camera: slow dolly with a hint of parallax
    const k = ep(t, 20.75, 29.3, ease.sine);
    camera.position.set(lerp(0.6, -0.5, k), lerp(0.2, -0.15, k), lerp(18.6, 16.6, k));
    camera.lookAt(lerp(0.2, -0.1, k), 0, 0);
    st.grid.position.x = -camera.position.x * 0.3;

    // profile: header in, rows appear, status stamps
    const rows = ROWS.map((_, i) => Math.round(ss(21.3 + i * 0.35, 21.8 + i * 0.35, t) * 20) / 20);
    const status = ROWS.map((_, i) => Math.round(ss(24.2 + i * 0.3, 24.6 + i * 0.3, t) * 20) / 20);
    const focus = t > 25.3 && t < 27.6 ? 2 : -1;
    profile.redraw({ rows, status, focus });
    const pIn = ep(t, 20.75, 21.4, ease.out);
    profile.opacity = pIn;
    profile.mesh.scale.setScalar(lerp(0.92, 1, pIn));

    docs.forEach((p, i) => {
      const a = ep(t, 22.4 + i * 0.25, 23.0 + i * 0.25, ease.out);
      p.opacity = a;
      p.mesh.position.x = px2w(DOC_X + (1 - a) * 80, 0).x;
      p.redraw({ frame: Math.round(ep(t, 23.3 + i * 0.3, 23.9 + i * 0.3, ease.inOut) * 30) / 30 });
    });
    conns.forEach((c, i) => {
      const k2 = ep(t, 23.8 + i * 0.3, 24.5 + i * 0.3, ease.inOut);
      if (c.g) c.g.set(0, k2, 1);
      else c.l.material.opacity = 0.8 * k2;
    });

    tl.material.opacity = 0.5 * ss(25.1, 25.5, t);
    tlLabel.opacity = ss(25.2, 25.6, t);
    sigs.forEach(({ p, pulse, at }) => {
      const a = ss(at, at + 0.35, t);
      p.redraw({ a: Math.round(a * 20) / 20 });
      const ph = clamp((t - at) / 0.8);
      pulse.material.opacity = a * (1 - ph) * 0.9;
      pulse.scale.setScalar(0.3 + ph * 1.4);
    });
    spine.set(0, ep(t, 25.3, 27.4, ease.inOut), 1);
    const jk = ep(t, 27.0, 27.6, ease.outBack);
    judge.opacity = ss(27.0, 27.3, t);
    judge.mesh.scale.setScalar(lerp(0.85, 1, jk));
    judge.redraw({ hl: Math.round(ss(27.3, 27.8, t) * 20) / 20 });
    judgeGlow.material.opacity = 0.35 * ss(27.3, 27.9, t);
  }

  return { scene, camera, update, bloom: 0.8, threshold: 0.72, vignette: 0.45 };
}
