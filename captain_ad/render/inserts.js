// Two shots rendered in true 4K (1920x1080 CSS at devicePixelRatio 2):
//   ?shot=ui   S26 laptop screen lights up: TradeMind SDR workbench, all data intact
//   ?shot=end  S35 black brand end card with logo
// window.renderAt(t) draws frame t (seconds) deterministically.
const DPR = window.devicePixelRatio || 1;
const shot = new URLSearchParams(location.search).get('shot') || 'ui';
const W = 1920, H = 1080;
const C = { navy: '#0b2146', deep: '#061530', gold: '#d9b373', goldHi: '#ffe0a0', warm: '#f6f1e8', mist: '#9dbad9', ice: '#cfe0f2', ok: '#8fd6a8' };
const CN = '"Noto Sans CJK SC", sans-serif', EN = 'Inter, "Noto Sans CJK SC", sans-serif';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const outC = (x) => 1 - Math.pow(1 - clamp(x), 3);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function txt(ctx, s, x, y, o = {}) {
  ctx.save(); ctx.font = `${o.w ?? 400} ${o.size ?? 20}px ${o.font ?? CN}`; ctx.fillStyle = o.color ?? C.warm;
  ctx.globalAlpha *= o.alpha ?? 1; ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'alphabetic';
  if (o.ls) ctx.letterSpacing = `${o.ls}px`;
  if (o.glow) { ctx.shadowColor = o.glowColor ?? C.gold; ctx.shadowBlur = o.glow; }
  ctx.fillText(s, x, y); const w = ctx.measureText(s).width; ctx.restore(); return w;
}
function setup(id, w, h) { const c = document.getElementById(id); c.width = w * DPR; c.height = h * DPR; c.style.width = w + 'px'; c.style.height = h + 'px'; const ctx = c.getContext('2d'); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); return { c, ctx }; }

const bg = setup('bg', W, H), fg = setup('fg', W, H), lap = setup('laptop', 1640, 1060);
const logo = new Image(); logo.src = '/captain_ad/assets/logo_rgba.png';

// ---------------------------------------------------------------- embers
const R = mulberry32(5);
const embers = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H, s: 1 + R() * 3.5, v: 20 + R() * 60, ph: R() * 6.28, a: 0.3 + R() * 0.7, blur: R() }));
function drawEmbers(ctx, t, alpha = 1, tint = '255,170,90') {
  for (const e of embers) {
    const y = ((e.y - t * e.v) % H + H) % H;
    const x = e.x + Math.sin(t * 1.3 + e.ph) * 14;
    const fl = 0.6 + 0.4 * Math.sin(t * 9 + e.ph * 3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, e.s * (2 + e.blur * 4));
    g.addColorStop(0, `rgba(${tint},${e.a * fl * alpha})`); g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, e.s * (2 + e.blur * 4), 0, Math.PI * 2); ctx.fill();
  }
}

