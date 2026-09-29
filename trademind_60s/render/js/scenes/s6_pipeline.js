// 06 | 37–45 s  把一次沟通，接成商机推进
// A reply arrives; the camera tracks along the same communication record as it
// unfolds into needs → follow-up tasks → qualification → quote collaboration,
// and settles on a clear, executable next step.
import * as THREE from 'three';
import {
  C, FONT, W, H, lerp, ss, ep, ease, clamp, makePanel, glass, text, pill, icon, lines, roundRect, measure,
  GoldLine, makeStage, px2w, thinLine, glowSprite, statusPill, pillWidth, PX,
} from '../lib.js';

const CW = 440, CH = 330, Y = 480;
const XS = [380, 900, 1420, 1940, 2460, 2990];

function wrap(ctx, str, x, y, maxW, lh, o) {
  ctx.font = `${o.weight ?? 400} ${o.size}px ${FONT.cn}`;
  let line = '';
  for (const ch of str) {
    if (ctx.measureText(line + ch).width > maxW) { text(ctx, line, x, y, o); line = ''; y += lh; }
    line += ch;
  }
  if (line) text(ctx, line, x, y, o);
}

function header(ctx, n, title, ic, w) {
  text(ctx, n, 26, 44, { size: 15, font: FONT.en, weight: 600, color: C.gold, ls: 2 });
  icon(ctx, ic, 68, 38, 20, C.goldHi);
  text(ctx, title, 90, 45, { size: 21, weight: 500 });
  ctx.fillStyle = 'rgba(157,186,217,0.15)'; ctx.fillRect(24, 64, w - 48, 1);
}

function rowKV(ctx, k, v, y) {
  text(ctx, k, 28, y, { size: 15, color: C.mist });
  text(ctx, v, 100, y, { size: 18, color: C.warm });
}

function checkRow(ctx, label, state, y, w, sub) {
  text(ctx, label, 28, y, { size: 18, color: C.warm });
  if (sub) text(ctx, sub, 28, y + 22, { size: 13, color: C.mist });
  const lbl = state === 'ok' ? '已确认' : state === 'pending' ? '待确认' : '已完成';
  const pw = pillWidth(ctx, lbl, 14, true);
  statusPill(ctx, state === 'done' ? 'ok' : state, w - pw - 24, y - 20, { size: 14, okText: lbl, pendingText: lbl });
}

const CARDS = [
  (ctx, s, w, h) => {
    header(ctx, '01', '客户回复', 'mail', w);
    text(ctx, '来自：采购经理 · 示例客户 A', 28, 98, { size: 15, color: C.mist });
    ctx.fillStyle = 'rgba(217,179,115,0.7)'; ctx.fillRect(28, 116, 3, 120);
    wrap(ctx, '“感谢来信。我们对该型号很感兴趣，请提供技术资料，并就批量供货报价。”', 44, 140, w - 80, 30, { size: 18, color: C.warm });
    pill(ctx, '新回复', 28, 262, { size: 14 });
  },
  (ctx, s, w, h) => {
    header(ctx, '02', '需求整理', 'doc', w);
    rowKV(ctx, '产品', '6205 深沟球轴承', 108);
    rowKV(ctx, '工况', '农机变速箱', 150);
    rowKV(ctx, '需要', '技术资料 · 报价', 192);
    ctx.fillStyle = 'rgba(157,186,217,0.12)'; ctx.fillRect(24, 222, w - 48, 1);
    statusPill(ctx, 'ok', 28, 246, { size: 15, okText: '销售已确认' });
  },
  (ctx, s, w, h) => {
    header(ctx, '03', '跟进任务', 'flag', w);
    checkRow(ctx, '发送技术资料', 'done', 116, w);
    checkRow(ctx, '安排技术沟通', 'pending', 176, w);
    checkRow(ctx, '样品评估', 'pending', 236, w);
  },
  (ctx, s, w, h) => {
    header(ctx, '04', '资格确认', 'person', w);
    checkRow(ctx, '采购需求', 'ok', 116, w);
    checkRow(ctx, '决策角色', 'ok', 176, w);
    checkRow(ctx, '时间计划', 'pending', 236, w);
    text(ctx, '由销售确认', 28, 300, { size: 14, color: C.gold });
  },
  (ctx, s, w, h) => {
    header(ctx, '05', '报价协同', 'table', w);
    roundRect(ctx, 28, 90, 120, 150, 10); ctx.fillStyle = 'rgba(246,241,232,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(246,241,232,0.35)'; ctx.lineWidth = 1.3; ctx.stroke();
    icon(ctx, 'doc', 88, 140, 44, C.goldHi);
    text(ctx, '报价单（草稿）', 88, 212, { size: 14, color: C.ice, align: 'center' });
    icon(ctx, 'link', 180, 118, 22, C.goldHi);
    text(ctx, '关联商机', 202, 124, { size: 15, color: C.mist });
    text(ctx, '示例客户 A · 轴承配套', 166, 156, { size: 17, color: C.warm });
    text(ctx, '上下文', 166, 196, { size: 15, color: C.mist });
    let x = 166;
    for (const c of ['回复', '需求', '资格']) { x += pill(ctx, c, x, 210, { size: 14, h: 28, padX: 10, fill: 'rgba(157,186,217,0.1)', stroke: 'rgba(157,186,217,0.45)', color: C.ice }) + 8; }
  },
  (ctx, s, w, h) => {
    text(ctx, 'NEXT', 28, 46, { size: 15, font: FONT.en, weight: 600, color: C.gold, ls: 3 });
    text(ctx, '下一步', 28, 102, { size: 40, weight: 700, color: C.goldHi });
    text(ctx, '与采购经理确认技术参数', 28, 160, { size: 23, weight: 500, color: C.warm });
    text(ctx, '负责人：销售', 28, 200, { size: 16, color: C.mist });
    pill(ctx, '清晰 · 可执行', 28, 236, { size: 16, icon: 'check' });
  },
];

