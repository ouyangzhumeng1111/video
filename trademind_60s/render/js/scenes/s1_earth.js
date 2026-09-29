// 01a | 0–2.7 s  Earth at the day/night terminator, overseas cities light up,
// information windows float at several depths, camera dives toward the sea.
import * as THREE from 'three';
import { C, FONT, W, H, DPR, clamp, lerp, ss, ep, ease, mulberry32, makePanel, glass, text, icon, lines, glowSprite, streakTexture, pill, roundRect } from '../lib.js';
import { sph, CITIES } from '../geo.js';

const R = 5;
export const SUN = new THREE.Vector3(1.0, 0.25, -0.55).normalize();
const VIEW_LON = 70, TILT = 0.32;

export function infoWindow(kind, seed = 1) {
  // generic "scattered information" windows reused by the factory shot
  const sizes = { web: [360, 240], trade: [340, 210], mail: [330, 200], city: [300, 180] };
  const [w, h] = sizes[kind];
  return makePanel(w, h, (ctx) => {
    glass(ctx, 0, 0, w, h, { r: 12, alpha: 0.7 });
    if (kind === 'web') {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 0, w, 30);
      ['#e7a45a', '#d9b373', '#9dbad9'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(18 + i * 16, 15, 4.5, 0, Math.PI * 2); ctx.fill(); });
      roundRect(ctx, 70, 8, w - 90, 14, 7); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
      text(ctx, 'www.', 80, 20, { size: 11, font: FONT.mono, color: C.mist, alpha: 0.7 });
      const g = ctx.createLinearGradient(0, 44, w, 120); g.addColorStop(0, 'rgba(61,108,158,0.55)'); g.addColorStop(1, 'rgba(22,63,120,0.3)');
      ctx.fillStyle = g; roundRect(ctx, 16, 44, w - 32, 80, 8); ctx.fill();
      text(ctx, 'Company · About us', 30, 92, { size: 18, font: FONT.en, weight: 600, color: C.warm });
      lines(ctx, 16, 140, w - 60, 4, { seed: seed + 3, gap: 20, th: 7 });
    } else if (kind === 'trade') {
      icon(ctx, 'table', 26, 26, 18, C.goldHi);
      text(ctx, '贸易记录', 46, 32, { size: 18, weight: 500 });
      for (let i = 0; i < 5; i++) {
        const y = 60 + i * 28;
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(14, y, w - 28, 24);
        text(ctx, 'HS 8482', 24, y + 17, { size: 13, font: FONT.mono, color: C.mist });
        roundRect(ctx, 110, y + 8, 90 + ((i * 37 + seed * 13) % 80), 8, 4); ctx.fillStyle = 'rgba(207,224,242,0.25)'; ctx.fill();
        roundRect(ctx, w - 70, y + 8, 44, 8, 4); ctx.fillStyle = 'rgba(217,179,115,0.45)'; ctx.fill();
      }
    } else if (kind === 'mail') {
      icon(ctx, 'mail', 26, 26, 20, C.goldHi);
      text(ctx, '邮件', 46, 32, { size: 18, weight: 500 });
      for (let i = 0; i < 4; i++) {
        const y = 58 + i * 34;
        ctx.fillStyle = 'rgba(157,186,217,0.35)'; ctx.beginPath(); ctx.arc(30, y + 12, 9, 0, Math.PI * 2); ctx.fill();
        roundRect(ctx, 50, y + 3, 110 + ((i * 29 + seed * 7) % 60), 8, 4); ctx.fillStyle = 'rgba(246,241,232,0.35)'; ctx.fill();
        roundRect(ctx, 50, y + 17, 190, 6, 3); ctx.fillStyle = 'rgba(207,224,242,0.18)'; ctx.fill();
      }
    } else if (kind === 'city') {
      // skyline silhouette
      const r = mulberry32(seed);
      ctx.save(); roundRect(ctx, 0, 0, w, h, 12); ctx.clip();
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(22,63,120,0.2)'); g.addColorStop(1, 'rgba(231,164,90,0.25)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(6,21,48,0.9)';
      let x = 0;
      while (x < w) { const bw = 14 + r() * 26, bh = 30 + r() * 90; ctx.fillRect(x, h - bh, bw - 2, bh); x += bw; }
      ctx.fillStyle = 'rgba(255,224,160,0.7)';
      for (let i = 0; i < 70; i++) ctx.fillRect(r() * w, h - r() * 90, 2, 2);
      ctx.restore();
      text(ctx, ['Hamburg', 'Rotterdam', 'São Paulo', 'Dubai'][seed % 4], 18, 34, { size: 20, font: FONT.en, weight: 600 });
      text(ctx, '海外城市', 18, 58, { size: 14, color: C.mist });
    }
  }, { res: 1.5 });
}

