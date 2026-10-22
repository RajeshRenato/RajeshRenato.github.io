'use strict';
// procedural city: tile map, rendering, world collision
// The map is a pure function of (tx, ty); nothing is stored, and it is
// identical on every visit.

const TILE = 48;
const PERIOD = 8;            // road grid every 8 tiles (2 road + 1 sidewalk + 4 building + 1 sidewalk)
const MAP_W = 96, MAP_H = 96;
const CITY_EDGE = MAP_W - 10; // beach starts here, then ocean
const WORLD_W = MAP_W * TILE, WORLD_H = MAP_H * TILE;

const T_ROAD = 0, T_SIDEWALK = 1, T_BUILDING = 2, T_GRASS = 3, T_SAND = 4, T_WATER = 5;

const BLOCK_BASE = ['#35486e', '#5a3a6e', '#6e3a55', '#2f5d68', '#6e5a33', '#3c3f70'];
const NEON = ['#ff4fa3', '#28e0ff', '#ffd166', '#64ffb4', '#c77bff', '#ff8a5c'];

function isPark(bx, by) { return hash2(bx * 7 + 3, by * 11 + 5) < 0.16; }

function tileType(tx, ty) {
  if (tx < 0 || ty < 0 || ty >= MAP_H) return T_WATER;
  if (tx >= CITY_EDGE + 4) return T_WATER;
  if (tx >= CITY_EDGE) return T_SAND;
  const mx = tx % PERIOD, my = ty % PERIOD;
  if (mx < 2 || my < 2) return T_ROAD;
  if (mx === 2 || mx === 7 || my === 2 || my === 7) return T_SIDEWALK;
  const bx = (tx / PERIOD) | 0, by = (ty / PERIOD) | 0;
  if (isPark(bx, by)) return T_GRASS;
  return T_BUILDING;
}

function isRoad(tx, ty) { return tileType(tx, ty) === T_ROAD; }
function isSolid(tx, ty) { const t = tileType(tx, ty); return t === T_BUILDING || t === T_WATER; }

// Right-hand traffic. Returns null on intersections (any direction allowed) and non-road.
function laneDir(tx, ty) {
  if (!isRoad(tx, ty)) return null;
  const mx = tx % PERIOD, my = ty % PERIOD;
  const vert = mx < 2, horiz = my < 2;
  if (vert && horiz) return null;
  if (vert) return mx === 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  return my === 0 ? { x: -1, y: 0 } : { x: 1, y: 0 };
}

// collision

// push a moving circle {x,y,vx,vy} out of solid tiles; returns impact speed
function circleVsSolid(p, r, bounce) {
  let impact = 0;
  const tx0 = Math.floor((p.x - r) / TILE), tx1 = Math.floor((p.x + r) / TILE);
  const ty0 = Math.floor((p.y - r) / TILE), ty1 = Math.floor((p.y + r) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!isSolid(tx, ty)) continue;
    const rx = tx * TILE, ry = ty * TILE;
    let dx = p.x - clamp(p.x, rx, rx + TILE);
    let dy = p.y - clamp(p.y, ry, ry + TILE);
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    let d = Math.sqrt(d2);
    if (d === 0) { dx = 0; dy = -1; d = 1; }
    const ux = dx / d, uy = dy / d;
    p.x += ux * (r - d); p.y += uy * (r - d);
    const vn = p.vx * ux + p.vy * uy;
    if (vn < 0) {
      impact = Math.max(impact, -vn);
      p.vx -= ux * vn * (1 + bounce);
      p.vy -= uy * vn * (1 + bounce);
    }
  }
  return impact;
}

// cars collide as two circles (front and rear) so long bodies slide along walls
function collideCarWorld(car) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let impact = 0;
  for (const off of [13, -13]) {
    const ox = car.x + fx * off, oy = car.y + fy * off;
    const p = { x: ox, y: oy, vx: car.vx, vy: car.vy };
    const im = circleVsSolid(p, 11, 0.2);
    car.x += p.x - ox; car.y += p.y - oy;
    car.vx = p.vx; car.vy = p.vy;
    if (im > impact) impact = im;
  }
  return impact;
}

// block shapes, shared by both views

const SLAB_R = 22;   // sidewalk corners are rounded with this radius

// The raised sidewalk slab of block (bx, by): [x0, y0, x1, y1, rounded]. Blocks that
// run into the beach are cut off square at the sand.
function slabRect(bx, by) {
  const x0 = (bx * PERIOD + 2) * TILE, y0 = (by * PERIOD + 2) * TILE;
  let x1 = x0 + 6 * TILE;
  const y1 = y0 + 6 * TILE, edge = CITY_EDGE * TILE;
  const cut = x1 > edge;
  if (cut) x1 = edge;
  return [x0, y0, x1, y1, !cut];
}

// Points around a rectangle, clockwise on screen: square, rounded, or with the
// corners cut off at 45 degrees.
function footprint(x0, y0, x1, y1, shape, r) {
  if (shape === 'box' || !r) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const pts = [], n = shape === 'round' ? 5 : 1;
  for (const [cx, cy, a0] of [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]]) {
    for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  }
  return pts;
}