export async function create() {
  const st = makeStage({ seed: 61 });
  const { scene, camera } = st;

  // context strip spanning the whole record
  const strip = makePanel(2900, 50, (ctx, s, w, h) => {
    roundRect(ctx, 2, 2, w - 4, h - 4, 12); ctx.fillStyle = 'rgba(12,32,64,0.75)'; ctx.fill();
    ctx.strokeStyle = 'rgba(157,186,217,0.3)'; ctx.lineWidth = 1.2; ctx.stroke();
    for (const x0 of [30, 1000, 1970]) {
      icon(ctx, 'link', x0 + 12, h / 2, 18, C.gold);
      text(ctx, '同一条沟通记录 · 商机：示例客户 A · 轴承配套', x0 + 34, h / 2 + 1, { size: 17, baseline: 'middle', color: C.ice });
    }
  }, { res: 1 });
  st.add(strip, (XS[0] + XS[5]) / 2, 225, -0.2, 8);

  const cards = CARDS.map((draw, i) => {
    const last = i === CARDS.length - 1;
    const p = makePanel(CW, CH, (ctx, s, w, h) => {
      glass(ctx, 0, 0, w, h, { r: 18, alpha: 0.9, highlight: s.hl ?? 0 });
      draw(ctx, s, w, h);
    }, { state: {} });
    st.add(p, XS[i], Y, 0, 10);
    p.opacity = 0;
    return p;
  });
  const lastGlow = glowSprite(C.goldHi, 7, 0); lastGlow.position.copy(px2w(XS[5], Y, -0.5)); lastGlow.renderOrder = 5; scene.add(lastGlow);

  // progress rail running beneath the cards
  const RAIL = Y + CH / 2 + 34, R0 = XS[0] - CW / 2, R1 = XS[5] + CW / 2 - 30;
  const railBase = thinLine([px2w(R0, RAIL, 0), px2w(R1, RAIL, 0)], C.steel, 0, 1.4, { order: 5 });
  scene.add(railBase);
  const gold = new GoldLine([px2w(R0, RAIL, 0.05), px2w(R1, RAIL, 0.05)], { width: 3, headSize: 1.0, order: 6 });
  scene.add(gold.group);
  const ticks = XS.map((x) => { const s = glowSprite(C.goldHi, 0.7, 0); s.position.copy(px2w(x, RAIL, 0.1)); s.renderOrder = 12; scene.add(s); return s; });
  const camX = (t) => lerp(640, 2800, ep(t, 36.9, 44.6, ease.inOut));
  function update(t) {
    const cx = camX(t);
    const c = px2w(cx, 540);
    camera.position.set(c.x, lerp(0.25, -0.1, ep(t, 36.8, 45.3, ease.sine)), lerp(17.8, 17.3, ep(t, 36.8, 45.3)));
    camera.lookAt(c.x + 0.4, 0, 0);
    st.grid.position.x = c.x * 0.7;
    st.dust.position.x = c.x * 0.6;

    strip.opacity = 0.9 * ss(37.3, 37.8, t);
    // gold head runs slightly ahead of the camera centre
    const headPx = Math.min(R1, cx + 330);
    const f = clamp((headPx - R0) / (R1 - R0));
    railBase.material.opacity = 0.35 * ss(37.2, 37.6, t);
    gold.set(0, t < 37.3 ? 0 : f * ss(37.3, 37.8, t), 1);
    gold.headOn = headPx < R1;
    cards.forEach((p, i) => {
      const arrive = i === 0 ? 37.05 : null;
      const reached = i === 0 ? ss(37.0, 37.5, t) : ss(0, 60, headPx - (XS[i] - CW / 2 - 20));
      const k = ease.out(clamp(reached));
      p.opacity = k;
      p.mesh.position.y = px2w(0, Y + (1 - k) * 40).y;
      if (i === 0) p.mesh.position.x = px2w(XS[0] - (1 - k) * 120, 0).x;
      const last = i === cards.length - 1;
      p.redraw({ hl: last ? Math.round(ss(43.9, 44.4, t) * 10) / 10 : i === 0 ? Math.round(ss(37.2, 37.5, t) * (1 - ss(38.2, 38.8, t)) * 10) / 10 * 0.6 : 0 });
    });
    ticks.forEach((s, i) => { const hit = clamp((headPx - XS[i]) / 40); s.material.opacity = t < 37.4 ? 0 : hit * 0.9; });
    lastGlow.material.opacity = 0.35 * ss(43.9, 44.5, t);
  }

  return { scene, camera, update, bloom: 0.8, threshold: 0.72, vignette: 0.45 };
}
