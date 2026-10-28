// 3D models of a sport bike with its rider and a police tourer, in metres. X right, Y up, the
// bike points along -Z (away from the camera behind it). Parts that the game recolours per rider
// are tagged: 'paint' (bodywork), 'suit' (leathers) and 'trim' (helmet and suit panels).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const NEUTRAL = 0xe6e6e6;

export function materials() {
  const std = (color, rough, metal, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra || {}));
  return {
    paint: std(NEUTRAL, 0.28, 0.25),
    suit: std(NEUTRAL, 0.6, 0.05),
    trim: std(NEUTRAL, 0.22, 0.2),
    tyre: std(0x141414, 0.85, 0),
    rim: std(0x2a2b2e, 0.4, 0.7),
    chrome: std(0xffffff, 0.12, 1),
    engine: std(0x3a3c40, 0.45, 0.6),
    black: std(0x111113, 0.5, 0.1),
    seat: std(0x161618, 0.8, 0),
    glove: std(0x18181a, 0.55, 0.05),
    visor: std(0x0b0c10, 0.08, 0.6),
    glass: std(0x6a7d8c, 0.05, 0.3, { transparent: true, opacity: 0.45 }),
    tail: std(0xff2a20, 0.3, 0, { emissive: 0x9a0a06 }),
    amber: std(0xffa020, 0.3, 0, { emissive: 0x7a4000 }),
    plate: std(0xe8e4cc, 0.6, 0),
    white: std(0xf2f3f4, 0.3, 0.1),
    copSuit: std(0x1c1d22, 0.55, 0.05),
    reflect: std(0xd8e050, 0.4, 0, { emissive: 0x303000 }),
    red: std(0xff2020, 0.3, 0, { emissive: 0xaa0000 }),
    blue: std(0x2050ff, 0.3, 0, { emissive: 0x0010aa }),
  };
}

function mesh(geo, mat, tag) { const m = new THREE.Mesh(geo, mat); m.userData.tag = tag || null; m.castShadow = m.receiveShadow = true; return m; }
// a capsule from a to b
function limb(a, b, r, mat, tag) {
  const d = b.clone().sub(a), len = d.length();
  const m = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 14), mat, tag);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return m;
}
// a tapered capsule-ish segment, wider at a
function taper(a, b, ra, rb, mat, tag) {
  const g = new THREE.Group(), d = b.clone().sub(a), len = d.length();
  const cyl = mesh(new THREE.CylinderGeometry(rb, ra, len, 16), mat, tag);
  cyl.position.copy(a).add(b).multiplyScalar(0.5); cyl.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  const sa = mesh(new THREE.SphereGeometry(ra, 16, 12), mat, tag); sa.position.copy(a);
  const sb = mesh(new THREE.SphereGeometry(rb, 16, 12), mat, tag); sb.position.copy(b);
  g.add(cyl, sa, sb); return g;
}
function blob(pos, scale, mat, tag, rot) {
  const m = mesh(new THREE.SphereGeometry(1, 32, 24), mat, tag);
  m.position.copy(pos); m.scale.copy(scale); if (rot) m.rotation.set(rot.x, rot.y, rot.z);
  return m;
}
function box(pos, size, mat, tag, radius, rot) {
  const m = mesh(radius ? new RoundedBoxGeometry(size.x, size.y, size.z, 3, radius) : new THREE.BoxGeometry(size.x, size.y, size.z), mat, tag);
  m.position.copy(pos); if (rot) m.rotation.set(rot.x, rot.y, rot.z);
  return m;
}
function cyl(pos, r, len, mat, axis, tag, rTop) {
  const m = mesh(new THREE.CylinderGeometry(rTop === undefined ? r : rTop, r, len, 24), mat, tag);
  m.position.copy(pos);
  if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
  return m;
}
function wheel(M, z, R, tube, width) {
  const g = new THREE.Group();
  const tyre = mesh(new THREE.TorusGeometry(R - tube, tube, 20, 48), M.tyre); tyre.rotation.y = Math.PI / 2; tyre.scale.set(1, 1, width / tube / 2);
  // tyre scale: torus lies in XY; after rotating about Y it lies in ZY, and scale.z widens it across X
  tyre.scale.set(1, 1, 1); tyre.scale.z = width / (tube * 2);
  g.add(tyre);
  g.add(cyl(V(0, 0, 0), R - tube * 1.6, width * 0.5, M.rim, 'x'));
  g.add(cyl(V(0, 0, 0), 0.05, width * 0.9, M.chrome, 'x'));
  g.position.set(0, R, z);
  return g;
}