// Each building block gets a Miami look: rounded art deco corners, cut corners, or plain.
function blockShape(bx, by) {
  const h = hash2(bx * 41 + 7, by * 37 + 3);
  return h < 0.42 ? { shape: 'round', r: 34 } : h < 0.72 ? { shape: 'chamfer', r: 26 } : { shape: 'box', r: 0 };
}

// Is (x, y) on a raised sidewalk slab (inside its rounded corners)?
function onSlab(x, y) {
  const bx = Math.floor(x / (PERIOD * TILE)), by = Math.floor(y / (PERIOD * TILE));
  const [x0, y0, x1, y1, round] = slabRect(bx, by);
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  if (!round) return true;
  const cx = x < x0 + SLAB_R ? x0 + SLAB_R : x > x1 - SLAB_R ? x1 - SLAB_R : x;
  const cy = y < y0 + SLAB_R ? y0 + SLAB_R : y > y1 - SLAB_R ? y1 - SLAB_R : y;
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= SLAB_R * SLAB_R;
}

// rendering

function drawPalm(ctx, x, y, seed) {
  const r = hash2(seed, seed * 3 + 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#4a3522';
  ctx.fillRect(-2, -2, 4, 4);
  ctx.strokeStyle = '#1f7a4d';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + r * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * 15, Math.sin(a) * 15 + 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#2ba35f';
  ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill();
  ctx.restore();
}

function drawTile(ctx, tx, ty, time) {
  const t = tileType(tx, ty), px = tx * TILE, py = ty * TILE;
  if (t === T_WATER) {
    ctx.fillStyle = '#0c2e44';
    ctx.fillRect(px, py, TILE, TILE);
    if (Math.sin(time * 1.5 + ty * 0.7 + tx * 0.35) > 0.55) {
      ctx.fillStyle = 'rgba(120,200,230,0.12)';
      ctx.fillRect(px, py + TILE * 0.4, TILE, 3);
    }
    return;
  }
  if (t === T_SAND) { ctx.fillStyle = '#c7a263'; ctx.fillRect(px, py, TILE, TILE); return; }
  // asphalt, with a little variation; blocks cover most of it
  ctx.fillStyle = hash2(tx * 5 + 2, ty * 3 + 1) < 0.5 ? '#20242e' : '#22262f';
  ctx.fillRect(px, py, TILE, TILE);
  if (t !== T_ROAD) return;
  const mx = tx % PERIOD, my = ty % PERIOD;
  if (mx < 2 && my < 2) return;   // intersection
  ctx.fillStyle = 'rgba(240,198,80,0.85)';
  // double yellow down the middle
  if (mx === 1 && my >= 2) { ctx.fillRect(px - 2.6, py, 1.8, TILE); ctx.fillRect(px + 0.8, py, 1.8, TILE); }
  else if (my === 1 && mx >= 2) { ctx.fillRect(px, py - 2.6, TILE, 1.8); ctx.fillRect(px, py + 0.8, TILE, 1.8); }
  // zebra crossings and stop lines where a road meets an intersection
  ctx.fillStyle = 'rgba(236,238,242,0.8)';
  if (mx < 2 && (my === 2 || my === 7)) {
    const y0 = my === 2 ? py + 3 : py + TILE - 17;
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 3 + i * 11.5, y0, 6, 14);
    // stop line on the lane arriving at the intersection
    if ((my === 2 && mx === 1) || (my === 7 && mx === 0)) ctx.fillRect(px + 2, my === 2 ? py + 20 : py + TILE - 22, TILE - 4, 2.4);
  } else if (my < 2 && (mx === 2 || mx === 7)) {
    const x0 = mx === 2 ? px + 3 : px + TILE - 17;
    for (let i = 0; i < 4; i++) ctx.fillRect(x0, py + 3 + i * 11.5, 14, 6);
    if ((mx === 2 && my === 0) || (mx === 7 && my === 1)) ctx.fillRect(mx === 2 ? px + 20 : px + TILE - 22, py + 2, 2.4, TILE - 4);
  }
}

