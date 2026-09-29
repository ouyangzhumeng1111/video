// Shared helpers: palette, easing, seeded random, canvas-drawn UI panels,
// glowing gold lines, soft point sprites. 1 world unit = 100 px at z = 0
// when viewed through pxCamera().
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

export const W = 1920, H = 1080;
export const DPR = window.devicePixelRatio || 1;
export const PX = 0.01;

export const C = {
  bg: '#030b1a', deep: '#061530', navy: '#0b2146', blue: '#163f78', steel: '#3d6c9e',
  mist: '#9dbad9', ice: '#cfe0f2', warm: '#f6f1e8', warm2: '#e8dcc6',
  gold: '#d9b373', goldHi: '#ffe0a0', goldDeep: '#a47a36', amber: '#e7a45a',
  pending: '#8ea5c3',
};
export const FONT = {
  cn: '"Noto Sans CJK SC", sans-serif',
  en: 'Inter, "Noto Sans CJK SC", sans-serif',
  mono: '"IBM Plex Mono", "Noto Sans CJK SC", monospace',
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const ss = (a, b, t) => { const x = prog(t, a, b); return x * x * (3 - 2 * x); };
export const ease = {
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: (x) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
// eased progress of t through [a, b]
export const ep = (t, a, b, fn = ease.inOut) => fn(prog(t, a, b));
// fade in over [a, a+fi], hold, fade out over [b-fo, b]
export const window01 = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(ss(a, a + fi, t), 1 - ss(b - fo, b, t));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pxCamera(fov = 35) {
  const cam = new THREE.PerspectiveCamera(fov, W / H, 0.1, 5000);
  cam.position.set(0, 0, pxDistance(fov));
  return cam;
}
export const pxDistance = (fov = 35) => (H * PX / 2) / Math.tan((fov * Math.PI) / 360);

// ---------------------------------------------------------------- canvas UI
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function glass(ctx, x, y, w, h, o = {}) {
  const r = o.r ?? 18;
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  const a = o.alpha ?? 0.82;
  g.addColorStop(0, `rgba(26,58,108,${a})`);
  g.addColorStop(1, `rgba(9,26,56,${a})`);
  ctx.fillStyle = o.fill ?? g;
  ctx.fill();
  if (o.warm) {
    ctx.fillStyle = `rgba(246,241,232,${o.warm})`;
    ctx.fill();
  }
  ctx.lineWidth = o.lw ?? 1.5;
  ctx.strokeStyle = o.stroke ?? 'rgba(157,186,217,0.28)';
  ctx.stroke();
  if (o.highlight) {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(255,224,160,${o.highlight})`;
    ctx.shadowColor = `rgba(217,179,115,${o.highlight})`;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  // top sheen
  ctx.clip();
  const s = ctx.createLinearGradient(x, y, x, y + 60);
  s.addColorStop(0, 'rgba(255,255,255,0.07)');
  s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s;
  ctx.fillRect(x, y, w, 60);
  ctx.restore();
}

export function text(ctx, str, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.weight ?? 400} ${o.size ?? 24}px ${o.font ?? FONT.cn}`;
  ctx.fillStyle = o.color ?? C.warm;
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.ls) ctx.letterSpacing = `${o.ls}px`;
  if (o.glow) { ctx.shadowColor = o.glowColor ?? C.gold; ctx.shadowBlur = o.glow; }
  ctx.fillText(str, x, y);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

export function measure(ctx, str, o = {}) {
  ctx.save();
  ctx.font = `${o.weight ?? 400} ${o.size ?? 24}px ${o.font ?? FONT.cn}`;
  if (o.ls) ctx.letterSpacing = `${o.ls}px`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

// Pill / tag
export function pill(ctx, str, x, y, o = {}) {
  const size = o.size ?? 18;
  const padX = o.padX ?? 12, hgt = o.h ?? size + 14;
  const w = measure(ctx, str, { size, weight: o.weight ?? 500, font: o.font }) + padX * 2 + (o.icon ? size + 6 : 0);
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  roundRect(ctx, x, y, w, hgt, hgt / 2);
  ctx.fillStyle = o.fill ?? 'rgba(217,179,115,0.14)';
  ctx.fill();
  if (o.dashed) ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = o.stroke ?? 'rgba(217,179,115,0.6)';
  ctx.stroke();
  ctx.setLineDash([]);
  let tx = x + padX;
  if (o.icon) { icon(ctx, o.icon, tx + size / 2, y + hgt / 2, size, o.iconColor ?? o.color ?? C.goldHi); tx += size + 6; }
  text(ctx, str, tx, y + hgt / 2 + 1, { size, weight: o.weight ?? 500, color: o.color ?? C.goldHi, baseline: 'middle', font: o.font });
  ctx.restore();
  return w;
}

// Minimal vector icon set, centred at (cx, cy)
export function icon(ctx, name, cx, cy, s, color = C.goldHi, o = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = o.lw ?? Math.max(1.5, s / 11);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha *= o.alpha ?? 1;
  const h = s / 2;
  switch (name) {
    case 'check': {
      ctx.beginPath(); ctx.arc(0, 0, h, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = o.inner ?? '#0b2146'; ctx.lineWidth = s / 8;
      ctx.beginPath(); ctx.moveTo(-h * 0.45, 0); ctx.lineTo(-h * 0.1, h * 0.35); ctx.lineTo(h * 0.5, -h * 0.35); ctx.stroke();
      break;
    }
    case 'tick': {
      ctx.beginPath(); ctx.moveTo(-h * 0.6, 0); ctx.lineTo(-h * 0.15, h * 0.45); ctx.lineTo(h * 0.65, -h * 0.45); ctx.stroke();
      break;
    }
    case 'pending': {
      ctx.setLineDash([s / 7, s / 9]);
      ctx.beginPath(); ctx.arc(0, 0, h * 0.92, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 ${s * 0.62}px ${FONT.en}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, s * 0.03);
      break;
    }
    case 'dot': { ctx.beginPath(); ctx.arc(0, 0, h * 0.5, 0, Math.PI * 2); ctx.fill(); break; }
    case 'doc': {
      ctx.beginPath(); ctx.moveTo(-h * 0.6, -h); ctx.lineTo(h * 0.25, -h); ctx.lineTo(h * 0.7, -h * 0.55); ctx.lineTo(h * 0.7, h); ctx.lineTo(-h * 0.6, h); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-h * 0.3, -h * 0.2); ctx.lineTo(h * 0.4, -h * 0.2); ctx.moveTo(-h * 0.3, h * 0.15); ctx.lineTo(h * 0.4, h * 0.15); ctx.moveTo(-h * 0.3, h * 0.5); ctx.lineTo(h * 0.15, h * 0.5); ctx.stroke();
      break;
    }
    case 'globe': {
      ctx.beginPath(); ctx.arc(0, 0, h * 0.9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, h * 0.4, h * 0.9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-h * 0.9, 0); ctx.lineTo(h * 0.9, 0); ctx.stroke();
      break;
    }
    case 'mail': {
      roundRect(ctx, -h, -h * 0.68, s, h * 1.36, s * 0.08); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-h, -h * 0.6); ctx.lineTo(0, h * 0.12); ctx.lineTo(h, -h * 0.6); ctx.stroke();
      break;
    }
    case 'person': {
      ctx.beginPath(); ctx.arc(0, -h * 0.35, h * 0.38, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, h * 0.95, h * 0.78, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      break;
    }
    case 'table': {
      roundRect(ctx, -h, -h * 0.8, s, h * 1.6, 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-h, -h * 0.25); ctx.lineTo(h, -h * 0.25); ctx.moveTo(-h, h * 0.25); ctx.lineTo(h, h * 0.25); ctx.moveTo(-h * 0.2, -h * 0.8); ctx.lineTo(-h * 0.2, h * 0.8); ctx.stroke();
      break;
    }
    case 'search': {
      ctx.beginPath(); ctx.arc(-h * 0.15, -h * 0.15, h * 0.55, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(h * 0.25, h * 0.25); ctx.lineTo(h * 0.8, h * 0.8); ctx.stroke();
      break;
    }
    case 'chart': {
      ctx.beginPath(); ctx.moveTo(-h, h * 0.8); ctx.lineTo(h, h * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-h * 0.8, h * 0.3); ctx.lineTo(-h * 0.25, -h * 0.15); ctx.lineTo(h * 0.2, h * 0.15); ctx.lineTo(h * 0.8, -h * 0.6); ctx.stroke();
      break;
    }
    case 'pen': {
      ctx.beginPath(); ctx.moveTo(-h * 0.7, h * 0.7); ctx.lineTo(-h * 0.55, h * 0.2); ctx.lineTo(h * 0.45, -h * 0.8); ctx.lineTo(h * 0.8, -h * 0.45); ctx.lineTo(-h * 0.2, h * 0.55); ctx.closePath(); ctx.stroke();
      break;
    }
    case 'factory': {
      ctx.beginPath(); ctx.moveTo(-h, h * 0.8); ctx.lineTo(-h, -h * 0.1); ctx.lineTo(-h * 0.4, h * 0.25); ctx.lineTo(-h * 0.4, -h * 0.1); ctx.lineTo(h * 0.2, h * 0.25); ctx.lineTo(h * 0.2, -h * 0.9); ctx.lineTo(h * 0.7, -h * 0.9); ctx.lineTo(h * 0.7, h * 0.8); ctx.closePath(); ctx.stroke();
      break;
    }
    case 'link': {
      ctx.beginPath(); ctx.arc(-h * 0.35, 0, h * 0.42, Math.PI * 0.5, Math.PI * 1.5); ctx.lineTo(0, -h * 0.42); ctx.stroke();
      ctx.beginPath(); ctx.arc(h * 0.35, 0, h * 0.42, -Math.PI * 0.5, Math.PI * 0.5); ctx.lineTo(0, h * 0.42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-h * 0.3, 0); ctx.lineTo(h * 0.3, 0); ctx.stroke();
      break;
    }
    case 'bearing': {
      ctx.beginPath(); ctx.arc(0, 0, h * 0.95, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, h * 0.42, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * h * 0.68, Math.sin(a) * h * 0.68, h * 0.12, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'flag': {
      ctx.beginPath(); ctx.moveTo(-h * 0.6, h); ctx.lineTo(-h * 0.6, -h); ctx.lineTo(h * 0.7, -h * 0.55); ctx.lineTo(-h * 0.6, -h * 0.1); ctx.stroke();
      break;
    }
    case 'loop': {
      ctx.beginPath(); ctx.arc(0, 0, h * 0.75, Math.PI * 0.2, Math.PI * 1.75); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(h * 0.75, -h * 0.55); ctx.lineTo(h * 0.62, -h * 0.05); ctx.lineTo(h * 0.2, -h * 0.35); ctx.stroke();
      break;
    }
    default: break;
  }
  ctx.restore();
}

// Placeholder "text lines" used for abstract documents
export function lines(ctx, x, y, w, n, o = {}) {
  const gap = o.gap ?? 16, th = o.th ?? 6;
  const r = mulberry32(o.seed ?? 1);
  ctx.save();
  ctx.fillStyle = o.color ?? 'rgba(207,224,242,0.22)';
  for (let i = 0; i < n; i++) {
    const lw = i === n - 1 ? w * (0.35 + r() * 0.3) : w * (0.75 + r() * 0.25);
    roundRect(ctx, x, y + i * gap, lw * (o.reveal == null ? 1 : clamp(o.reveal * n - i)), th, th / 2);
    ctx.fill();
  }
  ctx.restore();
}

// --------------------------------------------------------- textured panels
export function makePanel(w, h, draw, o = {}) {
  const res = (o.res ?? 2) * Math.min(DPR, 2);
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * res); cv.height = Math.round(h * res);
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: o.depthTest ?? true,
    side: THREE.DoubleSide, toneMapped: false, opacity: 1,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * PX, h * PX), mat);
  if (o.order != null) mesh.renderOrder = o.order;
  const panel = {
    mesh, ctx, cv, tex, w, h, key: undefined,
    redraw(state = {}) {
      const key = JSON.stringify(state);
      if (key === panel.key) return;
      panel.key = key;
      ctx.setTransform(res, 0, 0, res, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (o.blur) ctx.filter = `blur(${o.blur}px)`;
      draw(ctx, state, w, h);
      ctx.filter = 'none';
      tex.needsUpdate = true;
    },
    set opacity(v) { mat.opacity = v; mesh.visible = v > 0.002; },
    get opacity() { return mat.opacity; },
  };
  panel.redraw(o.state ?? {});
  return panel;
}

// Draw once into a canvas and blur, for depth-of-field background panels
export function blurredPanel(w, h, draw, blur, o = {}) {
  return makePanel(w, h, draw, { ...o, blur });
}

// ------------------------------------------------------------- glow sprites
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.18)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.04)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  _glowTex = new THREE.CanvasTexture(cv);
  return _glowTex;
}
export function glowSprite(color = C.goldHi, size = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(), color: new THREE.Color(color), transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const sp = new THREE.Sprite(m);
  sp.scale.setScalar(size);
  return sp;
}

let _streakTex = null;
export function streakTexture() {
  if (_streakTex) return _streakTex;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 32;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 32);
  const v = ctx.createLinearGradient(0, 0, 0, 32);
  v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = v; ctx.fillRect(0, 0, 512, 32);
  _streakTex = new THREE.CanvasTexture(cv);
  return _streakTex;
}

// ---------------------------------------------------------------- soft points
export function softPoints(positions, o = {}) {
  const n = positions.length / 3;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const sizes = o.sizes ?? new Float32Array(n).fill(o.size ?? 4);
  g.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const colors = o.colors ?? (() => { const c = new THREE.Color(o.color ?? C.mist); const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } return a; })();
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const alphas = o.alphas ?? new Float32Array(n).fill(1);
  g.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));
  const mat = new THREE.ShaderMaterial({
    // perspective: size is in world units; otherwise size is in CSS px
    uniforms: {
      uScale: { value: o.perspective === false ? DPR : (H * DPR * 0.5) / Math.tan(((o.fov ?? 35) * Math.PI) / 360) },
      uOpacity: { value: o.opacity ?? 1 }, uHard: { value: o.hard ?? 0.35 }, uPersp: { value: o.perspective === false ? 0 : 1 },
    },
    vertexShader: `
      attribute float size; attribute vec3 color; attribute float alpha;
      uniform float uScale; uniform float uPersp;
      varying vec3 vColor; varying float vAlpha;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float s = uPersp > 0.5 ? size * uScale / -mv.z : size * uScale;
        gl_PointSize = max(s, 1.0);
        vColor = color; vAlpha = alpha * clamp(s, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform float uOpacity; uniform float uHard;
      varying vec3 vColor; varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, uHard * 0.5, d);
        gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
      }`,
    transparent: true, depthWrite: false,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

// ---------------------------------------------------------------- gold line
// A polyline that can be revealed between arc-length fractions [p0, p1],
// drawn as a bright core + soft halo with a glowing head.
export class GoldLine {
  constructor(points, o = {}) {
    this.group = new THREE.Group();
    this.setPath(points);
    // Core drawn with an HDR colour and normal blending: overlapping joints
    // don't double up, and the compositor's bloom supplies a smooth glow.
    const mk = (width, color, opacity, additive) => {
      const m = new LineMaterial({
        color: new THREE.Color(color), linewidth: width * DPR, transparent: true, opacity,
        depthWrite: false, depthTest: o.depthTest ?? true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, worldUnits: false,
        dashed: false, toneMapped: false,
      });
      m.resolution.set(W * DPR, H * DPR);
      const l = new Line2(new LineGeometry(), m);
      l.frustumCulled = false;
      if (o.order != null) l.renderOrder = o.order;
      return l;
    };
    this.core = mk(o.width ?? 2.6, new THREE.Color(o.color ?? '#ffe6b8').multiplyScalar(o.hdr ?? 2.4), o.opacity ?? 1, false);
    this.halo = mk(o.halo ?? 12, o.haloColor ?? C.gold, (o.haloOpacity ?? 0.05), true);
    this.group.add(this.halo, this.core);
    this.head = glowSprite(C.goldHi, o.headSize ?? 0.9, 0.95);
    if (o.order != null) this.head.renderOrder = o.order + 1;
    this.group.add(this.head);
    this.baseOpacity = o.opacity ?? 1;
    this.baseHalo = o.haloOpacity ?? 0.05;
    this.headOn = o.head ?? true;
    this.set(0, 0);
  }
  setPath(points) {
    this.pts = points.map((p) => p.clone());
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.len = this.cum[this.cum.length - 1] || 1;
  }
  pointAt(f) {
    const d = clamp(f) * this.len;
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    const a = this.cum[i - 1], b = this.cum[i];
    return this.pts[i - 1].clone().lerp(this.pts[i], b > a ? (d - a) / (b - a) : 0);
  }
  set(p0, p1, alpha = 1) {
    p0 = clamp(p0); p1 = clamp(p1);
    const vis = p1 - p0 > 1e-4 && alpha > 0.001;
    this.group.visible = vis;
    if (!vis) return;
    const d0 = p0 * this.len, d1 = p1 * this.len;
    const out = [this.pointAt(p0)];
    for (let i = 0; i < this.pts.length; i++) if (this.cum[i] > d0 && this.cum[i] < d1) out.push(this.pts[i]);
    out.push(this.pointAt(p1));
    const flat = [];
    for (const p of out) flat.push(p.x, p.y, p.z);
    if (flat.length === 6) flat.push(out[1].x + 1e-5, out[1].y, out[1].z);
    for (const l of [this.core, this.halo]) {
      l.geometry.dispose();
      l.geometry = new LineGeometry();
      l.geometry.setPositions(flat);
    }
    this.core.material.opacity = this.baseOpacity * alpha;
    this.halo.material.opacity = this.baseHalo * alpha;
    this.head.visible = this.headOn && p1 < 0.999;
    this.head.position.copy(out[out.length - 1]);
    this.head.material.opacity = 0.95 * alpha;
  }
}

export function curvePoints(ctrl, n = 120, closed = false) {
  const c = new THREE.CatmullRomCurve3(ctrl, closed, 'centripetal');
  return c.getPoints(n);
}

// Straight-ish connector with a gentle S bend between two points
export function bendPoints(a, b, n = 40, bend = 0.35) {
  const mid1 = new THREE.Vector3(lerp(a.x, b.x, bend), a.y, lerp(a.z, b.z, 0.5));
  const mid2 = new THREE.Vector3(lerp(a.x, b.x, 1 - bend), b.y, lerp(a.z, b.z, 0.5));
  const c = new THREE.CubicBezierCurve3(a, mid1, mid2, b);
  return c.getPoints(n);
}

export function gradientTexture(stops, w = 16, h = 512, vertical = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const g = vertical ? ctx.createLinearGradient(0, 0, 0, h) : ctx.createLinearGradient(0, 0, w, 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Radial-ish background: a big camera-facing plane far behind everything
export function backdrop(camera, draw, dist = 900) {
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 540;
  const ctx = cv.getContext('2d');
  draw(ctx, 960, 540);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const hgt = 2 * dist * Math.tan((camera.fov * Math.PI) / 360) * 1.25;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(hgt * camera.aspect, hgt), new THREE.MeshBasicMaterial({ map: t, depthWrite: false, toneMapped: false, fog: false }));
  m.renderOrder = -100;
  m.position.set(0, 0, -dist);
  camera.add(m);
  return { mesh: m, ctx, tex: t, redraw(fn) { fn(ctx, 960, 540); t.needsUpdate = true; } };
}

export function deepSpaceBackdrop(ctx, w, h, o = {}) {
  const g = ctx.createRadialGradient(w * (o.cx ?? 0.5), h * (o.cy ?? 0.45), 0, w * 0.5, h * 0.5, w * 0.75);
  g.addColorStop(0, o.c0 ?? '#123566');
  g.addColorStop(0.45, o.c1 ?? '#0a1f42');
  g.addColorStop(1, o.c2 ?? '#030a18');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------ UI stages
// Screen-px layout on the z = 0 plane (pixel-exact through pxCamera()).
export const px2w = (px, py, z = 0) => new THREE.Vector3((px - W / 2) * PX, -(py - H / 2) * PX, z);
export function atPx(obj, px, py, z = 0) { obj.position.copy(px2w(px, py, z)); return obj; }

export function thinLine(points, color = C.steel, opacity = 0.5, width = 1.4, o = {}) {
  const m = new LineMaterial({ color: new THREE.Color(color), linewidth: width * DPR, transparent: true, opacity, depthWrite: false, toneMapped: false, dashed: !!o.dashed, dashSize: o.dashSize ?? 0.08, gapSize: o.gapSize ?? 0.06 });
  m.resolution.set(W * DPR, H * DPR);
  const g = new LineGeometry();
  g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
  const l = new Line2(g, m);
  l.computeLineDistances();
  if (o.order != null) l.renderOrder = o.order;
  return l;
}

export function makeStage(o = {}) {
  const scene = new THREE.Scene();
  const camera = pxCamera();
  scene.add(camera);
  backdrop(camera, (ctx, w, h) => deepSpaceBackdrop(ctx, w, h, o.bg ?? { cx: 0.5, cy: 0.42, c0: '#12335f', c1: '#0a1d3d', c2: '#030a18' }));
  // faint grid far behind the panels for parallax depth
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024;
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = 'rgba(157,186,217,0.045)'; ctx.lineWidth = 1.2;
  for (let x = 0; x <= 2048; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke(); }
  for (let y = 0; y <= 1024; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke(); }
  const fade = ctx.createRadialGradient(1024, 512, 100, 1024, 512, 1000);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = fade; ctx.fillRect(0, 0, 2048, 1024);
  const gt = new THREE.CanvasTexture(cv); gt.colorSpace = THREE.SRGBColorSpace;
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), new THREE.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false, opacity: o.gridOpacity ?? 1 }));
  grid.position.z = -9; grid.renderOrder = -50;
  scene.add(grid);
  const r = mulberry32(o.seed ?? 3);
  const dp = [], ds = [], da = [];
  for (let i = 0; i < 260; i++) { dp.push((r() - 0.5) * 36, (r() - 0.5) * 20, -r() * 16 + 3); ds.push(0.02 + r() * 0.04); da.push(0.15 + r() * 0.45); }
  const dust = softPoints(dp, { sizes: new Float32Array(ds), alphas: new Float32Array(da), color: '#9dbad9', additive: true });
  scene.add(dust);
  const add = (panel, px, py, z = 0, order = 10) => { atPx(panel.mesh, px, py, z); panel.mesh.renderOrder = order; scene.add(panel.mesh); return panel; };
  return { scene, camera, grid, dust, add };
}

// Row with label / value / status used by several evidence panels
export function statusPill(ctx, state, x, y, o = {}) {
  // state: 'ok' | 'pending' | 'none'
  if (state === 'ok') return pill(ctx, o.okText ?? '已核实', x, y, { size: o.size ?? 15, icon: 'check', iconColor: C.goldHi, fill: 'rgba(217,179,115,0.16)', stroke: 'rgba(255,224,160,0.75)', color: C.goldHi, alpha: o.alpha ?? 1 });
  if (state === 'pending') return pill(ctx, o.pendingText ?? '待确认', x, y, { size: o.size ?? 15, icon: 'pending', iconColor: C.pending, fill: 'rgba(142,165,195,0.08)', stroke: 'rgba(142,165,195,0.6)', color: C.pending, dashed: true, alpha: o.alpha ?? 1 });
  return 0;
}

// right-aligned variant helper
export function pillWidth(ctx, str, size = 15, withIcon = true) { return measure(ctx, str, { size, weight: 500 }) + 24 + (withIcon ? size + 6 : 0); }

// typewriter substring
export const typed = (str, k) => { const a = [...str]; return a.slice(0, Math.floor(clamp(k) * a.length)).join(''); };
