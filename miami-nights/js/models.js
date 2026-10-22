'use strict';
// car models: each is a body and a cabin, described by cross-sections along the
// car's length. A section is [along, half width, bottom, top]: along runs from
// -1 (rear) to 1 (front) as a share of half the length, half width is a share of
// half the width, and heights are in world units above the ground. The cabin's
// sloped ends become the windshield and the rear window.

const CAR_MODELS = {
  sports: {
    len: 41, wid: 20, wheel: 4.2, track: 0.55,
    body: [[-1, 0.86, 3.2, 8.6], [-0.9, 0.98, 2.8, 10.2], [-0.2, 1, 2.6, 10.4], [0.55, 0.98, 2.6, 9.2], [0.92, 0.9, 2.8, 7.4], [1, 0.78, 3.4, 6.2]],
    cabin: [[-0.62, 0.66, 10], [-0.22, 0.74, 15.4], [0.1, 0.76, 15.6], [0.5, 0.86, 9.4]],
    spoiler: true, stripe: true,
  },
  sedan: {
    len: 43, wid: 20, wheel: 4.2, track: 0.58,
    body: [[-1, 0.86, 3.6, 10.4], [-0.92, 0.98, 3.2, 12], [0.7, 1, 3.2, 11.6], [0.94, 0.94, 3.4, 10], [1, 0.84, 4.2, 8.6]],
    cabin: [[-0.6, 0.76, 12], [-0.38, 0.8, 19.2], [0.24, 0.82, 19.2], [0.52, 0.88, 11.8]],
  },
  hatch: {
    len: 35, wid: 19, wheel: 4, track: 0.6,
    body: [[-1, 0.9, 3.6, 12], [-0.94, 0.98, 3.2, 12.4], [0.66, 1, 3.2, 11.4], [0.93, 0.94, 3.4, 9.8], [1, 0.82, 4.2, 8.4]],
    cabin: [[-0.94, 0.8, 12.4], [-0.8, 0.82, 20.4], [0.2, 0.84, 20.6], [0.55, 0.9, 11.6]],
  },
  suv: {
    len: 44, wid: 22, wheel: 5, track: 0.58,
    body: [[-1, 0.9, 5, 14], [-0.95, 0.98, 4.6, 15], [0.72, 1, 4.6, 14.6], [0.95, 0.95, 4.8, 13], [1, 0.86, 5.6, 11]],
    cabin: [[-0.95, 0.84, 15], [-0.88, 0.86, 24.4], [0.3, 0.88, 24.4], [0.6, 0.92, 14.8]],
    rails: true,
  },
  pickup: {
    len: 47, wid: 21, wheel: 4.8, track: 0.6,
    body: [[-1, 0.94, 4.6, 12], [-0.12, 1, 4.4, 12.4], [-0.1, 1, 4.4, 13.4], [0.72, 1, 4.4, 13.2], [0.95, 0.95, 4.6, 12], [1, 0.86, 5.2, 10.4]],
    cabin: [[-0.1, 0.86, 13.4], [-0.06, 0.86, 22.4], [0.28, 0.88, 22.4], [0.56, 0.92, 13.2]],
    bed: true,
  },
  police: {
    len: 43, wid: 20, wheel: 4.2, track: 0.58,
    body: [[-1, 0.86, 3.6, 10.4], [-0.92, 0.98, 3.2, 12], [0.7, 1, 3.2, 11.6], [0.94, 0.94, 3.4, 10], [1, 0.84, 4.2, 8.6]],
    cabin: [[-0.6, 0.76, 12], [-0.38, 0.8, 19.2], [0.24, 0.82, 19.2], [0.52, 0.88, 11.8]],
    lightbar: true, livery: true,
  },
};

// traffic mix
const TRAFFIC_MODELS = ['sedan', 'sedan', 'sedan', 'hatch', 'hatch', 'suv', 'suv', 'sports', 'pickup'];
// modern paint: deep and metallic tones, plus a few Miami brights
const MODEL_PAINT = ['#f2f2f2', '#1c1f26', '#8d939c', '#2b4a7e', '#7a1f2b', '#2f6b5a', '#c9b48a', '#ff6fb0', '#45d9e8', '#ffd166', '#c77bff', '#ff8a5c'];

// Builds the faces of a model once: lists of [along, across, height] points
// with a role (paint, glass, roof, ...). Cached per model.
const _modelFaces = {};
function modelFaces(name) {
  if (_modelFaces[name]) return _modelFaces[name];
  const m = CAR_MODELS[name] || CAR_MODELS.sedan;
  const L = m.len / 2, W = m.wid / 2;
  const faces = [];
  const loft = (secs, role, capRoles) => {
    const ring = s => {
      const [a, w, z0, z1] = s;
      return [[a * L, -w * W, z0], [a * L, -w * W, z1], [a * L, w * W, z1], [a * L, w * W, z0]];
    };
    for (let i = 0; i < secs.length - 1; i++) {
      const p = ring(secs[i]), q = ring(secs[i + 1]);
      faces.push({ pts: [p[0], q[0], q[1], p[1]], role: role.side, z: 'side' });
      faces.push({ pts: [p[3], p[2], q[2], q[3]], role: role.side, z: 'side' });
      const slope = Math.abs(secs[i + 1][3] - secs[i][3]) / Math.max(0.01, Math.abs(secs[i + 1][0] - secs[i][0]) * L);
      faces.push({ pts: [p[1], q[1], q[2], p[2]], role: slope > 0.35 ? role.slope : role.top, z: 'top' });
    }
    faces.push({ pts: ring(secs[0]), role: capRoles[0], z: 'rear' });
    faces.push({ pts: ring(secs[secs.length - 1]), role: capRoles[1], z: 'front' });
  };
  loft(m.body, { side: 'paint', top: 'paint', slope: 'paint' }, ['paint', 'paint']);
  // cabin: sections share the body's beltline at each end
  const cab = m.cabin.map(([a, w, z]) => [a, w, beltAt(m, a), z]);
  if (m.bed) faces[2].role = 'bed';   // the first body segment's top is the open load bed
  loft(cab, { side: 'glass', top: 'roof', slope: 'glass' }, ['glass', 'glass']);
  return (_modelFaces[name] = { m, faces, bodyCount: faces.length - (cab.length - 1) * 3 - 2 });
}

function beltAt(m, a) {
  const b = m.body;
  for (let i = 0; i < b.length - 1; i++) {
    if (a >= b[i][0] && a <= b[i + 1][0]) {
      const t = (a - b[i][0]) / ((b[i + 1][0] - b[i][0]) || 1);
      return b[i][3] + (b[i + 1][3] - b[i][3]) * t;
    }
  }
  return a < b[0][0] ? b[0][3] : b[b.length - 1][3];
}

function pickTrafficModel(r) { return TRAFFIC_MODELS[Math.floor(r * TRAFFIC_MODELS.length) % TRAFFIC_MODELS.length]; }