function pathOf(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// A block seen from above: the rounded sidewalk slab, then a park or a building.
function drawBlockDecor(ctx, bx, by) {
  if (bx < 0 || by < 0) return;
  const tx = bx * PERIOD + 3, ty = by * PERIOD + 3;
  const t = tileType(tx, ty);
  if (t !== T_BUILDING && t !== T_GRASS) return;
  const [sx0, sy0, sx1, sy1, round] = slabRect(bx, by);
  const slab = footprint(sx0, sy0, sx1, sy1, round ? 'round' : 'box', SLAB_R);
  ctx.fillStyle = '#6d7488';           // the curb, a lighter rim
  pathOf(ctx, slab); ctx.fill();
  ctx.fillStyle = '#4a5063';
  pathOf(ctx, footprint(sx0 + 3, sy0 + 3, sx1 - 3, sy1 - 3, round ? 'round' : 'box', SLAB_R - 3)); ctx.fill();
  // paving joints
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let v = sx0 + 24; v < sx1 - 12; v += 24) { ctx.moveTo(v, sy0 + 3); ctx.lineTo(v, sy0 + TILE); ctx.moveTo(v, sy1 - TILE); ctx.lineTo(v, sy1 - 3); }
  for (let v = sy0 + 24; v < sy1 - 12; v += 24) { ctx.moveTo(sx0 + 3, v); ctx.lineTo(sx0 + TILE, v); ctx.moveTo(sx1 - TILE, v); ctx.lineTo(sx1 - 3, v); }
  ctx.stroke();

  const x = tx * TILE, y = ty * TILE, S = 4 * TILE;
  if (t === T_GRASS) {
    ctx.fillStyle = '#1d5438';
    pathOf(ctx, footprint(x - 4, y - 4, x + S + 4, y + S + 4, 'round', 14)); ctx.fill();
    ctx.strokeStyle = 'rgba(160,140,100,0.35)'; ctx.lineWidth = 6;       // paths to the fountain
    ctx.beginPath(); ctx.moveTo(x + S / 2, y); ctx.lineTo(x + S / 2, y + S); ctx.moveTo(x, y + S / 2); ctx.lineTo(x + S, y + S / 2); ctx.stroke();
    const cx = x + S / 2, cy = y + S / 2;
    ctx.fillStyle = '#17486a';
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fill();
    ctx.strokeStyle = '#9fd8ef'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.stroke();
    return;
  }
  const { shape, r } = blockShape(bx, by);
  const foot = footprint(x, y, x + S, y + S, shape, r);
  const base = BLOCK_BASE[(hash2(bx, by) * BLOCK_BASE.length) | 0];
  const neon = NEON[(hash2(bx * 5 + 1, by * 3 + 7) * NEON.length) | 0];
  // shadow toward the inland side
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.save(); ctx.translate(-10, 8); pathOf(ctx, foot); ctx.fill(); ctx.restore();
  ctx.fillStyle = base;
  pathOf(ctx, foot); ctx.fill();
  // roof: a parapet, then details
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  pathOf(ctx, footprint(x + 10, y + 10, x + S - 10, y + S - 10, shape, Math.max(0, r - 10))); ctx.fill();
  const rng = mulberry32(((bx * 73856093) ^ (by * 19349663)) >>> 0);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 22 + rng() * (S - 62), y + 22 + rng() * (S - 62), 14, 10);
  if (rng() < 0.5) {   // water tank or a stair house
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(x + S * 0.7, y + S * 0.32, 11, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
  } else { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + S * 0.25, y + S * 0.6, 30, 22); }
  ctx.globalAlpha = 0.22; ctx.strokeStyle = neon; ctx.lineWidth = 7;
  pathOf(ctx, footprint(x + 3, y + 3, x + S - 3, y + S - 3, shape, Math.max(0, r - 3))); ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.stroke();
}

function drawPalms(ctx, x0, y0, x1, y1) {
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileType(tx, ty), px = tx * TILE + TILE / 2, py = ty * TILE + TILE / 2;
    if (t === T_SAND && hash2(tx, ty) < 0.05) drawPalm(ctx, px, py, tx * 17 + ty);
    else if (t === T_SIDEWALK && hash2(tx * 3 + 1, ty * 5 + 2) < 0.08 && onSlab(px, py)) drawPalm(ctx, px, py, tx * 31 + ty);
    else if (t === T_GRASS && hash2(tx + 9, ty + 4) < 0.15) drawPalm(ctx, px, py, tx * 13 + ty * 7);
  }
}

function drawWorld(ctx, cx, cy, w, h, time) {
  const x0 = Math.floor(cx / TILE) - 1, y0 = Math.floor(cy / TILE) - 1;
  const x1 = Math.floor((cx + w) / TILE) + 1, y1 = Math.floor((cy + h) / TILE) + 1;
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      drawTile(ctx, tx, ty, time);
  const bx0 = Math.floor(x0 / PERIOD), bx1 = Math.floor(x1 / PERIOD);
  const by0 = Math.floor(y0 / PERIOD), by1 = Math.floor(y1 / PERIOD);
  for (let by = by0; by <= by1; by++)
    for (let bx = bx0; bx <= bx1; bx++)
      drawBlockDecor(ctx, bx, by);
  drawPalms(ctx, x0, y0, x1, y1);
}

// minimap (pre-rendered once, 1px per tile)

let minimapCanvas = null;
function buildMinimap() {
  minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = MAP_W;
  minimapCanvas.height = MAP_H;
  const c = minimapCanvas.getContext('2d');
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const t = tileType(tx, ty);
    c.fillStyle =
      t === T_ROAD ? '#3a4152' :
      t === T_WATER ? '#0c2e44' :
      t === T_SAND ? '#c7a263' :
      t === T_GRASS ? '#1d5438' :
      t === T_SIDEWALK ? '#2a2f3b' : '#171a22';
    c.fillRect(tx, ty, 1, 1);
  }
}
