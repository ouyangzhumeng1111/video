// 2D overlay: on-screen captions (屏幕字幕), "流程示意" tag and the final
// brand lockup. Drawn on a separate canvas above WebGL so type stays crisp.
import { C, FONT, W, H, DPR, clamp, ss, ep, ease, text, measure, roundRect } from './lib.js';

export const CAPTIONS = [
  { t0: 0.0, t1: 6.0, kicker: 'GLOBAL OPPORTUNITY', text: '好产品，如何找到对的客户？', inAt: 1.2 },
  { t0: 6.0, t1: 13.0, kicker: 'PRODUCT KNOWLEDGE', text: '懂产品，才知道该找谁' },
  { t0: 13.0, t1: 21.0, kicker: 'MARKET INSIGHT', text: '市场洞察 → 买家发现' },
  { t0: 21.0, t1: 29.0, kicker: 'EVIDENCE', text: '看见机会，也看见依据' },
  { t0: 29.0, t1: 37.0, kicker: 'MULTI-AGENT', text: 'AI协同准备，关键动作由你掌控' },
  { t0: 37.0, t1: 45.0, kicker: 'OPPORTUNITY FLOW', text: '回复 → 需求 → 资格 → 报价' },
  { t0: 45.0, t1: 53.0, kicker: 'FEEDBACK LOOP', text: '纠错留痕，复核后复用' },
];

const SCHEMATIC = [17.6, 52.9]; // UI shots labelled 流程示意

export class Overlay {
  constructor(canvas, assets) {
    canvas.width = W * DPR; canvas.height = H * DPR;
    this.ctx = canvas.getContext('2d');
    this.logo = assets.logo;
  }

