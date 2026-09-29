// The one example product used across the film: a 6205 deep-groove ball
// bearing (OD 52 / ID 25 / W 15 mm) with a brass cage. 1 unit = 20 mm.
import * as THREE from 'three';

let _env = null;
// Studio environment tinted in brand colours for metallic reflections.
export function studioEnv(renderer) {
  if (_env) return _env;
  const s = new THREE.Scene();
  s.background = new THREE.Color('#0a1a36');
  const box = (w, h, x, y, z, color, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  box(8, 3, 0, 9, 2, '#ffffff', 1.3);       // top softbox
  box(3, 8, -9, 1, 3, '#dbe8ff', 1.1);      // cool left strip
  box(3, 7, 9, 0, -2, '#ffd9a0', 1.2);      // warm gold right strip
  box(14, 2, 0, -8, 0, '#16345f', 1.0);     // floor bounce
  box(6, 6, 0, 2, -10, '#1c4a8a', 0.9);     // back blue
  const pm = new THREE.PMREMGenerator(renderer);
  _env = pm.fromScene(s, 0.04).texture;
  return _env;
}

function ringProfile(rIn, rOut, h, grooveSide, gd = 0.06, gw = 0.17, ch = 0.03) {
  // Lathe profile (r, y): bottom face -> outer surface up -> top face ->
  // inner surface down, so normals face outwards. Circular raceway groove on
  // the side that touches the balls.
  const P = [];
  const depth = (y) => (Math.abs(y) < gw ? gd * Math.sqrt(1 - (y / gw) ** 2) : 0);
  const N = 24;
  P.push([rIn + ch, -h], [rOut - ch, -h], [rOut, -h + ch]);
  if (grooveSide === 'out') for (let i = 0; i <= N; i++) { const y = -gw + (2 * gw * i) / N; P.push([rOut - depth(y), y]); }
  P.push([rOut, h - ch], [rOut - ch, h], [rIn + ch, h], [rIn, h - ch]);
  if (grooveSide === 'in') for (let i = 0; i <= N; i++) { const y = gw - (2 * gw * i) / N; P.push([rIn + depth(y), y]); }
  P.push([rIn, -h + ch], [rIn + ch, -h]);
  return P.map(([r, y]) => new THREE.Vector2(r, y));
}

export function makeBearing(renderer, o = {}) {
  const env = studioEnv(renderer);
  const steel = new THREE.MeshStandardMaterial({ color: '#9aa5b1', metalness: 1, roughness: 0.26, envMap: env, envMapIntensity: 0.95 });
  // concentric machining marks for the flat faces (planar UVs of RingGeometry)
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#707070'; cx.fillRect(0, 0, 1024, 1024);
  for (let r = 4; r < 512; r += 2) {
    const v = 90 + Math.floor(70 * Math.abs(Math.sin(r * 0.37)) + 40 * Math.sin(r * 0.05));
    cx.strokeStyle = `rgb(${v},${v},${v})`; cx.lineWidth = 2; cx.beginPath(); cx.arc(512, 512, r, 0, Math.PI * 2); cx.stroke();
  }
  const turned = new THREE.CanvasTexture(cv);
  turned.colorSpace = THREE.NoColorSpace;
  const steelFace = new THREE.MeshStandardMaterial({ roughnessMap: turned, bumpMap: turned, bumpScale: 0.05, color: '#98a3b0', metalness: 1, roughness: 0.6, envMap: env, envMapIntensity: 0.85 });
  const ballMat = new THREE.MeshStandardMaterial({ color: '#d8dee6', metalness: 1, roughness: 0.08, envMap: env, envMapIntensity: 1.2 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d9b373', metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 1.3 });

  const g = new THREE.Group();
  const halfW = 0.375;
  const outer = new THREE.Mesh(new THREE.LatheGeometry(ringProfile(1.02, 1.3, halfW, 'in'), 160), steel);
  const inner = new THREE.Mesh(new THREE.LatheGeometry(ringProfile(0.625, 0.9, halfW, 'out'), 160), steel);
  // machined face rings for extra specular detail
  const faceRing = (r0, r1, y) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 160), steelFace); m.rotation.x = -Math.PI / 2; m.position.y = y; return m; };
  outer.add(faceRing(1.05, 1.27, halfW + 0.001), faceRing(1.05, 1.27, -halfW - 0.001));
  inner.add(faceRing(0.65, 0.87, halfW + 0.001), faceRing(0.65, 0.87, -halfW - 0.001));

  const rotor = new THREE.Group(); // inner ring (spins)
  rotor.add(inner);
  const cageG = new THREE.Group(); // balls + cage (orbit slower)
  const nBalls = 9, pitch = 0.96, rb = 0.165;
  const ballGeo = new THREE.SphereGeometry(rb, 40, 28);
  for (let i = 0; i < nBalls; i++) {
    const a = (i / nBalls) * Math.PI * 2;
    const b = new THREE.Mesh(ballGeo, ballMat);
    b.position.set(Math.cos(a) * pitch, 0, Math.sin(a) * pitch);
    cageG.add(b);
  }
  // pressed cage: two wavy bands
  for (const side of [-1, 1]) {
    const pts = [];
    const M = 360;
    for (let i = 0; i <= M; i++) {
      const a = (i / M) * Math.PI * 2;
      const w = Math.pow(Math.max(0, Math.cos(a * nBalls)), 3);
      pts.push(new THREE.Vector3(Math.cos(a) * pitch, side * (0.1 + 0.1 * (1 - w)), Math.sin(a) * pitch));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 360, 0.022, 8, true), brass);
    cageG.add(tube);
  }
  g.add(outer, rotor, cageG);
  g.userData = { outer, rotor, cageG, mats: [steel, steelFace, ballMat].map((m) => [m, m.envMapIntensity]) };
  g.scale.setScalar(o.scale ?? 1);
  return g;
}

// Shared motion so the product matches exactly across cuts.
export function bearingPose(g, t) {
  const { rotor, cageG } = g.userData;
  rotor.rotation.y = t * 0.9;
  cageG.rotation.y = t * 0.36;
}

export function bearingLights(scene, o = {}) {
  const key = new THREE.DirectionalLight('#fff4e0', o.key ?? 1.1); key.position.set(4, 6, 5);
  const rim = new THREE.DirectionalLight('#ffd08a', o.rim ?? 1.8); rim.position.set(-5, 2, -4);
  const fill = new THREE.HemisphereLight('#6f9bd6', '#0a1a36', o.fill ?? 0.6);
  scene.add(key, rim, fill);
  return { key, rim, fill };
}