export async function create({ renderer, assets }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#01040b');
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 3000);
  scene.add(camera);

  const earth = new THREE.Group();
  earth.rotation.set(TILT, (-VIEW_LON * Math.PI) / 180, 0, 'XYZ');
  scene.add(earth);

  const landTex = new THREE.CanvasTexture(assets.land.canvas);
  landTex.colorSpace = THREE.NoColorSpace;
  landTex.wrapS = THREE.RepeatWrapping;
  const base = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), new THREE.ShaderMaterial({
    uniforms: { landTex: { value: landTex }, sunDir: { value: SUN } },
    vertexShader: `varying vec3 vN; varying vec3 vO; varying vec3 vP;
      void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform sampler2D landTex; uniform vec3 sunDir; varying vec3 vN; varying vec3 vO; varying vec3 vP;
      void main(){
        float lon = atan(vO.x, vO.z); float lat = asin(clamp(vO.y, -1.0, 1.0));
        vec2 uv = vec2((lon + 3.14159265) / 6.2831853, 0.5 + lat / 3.14159265);
        float land = texture2D(landTex, uv).r;
        vec3 n = normalize(vN);
        float d = dot(n, sunDir);
        float day = smoothstep(-0.1, 0.25, d);
        vec3 ocean = mix(vec3(0.003, 0.008, 0.02), vec3(0.02, 0.07, 0.17), day);
        vec3 landC = mix(vec3(0.006, 0.012, 0.025), vec3(0.06, 0.11, 0.17), day);
        vec3 col = mix(ocean, landC, land);
        float band = exp(-pow((d - 0.02) / 0.09, 2.0));
        col += vec3(0.30, 0.14, 0.035) * band * 0.55;
        vec3 V = normalize(cameraPosition - vP);
        vec3 Hh = normalize(V + sunDir);
        col += vec3(1.0, 0.75, 0.45) * pow(max(dot(n, Hh), 0.0), 80.0) * 0.9 * (1.0 - land) * day;
        float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        col += vec3(0.05, 0.12, 0.3) * fr * (0.3 + day);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  earth.add(base);

  // land dots (Fibonacci sampling) + city lights
  const rnd = mulberry32(11);
  const N = 70000, pos = [], cityPos = [], cityA = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = ga * i;
    const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
    const lat = (Math.asin(y) * 180) / Math.PI, lon = (Math.atan2(x, z) * 180) / Math.PI;
    if (assets.land.isLand(lat, lon)) pos.push(x * R * 1.002, y * R * 1.002, z * R * 1.002);
  }
  for (const [lat, lon] of Object.values(CITIES)) {
    for (let k = 0; k < 90; k++) {
      const g = () => (rnd() + rnd() + rnd() - 1.5) * 1.6;
      const la = lat + g(), lo = lon + g() * 1.3;
      if (!assets.land.isLand(la, lo)) continue;
      cityPos.push(...sph(la, lo, R * 1.004));
      cityA.push(0.35 + rnd() * 0.65);
    }
  }
  // extra scattered towns
  for (let k = 0; k < 6000; k++) {
    const la = -50 + rnd() * 115, lo = -180 + rnd() * 360;
    if (!assets.land.isLand(la, lo) || rnd() > 0.35) continue;
    cityPos.push(...sph(la, lo, R * 1.004)); cityA.push(0.15 + rnd() * 0.35);
  }
  const dotsMat = (color, nightColor, size, isCity) => new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN }, uScale: { value: (H * DPR * 0.5) / Math.tan((35 * Math.PI) / 360) }, uSize: { value: size }, uColor: { value: new THREE.Color(color) }, uNight: { value: new THREE.Color(nightColor) }, uOpacity: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `attribute float a; uniform float uScale; uniform float uSize; uniform vec3 sunDir; varying float vDay; varying float vA; varying float vFace;
      void main(){ vec3 wn = normalize(mat3(modelMatrix) * position); vDay = smoothstep(-0.08, 0.22, dot(wn, sunDir)); vA = a;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vFace = dot(normalize(-mv.xyz), normalize(mat3(viewMatrix) * wn));
        gl_Position = projectionMatrix * mv; gl_PointSize = max(uSize * uScale / -mv.z, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uNight; uniform float uOpacity; varying float vDay; varying float vA; varying float vFace;
      void main(){ float d = length(gl_PointCoord - 0.5); float m = smoothstep(0.5, 0.15, d);
        ${isCity ? 'float k = (1.0 - vDay) * vA; vec3 c = uColor * (1.0 + 0.6 * vA);' : 'float k = mix(0.18, 0.75, vDay); vec3 c = mix(uNight, uColor, vDay);'}
        gl_FragColor = vec4(c, m * k * uOpacity * smoothstep(0.0, 0.25, vFace)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const landGeo = new THREE.BufferGeometry();
  landGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  landGeo.setAttribute('a', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(1), 1));
  const landDots = new THREE.Points(landGeo, dotsMat('#8fb6e6', '#1d3a66', 0.034, false));
  earth.add(landDots);
  const cityGeo = new THREE.BufferGeometry();
  cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityPos, 3));
  cityGeo.setAttribute('a', new THREE.Float32BufferAttribute(cityA, 1));
  const cityDots = new THREE.Points(cityGeo, dotsMat('#ffc978', '#000000', 0.045, true));
  earth.add(cityDots);

  // atmosphere
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 96, 64), new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vP;
      void main(){ vec3 V = normalize(cameraPosition - vP); float rim = 1.0 - abs(dot(normalize(vN), V));
        float i = pow(smoothstep(0.0, 1.0, rim), 5.0) * 1.6;
        float s = dot(normalize(vN), sunDir);
        vec3 col = mix(vec3(0.05, 0.16, 0.45), vec3(0.35, 0.55, 1.0), smoothstep(-0.2, 0.5, s));
        col = mix(col, vec3(1.0, 0.62, 0.3), exp(-pow((s - 0.05) / 0.16, 2.0)) * 0.8);
        float lit = smoothstep(-0.45, 0.2, s);
        gl_FragColor = vec4(col * i * (0.03 + lit), 1.0); }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(atmo);

  // stars
  const sp = [], ss_ = [], sa = [];
  const r2 = mulberry32(5);
  for (let i = 0; i < 2500; i++) { const v = new THREE.Vector3(r2() - 0.5, r2() - 0.5, r2() - 0.5).normalize().multiplyScalar(600); sp.push(v.x, v.y, v.z); ss_.push(0.6 + r2() * 1.6); sa.push(0.2 + r2() * 0.8); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sg.setAttribute('size', new THREE.Float32BufferAttribute(ss_, 1));
  sg.setAttribute('a', new THREE.Float32BufferAttribute(sa, 1));
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: { dpr: { value: DPR } },
    vertexShader: `attribute float size; attribute float a; uniform float dpr; varying float vA; void main(){ vA = a; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_PointSize = size * dpr; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.75, 0.85, 1.0), smoothstep(0.5, 0.0, d) * vA); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(stars);

  // sun just behind the right limb: glow wraps around the edge (depth-tested)
  const sunPos = new THREE.Vector3(5.4, 1.5, -12);
  const sun = glowSprite('#ffc983', 16, 0.85); sun.position.copy(sunPos); scene.add(sun);
  const sunCore = glowSprite('#ffffff', 4, 1); sunCore.position.copy(sunPos); scene.add(sunCore);

  // city pins with labels
  const pinDefs = [['Hamburg', 'hamburg', 0.55], ['Istanbul', 'istanbul', 0.7], ['Dubai', 'dubai', 0.85], ['Mumbai', 'mumbai', 1.0], ['Singapore', 'singapore', 1.15], ['Shanghai', 'shanghai', 1.3]];
  const pins = pinDefs.map(([name, key, at]) => {
    const p = makePanel(170, 40, (ctx) => {
      ctx.fillStyle = C.goldHi; ctx.beginPath(); ctx.arc(10, 20, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,224,160,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(10, 20, 9, 0, Math.PI * 2); ctx.stroke();
      text(ctx, name, 26, 26, { size: 17, font: FONT.en, weight: 600, color: C.warm });
    }, { res: 2 });
    p.mesh.geometry.translate(0.75, 0, 0); // anchor dot at pin
    const [lat, lon] = CITIES[key];
    const local = new THREE.Vector3(...sph(lat, lon, R * 1.01));
    scene.add(p.mesh);
    return { p, local, at };
  });

  // floating information windows at different depths
  // screen-space placement: sx, sy in [-1, 1] of the frame, d = depth
  const floaters = [
    { p: infoWindow('web', 1), sx: -0.6, sy: 0.5, d: 17, rot: [0.1, 0.45, 0.05], at: 0.9 },
    { p: infoWindow('trade', 2), sx: 0.62, sy: -0.4, d: 18, rot: [-0.08, -0.5, -0.04], at: 1.1 },
    { p: infoWindow('mail', 3), sx: 0.66, sy: 0.56, d: 22, rot: [0.05, -0.35, 0.06], at: 1.3 },
    { p: infoWindow('city', 0), sx: -0.68, sy: -0.08, d: 23, rot: [-0.06, 0.4, -0.05], at: 1.45 },
  ];
  for (const f of floaters) { scene.add(f.p.mesh); f.p.opacity = 0; }

  const tmp = new THREE.Vector3();
  const target0 = new THREE.Vector3(0.9, 0.2, 0);
  const seaLocal = new THREE.Vector3(...sph(14, 112, R));

  function update(t) {
    earth.rotation.y = (-VIEW_LON * Math.PI) / 180 + t * 0.018;
    earth.updateMatrixWorld();
    const seaW = seaLocal.clone().applyMatrix4(earth.matrixWorld);
    // camera: slow drift, then dive toward the South China Sea at dawn
    const cam0 = new THREE.Vector3(lerp(-2.2, -1.2, t / 1.6), lerp(1.1, 0.8, t / 1.6), lerp(27, 22.5, ease.out(clamp(t / 1.5))));
    const e = ep(t, 1.45, 2.75, ease.inOut);
    const dir = cam0.clone().normalize().lerp(seaW.clone().normalize(), e).normalize();
    const dist = cam0.length() * Math.pow((R * 1.1) / cam0.length(), e);
    camera.position.copy(dir.multiplyScalar(dist));
    tmp.copy(target0).lerp(seaW, ep(t, 1.2, 2.6, ease.inOut));
    camera.lookAt(tmp);
    camera.updateMatrixWorld();

    pins.forEach(({ p, local, at }) => {
      const wpos = local.clone().applyMatrix4(earth.matrixWorld);
      p.mesh.position.copy(wpos);
      p.mesh.quaternion.copy(camera.quaternion);
      const facing = wpos.clone().normalize().dot(camera.position.clone().sub(wpos).normalize());
      const dist = camera.position.distanceTo(wpos);
      p.mesh.scale.setScalar(dist / 17.13);
      p.opacity = ss(at, at + 0.35, t) * ss(0.05, 0.3, facing) * (1 - ss(1.9, 2.3, t));
    });
    floaters.forEach((f, i) => {
      const k = ep(t, f.at, f.at + 0.6, ease.out);
      f.p.opacity = k * 0.72 * (1 - ss(2.2, 2.6, t));
      const spread = 1 + ep(t, 1.6, 2.8, ease.in) * 0.9;
      const d = f.d - 1.5 * (1 - k);
      const v = new THREE.Vector3(f.sx * spread * d * 0.5605, f.sy * spread * d * 0.3153, -d);
      f.p.mesh.position.copy(camera.localToWorld(v));
      f.p.mesh.quaternion.copy(camera.quaternion);
      f.p.mesh.rotateX(f.rot[0]); f.p.mesh.rotateY(f.rot[1]); f.p.mesh.rotateZ(f.rot[2]);
    });
    cityDots.material.uniforms.uOpacity.value = 0.6 + 0.4 * ss(0.2, 1.2, t);
  }

  return { scene, camera, update, bloom: 1.0, threshold: 0.6, vignette: 0.5 };
}