  draw(t) {
    const ctx = this.ctx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const c of CAPTIONS) if (t >= c.t0 && t < c.t1 + 0.1) this.caption(ctx, c, t);
    this.schematic(ctx, t);
    this.brand(ctx, t);
  }

  caption(ctx, c, t) {
    const tin = c.t0 + (c.inAt ?? 0.55);
    const out = 1 - ss(c.t1 - 0.45, c.t1 - 0.1, t);
    if (t < tin || out <= 0) return;
    const x = 128, base = 952;
    const size = 50;
    ctx.save();
    ctx.globalAlpha = out;
    // soft shadow plate for legibility on busy frames
    const tw = measure(ctx, c.text, { size, weight: 500 });
    const g = ctx.createLinearGradient(0, base - 150, 0, H);
    g.addColorStop(0, 'rgba(3,11,26,0)');
    g.addColorStop(0.55, 'rgba(3,11,26,0.35)');
    g.addColorStop(1, 'rgba(3,11,26,0.55)');
    ctx.fillStyle = g;
    ctx.globalAlpha = out * ss(tin, tin + 0.5, t);
    ctx.fillRect(0, base - 150, W, H - base + 150);
    ctx.globalAlpha = out;
    // gold rule + kicker
    const rule = ep(t, tin, tin + 0.6, ease.out);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x, base - 92, 44 * rule, 2);
    text(ctx, c.kicker, x + 58, base - 85, { size: 15, weight: 600, font: FONT.en, color: C.gold, ls: 4, alpha: ss(tin + 0.15, tin + 0.6, t) });
    // per-character reveal
    const chars = [...c.text];
    let cx = x;
    ctx.font = `500 ${size}px ${FONT.cn}`;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const k = ep(t, tin + 0.1 + i * 0.028, tin + 0.55 + i * 0.028, ease.out);
      const isArrow = ch === '→';
      ctx.save();
      ctx.globalAlpha = out * k;
      ctx.font = `${isArrow ? 400 : 500} ${size}px ${FONT.cn}`;
      ctx.fillStyle = isArrow ? C.gold : C.warm;
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16;
      ctx.fillText(ch, cx, base + (1 - k) * 14);
      ctx.restore();
      cx += ctx.measureText(ch).width + (ch === ' ' ? 0 : 1);
    }
    ctx.restore();
  }

  schematic(ctx, t) {
    const a = Math.min(ss(SCHEMATIC[0], SCHEMATIC[0] + 0.5, t), 1 - ss(SCHEMATIC[1] - 0.4, SCHEMATIC[1], t));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * 0.85;
    const label = '流程示意';
    const w = measure(ctx, label, { size: 17, weight: 500 }) + 44;
    const x = W - 64 - w, y = 52;
    roundRect(ctx, x, y, w, 34, 17);
    ctx.fillStyle = 'rgba(3,11,26,0.45)'; ctx.fill();
    ctx.strokeStyle = 'rgba(246,241,232,0.4)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(x + 18, y + 17, 3.5, 0, Math.PI * 2); ctx.fill();
    text(ctx, label, x + 30, y + 18, { size: 17, weight: 500, baseline: 'middle', color: C.warm });
    ctx.restore();
  }

  brand(ctx, t) {
    const T0 = 56.3; // everything settles by 57.0: last 3 s are static
    if (t < T0) return;
    const logoH = 300, logoW = logoH * (this.logo.width / this.logo.height);
    const title = 'TradeMind AI SDR';
    const sub = ['懂产品', '找对客', '有据推进'];
    const titleSize = 92, subSize = 40, gap = 70;
    const titleW = measure(ctx, title, { size: titleSize, weight: 700, font: FONT.en, ls: -1 });
    const blockW = logoW + gap * 2 + 2 + titleW;
    const x0 = (W - blockW) / 2;
    const cy = H / 2 - 10;
    ctx.save();
    // logo
    const a1 = ep(t, T0, T0 + 0.55, ease.out);
    ctx.globalAlpha = a1;
    const lg = 0.96 + 0.04 * a1;
    ctx.drawImage(this.logo, x0 + (logoW * (1 - lg)) / 2, cy - (logoH * lg) / 2, logoW * lg, logoH * lg);
    // divider (grows from centre)
    const dv = ep(t, T0 + 0.1, T0 + 0.55, ease.out);
    const dx = x0 + logoW + gap;
    const dg = ctx.createLinearGradient(0, cy - 120, 0, cy + 120);
    dg.addColorStop(0, 'rgba(164,122,54,0)'); dg.addColorStop(0.5, 'rgba(164,122,54,1)'); dg.addColorStop(1, 'rgba(164,122,54,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = dg;
    ctx.fillRect(dx, cy - 120 * dv, 2, 240 * dv);
    // title + subtitle
    const tx = dx + 2 + gap;
    const a2 = ep(t, T0 + 0.15, T0 + 0.65, ease.out);
    ctx.save();
    ctx.beginPath(); ctx.rect(tx - 10, 0, W, H); ctx.clip();
    text(ctx, title, tx - 30 * (1 - a2), cy - 6, { size: titleSize, weight: 700, font: FONT.en, color: C.navy, alpha: a2, ls: -1 });
    ctx.restore();
    const a3 = ep(t, T0 + 0.25, T0 + 0.7, ease.out);
    ctx.font = `500 ${subSize}px ${FONT.cn}`;
    let sx = tx;
    const sy = cy + 72;
    for (let i = 0; i < sub.length; i++) {
      text(ctx, sub[i], sx, sy, { size: subSize, weight: 500, color: '#26406a', alpha: a3, ls: 2 });
      sx += measure(ctx, sub[i], { size: subSize, weight: 500, ls: 2 });
      if (i < sub.length - 1) {
        ctx.save(); ctx.globalAlpha = a3; ctx.fillStyle = C.goldDeep;
        ctx.beginPath(); ctx.arc(sx + 22, sy - 13, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        sx += 44;
      }
    }
    // hairline under title
    const hl = ep(t, T0 + 0.3, T0 + 0.7, ease.inOut);
    const hg = ctx.createLinearGradient(tx, 0, tx + titleW, 0);
    hg.addColorStop(0, 'rgba(164,122,54,0.9)'); hg.addColorStop(1, 'rgba(164,122,54,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(tx, cy + 22, titleW * hl, 1.5);
    ctx.restore();
  }
}