// ------------------------------------------------------------ UI insert
function drawNightBackground(ctx, t) {
  ctx.fillStyle = '#04070d'; ctx.fillRect(0, 0, W, H);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, 'rgba(22,44,78,0.55)'); sky.addColorStop(0.55, 'rgba(8,16,30,0.2)'); sky.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // burning ship far behind: warm bokeh, flickering
  const blobs = [[260, 300, 260, 1.0], [470, 210, 180, 0.8], [1660, 330, 240, 0.9], [1480, 180, 150, 0.6], [120, 620, 160, 0.5], [1800, 700, 200, 0.5]];
  blobs.forEach(([x, y, r, k], i) => {
    const fl = 0.75 + 0.25 * Math.sin(t * (7 + i) + i) * Math.sin(t * 3.1 + i * 2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,150,60,${0.55 * k * fl})`); g.addColorStop(0.5, `rgba(200,80,30,${0.22 * k * fl})`); g.addColorStop(1, 'rgba(120,40,10,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  });
  drawEmbers(ctx, t, 0.7);
}

const CUSTOMERS = [['A', '示例客户 A', '德国 · 农业机械', '报价协同'], ['B', '候选企业 B', '波兰 · 输送设备', '需求确认'], ['C', '候选企业 C', '荷兰 · 五金贸易', '待跟进'], ['D', '候选企业 D', '意大利 · 农机零部件', '样品评估'], ['E', '候选企业 E', '西班牙 · 泵阀', '已联系'], ['F', '候选企业 F', '土耳其 · 工程机械', '新线索']];
const DEALS = [['示例客户 A', '轴承配套', '报价协同', 4], ['候选企业 D', '农机零部件', '样品评估', 3], ['候选企业 B', '输送设备', '需求确认', 2]];
const FOLLOW = [['已发送技术资料', '示例客户 A', true], ['技术沟通会议', '示例客户 A', true], ['报价单（草稿）已关联商机', '示例客户 A', true], ['样品寄送确认', '候选企业 D', true], ['下一步：与采购经理确认技术参数', '示例客户 A', false]];

function drawScreen(ctx, t, x0, y0, w, h) {
  // t: seconds since shot start
  ctx.save(); rr(ctx, x0, y0, w, h, 6); ctx.clip();
  ctx.fillStyle = '#020306'; ctx.fillRect(x0, y0, w, h);
  const on = ss(0.42, 0.62, t);
  if (on > 0) {
    // splash
    const sp = on * (1 - ss(1.0, 1.25, t));
    if (sp > 0) {
      const g = ctx.createRadialGradient(x0 + w / 2, y0 + h / 2, 0, x0 + w / 2, y0 + h / 2, w * 0.7);
      g.addColorStop(0, `rgba(16,40,80,${sp})`); g.addColorStop(1, `rgba(4,10,24,${sp})`);
      ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
      txt(ctx, 'TradeMind SDR', x0 + w / 2, y0 + h / 2 - 6, { size: 64, w: 700, font: EN, align: 'center', base: 'middle', alpha: sp * ss(0.5, 0.75, t), color: C.warm, ls: 1 });
      const pw = 360 * ss(0.62, 1.05, t);
      ctx.fillStyle = `rgba(217,179,115,${sp})`; ctx.fillRect(x0 + w / 2 - 180, y0 + h / 2 + 52, pw, 3);
      txt(ctx, '正在登录 · 云端账号', x0 + w / 2, y0 + h / 2 + 96, { size: 20, align: 'center', color: C.mist, alpha: sp * ss(0.6, 0.8, t) });
    }
    const ui = ss(1.0, 1.25, t);
    if (ui > 0) drawWorkbench(ctx, t, x0, y0, w, h, ui);
  }
  ctx.restore();
}

function drawWorkbench(ctx, t, x0, y0, w, h, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#0d2447'); g.addColorStop(1, '#07152c');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  // top bar
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x0, y0, w, 64);
  ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(x0 + 36, y0 + 32, 10, 0, Math.PI * 2); ctx.fill();
  txt(ctx, 'TradeMind SDR', x0 + 58, y0 + 40, { size: 22, w: 700, font: EN });
  txt(ctx, '工作台', x0 + 232, y0 + 40, { size: 20, color: C.mist });
  rr(ctx, x0 + w / 2 - 220, y0 + 16, 440, 34, 17); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
  txt(ctx, '搜索客户、商机、跟进…', x0 + w / 2 - 196, y0 + 39, { size: 16, color: 'rgba(207,224,242,0.5)' });
  const sync = ss(1.55, 1.8, t);
  ctx.fillStyle = sync > 0.5 ? C.ok : C.mist; ctx.beginPath(); ctx.arc(x0 + w - 250, y0 + 32, 6, 0, Math.PI * 2); ctx.fill();
  txt(ctx, sync > 0.5 ? '已同步 · 账号正常' : '同步中…', x0 + w - 236, y0 + 39, { size: 18, color: C.ice });
  // left rail
  ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x0, y0 + 64, 76, h - 64);
  for (let i = 0; i < 6; i++) { rr(ctx, x0 + 22, y0 + 96 + i * 62, 32, 32, 8); ctx.fillStyle = i === 0 ? 'rgba(217,179,115,0.8)' : 'rgba(157,186,217,0.22)'; ctx.fill(); }
  // heading
  txt(ctx, '欢迎回来，船长', x0 + 104, y0 + 118, { size: 34, w: 700 });
  txt(ctx, '客户、商机与跟进记录均已完整保留', x0 + 104, y0 + 154, { size: 18, color: C.mist });
  const cols = [[x0 + 104, 450, '客户资料', '6 家企业'], [x0 + 578, 450, '商机记录', '3 个进行中'], [x0 + 1052, w - 1052 - 32, '跟进记录', '最近更新']];
  cols.forEach(([cx, cw, title, sub], ci) => {
    const k = outC((t - 1.1 - ci * 0.12) / 0.35);
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 18);
    rr(ctx, cx, y0 + 184, cw, h - 214, 14); ctx.fillStyle = 'rgba(20,48,92,0.72)'; ctx.fill(); ctx.strokeStyle = 'rgba(157,186,217,0.25)'; ctx.lineWidth = 1.2; ctx.stroke();
    txt(ctx, title, cx + 22, y0 + 224, { size: 22, w: 500 });
    txt(ctx, sub, cx + cw - 22, y0 + 224, { size: 15, color: C.mist, align: 'right' });
    ctx.fillStyle = 'rgba(157,186,217,0.2)'; ctx.fillRect(cx + 18, y0 + 240, cw - 36, 1);
    ctx.restore();
  });
  // rows cascade in: "everything is still there"
  CUSTOMERS.forEach(([ini, name, where, stage], i) => {
    const k = outC((t - 1.25 - i * 0.06) / 0.3); if (k <= 0) return;
    const y = y0 + 262 + i * 104, cx = x0 + 104;
    ctx.save(); ctx.globalAlpha *= k; ctx.translate((1 - k) * -14, 0);
    ctx.fillStyle = 'rgba(217,179,115,0.25)'; ctx.beginPath(); ctx.arc(cx + 44, y + 36, 22, 0, Math.PI * 2); ctx.fill();
    txt(ctx, ini, cx + 44, y + 37, { size: 20, w: 700, font: EN, align: 'center', base: 'middle', color: C.goldHi });
    txt(ctx, name, cx + 80, y + 30, { size: 20, w: 500 });
    txt(ctx, where, cx + 80, y + 56, { size: 15, color: C.mist });
    const pw = ctx.measureText(stage).width;
    rr(ctx, cx + 450 - 22 - 96, y + 18, 96, 30, 15); ctx.fillStyle = 'rgba(217,179,115,0.14)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,160,0.5)'; ctx.stroke();
    txt(ctx, stage, cx + 450 - 22 - 48, y + 34, { size: 14, align: 'center', base: 'middle', color: C.goldHi });
    ctx.restore();
  });
  DEALS.forEach(([name, what, stage, step], i) => {
    const k = outC((t - 1.35 - i * 0.08) / 0.3); if (k <= 0) return;
    const y = y0 + 262 + i * 170, cx = x0 + 578;
    ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 12);
    rr(ctx, cx + 18, y, 414, 150, 12); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
    txt(ctx, name, cx + 38, y + 38, { size: 20, w: 500 });
    txt(ctx, what, cx + 38, y + 66, { size: 16, color: C.mist });
    for (let s = 0; s < 5; s++) { rr(ctx, cx + 38 + s * 76, y + 96, 68, 8, 4); ctx.fillStyle = s < step ? C.gold : 'rgba(157,186,217,0.2)'; ctx.fill(); }
    txt(ctx, `阶段：${stage}`, cx + 38, y + 132, { size: 15, color: C.goldHi });
    ctx.restore();
  });
  FOLLOW.forEach(([what, who, done], i) => {
    const k = outC((t - 1.45 - i * 0.07) / 0.3); if (k <= 0) return;
    const y = y0 + 272 + i * 118, cx = x0 + 1052;
    ctx.save(); ctx.globalAlpha *= k;
    ctx.strokeStyle = 'rgba(157,186,217,0.3)'; ctx.lineWidth = 2;
    if (i < FOLLOW.length - 1) { ctx.beginPath(); ctx.moveTo(cx + 40, y + 20); ctx.lineTo(cx + 40, y + 118); ctx.stroke(); }
    ctx.fillStyle = done ? C.gold : C.goldHi; ctx.beginPath(); ctx.arc(cx + 40, y + 12, done ? 9 : 11, 0, Math.PI * 2); ctx.fill();
    if (done) { ctx.strokeStyle = '#0b2146'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx + 35, y + 12); ctx.lineTo(cx + 39, y + 16); ctx.lineTo(cx + 46, y + 8); ctx.stroke(); }
    txt(ctx, what, cx + 66, y + 18, { size: 19, w: done ? 400 : 700, color: done ? C.warm : C.goldHi });
    txt(ctx, who, cx + 66, y + 44, { size: 15, color: C.mist });
    ctx.restore();
  });
  // toast
  const tk = outC((t - 1.8) / 0.3);
  if (tk > 0) {
    ctx.save(); ctx.globalAlpha *= tk; const tw = 360, tx = x0 + w - tw - 34, ty = y0 + h - 84 + (1 - tk) * 20;
    rr(ctx, tx, ty, tw, 52, 26); ctx.fillStyle = 'rgba(12,32,64,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(143,214,168,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    txt(ctx, '✓  数据完整 · 云端已同步', tx + tw / 2, ty + 27, { size: 18, align: 'center', base: 'middle', color: C.ok });
    ctx.restore();
  }
  ctx.restore();
}

function drawLaptop(t) {
  const ctx = lap.ctx; ctx.clearRect(0, 0, 1640, 1060);
  // lid + bezel
  rr(ctx, 0, 0, 1640, 1060, 34);
  const g = ctx.createLinearGradient(0, 0, 0, 1060); g.addColorStop(0, '#1b1d22'); g.addColorStop(1, '#0c0d10'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(160,170,185,0.35)'; ctx.lineWidth = 3; ctx.stroke();
  drawScreen(ctx, t, 40, 40, 1560, 975);
  // glass: soot smudges and fingerprints, faint reflection of fire
  const r = mulberry32(11);
  for (let i = 0; i < 14; i++) {
    const x = 40 + r() * 1560, y = 40 + r() * 975, s = 20 + r() * 90;
    const sg = ctx.createRadialGradient(x, y, 0, x, y, s); sg.addColorStop(0, `rgba(10,8,6,${0.10 + r() * 0.16})`); sg.addColorStop(1, 'rgba(10,8,6,0)');
    ctx.fillStyle = sg; ctx.fillRect(x - s, y - s, s * 2, s * 2);
  }
  const refl = ctx.createLinearGradient(40, 40, 1600, 1015);
  refl.addColorStop(0, 'rgba(255,150,70,0.07)'); refl.addColorStop(0.35, 'rgba(255,255,255,0.0)'); refl.addColorStop(0.7, 'rgba(255,255,255,0.03)'); refl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = refl; ctx.fillRect(40, 40, 1560, 975);
  // soot on the bezel
  for (let i = 0; i < 18; i++) { const x = r() * 1640, y = r() < 0.5 ? 6 + r() * 30 : 1022 + r() * 30, s = 14 + r() * 50; const sg2 = ctx.createRadialGradient(x, y, 0, x, y, s); sg2.addColorStop(0, `rgba(0,0,0,${0.18 + r() * 0.2})`); sg2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg2; ctx.fillRect(x - s, y - s, s * 2, s * 2); }
}

function renderUI(t) {
  document.getElementById('rig').style.display = 'none';
  drawNightBackground(bg.ctx, t);
  drawLaptop(t);
  // laptop composited in 2D: slow push-in, slight tilt and float (cheap at 4K)
  const push = outC(t / 3.0);
  const b = bg.ctx;
  b.save();
  b.translate(W / 2, H / 2 + 10);
  b.scale(0.9 + 0.07 * push, 0.9 + 0.07 * push);
  b.rotate((-1.2 + 0.6 * push + 0.25 * Math.sin(t * 1.1)) * Math.PI / 180);
  b.transform(1, 0, -0.03 + 0.015 * push, 1, 0, 0);
  const sh = b.createRadialGradient(0, 40, 300, 0, 40, 1000);  // soft contact shadow, no blur filter
  sh.addColorStop(0, 'rgba(0,0,0,0.75)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  b.fillStyle = sh; b.fillRect(-1100, -700, 2200, 1500);
  b.drawImage(lap.c, -820, -530, 1640, 1060);
  b.restore();
  // screen light spill + foreground embers and vignette
  const f = fg.ctx; f.clearRect(0, 0, W, H);
  const on = ss(0.42, 0.62, t);
  const spill = f.createRadialGradient(W / 2, H * 0.55, 100, W / 2, H * 0.55, 1100);
  spill.addColorStop(0, `rgba(90,140,220,${0.10 * on})`); spill.addColorStop(1, 'rgba(0,0,0,0)');
  f.fillStyle = spill; f.fillRect(0, 0, W, H);
  drawEmbers(f, t + 7, 0.45);
  const v = f.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
  f.fillStyle = v; f.fillRect(0, 0, W, H);
}

// -------------------------------------------------------------- end card
function renderEnd(t) {
  document.getElementById('rig').style.display = 'none';
  const ctx = bg.ctx;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // smoke haze + a few embers, very low
  const hz = ctx.createRadialGradient(W / 2, H * 0.62, 0, W / 2, H * 0.62, W * 0.6);
  hz.addColorStop(0, 'rgba(60,40,28,0.35)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H);
  drawEmbers(ctx, t, 0.35 * (1 - 0.5 * ss(1.2, 2.2, t)));
  const a1 = outC(t / 0.7);
  txt(ctx, 'TradeMind SDR', W / 2, 452, { size: 118, w: 700, font: EN, align: 'center', color: C.warm, alpha: a1, ls: 2 });
  const lw = 520 * ss(0.25, 0.9, t);
  const lg = ctx.createLinearGradient(W / 2 - 260, 0, W / 2 + 260, 0);
  lg.addColorStop(0, 'rgba(217,179,115,0)'); lg.addColorStop(0.5, 'rgba(217,179,115,1)'); lg.addColorStop(1, 'rgba(217,179,115,0)');
  ctx.fillStyle = lg; ctx.fillRect(W / 2 - lw / 2, 498, lw, 2);
  txt(ctx, '生意的底气，带得走。', W / 2, 584, { size: 54, w: 500, align: 'center', color: C.gold, alpha: outC((t - 0.35) / 0.6), ls: 6 });
  // company logo on a warm-white badge (logo colours kept as supplied)
  const la = outC((t - 0.7) / 0.6);
  if (la > 0 && logo.complete) {
    const bh = 176, bw = bh * (logo.width / logo.height) + 36, bx = W / 2 - bw / 2, by = 744;
    ctx.save(); ctx.globalAlpha = la;
    rr(ctx, bx, by, bw, bh + 24, 16); ctx.fillStyle = '#f6f1e8'; ctx.fill();
    ctx.drawImage(logo, bx + 18, by + 12, bw - 36, bh);
    ctx.restore();
  }
  fg.ctx.clearRect(0, 0, W, H);
}

window.renderAt = (t) => (shot === 'end' ? renderEnd(t) : renderUI(t));
Promise.all([document.fonts.load('700 40px Inter'), document.fonts.load('500 40px "Noto Sans CJK SC"'), logo.decode()]).then(() => { window.__ready = true; });
