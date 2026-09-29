// 01b | 2.5–4.1 s  A container ship crossing the sea at dawn; the gold route
// line runs ahead of the bow toward the horizon.
import * as THREE from 'three';
import { C, W, H, lerp, ep, ease, ss, mulberry32, GoldLine, curvePoints } from '../lib.js';

const SUN_DIR = new THREE.Vector3(-0.85, 0.085, -0.75).normalize();

const SKY_FN = `
vec3 skyCol(vec3 d, vec3 sunDir){
  float e = clamp(d.y, -0.2, 1.0);
  vec3 zenith = vec3(0.012, 0.035, 0.09);
  vec3 mid = vec3(0.05, 0.10, 0.22);
  vec3 hor = vec3(0.95, 0.52, 0.22);
  float s = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))), 0.0);
  vec3 h = mix(vec3(0.30, 0.25, 0.32), hor, pow(s, 3.0));
  vec3 c = mix(h, mid, smoothstep(0.0, 0.12, e));
  c = mix(c, zenith, smoothstep(0.1, 0.6, e));
  float sd = max(dot(d, sunDir), 0.0);
  c += vec3(1.0, 0.72, 0.4) * pow(sd, 24.0) * 0.45 + vec3(1.0, 0.9, 0.75) * pow(sd, 1200.0) * 5.0;
  return c;
}`;

