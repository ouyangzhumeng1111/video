// 05 | 29–37 s  多个智能体，协同准备行动
// A spatial workbench: research / analysis / contacts / content agents run in
// parallel around one company. Need signal + product strength merge into a
// targeted draft; a salesperson reviews and confirms; the gold line passes the
// review node and reaches the customer's inbox.
import * as THREE from 'three';
import {
  C, FONT, W, H, lerp, ss, ep, ease, clamp, makePanel, glass, text, pill, icon, lines, roundRect, measure,
  GoldLine, makeStage, px2w, thinLine, glowSprite, bendPoints, typed, pillWidth,
} from '../lib.js';

const AGENTS = [
  { name: '研究智能体', task: '检索官网与公开资料', ic: 'search', x: 330, rot: 0.2, z: -0.6 },
  { name: '分析智能体', task: '匹配需求与产品优势', ic: 'chart', x: 750, rot: 0.07, z: -0.2 },
  { name: '联系人智能体', task: '识别采购相关角色', ic: 'person', x: 1170, rot: -0.07, z: -0.2 },
  { name: '内容智能体', task: '准备沟通草稿', ic: 'pen', x: 1590, rot: -0.2, z: -0.6 },
];
const AG_Y = 330, AG_W = 360, AG_H = 236;

const DRAFT_BODY = '您好，关注到贵司近期发布的传动部件产线扩建计划。针对农机变速箱工况，我们的 6205 深沟球轴承可提供 P5 精度与稳定交付，附技术资料供评估……';