// pose: { lean, action: 'ride'|'punch'|'back'|'kick'|'swing', side: -1|1, phase: 0..1, weapon: 'chain'|'club'|null }
export function sportBike(M, pose) {
  const root = new THREE.Group(), bike = new THREE.Group(), rider = new THREE.Group();
  root.add(bike, rider);
  const s = pose.side || 1;
  // wheels: rear 180/55 style, front narrower
  bike.add(wheel(M, 0.68, 0.315, 0.085, 0.19));
  bike.add(wheel(M, -0.72, 0.31, 0.065, 0.13));
  // rear hugger and swingarm
  const hug = mesh(new THREE.TorusGeometry(0.33, 0.012, 6, 24, Math.PI * 0.55), M.black); hug.rotation.set(0, Math.PI / 2, Math.PI * 0.42); hug.scale.z = 9; hug.position.set(0, 0.315, 0.68); bike.add(hug);
  for (const x of [-0.11, 0.11]) bike.add(box(V(x, 0.34, 0.42), V(0.035, 0.07, 0.55), M.engine, null, 0.015, V(-0.12, 0, 0)));
  // engine and frame
  bike.add(box(V(0, 0.44, -0.02), V(0.36, 0.34, 0.5), M.engine, null, 0.06));
  bike.add(box(V(0, 0.4, -0.02), V(0.42, 0.16, 0.32), M.engine, null, 0.06));
  for (const x of [-0.2, 0.2]) bike.add(cyl(V(x, 0.42, 0.02), 0.08, 0.05, M.chrome, 'x'));
  for (const x of [-0.17, 0.17]) bike.add(box(V(x, 0.72, -0.12), V(0.05, 0.1, 0.62), M.rim, null, 0.02, V(0.25, 0, 0)));
  // exhaust: header under the engine to a can on the right, kicked up
  bike.add(limb(V(0.06, 0.24, -0.25), V(0.16, 0.3, 0.3), 0.032, M.chrome));
  const can = cyl(V(0.2, 0.45, 0.55), 0.065, 0.42, M.chrome, 'z', null, 0.055); can.rotation.x = Math.PI / 2 - 0.45; bike.add(can);
  bike.add(cyl(V(0.2, 0.55, 0.75), 0.04, 0.02, M.black, 'z'));
  // bodywork: lower fairing and belly pan, side panels, tank, nose and screen
  bike.add(blob(V(0, 0.42, -0.22), V(0.24, 0.17, 0.36), M.paint, 'paint'));
  for (const x of [-1, 1]) bike.add(blob(V(x * 0.15, 0.62, -0.42), V(0.12, 0.2, 0.32), M.paint, 'paint', V(0.25, 0, 0)));
  bike.add(blob(V(0, 0.86, -0.12), V(0.19, 0.13, 0.28), M.paint, 'paint'));
  bike.add(blob(V(0, 0.84, -0.62), V(0.22, 0.15, 0.22), M.paint, 'paint'));
  const scr = blob(V(0, 0.98, -0.66), V(0.15, 0.1, 0.14), M.glass); bike.add(scr);
  // seat and the upswept tail with its light, indicators and plate
  bike.add(box(V(0, 0.88, 0.2), V(0.24, 0.06, 0.32), M.seat, null, 0.025, V(-0.08, 0, 0)));
  bike.add(blob(V(0, 0.9, 0.48), V(0.12, 0.09, 0.3), M.paint, 'paint', V(-0.22, 0, 0)));
  bike.add(box(V(0, 0.93, 0.76), V(0.12, 0.035, 0.03), M.tail, 'taillight', 0.01, V(-0.4, 0, 0)));
  bike.add(box(V(0, 0.72, 0.78), V(0.02, 0.2, 0.02), M.black, null, 0, V(0.3, 0, 0)));
  bike.add(box(V(0, 0.62, 0.84), V(0.18, 0.11, 0.008), M.plate));
  for (const x of [-0.12, 0.12]) { bike.add(limb(V(0, 0.7, 0.8), V(x, 0.7, 0.8), 0.008, M.black)); bike.add(blob(V(x, 0.7, 0.81), V(0.02, 0.015, 0.025), M.amber)); }
  // clip-ons and mirrors
  for (const x of [-1, 1]) {
    bike.add(limb(V(x * 0.12, 0.92, -0.5), V(x * 0.3, 0.9, -0.46), 0.014, M.black));
    bike.add(limb(V(x * 0.2, 1.0, -0.62), V(x * 0.33, 1.06, -0.6), 0.008, M.black));
    bike.add(blob(V(x * 0.36, 1.07, -0.6), V(0.06, 0.035, 0.02), M.paint, 'paint'));
  }
  // pegs
  for (const x of [-1, 1]) bike.add(cyl(V(x * 0.2, 0.42, 0.26), 0.012, 0.08, M.chrome, 'x'));

  // ----- the rider, tucked in
  const hip = V(0, 0.98, 0.16), chest = V(0, 1.24, -0.12), neck = V(0, 1.33, -0.24);
  // pelvis and torso: two broad blobs, the back long and flat-ish
  rider.add(blob(V(0, 1.0, 0.14), V(0.18, 0.12, 0.15), M.suit, 'suit'));
  const back = blob(V(0, 1.17, -0.02), V(0.215, 0.13, 0.3), M.suit, 'suit', V(0.62, 0, 0)); rider.add(back);
  rider.add(blob(V(0, 1.27, -0.17), V(0.24, 0.12, 0.13), M.suit, 'suit'));               // shoulders
  // racing hump and contrast panels down the sides of the back
  rider.add(blob(V(0, 1.3, -0.04), V(0.1, 0.07, 0.14), M.suit, 'suit', V(0.62, 0, 0)));
  for (const x of [-1, 1]) rider.add(blob(V(x * 0.15, 1.15, -0.03), V(0.07, 0.09, 0.26), M.trim, 'trim', V(0.62, 0, x * 0.25)));
  // helmet with a visor, chin low over the tank
  const hel = V(0, 1.39, -0.33);
  rider.add(blob(hel, V(0.135, 0.135, 0.15), M.trim, 'trim'));
  rider.add(blob(V(0, 1.375, -0.43), V(0.11, 0.05, 0.06), M.visor));
  rider.add(blob(V(0, 1.47, -0.3), V(0.03, 0.045, 0.14), M.suit, 'suit'));                // helmet stripe
  // legs: thighs forward and out to the knees by the tank, shins back to boots on the pegs
  const legs = [];
  for (const x of [-1, 1]) {
    const kicking = pose.action === 'kick' && x === s;
    const h = V(x * 0.11, 0.98, 0.12);
    const knee = kicking ? V(x * 0.42, 0.86, -0.02) : V(x * 0.21, 0.86, -0.2);
    const ankle = kicking ? V(x * 0.78, 0.82, 0.02) : V(x * 0.19, 0.5, 0.2);
    rider.add(taper(h, knee, 0.085, 0.065, M.suit, 'suit'));
    rider.add(taper(knee, ankle, 0.062, 0.045, M.suit, 'suit'));
    rider.add(blob(knee.clone().add(V(x * 0.04, 0, 0)), V(0.035, 0.045, 0.05), M.trim, 'trim'));   // knee slider
    const boot = box(kicking ? V(x * 0.84, 0.8, 0.02) : V(x * 0.19, 0.44, 0.26), kicking ? V(0.12, 0.09, 0.1) : V(0.09, 0.14, 0.22), M.glove, null, 0.03, kicking ? V(0, 0, x * 0.3) : V(-0.3, 0, 0));
    rider.add(boot); legs.push(knee);
  }
  // arms: riding, punching, backhanding or swinging
  const shoulder = x => V(x * 0.2, 1.28, -0.16);
  const grip = x => V(x * 0.28, 0.93, -0.46);
  for (const x of [-1, 1]) {
    const sh = shoulder(x);
    let elbow, hand, fist = false;
    if (pose.action !== 'ride' && pose.action !== 'kick' && x === s) {
      if (pose.action === 'punch') { elbow = V(x * 0.45, 1.3, -0.2); hand = V(x * 0.74, 1.3, -0.24); fist = true; }
      else if (pose.action === 'back') { elbow = V(x * 0.42, 1.18, -0.02); hand = V(x * 0.62, 1.05, 0.2); fist = true; }
      else {
        // swing: the arm sweeps from raised and back to out in front
        const a = -0.9 + pose.phase * 2.2;
        elbow = sh.clone().add(V(x * 0.22, 0.12 - pose.phase * 0.05, -0.05 + Math.sin(a) * 0.08));
        hand = sh.clone().add(V(x * (0.3 + pose.phase * 0.2), 0.32 - pose.phase * 0.25, 0.18 - pose.phase * 0.45));
        fist = true;
      }
    } else { elbow = V(x * 0.3, 1.1, -0.3); hand = grip(x); }
    rider.add(taper(sh, elbow, 0.07, 0.058, M.suit, 'suit'));
    rider.add(taper(elbow, hand, 0.056, 0.048, M.suit, 'suit'));
    rider.add(blob(elbow, V(0.06, 0.06, 0.06), M.trim, 'trim'));
    rider.add(blob(hand, V(0.06, 0.055, 0.07), M.glove));
    if (fist && pose.action === 'swing') {
      if (pose.weapon === 'club') rider.add(taper(hand, hand.clone().add(V(x * 0.1, 0.42 - pose.phase * 0.5, 0.15 - pose.phase * 0.5)), 0.025, 0.04, new THREE.MeshStandardMaterial({ color: 0x7a4f2a, roughness: 0.7 })));
      else {
        // the chain: links trailing in an arc behind the fist
        for (let i = 1; i <= 12; i++) {
          const t = i / 12, p = hand.clone().add(V(x * (0.04 + t * 0.25) * (1 - pose.phase * 0.5), 0.05 + Math.sin(t * Math.PI) * 0.18 - t * pose.phase * 0.3, t * 0.35 * (1 - pose.phase * 1.4)));
          const l = mesh(new THREE.TorusGeometry(0.024, 0.009, 6, 10), M.chrome); l.position.copy(p); l.rotation.set(i * 0.9, i * 0.5, 0); rider.add(l);
        }
      }
    }
  }
  root.rotation.z = -(pose.lean || 0);
  return root;
}