export async function create() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.5, 4000);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 64, 32), new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 sunDir; varying vec3 vD; ${SKY_FN} void main(){ gl_FragColor = vec4(skyCol(normalize(vD), sunDir), 1.0); }`,
    side: THREE.BackSide, depthWrite: false,
  }));
  scene.add(sky);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 sunDir; uniform float uTime; varying vec3 vP; ${SKY_FN}
      void main(){
        vec2 p = vP.xz + vec2(0.0, uTime * 6.0);
        float dist = length(cameraPosition - vP);
        float fade = 1.0 / (1.0 + dist * 0.004);
        vec2 g = vec2(0.0);
        for (int i = 0; i < 10; i++) {
          float fi = float(i);
          float ang = fi * 2.399 + 0.3;
          vec2 d = vec2(cos(ang), sin(ang));
          float f = 0.55 * pow(1.38, fi);
          float a = 0.13 / f;
          g += d * a * f * cos(dot(d, p) * f + uTime * (0.8 + sqrt(f) * 1.3) + fi * 1.7);
        }
        vec3 n = normalize(vec3(-g.x * fade, 1.0, -g.y * fade));
        vec3 V = normalize(cameraPosition - vP);
        vec3 Rr = reflect(-V, n);
        Rr.y = abs(Rr.y);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 deep = vec3(0.004, 0.018, 0.045);
        vec3 col = mix(deep, skyCol(Rr, sunDir), fres);
        float sd = max(dot(Rr, sunDir), 0.0);
        col += vec3(1.0, 0.68, 0.32) * (pow(sd, 500.0) * 1.6 + pow(sd, 40.0) * 0.06);
        vec3 fogC = skyCol(normalize(vec3(-V.x, 0.0, -V.z)), sunDir);
        col = mix(col, fogC, smoothstep(250.0, 2200.0, dist));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  scene.add(sea);

  // ---------------------------------------------------------------- ship
  const ship = new THREE.Group();
  scene.add(ship);
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-3.1, -20);
  hullShape.lineTo(3.1, -20);
  hullShape.lineTo(3.1, 12);
  hullShape.quadraticCurveTo(3.0, 19, 0, 23);
  hullShape.quadraticCurveTo(-3.0, 19, -3.1, 12);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 2.6, bevelEnabled: false, curveSegments: 24 });
  hullGeo.rotateX(-Math.PI / 2);
  hullGeo.translate(0, -0.6, 0);
  const hullMat = new THREE.MeshStandardMaterial({ color: '#1b2433', roughness: 0.55, metalness: 0.3 });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  ship.add(hull);
  // deck edge highlight
  const deckPts = hullShape.getPoints(40).map((p) => new THREE.Vector3(p.x, 2.02, -p.y));
  const deckLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(deckPts), new THREE.LineBasicMaterial({ color: '#e8dcc6', transparent: true, opacity: 0.5 }));
  ship.add(deckLine);

  // containers
  const r = mulberry32(21);
  const palette = ['#23466f', '#2f5a8a', '#1a3558', '#c9a064', '#e6ddcc', '#8d6b3e', '#3e6f9c', '#b3552f', '#25405f'];
  const cw = 0.25, ch = 0.27, cl = 1.22;
  const boxes = [];
  for (let bay = 0; bay < 24; bay++) {
    const z = -14.2 + bay * 1.3 + Math.floor(bay / 2) * 0.12;
    if (z > 15.4) break;
    const wz = -z; // bow is toward -z
    const taper = wz < -9 ? Math.max(0, (wz + 22) / 13) : 1; // narrower toward the bow
    const rows = Math.max(8, Math.floor(22 * Math.min(1, taper)));
    for (let row = 0; row < rows; row++) {
      const x = (row - (rows - 1) / 2) * (cw + 0.012);
      const tiers = 3 + Math.floor(r() * 5 * (0.6 + 0.4 * taper));
      for (let tier = 0; tier < tiers; tier++) boxes.push([x, 2.02 + ch / 2 + tier * (ch + 0.006), -z, palette[Math.floor(r() * palette.length)]]);
    }
  }
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(cw, ch, cl), new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.25 }), boxes.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  boxes.forEach(([x, y, z, c], i) => { m4.makeTranslation(x, y, z); inst.setMatrixAt(i, m4); col.set(c).multiplyScalar(0.8 + r() * 0.35); inst.setColorAt(i, col); });
  ship.add(inst);
  // bridge + funnel near the stern
  const white = new THREE.MeshStandardMaterial({ color: '#e6e0d4', roughness: 0.5, metalness: 0.1 });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(6.0, 3.6, 1.5), white);
  bridge.position.set(0, 2.0 + 1.8, 16.6); ship.add(bridge);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.25, 1.7), white); wing.position.set(0, 5.4, 16.6); ship.add(wing);
  const win = new THREE.Mesh(new THREE.BoxGeometry(6.02, 0.3, 1.52), new THREE.MeshStandardMaterial({ color: '#0d1522', emissive: '#ffcf8a', emissiveIntensity: 0.25 }));
  win.position.set(0, 5.05, 16.6); ship.add(win);
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 1.8), hullMat); funnel.position.set(0, 3.3, 18.8); ship.add(funnel);

  // wake + bow foam: canvas-drawn streak textures
  const foamTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 1024;
    const ctx = cv.getContext('2d');
    const rr = mulberry32(3);
    for (let i = 0; i < 900; i++) {
      const y = rr() * 1024, spread = 20 + (y / 1024) * 110;
      const x = 128 + (rr() - 0.5) * 2 * spread;
      const a = (1 - y / 1024) * 0.35 * rr();
      ctx.fillStyle = `rgba(235,242,250,${a})`;
      ctx.fillRect(x, y, 1 + rr() * 3, 6 + rr() * 30);
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(22, 110).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.9 }));
  wake.position.set(0, 0.05, 20 + 55); ship.add(wake);
  const sideFoam = new THREE.Mesh(new THREE.PlaneGeometry(9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.55 }));
  sideFoam.rotation.y = Math.PI; sideFoam.position.set(0, 0.04, -2); ship.add(sideFoam);

  // lights
  const sunL = new THREE.DirectionalLight('#ffc98f', 2.6); sunL.position.copy(SUN_DIR).multiplyScalar(100); scene.add(sunL);
  const hemi = new THREE.HemisphereLight('#5a7cb0', '#0a1830', 1.3); scene.add(hemi);
  const back = new THREE.DirectionalLight('#6f8fc0', 0.5); back.position.set(40, 30, 60); scene.add(back);

  // gold route ahead of the bow
  const route = new GoldLine(curvePoints([
    new THREE.Vector3(0, 0.12, -23.5), new THREE.Vector3(-8, 0.12, -60), new THREE.Vector3(-60, 0.12, -150), new THREE.Vector3(-300, 0.12, -380), new THREE.Vector3(-1100, 0.12, -1000),
  ], 160), { width: 2.4, halo: 12, headSize: 3.5 });
  scene.add(route.group);

  function update(t) {
    const k = ep(t, 2.45, 4.2, ease.out);
    camera.position.set(lerp(23, 14, k), lerp(16, 10.5, k), lerp(37, 24, k));
    camera.lookAt(lerp(-7, -5, k), 0, lerp(-20, -22, k));
    sea.material.uniforms.uTime.value = t;
    ship.position.y = Math.sin(t * 0.9) * 0.05;
    ship.rotation.z = Math.sin(t * 0.7) * 0.004;
    route.set(0, ep(t, 2.8, 4.1, ease.inOut), 1);
  }

  return { scene, camera, update, bloom: 0.6, threshold: 0.95, vignette: 0.5, warmth: 0.12 };
}
