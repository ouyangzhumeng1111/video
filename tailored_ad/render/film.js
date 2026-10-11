// 《原来，你对谁都这么说》 TradeMind SDR · 60 s vertical screen-life film.
// The frame is a phone screen (1080x1920 CSS px, rendered at devicePixelRatio 2 = 2160x3840).
// window.renderAt(t) draws second t deterministically; window.EVENTS lists every sound cue
// (dialogue placements and effects) that audio/sound_design.py turns into the soundtrack.
const W = 1080, H = 1920, DUR = 60;
const screen = document.getElementById('screen');

// ------------------------------------------------------------------ helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pr = (t, a, b) => clamp((t - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - clamp(x), 3);
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const back = (x) => { x = clamp(x); const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function $(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
const vis = (e, on) => {  // hide/show without losing an element's own display (flex, block for .scene)
  if (!on) { if (e.style.display !== 'none') e._disp = e.style.display; e.style.display = 'none'; }
  else if (e.style.display === 'none') e.style.display = e._disp ?? (e.classList.contains('scene') ? 'block' : '');
};
const isChar = (c) => /[一-鿿A-Za-z0-9]/.test(c);

const EVENTS = [];
const sfx = (t, name, gain = 1) => EVENTS.push({ t: +t.toFixed(3), kind: 'sfx', name, gain });
const say = (t, id, from = 0, to = null, fx = 'clean') => EVENTS.push({ t: +t.toFixed(3), kind: 'line', id, from, to, fx });

const PEOPLE = {
  王: { name: '王浩', color: '#3b82f6' }, 林: { name: '林悦', color: '#f59e0b' }, 陈: { name: '陈刚', color: '#10b981' },
  周: { name: '周敏', color: '#8b5cf6' }, 张: { name: '张总', color: '#475569' }, 赵: { name: '赵工', color: '#0ea5e9' },
};
const SELLER = '铭序连接器';

// --------------------------------------------------------------- status bar
const ICONS = (c) => `<svg width="54" height="34" viewBox="0 0 54 34"><g fill="${c}"><rect x="0" y="22" width="9" height="12" rx="2"/><rect x="14" y="15" width="9" height="19" rx="2"/><rect x="28" y="8" width="9" height="26" rx="2"/><rect x="42" y="0" width="9" height="34" rx="2"/></g></svg>
<svg width="46" height="34" viewBox="0 0 46 34"><path d="M23 33 L15 24 A12 12 0 0 1 31 24 Z" fill="${c}"/><path d="M8 17 A21 21 0 0 1 38 17" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M2 10 A30 30 0 0 1 44 10" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/></svg>
<svg width="76" height="36" viewBox="0 0 76 36"><rect x="2" y="2" width="64" height="32" rx="9" stroke="${c}" stroke-width="3.5" fill="none" opacity="0.55"/><rect x="7" y="7" width="48" height="22" rx="5" fill="${c}"/><rect x="69" y="12" width="5" height="12" rx="2" fill="${c}" opacity="0.55"/></svg>`;
function status(parent, time, dark = false) {
  const c = dark ? '#f6f1e8' : '#111827';
  const s = $('div', 'status', parent, `<span>${time}</span><span class="icons">${ICONS(c)}</span>`);
  s.style.color = c; return s;
}
function sceneRoot(parent, cls = '') {
  const r = $('div', 'scene ' + cls, parent);
  const cam = $('div', 'cam ' + cls, r);
  return { r, cam };
}
function chip(parent, text, top = 1770) { const c = $('div', 'chip', parent, text); c.style.top = top + 'px'; return c; }  // bottom by default; chats sit it under the header
function chipAt(el, t, a, b) { const k = Math.min(pr(t, a, a + 0.25), 1 - pr(t, b - 0.3, b)); el.style.opacity = k; vis(el, k > 0); }

// ---------------------------------------------------------------- mail app
const GENERIC = (company) => ({
  subject: ['为贵司定制的合作方', '按'],
  sender: `王浩｜${SELLER}`, av: '王', to: `发送至 ${company}采购部 · 上午 10:12`,
  paras: [`尊敬的<span class="co">${company}</span>采购部：`, '您好！', '研究了贵司的业务，<br>这份方案，是专门为您做的。',
    '方案涵盖产品选型、价格政策与交付周期，详见附件。期待与贵司合作！', `王浩<br><span style="color:#6b7280;font-size:38px">${SELLER} · 大客户经理</span>`],
  attach: ['合作方按.pdf', '2.4 MB'],
});
const SPECIFIC = {
  subject: ['关于贵司新增无人机产线的连接器选型', ''],
  sender: `王浩｜${SELLER}`, av: '王', to: '发送至 赵工 · 昨天 16:48',
  paras: ['赵工您好，', '看到贵司新增无人机产线，<br>工业连接器是否已有选型计划？<br>可先发规格书，供技术评估。', `王浩<br><span style="color:#6b7280;font-size:38px">${SELLER} · 大客户经理</span>`],
  attach: ['M12 工业连接器 产品资料.pdf', '3.1 MB'],
};
function mailDetail(parent, o) {
  const r = $('div', 'scene light', parent);
  r.style.cssText = 'display:block;width:1080px;height:1920px;inset:auto;left:0;top:0;';
  status(r, o.time);
  $('div', 'navbar', r, `<span style="color:${o.accent}">‹ 收件箱</span><span style="color:${o.accent};font-size:40px;letter-spacing:6px">回复 · 转发</span>`);
  const body = $('div', 'mailbody', r), inner = $('div', 'mailinner', body);
  const m = o.mail;
  const subj = $('div', 'subject', inner, `${m.subject[0]}<span class="typo">${m.subject[1]}</span>`);
  const snd = $('div', 'sender', inner, `<div class="av" style="background:${PEOPLE[m.av].color}">${m.av}</div><div class="nm">${m.sender}</div><div class="to">${m.to}</div>`);
  $('div', 'hr', inner);
  m.paras.forEach((p) => $('div', 'para', inner, p));
  const att = $('div', 'attach', inner, `<div class="ic">PDF</div><div class="fn">${m.attach[0]}</div><div class="fs">${m.attach[1]}</div>`);
  return { r, inner, subj, typo: subj.querySelector('.typo'), co: [...inner.querySelectorAll('.co')], att, snd };
}
function inbox(parent, o) {
  const r = $('div', 'scene light', parent);
  r.style.cssText = 'display:block;width:1080px;height:1920px;inset:auto;left:0;top:0;';
  status(r, o.time);
  $('div', 'navbar', r, `<span style="color:${o.accent}">‹ 邮箱</span><span style="color:${o.accent}">编辑</span>`);
  $('div', 'bigtitle', r, '收件箱');
  $('div', 'search', r, '搜索');
  const list = $('div', 'list', r);
  const row = (av, color, from, time, subj, prev, cls = '') => {
    const e = $('div', 'row ' + cls, list, `<div class="av" style="background:${color}">${av}</div><div class="from">${from}</div><div class="time">${time}</div><div class="subj">${subj}</div><div class="prev">${prev}</div>`);
    return e;
  };
  const fresh = row(o.newRow.av, PEOPLE[o.newRow.av]?.color ?? '#3b82f6', o.newRow.from, o.newRow.time, o.newRow.subj, o.newRow.prev);
  $('div', 'dot', fresh).style.background = o.accent;
  fresh.style.overflow = 'hidden';
  [['展', '#64748b', '华南工业展组委会', '昨天', '观展须知与展位图', '请携带电子胸卡入场，休息区位于 3 号馆二层…'],
   ['财', '#a855f7', '财务部', '昨天', '九月报销截止提醒', '本月报销请于 9 月 28 日前提交，逾期顺延至…'],
   ['供', '#22c55e', '供应商 B', '星期一', '询价回复：304 不锈钢件', '您好，附件为本次询价的报价单与交期说明…'],
   ['行', '#f97316', '行政部', '星期一', '会议室预订确认', '您预订的 A302 会议室已确认，时间为周四下午…']].forEach((x) => row(...x, 'dim'));
  return { r, list, fresh };
}
function tapFx(parent) { const e = $('div', 'tapfx', parent); vis(e, false); return e; }
function tapAt(e, t, t0, x, y, size = 150) {
  const k = pr(t, t0, t0 + 0.32);
  vis(e, t >= t0 && k < 1);
  const s = size * (0.5 + 0.8 * eo(k));
  e.style.cssText += `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;opacity:${0.9 * (1 - k)};`;
}

// --------------------------------------------------------------- chat app
function thumb(parent, w, build) {
  const box = $('div', 'thumb', parent);
  box.style.width = w + 'px'; box.style.height = Math.round(w * H / W) + 'px';
  const v = build(box); v.r.style.transform = `scale(${w / W})`; v.r.style.transformOrigin = '0 0';
  return { box, v };
}
function circleOn(span) {  // red hand-drawn ellipse around the typo, drawn in the thumb's own coordinates
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', 210); svg.setAttribute('height', 150);
  svg.style.cssText = 'position:absolute;left:-75px;top:-30px;overflow:visible';
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M190 40 C 170 -6, 30 -10, 12 50 C -4 110, 120 140, 180 105 C 214 84, 206 44, 160 26');
  p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#e5484d'); p.setAttribute('stroke-width', 14); p.setAttribute('stroke-linecap', 'round');
  svg.appendChild(p); span.appendChild(svg);
  const len = 620; p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
  return (k) => { p.style.strokeDashoffset = len * (1 - clamp(k)); };
}
const ROW_BARS = mulberry32(11);
function chat(parent, o) {
  const { r, cam } = sceneRoot(parent, 'chat');
  status(cam, o.time);
  const head = $('div', 'chathead', cam, `<div class="back">‹</div><div class="ttl">${o.title}</div><div class="sub">${o.sub ?? ''}</div>`);
  const sub = head.querySelector('.sub');
  const msgs = $('div', 'msgs', cam);
  const bar = $('div', 'inputbar', cam, `<div class="mic">◉</div><div class="field"></div><div class="plus">+</div>`);
  const field = bar.querySelector('.field');
  const items = [];
  const add = (m) => {
    const wrap = $('div', 'mwrap', msgs);
    const sep = m.sep ? $('div', '', wrap, `<div style="text-align:center;font-size:28px;color:#9aa1ab;padding:22px 0 6px">${m.sep}</div>`) : null;
    const msg = $('div', 'msg ' + m.side, wrap);
    $('div', 'av', msg, m.av).style.background = PEOPLE[m.av].color;
    const col = $('div', 'col', msg);
    if (o.group && m.side === 'left') $('div', 'who', col, PEOPLE[m.av].name);
    const it = { m, wrap, msg, h: 0 };
    if (m.kind === 'text') $('div', 'bubble', col, m.text);
    if (m.kind === 'image') { const b = $('div', 'bubble media', col); thumb(b, m.w ?? 300, m.build); }
    if (m.kind === 'stitched') {
      const b = $('div', 'bubble media', col); b.style.display = 'flex'; b.style.gap = '8px';
      it.circles = m.builds.map((fn) => { const th = thumb(b, 212, fn); return circleOn(th.v.typo); });
    }
    if (m.kind === 'link') {
      $('div', 'link', col, `<div class="lt">TradeMind SDR</div><div class="ld">找对客户，说到点上。按你的产品匹配目标企业，附上每家的联系依据。</div><div class="li">TM</div><div class="ls">tradeMind SDR · 产品介绍</div>`);
    }
    if (m.kind === 'voice') {
      const b = $('div', 'bubble', col);
      const dur = m.dur;
      b.style.minWidth = Math.min(640, 230 + dur * 70) + 'px';
      const n = Math.max(8, Math.min(18, Math.round(dur * 4)));
      const hs = Array.from({ length: n }, () => 18 + ROW_BARS() * 44);
      b.innerHTML = `<div class="voice" style="flex-direction:${m.side === 'right' ? 'row-reverse' : 'row'}"><div class="bars">${hs.map((h) => `<i style="height:${h}px"></i>`).join('')}</div><div class="len">${Math.max(1, Math.round(dur))}″</div></div>`;
      it.bars = [...b.querySelectorAll('i')];
      if (m.side === 'right') it.bars.reverse();
      if (m.trans) { it.trans = $('div', 'trans', col); it.trans.style.display = 'none'; }
    }
    items.push(it);
    return it;
  };
  o.msgs.forEach(add);
  return { r, cam, sub, msgs, field, items, bar, head };
}
function charTimes(text, words) {
  const toks = [];
  for (const [w, s, e] of words) { const cs = [...w].filter(isChar); cs.forEach((c, i) => toks.push(s + (e - s) * (i + 1) / cs.length)); }
  const out = []; let k = 0, last = 0;
  for (const c of text) { if (isChar(c)) last = k < toks.length ? toks[k++] : last + 0.12; out.push(last); }
  return out;
}
function reveal(text, times, t) { let n = 0; while (n < times.length && times[n] <= t) n++; return [...text].slice(0, n).join(''); }
function chatUpdate(c, t, typing = []) {
  for (const it of c.items) {
    const a = it.m.at;
    const k = a < 0 ? 1 : eo(pr(t, a, a + 0.24));
    vis(it.wrap, k > 0);
    const grow = it.trans ? (it.h1 - it.h) * eo(pr(t, it.m.play, it.m.play + 0.25)) : 0;
    it.wrap.style.height = ((it.h + grow) * k) + 'px';
    it.msg.style.opacity = k;
    it.msg.style.transform = `scale(${0.92 + 0.08 * back(pr(t, a, a + 0.3))})`;
    if (it.bars) {
      const p0 = it.m.play ?? 1e9, p = pr(t, p0, p0 + it.m.dur);
      const right = it.m.side === 'right';
      it.bars.forEach((b, i) => { const on = (i + 0.5) / it.bars.length <= p; b.style.background = right ? (on ? '#fff' : 'rgba(255,255,255,0.45)') : (on ? '#111827' : '#c3c8d0'); });
      if (it.trans) {
        vis(it.trans, t >= p0);
        it.trans.textContent = reveal(it.m.trans.text, it.m.trans.times, t - p0) || ' ';
      }
    }
    if (it.circles) it.circles.forEach((f, i) => f(pr(t, it.m.circleAt + i * 0.16, it.m.circleAt + i * 0.16 + 0.42)));
  }
  const ty = typing.find(([a, b]) => t >= a && t < b);
  c.sub.textContent = ty ? ty[2] : (c.defaultSub ?? '');
}
function measure(c) {
  c.items.forEach((it) => {
    it.wrap.style.height = 'auto'; vis(it.wrap, true);
    if (it.trans) { it.trans.textContent = it.m.trans.text; vis(it.trans, true); it.h1 = it.wrap.getBoundingClientRect().height; vis(it.trans, false); }
    it.h = it.wrap.getBoundingClientRect().height;
  });
}

// ---------------------------------------------------------------- keyboard
function keyboard(parent, dark = false) {
  const k = $('div', 'kbd' + (dark ? ' dark' : ''), parent);
  const cand = $('div', 'cand', k);
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  const keys = [];
  const kw = 96, gap = 10;
  rows.forEach((row, ri) => {
    const off = (W - (row.length * kw + (row.length - 1) * gap)) / 2;
    [...row].forEach((ch, i) => { const e = $('div', 'k', k, ch.toLowerCase()); e.style.left = off + i * (kw + gap) + 'px'; e.style.top = 120 + ri * 136 + 'px'; e.style.width = kw + 'px'; keys.push(e); });
  });
  const space = $('div', 'k', k, '空格'); space.style.cssText += 'left:250px;top:528px;width:580px;font-size:38px;';
  const send = $('div', 'k', k, '发送'); send.style.cssText += `left:850px;top:528px;width:190px;font-size:38px;background:${dark ? '#d9b373' : '#4f7cff'};color:${dark ? '#0b2146' : '#fff'};`;
  const num = $('div', 'k', k, '123'); num.style.cssText += 'left:40px;top:528px;width:190px;font-size:38px;';
  return { k, cand, keys, presses: [] };
}
function kbdUpdate(kb, t, shown) {
  const y = (1 - eo(shown)) * 720;
  kb.k.style.transform = `translateY(${y}px)`; vis(kb.k, shown > 0);
  const R = mulberry32(7);
  const hot = new Set();
  kb.presses.forEach((p) => { const i = Math.floor(R() * kb.keys.length); if (t >= p && t < p + 0.09) hot.add(i); });
  kb.keys.forEach((e, i) => { e.style.filter = hot.has(i) ? 'brightness(0.78)' : ''; });
}
function typedFrom(spans, t) {  // spans: [[t0, t1, text, mode]] mode: type | del ; returns current text
  let text = '';
  for (const [a, b, s, mode] of spans) {
    if (t < a) break;
    const n = [...s].length, k = Math.round(n * pr(t, a, b));
    text = mode === 'del' ? [...s].slice(0, n - k).join('') : [...s].slice(0, k).join('');
  }
  return text;
}
function pressTimes(spans) { const out = []; for (const [a, b, s] of spans) { const n = [...s].length; for (let i = 0; i < n; i++) out.push(a + (b - a) * (i + 0.5) / n); } return out; }

function banner(parent, o) {
  const b = $('div', 'banner', parent, `<div class="bi" style="background:${o.color}">${o.icon}</div><div class="bt">${o.title}</div><div class="bx">${o.text}</div><div class="bw">现在</div>`);
  vis(b, false); return b;
}
function bannerAt(b, t, a, out = 99) {
  const k = eo(pr(t, a, a + 0.32)) * (1 - eo(pr(t, out, out + 0.3)));
  vis(b, k > 0); b.style.top = lerp(-240, 44, k) + 'px';
}
function camera(cam, cx, cy, s) { cam.style.transform = `translate(${W / 2 - cx * s}px, ${H / 2 - cy * s}px) scale(${s})`; }
function camRest(cam) { cam.style.transform = ''; }
function centerOf(el, cam) {  // element centre in the cam's own (unscaled) coordinates
  const saved = cam.style.transform; cam.style.transform = 'none';
  const a = el.getBoundingClientRect(), b = cam.getBoundingClientRect();
  cam.style.transform = saved;
  return [a.left - b.left + a.width / 2, a.top - b.top + a.height / 2];
}

// ================================================================== scenes
const LINES_AT = { L1: 1.40, R1: 6.60, R2: 8.55, L2: 10.45, L3: 19.30, L4: 24.95, L5: 28.10, L6: 42.50, L7: 47.30 };
const SCENES = [];
let L = {};

function buildAll() {
  const words = (id) => L[id].words;
  // where "专门为您做的" begins and "您" ends inside the salesman's first take: the repeats reuse that very audio
  const w1 = words('L1');
  const zi = w1.findIndex(([w]) => w.includes('专'));
  const nin = w1.findIndex(([w]) => w.includes('您'));
  const rFrom = Math.max(0, w1[zi][1] - 0.05), rTo = L.L1.dur, cutTo = w1[nin][2] + 0.02;

  // ---------------- A/B/C: the same email, three buyers, three times "专门为您做的"
  const buyers = [
    { t0: 0, t1: 6.0, time: '10:12', accent: '#2f6bff', company: '启衡精工', who: '林悦 · 启衡精工 采购', av: '林' },
    { t0: 6.0, t1: 8.0, time: '10:14', accent: '#14a37f', company: '澜岳电子', who: '陈刚 · 澜岳电子 采购', av: '陈' },
    { t0: 8.0, t1: 9.25, time: '10:15', accent: '#8b5cf6', company: '瑞岑智造', who: '周敏 · 瑞岑智造 采购', av: '周' },
  ];
  buyers.forEach((b, i) => {
    const { r, cam } = sceneRoot(screen, 'light');
    const inb = inbox(cam, { time: b.time, accent: b.accent, newRow: { av: '王', from: `王浩｜${SELLER}`, time: '10:12', subj: '为贵司定制的合作方按', prev: '研究了贵司的业务，<br>这份方案，是专门为您做的。' } });
    const det = mailDetail(cam, { time: b.time, accent: b.accent, mail: GENERIC(b.company) });
    const tap = tapFx(cam);
    const c = chip(r, b.who);
    const T = [ // per scene: row arrives, tap, open (push), line start
      { rowIn: 0.35, tap: 0.95, open: [1.05, 1.40] },
      { rowIn: -1, tap: 6.20, open: [6.25, 6.50] },
      { rowIn: -1, tap: 8.00, open: [8.00, 8.12] },
    ][i];
    if (T.rowIn > 0) sfx(T.rowIn, 'ding');
    if (i < 2) sfx(T.tap, 'tap'); sfx(T.open[0], 'swish', i === 2 ? 0.6 : 1);
    SCENES.push({
      t0: b.t0, t1: b.t1, r, update(t) {
        const rk = T.rowIn < 0 ? 1 : eo(pr(t, T.rowIn, T.rowIn + 0.35));
        inb.fresh.style.height = 226 * rk + 'px';
        const ok = eio(pr(t, T.open[0], T.open[1]));
        vis(inb.r, ok < 1); vis(det.r, ok > 0);
        inb.r.style.transform = `translateX(${-280 * ok}px)`; inb.r.style.filter = `brightness(${1 - 0.25 * ok})`;
        det.r.style.transform = `translateX(${(1 - ok) * 1080}px)`;
        det.r.style.boxShadow = ok < 1 ? '-30px 0 60px rgba(0,0,0,0.15)' : '';
        tapAt(tap, t, T.tap, 520, 470 + 113, 170);
        // reading: the same slow push-in on all three, so the repeats rhyme
        const lineAt = [LINES_AT.L1, LINES_AT.R1, LINES_AT.R2][i];
        const z = i === 0 ? eio(pr(t, 1.4, 5.9)) : 0.55 + 0.45 * eio(pr(t, lineAt - 0.3, b.t1));
        camera(cam, 540, lerp(960, 900, z), lerp(1, 1.07, z));
        chipAt(c, t, b.t0 + 0.12, b.t0 + (i === 0 ? 1.7 : 1.15));
      },
    });
  });
  say(LINES_AT.L1, 'L1');
  say(LINES_AT.R1, 'L1', rFrom, rTo);
  say(LINES_AT.R2, 'L1', rFrom, cutTo);

  // ---------------- D: the buyers' group chat at the expo
  const D = { t0: 9.25, t1: 23.6 };
  const mk = (company, time, accent) => (box) => mailDetail(box, { time, accent, mail: GENERIC(company) });
  const tr = (id, text) => ({ text, times: charTimes(text, words(id)) });
  const gc = chat(screen, {
    time: '15:32', title: '华南工业展 · 采购交流 (3)', group: true, msgs: [
      { at: -1, side: 'left', av: '陈', kind: 'text', text: '展会第二天，下午茶区集合？', sep: '今天 15:10' },
      { at: -1, side: 'left', av: '周', kind: 'text', text: '已到，靠窗那桌' },
      { at: -1, side: 'right', av: '林', kind: 'text', text: '马上到，给你们带了咖啡' },
      { at: 9.75, side: 'right', av: '林', kind: 'image', build: mk('启衡精工', '10:12', '#2f6bff'), sep: '15:32' },
      { at: 10.25, side: 'right', av: '林', kind: 'voice', dur: L.L2.dur, play: LINES_AT.L2, trans: tr('L2', '这家挺用心，还专门给我做了方案。') },
      { at: 15.50, side: 'left', av: '陈', kind: 'image', build: mk('澜岳电子', '10:14', '#14a37f') },
      { at: 15.95, side: 'left', av: '陈', kind: 'text', text: '你看看我这份。' },
      { at: 18.65, side: 'left', av: '周', kind: 'image', build: mk('瑞岑智造', '10:15', '#8b5cf6') },
      { at: 19.10, side: 'left', av: '周', kind: 'voice', dur: L.L3.dur, play: LINES_AT.L3, trans: tr('L3', '连错别字都一样。') },
      { at: 21.40, side: 'left', av: '周', kind: 'stitched', circleAt: 21.6, builds: [mk('启衡精工', '10:12', '#2f6bff'), mk('澜岳电子', '10:14', '#14a37f'), mk('瑞岑智造', '10:15', '#8b5cf6')] },
    ],
  });
  gc.defaultSub = '林悦、陈刚、周敏';
  const gTyping = [[14.30, 15.45, '陈刚 正在输入…'], [18.20, 18.60, '周敏 正在输入…'], [22.90, 23.35, '陈刚 正在输入…']];
  // split screen: her email over his, identical but for the company name
  const split = $('div', 'abs', gc.r); split.style.cssText = 'left:0;top:0;width:1080px;height:1920px;background:#111;z-index:12;display:none';
  const halves = ['启衡精工', '澜岳电子'].map((co, i) => {
    const hb = $('div', 'abs', split); hb.style.cssText = `left:0;top:${i * 962}px;width:1080px;height:958px;overflow:hidden;background:#fff`;
    const v = mailDetail(hb, { time: i ? '10:14' : '10:12', accent: i ? '#14a37f' : '#2f6bff', mail: GENERIC(co) });
    v.r.style.transform = 'translateY(-90px)';
    const lab = $('div', 'chip', hb, i ? '陈刚收到的' : '林悦收到的'); lab.style.cssText += 'top:auto;bottom:40px;left:auto;right:40px;transform:none;';
    return v;
  });
  const gTap = tapFx(gc.cam);
  const gChip = chip(gc.r, '华南工业展 · 3 号馆休息区', 300);
  [9.75, 10.25, 15.50, 15.95, 18.65, 19.10, 21.40].forEach((t) => sfx(t, 'pop'));
  [10.45, 19.30].forEach((t) => sfx(t - 0.06, 'blip'));
  sfx(16.45, 'swish', 0.5); sfx(18.05, 'swish', 0.4); sfx(21.22, 'shutter');
  say(LINES_AT.L2, 'L2', 0, null, 'phone'); say(LINES_AT.L3, 'L3', 0, null, 'phone');
  SCENES.push({
    t0: D.t0, t1: D.t1, r: gc.r, measure: () => measure(gc), update(t) {
      chatUpdate(gc, t, gTyping);
      const sp = t >= 16.45 && t < 18.05; vis(split, sp);
      if (sp) {
        const k = eo(pr(t, 16.45, 16.75)) * (1 - eo(pr(t, 17.85, 18.05)));
        split.style.opacity = k;
        const hl = pr(t, 16.95, 17.25);
        halves.forEach((v) => v.co.forEach((e) => { e.style.background = `rgba(255,214,10,${0.6 * hl})`; }));
      }
      // the stitched image: push in while the circles draw, then back out to the silent header
      const st = gc.items[gc.items.length - 1];
      const zin = eio(pr(t, 21.45, 21.85)), zout = eio(pr(t, 22.55, 22.85));
      const z = zin * (1 - zout);
      if (z > 0) { const [x, y] = centerOf(st.msg.querySelector('.bubble'), gc.cam); camera(gc.cam, lerp(540, x, z), lerp(960, y, z), lerp(1, 1.45, z)); } else camRest(gc.cam);
      chipAt(gChip, t, D.t0 + 0.1, D.t0 + 1.5);
      tapAt(gTap, t, 16.30, 300, 1100, 140);
    },
  });

  // ---------------- E: the boss, in the salesman's DMs
  const E = { t0: 23.6, t1: 33.6 };
  const stitchedBuild = [mk('启衡精工', '10:12', '#2f6bff'), mk('澜岳电子', '10:14', '#14a37f'), mk('瑞岑智造', '10:15', '#8b5cf6')];
  const dm = chat(screen, {
    time: '16:05', title: '张总', msgs: [
      { at: -1, side: 'right', av: '王', kind: 'text', text: '张总，三家的方案都发出去了。', sep: '昨天 18:20' },
      { at: -1, side: 'left', av: '张', kind: 'stitched', circleAt: -10, builds: stitchedBuild, sep: '16:04' },
      { at: 24.40, side: 'left', av: '张', kind: 'text', text: '客户发来的。' },
      { at: 24.75, side: 'left', av: '张', kind: 'voice', dur: L.L4.dur, play: LINES_AT.L4, trans: tr('L4', '你到底定制了什么？') },
      { at: 30.40, side: 'right', av: '王', kind: 'voice', dur: L.L5.dur, play: LINES_AT.L5 },
      { at: 32.85, side: 'left', av: '张', kind: 'link' },
    ],
  });
  dm.defaultSub = '';
  const dmList = $('div', 'abs', dm.r); dmList.style.cssText = 'left:0;top:0;width:1080px;height:1920px;background:#f4f5f7;z-index:11';
  status(dmList, '16:05');
  $('div', 'bigtitle', dmList, '消息').style.top = '150px';
  [['张', '张总', '[图片]', '16:04'], ['林', '林悦 · 启衡精工', '收到，谢谢', '10:40'], ['陈', '陈刚 · 澜岳电子', '好的，我看一下', '10:32'], ['周', '周敏 · 瑞岑智造', '[图片]', '15:58']].forEach(([a, n, p, tm], i) => {
    const e = $('div', 'row', dmList, `<div class="av" style="background:${PEOPLE[a].color};border-radius:22px">${a}</div><div class="from">${n}</div><div class="time">${tm}</div><div class="prev" style="margin-top:14px">${p}</div>`);
    e.style.cssText += `position:absolute;left:0;top:${300 + i * 226}px;width:1080px;`;
  });
  const bossBanner = banner(dm.r, { icon: '张', color: PEOPLE.张.color, title: '张总', text: '[图片]' });
  const rec = $('div', 'abs', dm.r); rec.style.cssText = 'left:0;top:0;width:1080px;height:1920px;background:rgba(17,24,39,0.55);z-index:15;display:none';
  const recBox = $('div', 'abs', rec); recBox.style.cssText = 'left:240px;top:1080px;width:600px;height:250px;border-radius:40px;background:#4f7cff;display:flex;align-items:center;justify-content:center;gap:10px';
  const recBars = Array.from({ length: 22 }, () => { const i = $('i', '', recBox); i.style.cssText = 'display:block;width:10px;border-radius:5px;background:#fff;height:14px'; return i; });
  $('div', 'abs', rec, '松开 发送').style.cssText = 'left:0;width:1080px;top:1380px;text-align:center;color:#fff;font-size:38px';
  const recMic = $('div', 'abs', rec, '◉'); recMic.style.cssText = 'left:430px;top:1520px;width:220px;height:220px;border-radius:110px;background:#fff;color:#4f7cff;font-size:90px;display:flex;align-items:center;justify-content:center';
  const dmKbd = keyboard(dm.cam);
  const dmType = [[31.80, 32.10, '其实我', 'type'], [32.40, 32.62, '其实我', 'del']];
  dmKbd.presses = pressTimes([dmType[0]]).concat(pressTimes([[32.40, 32.62, '其实我']]));
  const dmTap = tapFx(dm.cam);
  const dmChip = chip(dm.r, '王浩 · 铭序连接器 销售', 300);
  const w5 = words('L5');
  sfx(23.65, 'banner'); sfx(23.95, 'tap'); sfx(24.05, 'swish', 0.7); sfx(24.40, 'pop'); sfx(24.75, 'pop'); sfx(LINES_AT.L4 - 0.06, 'blip');
  sfx(28.0, 'rec'); sfx(30.36, 'sent'); sfx(32.85, 'pop'); sfx(33.30, 'tap'); sfx(33.45, 'swish');
  dmKbd.presses.forEach((t) => sfx(t, 'key', 0.8));
  say(LINES_AT.L4, 'L4', 0, null, 'phone'); say(LINES_AT.L5, 'L5', 0, null, 'clean');
  SCENES.push({
    t0: E.t0, t1: E.t1, r: dm.r, measure: () => measure(dm), update(t) {
      const open = eio(pr(t, 24.05, 24.30));
      vis(dmList, open < 1); dmList.style.transform = `translateX(${-300 * open}px)`;
      dm.cam.style.transform = `translateX(${(1 - open) * 1080}px)`;
      bannerAt(bossBanner, t, 23.65, 23.95);
      chatUpdate(dm, t, [[30.65, 31.65, '对方正在输入…']]);
      dm.head.querySelector('.sub').style.color = '#4f7cff';
      const rv = t >= 28.0 && t < 30.4; vis(rec, rv);
      if (rv) {
        rec.style.opacity = eo(pr(t, 28.0, 28.15)) * (1 - pr(t, 30.25, 30.4));
        const lt = t - LINES_AT.L5;
        const talking = w5.some(([, s, e]) => lt >= s && lt <= e);
        recBars.forEach((b, i) => { const v = talking ? 30 + 70 * Math.abs(Math.sin(t * 13 + i * 1.7) * Math.sin(t * 5.3 + i)) : 14; b.style.height = v + 'px'; });
      }
      const kshow = pr(t, 31.62, 31.78) * (1 - pr(t, 32.70, 32.86));
      kbdUpdate(dmKbd, t, kshow);
      dm.msgs.style.height = (1490 - 690 * eo(kshow)) + 'px';  // keyboard is 690 px tall
      dm.bar.style.transform = `translateY(${-690 * eo(kshow)}px)`;
      const txt = typedFrom(dmType, t);
      dm.field.innerHTML = txt + (kshow > 0 && Math.floor(t * 2.4) % 2 === 0 ? '<span class="caret"></span>' : '');
      dmKbd.cand.textContent = t >= 31.80 && t < 32.40 ? '其实我　其实　奇石　骑士' : '';
      tapAt(dmTap, t, 33.30, 470, 1560, 170);
      chipAt(dmChip, t, 24.2, 25.6);
    },
  });

  // ---------------- F: TradeMind SDR — find the customer, see the reason, write to the point
  const F = { t0: 33.6, t1: 45.2 };
  const { r: fr, cam: fc } = sceneRoot(screen, 'tm');
  status(fc, '16:08', true);
  const splash = $('div', 'abs', fr); splash.style.cssText = 'left:0;top:0;width:1080px;height:1920px;background:#061530;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center';
  splash.innerHTML = '<div style="font-size:96px;font-weight:800;color:#f6f1e8;letter-spacing:2px">TradeMind SDR</div><div style="width:420px;height:4px;background:#d9b373;margin:36px 0"></div><div style="font-size:40px;color:#9dbad9;letter-spacing:6px">智能客户开发</div>';
  // F1 discover
  const f1 = $('div', 'abs', fc); f1.style.cssText = 'left:0;top:0;width:1080px;height:1920px';
  $('div', 'hdr', f1, '客户发现'); $('div', 'brand', f1, 'TradeMind SDR');
  const form = $('div', 'card', f1); form.style.cssText += 'top:280px;height:560px;padding:40px 44px;';
  form.innerHTML = '<div class="lab">我的产品</div><div class="fld" id="fp"></div><div class="lab" style="margin-top:34px">目标客户</div><div class="fld" id="ft"></div><div class="btn" style="margin-top:44px">匹配企业</div>';
  const fp = form.querySelector('#fp'), ft = form.querySelector('#ft'), fbtn = form.querySelector('.btn');
  const found = $('div', 'abs', f1, '为你找到 4 家匹配企业'); found.style.cssText = 'left:64px;top:890px;font-size:34px;color:#9dbad9';
  const RES = [['翔屿无人机制造', '东莞 · 无人机整机制造 · 600 人', '96%', ['新建产线', '采购窗口期']], ['云岬航空科技', '深圳 · 工业无人机 · 320 人', '91%', ['扩产中']],
    ['北辰智装', '苏州 · 无人机零部件 · 450 人', '88%', ['新品立项']], ['启翼无人系统', '成都 · 测绘无人机 · 210 人', '85%', ['招标中']]];
  const resEls = RES.map(([n, m, p, tags], i) => {
    const e = $('div', 'res', f1, `<div class="n">${n}</div><div class="m">${m}</div><div>${tags.map((x) => `<span class="tag">${x}</span>`).join('')}</div><div class="pct">匹配 ${p}</div>`);
    e.style.top = 960 + i * 236 + 'px'; return e;
  });
  // F2 detail
  const f2 = $('div', 'abs', fc); f2.style.cssText = 'left:0;top:0;width:1080px;height:1920px;background:#081a38';
  $('div', 'hdr', f2, '翔屿无人机制造'); $('div', 'brand', f2, '匹配 96%');
  const info = $('div', 'card', f2); info.style.cssText += 'top:290px;height:300px;padding:36px 44px;';
  info.innerHTML = [['行业', '无人机整机制造'], ['规模', '600 人'], ['所在地', '广东 · 东莞'], ['采购联系人', '赵工 · 采购部']].map(([a, b]) => `<div style="display:flex;justify-content:space-between;font-size:38px;line-height:58px"><span style="color:#9dbad9">${a}</span><span>${b}</span></div>`).join('');
  $('div', 'sec', f2, '联系依据').style.top = '650px';
  const basis = $('div', 'card', f2); basis.style.cssText += 'top:720px;height:420px;padding:40px 44px;border-color:rgba(217,179,115,0.85);';
  basis.innerHTML = '<div style="font-size:32px;color:#9dbad9">企业官网动态 · 3 天前</div><div style="font-size:50px;font-weight:700;line-height:1.45;margin-top:22px">新增无人机生产线，<br>项目进入建设阶段。</div><div style="font-size:30px;color:#9dbad9;margin-top:24px">来源：企业官网 · 新闻动态</div>';
  const angle = $('div', 'card', f2); angle.style.cssText += 'top:1180px;height:170px;padding:34px 44px;';
  angle.innerHTML = '<div style="font-size:32px;color:#9dbad9">建议切入点</div><div style="font-size:42px;margin-top:10px">新产线的工业连接器选型</div>';
  const wbtn = $('div', 'btn abs', f2, '写开发邮件'); wbtn.style.cssText += 'left:56px;top:1420px;width:968px;';
  // F3 compose
  const f3 = $('div', 'abs', fc); f3.style.cssText = 'left:0;top:0;width:1080px;height:1920px;background:#081a38';
  $('div', 'hdr', f3, '写邮件');
  const sendB = $('div', 'btn abs', f3, '发送'); sendB.style.cssText += 'left:800px;top:150px;width:224px;height:96px;font-size:40px;';
  const meta = $('div', 'card', f3); meta.style.cssText += 'top:290px;height:300px;padding:30px 44px;';
  meta.innerHTML = '<div style="font-size:36px;line-height:64px"><span style="color:#9dbad9">收件人　</span>赵工 · 翔屿无人机制造 采购部</div><div style="font-size:36px;line-height:64px"><span style="color:#9dbad9">主题　　</span>关于贵司新增无人机产线的连接器选型</div><div style="margin-top:14px"><span class="tag" style="margin:0">依据：官网动态 · 新增无人机产线</span></div>';
  const bodyBox = $('div', 'card', f3); bodyBox.style.cssText += 'top:630px;height:520px;padding:40px 44px;font-size:46px;line-height:1.75;';
  const fKbd = keyboard(fc, true);
  const DRAFT = ['看到贵司新增无人机产线，', '工业连接器是否已有选型计划？', '可先发规格书，供技术评估。'];
  const habit = '这份方案是专门为您……';
  const fType = [[34.25, 34.75, '工业连接器'], [34.85, 35.35, '无人机制造工厂']];
  const bType = [[41.30, 42.20, habit, 'type'], [42.65, 43.05, habit, 'del']];
  fKbd.presses = pressTimes(fType).concat(pressTimes([bType[0]])).concat(pressTimes([[42.65, 43.05, habit]]));
  const toast = $('div', 'toast', fr, '<svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26" fill="#d9b373"/><path d="M15 29 L25 38 L42 19" stroke="#0b2146" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>已发送');
  const vo = $('div', 'abs', fr, '先了解客户，再开口。'); vo.style.cssText = 'left:0;width:1080px;top:1640px;text-align:center;font-size:56px;font-weight:700;color:#d9b373;letter-spacing:4px;z-index:26;text-shadow:0 4px 24px rgba(0,0,0,0.6)';
  const fTap = tapFx(fc);
  sfx(33.62, 'chime', 0.7); sfx(35.50, 'tap'); [35.70, 35.85, 36.00, 36.15].forEach((t) => sfx(t, 'tick', 0.6)); sfx(36.75, 'tap'); sfx(37.40, 'swish', 0.6);
  sfx(37.90, 'glow', 0.7); sfx(40.70, 'tap'); sfx(41.00, 'swish', 0.6); sfx(44.45, 'tap'); sfx(44.55, 'sent'); sfx(44.62, 'chime', 0.6);
  fKbd.presses.forEach((t) => sfx(t, 'key', 0.7));
  [0, 1, 2].forEach((i) => sfx(43.15 + i * 0.3, 'tick', 0.5));
  say(LINES_AT.L6, 'L6', 0, null, 'voiceover');
  SCENES.push({
    t0: F.t0, t1: F.t1, r: fr, update(t) {
      const sk = 1 - eo(pr(t, 33.95, 34.15)); vis(splash, sk > 0); splash.style.opacity = sk;
      const s1 = t < 37.40, s2 = t >= 37.40 && t < 41.0, s3 = t >= 41.0;
      vis(f1, s1); vis(f2, s2); vis(f3, s3);
      const slide = (a) => `translateX(${(1 - eio(pr(t, a, a + 0.25))) * 240}px)`;
      f2.style.transform = slide(37.40); f2.style.opacity = eo(pr(t, 37.40, 37.62));
      f3.style.transform = slide(41.0); f3.style.opacity = eo(pr(t, 41.0, 41.22));
      fp.innerHTML = typedFrom([fType[0]], t) || '<span style="color:#5d7699">例如：工业连接器</span>';
      ft.innerHTML = typedFrom([fType[1]], t) || '<span style="color:#5d7699">例如：无人机制造工厂</span>';
      fbtn.style.filter = t >= 35.5 && t < 35.65 ? 'brightness(0.8)' : '';
      vis(found, t >= 35.62); found.style.opacity = eo(pr(t, 35.62, 35.8));
      resEls.forEach((e, i) => { const k = eo(pr(t, 35.70 + i * 0.15, 35.70 + i * 0.15 + 0.3)); e.style.opacity = k; e.style.transform = `translateY(${(1 - k) * 60}px)`; e.style.boxShadow = i === 0 && t >= 36.75 ? '0 0 0 4px #d9b373' : ''; });
      const glow = 0.5 + 0.5 * Math.sin((t - 37.9) * 5);
      basis.style.boxShadow = t >= 37.9 ? `0 0 ${40 + 30 * glow}px rgba(217,179,115,${0.35 + 0.25 * glow})` : '';
      // he leans in on the reason to write
      const lean = eio(pr(t, 38.0, 39.6)) * (1 - eio(pr(t, 40.25, 40.6)));
      if (s2 && lean > 0) camera(fc, 540, lerp(960, 930, lean), lerp(1, 1.11, lean)); else camRest(fc);
      wbtn.style.filter = t >= 40.7 && t < 40.85 ? 'brightness(0.8)' : '';
      const draft = DRAFT.map((s, i) => { const k = pr(t, 43.15 + i * 0.3, 43.15 + i * 0.3 + 0.28); return [...s].slice(0, Math.round([...s].length * k)).join(''); }).filter(Boolean);
      const typed = typedFrom(bType, t);
      const caret = (t < 44.3 && Math.floor(t * 2.4) % 2 === 0) ? '<span class="caret" style="background:#d9b373"></span>' : '';
      bodyBox.innerHTML = '<div style="color:#9dbad9;font-size:38px">赵工您好，</div>' + (draft.length ? draft.join('<br>') : typed) + caret;
      const kshow = pr(t, 34.12, 34.25) * (1 - pr(t, 35.40, 35.55)) + pr(t, 41.12, 41.28) * (1 - pr(t, 43.08, 43.24));
      kbdUpdate(fKbd, t, kshow);
      fKbd.cand.textContent = t >= 34.25 && t < 35.4 ? '工业连接器　连接器　无人机' : (t >= 41.3 && t < 42.6 ? '专门为您　专门　方案' : '');
      sendB.style.filter = t >= 44.45 && t < 44.6 ? 'brightness(0.8)' : '';
      const tk = eo(pr(t, 44.6, 44.8)) * (1 - pr(t, 45.0, 45.2)); vis(toast, tk > 0); toast.style.opacity = tk; toast.style.transform = `scale(${0.9 + 0.1 * tk})`;
      const vk = eo(pr(t, 43.2, 43.5)) * (1 - pr(t, 44.95, 45.2)); vis(vo, vk > 0); vo.style.opacity = vk;
      tapAt(fTap, t, 35.50, 540, 800, 170);
    },
  });
  // second tap ripple on F1/F2/F3 needs its own element
  const fTap2 = tapFx(fc), fTap3 = tapFx(fc), fTap4 = tapFx(fc);
  const fUpd = SCENES[SCENES.length - 1].update;
  SCENES[SCENES.length - 1].update = (t) => { fUpd(t); tapAt(fTap2, t, 36.75, 540, 1065, 170); tapAt(fTap3, t, 40.70, 540, 1476, 170); tapAt(fTap4, t, 44.45, 912, 198, 150); };

  // ---------------- G: the next day — a reply worth having
  const G = { t0: 45.2, t1: 55.0 };
  const { r: gr, cam: gcam } = sceneRoot(screen, 'light');
  const nextDay = $('div', 'abs', gr, '次日'); nextDay.style.cssText = 'left:0;top:0;width:1080px;height:1920px;background:#0b0f17;color:#f6f1e8;font-size:88px;font-weight:700;letter-spacing:20px;display:flex;align-items:center;justify-content:center;z-index:20';
  const zd = mailDetail(gcam, { time: '09:18', accent: '#0ea5e9', mail: SPECIFIC });
  const zChip = chip(gr, '赵工 · 翔屿无人机制造 采购');
  const sheet = $('div', 'abs', gcam); sheet.style.cssText = 'left:0;top:520px;width:1080px;height:1400px;background:#fff;border-radius:44px 44px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,0.18);z-index:7';
  sheet.innerHTML = '<div style="padding:40px 56px 0;font-size:36px;color:#6b7280">回复：王浩｜铭序连接器</div><div style="margin:20px 56px 0;height:2px;background:#eceef1"></div><div class="rt" style="padding:30px 56px;font-size:46px;line-height:1.7;color:#111827"></div>';
  const rt = sheet.querySelector('.rt');
  const sendZ = $('div', 'abs', sheet, '发送'); sendZ.style.cssText = 'right:56px;top:28px;padding:10px 34px;border-radius:30px;background:#0ea5e9;color:#fff;font-size:36px;font-weight:700';
  const zKbd = keyboard(gcam);
  zKbd.k.style.zIndex = 8;  // above the reply sheet
  const reply = '我们正在选连接器。发份规格书，技术看一下。';
  const replyT = charTimes(reply, words('L7'));
  zKbd.presses = replyT.filter((_, i) => isChar([...reply][i])).map((x) => LINES_AT.L7 + x - 0.05);
  // the salesman's phone: the reply lands, he goes straight to the spec sheets
  const sInbox = inbox(gcam, { time: '09:41', accent: '#2f6bff', newRow: { av: '赵', from: '赵工 · 翔屿无人机制造', time: '09:40', subj: '回复：关于贵司新增无人机产线的连接器选型', prev: reply } });
  const files = $('div', 'scene light', gcam); files.style.cssText = 'display:block;width:1080px;height:1920px;inset:auto;left:0;top:0;';
  status(files, '09:41');
  $('div', 'navbar', files, '<span style="color:#2f6bff">‹ 文件</span><span style="color:#2f6bff">选择</span>');
  $('div', 'bigtitle', files, '规格资料');
  const FILES = [['PDF', '#e5484d', 'M12 防水工业连接器 规格书 V3.pdf', '2.8 MB · 昨天'], ['XLS', '#16a34a', '无人机线束选型对照表.xlsx', '640 KB · 星期二'], ['PDF', '#e5484d', '认证证书合集（UL / CE）.pdf', '5.2 MB · 九月'], ['DOC', '#2563eb', '样品申请说明.docx', '120 KB · 九月']];
  const checks = FILES.map(([ic, c, n, m], i) => {
    const e = $('div', 'frow', files, `<div class="fi" style="background:${c}">${ic}</div><div class="fn">${n}</div><div class="fm">${m}</div><div class="ck"></div>`);
    e.style.cssText += `position:absolute;left:0;top:${360 + i * 200}px;width:1080px;`;
    return e.querySelector('.ck');
  });
  const selBar = $('div', 'abs', files, '已选 3 项　·　发送给 赵工'); selBar.style.cssText = 'left:56px;top:1660px;width:968px;height:120px;border-radius:30px;background:#2f6bff;color:#fff;font-size:40px;font-weight:700;display:flex;align-items:center;justify-content:center';
  const bossOk = banner(gr, { icon: '张', color: PEOPLE.张.color, title: '张总', text: '好。' });
  const gTap1 = tapFx(gcam), gTap2 = tapFx(gcam), gTap3 = tapFx(gcam);
  sfx(45.20, 'swish', 0.3); sfx(46.30, 'swish', 0.3); sfx(46.95, 'tap'); sfx(47.05, 'swish', 0.5);
  zKbd.presses.forEach((t) => sfx(t, 'key', 0.75));
  sfx(52.10, 'tap'); sfx(52.18, 'sent');
  sfx(52.50, 'ding'); sfx(52.95, 'tap'); sfx(53.05, 'swish', 0.5); [53.35, 53.60, 53.85].forEach((t) => sfx(t, 'tick', 0.7)); sfx(54.20, 'banner', 0.8);
  say(LINES_AT.L7, 'L7', 0, null, 'clean');
  SCENES.push({
    t0: G.t0, t1: G.t1, r: gr, update(t) {
      const nd = Math.min(eo(pr(t, 45.2, 45.4)), 1 - eo(pr(t, 45.75, 45.95))); vis(nextDay, nd > 0); nextDay.style.opacity = nd;
      const zPhone = t < 52.40;
      vis(zd.r, zPhone); vis(sheet, zPhone); vis(zKbd.k, zPhone);
      vis(sInbox.r, !zPhone && t < 53.25); vis(files, t >= 53.05);
      if (zPhone) {
        zd.inner.style.transform = `translateY(${-430 * eio(pr(t, 46.30, 46.80))}px)`;
        zd.att.style.boxShadow = t >= 46.80 ? `0 0 0 ${6 * eo(pr(t, 46.8, 47.0))}px rgba(14,165,233,0.45)` : '';
        const sk = eio(pr(t, 47.05, 47.30)) * (1 - eio(pr(t, 52.15, 52.35)));
        sheet.style.transform = `translateY(${(1 - sk) * 1500}px)`;
        rt.innerHTML = reveal(reply, replyT, t - LINES_AT.L7) + (sk > 0 && t < 52.1 && Math.floor(t * 2.4) % 2 === 0 ? '<span class="caret" style="background:#0ea5e9"></span>' : '');
        kbdUpdate(zKbd, t, sk);
        zKbd.cand.textContent = t >= LINES_AT.L7 && t < 52.0 ? '连接器　规格书　技术' : '';
        sendZ.style.filter = t >= 52.10 && t < 52.22 ? 'brightness(0.85)' : '';
        camera(gcam, 540, 960, lerp(1, 1.03, pr(t, 45.95, 52.4)));
      } else camRest(gcam);
      sInbox.fresh.style.height = 226 * eo(pr(t, 52.50, 52.85)) + 'px';
      const fo = eio(pr(t, 53.05, 53.25));
      sInbox.r.style.transform = `translateX(${-280 * fo}px)`; files.style.transform = `translateX(${(1 - fo) * 1080}px)`;
      checks.forEach((c, i) => { const on = i < 3 && t >= 53.35 + i * 0.25; c.style.background = on ? '#2f6bff' : ''; c.style.borderColor = on ? '#2f6bff' : '#c3c8d0'; c.textContent = on ? '✓' : ''; });
      const sb = eo(pr(t, 53.9, 54.1)); vis(selBar, sb > 0); selBar.style.opacity = sb; selBar.style.transform = `translateY(${(1 - sb) * 40}px)`;
      bannerAt(bossOk, t, 54.20);
      chipAt(zChip, t, 46.0, 47.3);
      tapAt(gTap1, t, 46.95, 860, 172, 150); tapAt(gTap2, t, 52.10, 930, 580, 140); tapAt(gTap3, t, 52.95, 520, 583, 170);
    },
  });

  // ---------------- end card
  const { r: er } = sceneRoot(screen, 'end');
  const e1 = $('div', 'abs', er, '改个公司名，不叫懂客户。'); e1.style.cssText = 'left:0;width:1080px;top:640px;text-align:center;font-size:62px;font-weight:500;color:#f6f1e8;letter-spacing:4px';
  const e2 = $('div', 'abs', er, 'TradeMind SDR'); e2.style.cssText = 'left:0;width:1080px;top:880px;text-align:center;font-size:118px;font-weight:800;color:#f6f1e8;letter-spacing:2px';
  const rule = $('div', 'abs', er); rule.style.cssText = 'left:290px;width:500px;top:1050px;height:4px;background:linear-gradient(90deg,rgba(217,179,115,0),#d9b373,rgba(217,179,115,0))';
  const e3 = $('div', 'abs', er, '找对客户，说到点上。'); e3.style.cssText = 'left:0;width:1080px;top:1100px;text-align:center;font-size:60px;font-weight:500;color:#d9b373;letter-spacing:8px';
  const plate = $('div', 'abs', er); plate.style.cssText = 'left:420px;top:1340px;width:240px;height:240px;border-radius:44px;background:#f6f1e8;display:flex;align-items:center;justify-content:center;box-shadow:0 0 60px rgba(217,179,115,0.18)';
  const logo = $('img', '', plate); logo.src = '../assets/logo_rgba.png'; logo.style.cssText = 'width:190px;height:190px;object-fit:contain';
  sfx(55.0, 'swish', 0.4);
  SCENES.push({
    t0: 55.0, t1: 60.01, r: er, update(t) {
      const up = (el, a) => { const k = eo(pr(t, a, a + 0.6)); el.style.opacity = k; el.style.transform = `translateY(${(1 - k) * 30}px)`; };
      up(e1, 55.25); up(e2, 56.30); up(e3, 56.95); up(plate, 57.45);
      rule.style.transform = `scaleX(${eo(pr(t, 56.6, 57.2))})`;
      er.style.opacity = 1 - pr(t, 59.7, 60.0);
    },
  });
  EVENTS.push({ t: 33.60, kind: 'cue', name: 'music_in' }, { t: 21.00, kind: 'cue', name: 'music_stop' }, { t: 58.55, kind: 'cue', name: 'music_hit' });
  EVENTS.sort((a, b) => a.t - b.t);
}

window.renderAt = (t) => {
  for (const s of SCENES) {
    const on = t >= s.t0 && t < s.t1;
    s.r.style.display = on ? 'block' : 'none';
    if (on) s.update(t);
  }
};

(async () => {
  L = await (await fetch('../audio/lines/lines.json')).json();
  for (const w of [400, 500, 600, 700, 800]) await document.fonts.load(`${w} 40px "Noto Sans CJK SC"`, '王浩专门为您');
  buildAll();
  await new Promise((r) => { const im = document.querySelector('.end img'); if (im.complete) r(); else im.onload = r; });
  for (const s of SCENES) { s.r.style.display = 'block'; s.measure?.(); s.r.style.display = 'none'; }
  window.EVENTS = EVENTS;
  window.renderAt(0);
  window.__ready = true;
})();