export function policeBike(M, pose) {
  const root = new THREE.Group(), bike = new THREE.Group(), rider = new THREE.Group();
  root.add(bike, rider);
  const s = pose.side || 1;
  bike.add(wheel(M, 0.75, 0.32, 0.08, 0.17));
  bike.add(wheel(M, -0.78, 0.31, 0.065, 0.13));
  bike.add(box(V(0, 0.45, -0.05), V(0.44, 0.36, 0.55), M.engine, null, 0.07));
  for (const x of [-1, 1]) {
    // cylinders sticking out each side, like a boxer twin, and crash bars
    bike.add(cyl(V(x * 0.3, 0.42, -0.2), 0.07, 0.18, M.chrome, 'x'));
    bike.add(limb(V(x * 0.22, 0.35, -0.42), V(x * 0.36, 0.5, -0.36), 0.015, M.chrome));
  }
  // black fairing and a tall screen
  bike.add(blob(V(0, 0.82, -0.6), V(0.42, 0.26, 0.28), M.black));
  bike.add(blob(V(0, 0.62, -0.5), V(0.32, 0.2, 0.3), M.black));
  const screen = box(V(0, 1.18, -0.7), V(0.5, 0.36, 0.015), M.glass, null, 0.05, V(-0.35, 0, 0)); bike.add(screen);
  for (const x of [-1, 1]) { bike.add(blob(V(x * 0.36, 1.0, -0.62), V(0.04, 0.03, 0.03), x < 0 ? M.red : M.blue)); bike.add(blob(V(x * 0.47, 0.98, -0.58), V(0.07, 0.04, 0.02), M.black)); }
  // tank, seat, panniers and the top box with its reflector
  bike.add(blob(V(0, 0.86, -0.22), V(0.21, 0.14, 0.26), M.black));
  bike.add(box(V(0, 0.87, 0.18), V(0.32, 0.08, 0.42), M.seat, null, 0.03));
  for (const x of [-1, 1]) {
    bike.add(box(V(x * 0.3, 0.6, 0.55), V(0.2, 0.34, 0.5), M.white, null, 0.05));
    bike.add(box(V(x * 0.3, 0.78, 0.55), V(0.21, 0.04, 0.51), M.black, null, 0.015));
    bike.add(box(V(x * 0.3, 0.6, 0.805), V(0.1, 0.03, 0.01), M.tail));
  }
  bike.add(box(V(0, 1.06, 0.62), V(0.44, 0.32, 0.36), M.white, null, 0.06));
  bike.add(box(V(0, 1.21, 0.62), V(0.45, 0.04, 0.37), M.black, null, 0.015));
  bike.add(box(V(0, 1.03, 0.805), V(0.2, 0.08, 0.01), M.tail, 'taillight'));
  bike.add(box(V(0, 0.82, 0.86), V(0.2, 0.11, 0.008), M.plate));
  for (const x of [-1, 1]) { bike.add(limb(V(x * 0.08, 0.95, -0.42), V(x * 0.36, 0.98, -0.38), 0.016, M.black)); bike.add(cyl(V(x * 0.22, 0.42, 0.06), 0.012, 0.12, M.chrome, 'x')); }

  // the officer sits upright
  rider.add(blob(V(0, 1.02, 0.2), V(0.19, 0.12, 0.15), M.copSuit));
  rider.add(blob(V(0, 1.27, 0.12), V(0.22, 0.25, 0.15), M.copSuit, null, V(0.15, 0, 0)));
  rider.add(blob(V(0, 1.44, 0.08), V(0.25, 0.1, 0.14), M.copSuit));
  rider.add(blob(V(0, 1.6, 0.02), V(0.135, 0.145, 0.15), M.white));
  rider.add(blob(V(0, 1.58, -0.09), V(0.11, 0.05, 0.05), M.visor));
  for (const x of [-1, 1]) {
    rider.add(taper(V(x * 0.11, 1.0, 0.16), V(x * 0.22, 0.93, -0.18), 0.09, 0.07, M.copSuit));
    rider.add(taper(V(x * 0.22, 0.93, -0.18), V(x * 0.23, 0.5, -0.12), 0.065, 0.05, M.copSuit));
    rider.add(box(V(x * 0.23, 0.45, -0.1), V(0.1, 0.12, 0.24), M.glove, null, 0.03));
    const sh = V(x * 0.22, 1.42, 0.08);
    let el, hand;
    if (pose.action === 'swing' && x === s) {
      el = sh.clone().add(V(x * 0.22, 0.12 - pose.phase * 0.06, -0.05));
      hand = sh.clone().add(V(x * (0.3 + pose.phase * 0.2), 0.3 - pose.phase * 0.25, 0.12 - pose.phase * 0.45));
      rider.add(taper(hand, hand.clone().add(V(x * 0.08, 0.45 - pose.phase * 0.55, 0.12 - pose.phase * 0.5)), 0.022, 0.03, M.black));   // baton
    } else { el = V(x * 0.34, 1.2, -0.1); hand = V(x * 0.35, 0.98, -0.38); }
    rider.add(taper(sh, el, 0.072, 0.06, M.copSuit));
    rider.add(taper(el, hand, 0.058, 0.05, M.copSuit));
    rider.add(blob(hand, V(0.06, 0.055, 0.07), M.glove));
  }
  root.rotation.z = -(pose.lean || 0);
  return root;
}
