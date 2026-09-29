// Renders up to two shots into HDR render targets, blends them with a
// transition, adds bloom, vignette, highlight roll-off, sRGB and dither.
import * as THREE from 'three';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class Pass {
  constructor(frag, uniforms) {
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.u = uniforms;
  }
  run(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.cam);
  }
}

const MIX = `
uniform sampler2D tA, tB; uniform float k, zA, zB, blurA, blurB, flash, useB;
uniform vec3 flashColor;
varying vec2 vUv;
vec3 zoomSample(sampler2D t, vec2 uv, float z, float blur){
  vec2 c = vec2(0.5);
  vec2 d = (uv - c) / z;
  if (blur < 0.001) return texture2D(t, c + d).rgb;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 10; i++) { float f = 1.0 - blur * float(i) / 10.0; acc += texture2D(t, c + d * f).rgb; }
  return acc / 10.0;
}
void main(){
  vec3 a = zoomSample(tA, vUv, zA, blurA);
  vec3 col = a;
  if (useB > 0.5) { vec3 b = zoomSample(tB, vUv, zB, blurB); col = mix(a, b, k); }
  col += flashColor * flash;
  gl_FragColor = vec4(col, 1.0);
}`;

const BRIGHT = `
uniform sampler2D tSrc; uniform float threshold; uniform vec2 texel;
varying vec2 vUv;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(tSrc, vUv + texel * vec2(-0.5,-0.5)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2( 0.5,-0.5)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2(-0.5, 0.5)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2( 0.5, 0.5)).rgb;
  c *= 0.25;
  float l = max(max(c.r, c.g), c.b);
  float w = smoothstep(threshold, threshold + 0.35, l);
  gl_FragColor = vec4(c * w, 1.0);
}`;

const BLUR = `
uniform sampler2D tSrc; uniform vec2 dir;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const FINAL = `
uniform sampler2D tBase, tBloom1, tBloom2; uniform float bloom, vignette, fade, time, warmth;
uniform vec3 fadeColor;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 0.61) * 43758.5453); }
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 rolloff(vec3 c){ // soft shoulder above 0.8 keeps mid-tones untouched
  vec3 x = max(c - 0.8, 0.0);
  return min(c, 0.8) + 0.2 * (1.0 - exp(-x / 0.2)) * 1.25;
}
void main(){
  vec3 c = texture2D(tBase, vUv).rgb;
  vec3 b = texture2D(tBloom1, vUv).rgb * 0.6 + texture2D(tBloom2, vUv).rgb * 0.8;
  c += b * bloom;
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
  float v = smoothstep(0.85, 0.2, length(q));
  c *= mix(1.0, v, vignette);
  c = mix(c, c * vec3(1.04, 1.0, 0.94), warmth);
  c = rolloff(c);
  c = mix(fadeColor, c, fade);
  vec3 s = toSRGB(c);
  s += (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 3.1) - 1.0) / 255.0;
  gl_FragColor = vec4(s, 1.0);
}`;

export class Compositor {
  constructor(renderer, w, h) {
    this.r = renderer;
    const hdr = { type: THREE.HalfFloatType, depthBuffer: true };
    this.rtA = new THREE.WebGLRenderTarget(w, h, { ...hdr, samples: 4 });
    this.rtB = new THREE.WebGLRenderTarget(w, h, { ...hdr, samples: 4 });
    this.rtMix = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    const mk = (d) => new THREE.WebGLRenderTarget(Math.round(w / d), Math.round(h / d), { type: THREE.HalfFloatType, depthBuffer: false });
    this.half = mk(2); this.q1 = mk(4); this.q2 = mk(4); this.e1 = mk(8); this.e2 = mk(8);
    this.w = w; this.h = h;
    this.mix = new Pass(MIX, {
      tA: { value: null }, tB: { value: null }, k: { value: 0 }, zA: { value: 1 }, zB: { value: 1 },
      blurA: { value: 0 }, blurB: { value: 0 }, flash: { value: 0 }, useB: { value: 0 }, flashColor: { value: new THREE.Color(1, 0.93, 0.8) },
    });
    this.bright = new Pass(BRIGHT, { tSrc: { value: null }, threshold: { value: 0.75 }, texel: { value: new THREE.Vector2(1 / w, 1 / h) } });
    this.blur = new Pass(BLUR, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } });
    this.final = new Pass(FINAL, {
      tBase: { value: null }, tBloom1: { value: null }, tBloom2: { value: null }, bloom: { value: 0.8 }, vignette: { value: 0.35 },
      fade: { value: 1 }, time: { value: 0 }, warmth: { value: 0 }, fadeColor: { value: new THREE.Color(0, 0, 0) },
    });
  }

  renderShot(shot, rt) {
    this.r.setRenderTarget(rt);
    this.r.setClearColor(shot.clear ?? 0x000000, 1);
    this.r.clear(true, true, true);
    this.r.render(shot.scene, shot.camera);
  }

  // layers: [{shot, z, blur}], optional second with k; fx: {k, flash, bloom, vignette, fade, threshold, time}
  render(a, b, fx) {
    this.renderShot(a.shot, this.rtA);
    const m = this.mix.u;
    m.tA.value = this.rtA.texture; m.zA.value = a.z ?? 1; m.blurA.value = a.blur ?? 0;
    m.useB.value = 0;
    if (b) {
      this.renderShot(b.shot, this.rtB);
      m.tB.value = this.rtB.texture; m.zB.value = b.z ?? 1; m.blurB.value = b.blur ?? 0;
      m.useB.value = 1; m.k.value = fx.k;
    }
    m.flash.value = fx.flash ?? 0;
    if (fx.flashColor) m.flashColor.value.set(fx.flashColor);
    this.mix.run(this.r, this.rtMix);

    // bloom chain
    this.bright.u.tSrc.value = this.rtMix.texture;
    this.bright.u.threshold.value = fx.threshold ?? 0.72;
    this.bright.run(this.r, this.half);
    const blurPass = (src, dst, dx, dy) => { this.blur.u.tSrc.value = src.texture; this.blur.u.dir.value.set(dx, dy); this.blur.run(this.r, dst); };
    // quarter res
    this.blur.u.tSrc.value = this.half.texture;
    blurPass(this.half, this.q1, 1 / (this.w / 4), 0);
    blurPass(this.q1, this.q2, 0, 1 / (this.h / 4));
    blurPass(this.q2, this.q1, 1.8 / (this.w / 4), 0);
    blurPass(this.q1, this.q2, 0, 1.8 / (this.h / 4));
    // eighth res (wide glow)
    blurPass(this.q2, this.e1, 1 / (this.w / 8), 0);
    blurPass(this.e1, this.e2, 0, 1 / (this.h / 8));
    blurPass(this.e2, this.e1, 2.2 / (this.w / 8), 0);
    blurPass(this.e1, this.e2, 0, 2.2 / (this.h / 8));

    const f = this.final.u;
    f.tBase.value = this.rtMix.texture; f.tBloom1.value = this.q2.texture; f.tBloom2.value = this.e2.texture;
    f.bloom.value = fx.bloom ?? 0.8; f.vignette.value = fx.vignette ?? 0.35; f.fade.value = fx.fade ?? 1;
    f.time.value = fx.time ?? 0; f.warmth.value = fx.warmth ?? 0;
    f.fadeColor.value.set(fx.fadeColor ?? 0x000000);
    this.final.run(this.r, null);
  }
}