function agentPanel(a, i) {
  return makePanel(AG_W, AG_H, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h, { r: 16, alpha: 0.86, highlight: s.done ? 0.35 : 0 });
    icon(ctx, a.ic, 34, 36, 22, C.goldHi);
    text(ctx, a.name, 58, 43, { size: 20, weight: 500 });
    // status
    const run = s.run ?? 0;
    if (s.done) {
      icon(ctx, 'check', w - 34, 36, 20, C.goldHi);
    } else if (run > 0) {
      for (let k = 0; k < 3; k++) { ctx.fillStyle = `rgba(157,186,217,${0.3 + 0.7 * (Math.floor(s.tick ?? 0) % 3 === k ? 1 : 0)})`; ctx.beginPath(); ctx.arc(w - 50 + k * 12, 36, 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    text(ctx, a.task, 24, 82, { size: 16, color: C.mist });
    ctx.fillStyle = 'rgba(157,186,217,0.15)'; ctx.fillRect(24, 96, w - 48, 1);
    const p = s.p ?? 0;
    if (i === 0) {
      ['企业官网 · 关于我们', '贸易记录 · 进口明细', '公开新闻 · 企业动态'].forEach((l, k) => {
        const a2 = clamp(p * 3 - k);
        if (a2 <= 0) return;
        ctx.globalAlpha = a2;
        icon(ctx, 'tick', 36, 124 + k * 34, 14, C.gold);
        text(ctx, l, 54, 130 + k * 34, { size: 16, color: C.ice });
        ctx.globalAlpha = 1;
      });
    } else if (i === 1) {
      if (p > 0.15) pill(ctx, '需求：产线扩建', 24, 116, { size: 15, alpha: clamp(p * 3 - 0.4), fill: 'rgba(157,186,217,0.1)', stroke: 'rgba(157,186,217,0.5)', color: C.ice });
      if (p > 0.45) pill(ctx, '优势：P5 精度 · 稳定交付', 24, 160, { size: 15, alpha: clamp(p * 3 - 1.4) });
    } else if (i === 2) {
      ['采购经理', '技术负责人'].forEach((l, k) => {
        const a2 = clamp(p * 2.5 - k);
        if (a2 <= 0) return;
        ctx.globalAlpha = a2;
        ctx.fillStyle = 'rgba(157,186,217,0.25)'; ctx.beginPath(); ctx.arc(42, 128 + k * 44, 15, 0, Math.PI * 2); ctx.fill();
        icon(ctx, 'person', 42, 128 + k * 44, 18, C.ice);
        text(ctx, l, 68, 126 + k * 44, { size: 17, color: C.warm });
        text(ctx, '联系信息已脱敏', 68, 146 + k * 44, { size: 13, color: C.mist });
        ctx.globalAlpha = 1;
      });
    } else {
      lines(ctx, 24, 118, w - 48, 4, { seed: 7, gap: 22, th: 8, reveal: p, color: 'rgba(246,241,232,0.28)' });
    }
  }, { state: {} });
}

export async function create() {
  const st = makeStage({ seed: 51 });
  const { scene, camera } = st;

  // hub: the one company everything revolves around
  const hub = makePanel(300, 58, (ctx, s, w, h) => {
    roundRect(ctx, 2, 2, w - 4, h - 4, 29); ctx.fillStyle = 'rgba(12,32,64,0.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,224,160,0.8)'; ctx.lineWidth = 1.6; ctx.stroke();
    icon(ctx, 'factory', 34, h / 2, 22, C.goldHi);
    text(ctx, '示例客户 A', 58, h / 2 + 1, { size: 21, weight: 500, baseline: 'middle' });
    text(ctx, '目标企业', w - 22, h / 2 + 1, { size: 14, color: C.gold, align: 'right', baseline: 'middle' });
  });
  st.add(hub, 960, 108, 0.2, 20);
  const hubLinks = AGENTS.map((a) => {
    const l = thinLine(bendPoints(px2w(960, 136, 0.1), px2w(a.x, AG_Y - AG_H / 2 - 2, a.z), 30, 0.2).map((p) => p), C.gold, 0, 1.4, { order: 5 });
    // bendPoints bends in x; for a top-down fan use a vertical bezier instead
    const A = px2w(960, 136, 0.1), B = px2w(a.x, AG_Y - AG_H / 2 - 2, a.z);
    const curve = new THREE.CubicBezierCurve3(A, new THREE.Vector3(A.x, lerp(A.y, B.y, 0.6), A.z), new THREE.Vector3(B.x, lerp(A.y, B.y, 0.4), B.z), B);
    l.geometry.setPositions(curve.getPoints(30).flatMap((p) => [p.x, p.y, p.z]));
    scene.add(l);
    return l;
  });

  const agents = AGENTS.map((a, i) => {
    const p = agentPanel(a, i);
    st.add(p, a.x, AG_Y, a.z, 10);
    p.mesh.rotation.y = a.rot;
    return p;
  });

  // ---------------- draft
  const DR = { x: 760, y: 660, w: 640, h: 290 };
  const draft = makePanel(DR.w, DR.h, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h, { r: 16, alpha: 0.92, highlight: s.hl ?? 0 });
    icon(ctx, 'mail', 34, 36, 22, C.goldHi);
    text(ctx, '沟通草稿', 58, 43, { size: 20, weight: 500 });
    const tw = pillWidth(ctx, '待人工审核', 14, false);
    pill(ctx, s.sent ? '已确认发送' : '待人工审核', w - tw - 22, 20, { size: 14, fill: s.sent ? 'rgba(217,179,115,0.2)' : 'rgba(157,186,217,0.08)', stroke: s.sent ? 'rgba(255,224,160,0.8)' : 'rgba(157,186,217,0.5)', color: s.sent ? C.goldHi : C.ice });
    text(ctx, '收件人', 26, 88, { size: 14, color: C.mist });
    text(ctx, '采购经理 · 示例客户 A', 90, 88, { size: 16, color: C.ice });
    text(ctx, '主题', 26, 118, { size: 14, color: C.mist });
    text(ctx, typed('关于新产线传动部件的轴承配套', s.subj ?? 0), 90, 118, { size: 17, color: C.warm, weight: 500 });
    ctx.fillStyle = 'rgba(157,186,217,0.15)'; ctx.fillRect(24, 134, w - 48, 1);
    // wrapped body with typewriter
    const body = typed(DRAFT_BODY, s.body ?? 0);
    ctx.font = `400 17px ${FONT.cn}`;
    let line = '', y = 166;
    for (const ch of body) {
      if (ctx.measureText(line + ch).width > w - 56) { text(ctx, line, 28, y, { size: 17, color: C.ice }); line = ''; y += 28; }
      line += ch;
    }
    if (line) text(ctx, line, 28, y, { size: 17, color: C.ice });
    if ((s.body ?? 0) < 1 && (s.body ?? 0) > 0) { const cw = ctx.measureText(line).width; ctx.fillStyle = C.goldHi; ctx.fillRect(28 + cw + 2, y - 16, 2, 20); }
  }, { state: {} });
  st.add(draft, DR.x, DR.y, 0.3, 12);

  // chips that merge into the draft
  const chipNeed = makePanel(240, 44, (ctx, s, w, h) => pill(ctx, '需求线索：产线扩建', 2, 4, { size: 16, fill: 'rgba(12,32,64,0.9)', stroke: 'rgba(157,186,217,0.7)', color: C.ice }));
  const chipAdv = makePanel(290, 44, (ctx, s, w, h) => pill(ctx, '产品优势：P5 精度 · 稳定交付', 2, 4, { size: 16, fill: 'rgba(12,32,64,0.9)' }));
  scene.add(chipNeed.mesh, chipAdv.mesh);
  chipNeed.mesh.renderOrder = 25; chipAdv.mesh.renderOrder = 25;

  // ---------------- review
  const RV = { x: 1400, y: 660, w: 380, h: 290 };
  const review = makePanel(RV.w, RV.h, (ctx, s, w, h) => {
    glass(ctx, 0, 0, w, h, { r: 16, alpha: 0.92, highlight: s.hl ?? 0 });
    icon(ctx, 'person', 34, 36, 22, C.goldHi);
    text(ctx, '人工审核', 58, 43, { size: 20, weight: 500 });
    text(ctx, '审核人：销售', w - 22, 43, { size: 14, color: C.mist, align: 'right' });
    ['事实依据已核对', '产品信息准确', '称呼与语气合适'].forEach((l, k) => {
      const a = clamp((s.checks ?? 0) * 3 - k);
      const y = 92 + k * 40;
      ctx.strokeStyle = 'rgba(157,186,217,0.5)'; ctx.lineWidth = 1.5; roundRect(ctx, 26, y - 14, 22, 22, 5); ctx.stroke();
      if (a > 0) { ctx.globalAlpha = a; icon(ctx, 'tick', 37, y - 3, 16, C.goldHi); ctx.globalAlpha = 1; }
      text(ctx, l, 62, y + 3, { size: 17, color: a > 0 ? C.warm : C.mist });
    });
    // confirm button
    const pr = s.press ?? 0;
    const bx = 26, by = 212, bw = w - 52, bh = 52;
    roundRect(ctx, bx, by, bw, bh, 12);
    const g = ctx.createLinearGradient(bx, by, bx + bw, by);
    g.addColorStop(0, `rgba(217,179,115,${0.75 + 0.25 * pr})`); g.addColorStop(1, `rgba(164,122,54,${0.75 + 0.25 * pr})`);
    ctx.fillStyle = g; ctx.fill();
    text(ctx, s.sent ? '已发送 ✓' : '确认发送', w / 2, by + bh / 2 + 1, { size: 20, weight: 500, color: '#1a1408', align: 'center', baseline: 'middle' });
    if ((s.ripple ?? 0) > 0 && s.ripple < 1) {
      ctx.save(); ctx.beginPath(); roundRect(ctx, bx, by, bw, bh, 12); ctx.clip();
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - s.ripple)})`;
      ctx.beginPath(); ctx.arc(w / 2 + 40, by + bh / 2, 20 + 180 * s.ripple, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // cursor
    if ((s.cur ?? 0) > 0) {
      const cx = lerp(w - 30, w / 2 + 40, s.curK ?? 0), cy = lerp(h + 20, by + bh / 2 + 4, s.curK ?? 0);
      ctx.save(); ctx.globalAlpha = s.cur; ctx.translate(cx, cy); ctx.scale(1 - 0.1 * pr, 1 - 0.1 * pr);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.lineTo(7, 20); ctx.lineTo(12, 31); ctx.lineTo(17, 29); ctx.lineTo(12, 18); ctx.lineTo(21, 18); ctx.closePath();
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#0b2146'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    }
  }, { state: {} });
  st.add(review, RV.x, RV.y, 0.3, 12);

  // inbox node
  const inbox = makePanel(170, 150, (ctx, s, w, h) => {
    ctx.fillStyle = 'rgba(12,32,64,0.9)'; ctx.beginPath(); ctx.arc(w / 2, 56, 46, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,224,160,${0.5 + 0.5 * (s.hl ?? 0)})`; ctx.lineWidth = 2; ctx.stroke();
    icon(ctx, 'mail', w / 2, 56, 38, C.goldHi);
    text(ctx, '客户邮箱', w / 2, 132, { size: 17, align: 'center', color: C.warm });
  }, { state: {} });
  st.add(inbox, 1760, 900, 0.3, 12);
  const inboxGlow = glowSprite(C.goldHi, 3.4, 0); inboxGlow.position.copy(px2w(1760, 856, 0.1)); scene.add(inboxGlow);

  // gold path: draft -> review node (button) -> inbox
  const gp = [
    ...bendPoints(px2w(DR.x + DR.w / 2, DR.y, 0.35), px2w(RV.x - RV.w / 2, RV.y + 60, 0.35), 20, 0.5),
    ...bendPoints(px2w(RV.x + RV.w / 2 - 30, RV.y + 97, 0.35), px2w(1700, 856, 0.35), 24, 0.5),
  ];
  const gold = new GoldLine(gp, { width: 3, headSize: 0.9, order: 11 });
  scene.add(gold.group);
  // envelope travelling with the head
  const env = makePanel(64, 46, (ctx) => { roundRect(ctx, 2, 2, 60, 42, 6); ctx.fillStyle = '#f6f1e8'; ctx.fill(); ctx.strokeStyle = '#a47a36'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(32, 26); ctx.lineTo(60, 6); ctx.stroke(); });
  env.mesh.renderOrder = 31; scene.add(env.mesh);

  function update(t) {
    const k = ep(t, 28.75, 37.3, ease.sine);
    camera.position.set(lerp(-0.4, 0.5, k), lerp(0.35, -0.1, k), lerp(18.2, 16.9, k));
    camera.lookAt(lerp(-0.2, 0.3, k), lerp(0.1, -0.1, k), 0);
    st.grid.position.x = -camera.position.x * 0.3;

    hub.opacity = ss(29.0, 29.4, t);
    hubLinks.forEach((l, i) => { l.material.opacity = 0.55 * ss(29.3 + i * 0.1, 29.7 + i * 0.1, t); });
    const DONE = [31.3, 31.6, 31.9, 33.7];
    agents.forEach((p, i) => {
      const a = ep(t, 29.1 + i * 0.12, 29.6 + i * 0.12, ease.out);
      p.opacity = a;
      p.mesh.position.y = px2w(0, AG_Y + (1 - a) * 30).y;
      const start = 29.7 + i * 0.15;
      const prog = i === 3 ? ep(t, 31.8, 33.6, ease.inOut) : ep(t, start, DONE[i], ease.inOut);
      p.redraw({ run: t > start ? 1 : 0, tick: Math.floor(t * 6), p: Math.round(prog * 30) / 30, done: t > DONE[i] });
    });

    // chips fly from the analysis agent into the draft
    const fly = ep(t, 31.6, 32.4, ease.inOut);
    const vis = ss(31.5, 31.7, t) * (1 - ss(32.3, 32.5, t));
    chipNeed.mesh.position.copy(px2w(lerp(700, 640, fly), lerp(420, 600, fly), 1.0));
    chipAdv.mesh.position.copy(px2w(lerp(820, 900, fly), lerp(465, 600, fly), 1.0));
    chipNeed.opacity = vis; chipAdv.opacity = vis;
    chipNeed.mesh.scale.setScalar(lerp(1, 0.7, fly)); chipAdv.mesh.scale.setScalar(lerp(1, 0.7, fly));

    draft.opacity = ss(31.4, 31.8, t);
    const sent = t > 35.25;
    draft.redraw({
      subj: Math.round(ep(t, 32.3, 32.9) * 40) / 40,
      body: Math.round(ep(t, 32.8, 34.3, (x) => x) * 80) / 80,
      hl: Math.round(ss(32.3, 32.6, t) * (1 - ss(34.3, 34.8, t)) * 10) / 20,
      sent,
    });

    review.opacity = ss(33.9, 34.3, t);
    const curK = ep(t, 34.6, 35.1, ease.inOut);
    const press = ss(35.1, 35.2, t) * (1 - ss(35.3, 35.45, t));
    review.redraw({
      checks: Math.round(ep(t, 34.2, 34.9, (x) => x) * 30) / 30,
      cur: Math.round(ss(34.5, 34.7, t) * (1 - ss(35.8, 36.1, t)) * 20) / 20,
      curK: Math.round(curK * 40) / 40,
      press: Math.round(press * 10) / 10,
      ripple: Math.round(clamp((t - 35.15) / 0.5) * 20) / 20,
      sent,
      hl: Math.round(ss(35.15, 35.4, t) * 10) / 10 * 0.6,
    });

    const gk = ep(t, 35.25, 36.55, ease.inOut);
    gold.set(0, gk, 1);
    const head = gold.pointAt(gk);
    env.mesh.position.copy(head).add(new THREE.Vector3(0, 0.38, 0.05));
    env.opacity = ss(35.3, 35.5, t) * (1 - ss(36.45, 36.6, t));
    inbox.opacity = ss(33.9, 34.4, t);
    const arrived = ss(36.45, 36.8, t);
    inbox.redraw({ hl: Math.round(arrived * 10) / 10 });
    inboxGlow.material.opacity = 0.5 * arrived * (1 - 0.4 * ss(36.8, 37.3, t));
  }

  return { scene, camera, update, bloom: 0.8, threshold: 0.72, vignette: 0.45 };
}
