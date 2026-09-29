// 01c | 4.0–6.3 s  Inside the plant. Scattered information drifts at several
// depths; a gold light ignites from the product and traces its outer ring.
// Ends on exactly the framing scene 02 starts with (match cut on the bearing).
import * as THREE from 'three';
import { C, W, H, lerp, ss, ep, ease, mulberry32, GoldLine, glowSprite } from '../lib.js';
import { makeBearing, bearingPose, bearingLights } from '../bearing.js';
import { BEARING_TILT, START_CAM } from './s2_product.js';
import { infoWindow } from './s1_earth.js';

function shaftTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 512;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, 'rgba(255,214,150,0.9)'); g.addColorStop(0.6, 'rgba(255,200,140,0.25)'); g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 512);
  const h = ctx.createLinearGradient(0, 0, 128, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.3, 'rgba(0,0,0,0)'); h.addColorStop(0.7, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = h; ctx.fillRect(0, 0, 128, 512);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function create({ renderer }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040b18');
  scene.fog = new THREE.FogExp2('#071428', 0.018);
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 1000);
  scene.add(camera);

  const FLOOR = -3.2;
  const steel = new THREE.MeshStandardMaterial({ color: '#2a3a52', roughness: 0.6, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#141f31', roughness: 0.7, metalness: 0.4 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 300).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0b1526', roughness: 0.28, metalness: 0.7 }));
  floor.position.y = FLOOR; scene.add(floor);
  // floor lane markings
  for (const x of [-4.5, 4.5]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 200).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#8a6f3e', transparent: true, opacity: 0.5 }));
    m.position.set(x, FLOOR + 0.01, -60); scene.add(m);
  }

  const hall = new THREE.Group(); scene.add(hall);
  const warmLight = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b0').multiplyScalar(2.2), toneMapped: false });
  const coolLight = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fc6ff').multiplyScalar(1.4), toneMapped: false });
  const r = mulberry32(9);
  for (let i = 0; i < 16; i++) {
    const z = 6 - i * 8;
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, 18, 0.8), steel); col.position.set(s * 16, FLOOR + 9, z); hall.add(col);
      // machines along both sides
      const mz = z - 4;
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 4.2), dark); body.position.set(s * 9.5, FLOOR + 1.3, mz); hall.add(body);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), coolLight); scr.position.set(s * 9.5 - s * 1.61, FLOOR + 1.9, mz); scr.rotation.y = -s * Math.PI / 2; hall.add(scr);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: r() > 0.5 ? '#ffb45a' : '#7fe0a0', toneMapped: false })); lamp.position.set(s * 9.5 - s * 1.2, FLOOR + 2.75, mz + 1.5); hall.add(lamp);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(32, 0.7, 0.6), steel); beam.position.set(0, FLOOR + 17.5, z); hall.add(beam);
    for (const x of [-6, 6]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 7.9), warmLight); strip.position.set(x, FLOOR + 16.6, z - 4); hall.add(strip);
    }
  }
  // light shafts from high windows
  const sTex = shaftTexture();
  const shafts = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 26), new THREE.MeshBasicMaterial({ map: sTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.set(-12 + i * 6, FLOOR + 10, -14 - i * 7);
    m.rotation.z = 0.35;
    scene.add(m); shafts.push(m);
  }

  // product on a lit plinth
  bearingLights(scene, { key: 1.1, rim: 1.8, fill: 0.6 });
  const bearing = makeBearing(renderer, { scale: 2 });
  scene.add(bearing);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.35, 96), new THREE.MeshStandardMaterial({ color: '#1a2a44', roughness: 0.3, metalness: 0.8 }));
  plinth.position.y = FLOOR + 0.18; scene.add(plinth);
  const plinthGlow = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.75, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd79a').multiplyScalar(1.5), transparent: true, opacity: 0.0, toneMapped: false }));
  plinthGlow.position.y = FLOOR + 0.37; scene.add(plinthGlow);
  const goldPoint = new THREE.PointLight('#ffc978', 0, 30, 1.5); scene.add(goldPoint);
  const ignite = glowSprite('#ffd79a', 1, 0); ignite.position.set(0, 0, 1.4); scene.add(ignite);

  const ringPts = [];
  for (let i = 0; i <= 160; i++) { const a = -Math.PI / 2 + (i / 160) * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
  const ring = new GoldLine(ringPts, { width: 2.2, halo: 10, head: true, headSize: 0.35, order: 21 });
  scene.add(ring.group);

  // scattered info windows (screen-space placement relative to the camera)
  const floaters = [
    { p: infoWindow('web', 5), sx: -0.62, sy: 0.46, d: 20, dir: [-1, 0.4], at: 4.15 },
    { p: infoWindow('trade', 6), sx: 0.64, sy: 0.42, d: 24, dir: [1, 0.6], at: 4.3 },
    { p: infoWindow('mail', 7), sx: 0.7, sy: -0.36, d: 18, dir: [1, -0.5], at: 4.45 },
    { p: infoWindow('city', 1), sx: -0.72, sy: -0.02, d: 26, dir: [-1, -0.2], at: 4.55 },
    { p: infoWindow('city', 2), sx: 0.1, sy: 0.72, d: 30, dir: [0.2, 1], at: 4.65 },
  ];
  for (const f of floaters) { scene.add(f.p.mesh); f.p.opacity = 0; }

  const from = new THREE.Vector3(1.5, 3.2, 34), tgt = new THREE.Vector3();
  function update(t) {
    const k = ep(t, 4.0, 5.95, ease.inOut);
    camera.position.copy(from).lerp(START_CAM.pos, k);
    tgt.set(0, -0.6, 0).lerp(START_CAM.target, ep(t, 4.0, 5.6, ease.inOut));
    camera.lookAt(tgt);
    camera.updateMatrixWorld();

    bearingPose(bearing, t);
    bearing.rotation.copy(BEARING_TILT(t));

    const ig = ep(t, 4.85, 5.4, ease.out);
    goldPoint.intensity = 7 * ig;
    goldPoint.position.set(0, 0.5, 3.2);
    ignite.material.opacity = ig * (1 - 0.6 * ss(5.4, 6.0, t));
    ignite.scale.setScalar(lerp(0.5, 5.5, ig));
    plinthGlow.material.opacity = 0.8 * ig;
    ring.group.scale.setScalar(2 * 1.42);
    ring.group.lookAt(camera.position);
    ring.set(0, ep(t, 4.95, 5.75, ease.inOut), 1);
    ring.headOn = t < 5.75;

    const dim = ss(5.0, 5.8, t);
    floaters.forEach((f) => {
      const a = ep(t, f.at, f.at + 0.5, ease.out);
      f.p.opacity = a * 0.75 * (1 - dim * 0.85);
      const drift = (t - f.at) * 0.35 + dim * 0.5;
      const v = new THREE.Vector3((f.sx + f.dir[0] * drift * 0.12) * f.d * 0.5605, (f.sy + f.dir[1] * drift * 0.12) * f.d * 0.3153, -f.d);
      f.p.mesh.position.copy(camera.localToWorld(v));
      f.p.mesh.quaternion.copy(camera.quaternion);
      f.p.mesh.rotateY(-f.sx * 0.5);
      f.p.mesh.rotateX(f.sy * 0.25);
    });
    shafts.forEach((m, i) => { m.material.opacity = 0.12 + 0.05 * Math.sin(t * 0.8 + i); });
  }

  return { scene, camera, update, bloom: 0.9, threshold: 0.72, vignette: 0.55 };
}
