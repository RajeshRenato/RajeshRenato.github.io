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
const CAR_COLORS = ['#ff6fb0', '#45d9e8', '#ffd166', '#9effb0', '#c77bff', '#ff8a5c', '#f2f2f2', '#7f8cff'];

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
  switch (t) {
    case T_WATER: {
      ctx.fillStyle = '#0c2e44';
      ctx.fillRect(px, py, TILE, TILE);
      if (Math.sin(time * 1.5 + ty * 0.7 + tx * 0.35) > 0.55) {
        ctx.fillStyle = 'rgba(120,200,230,0.12)';
        ctx.fillRect(px, py + TILE * 0.4, TILE, 3);
      }
      break;
    }
    case T_SAND: {
      ctx.fillStyle = '#c7a263';
      ctx.fillRect(px, py, TILE, TILE);
      if (hash2(tx, ty) < 0.05) drawPalm(ctx, px + TILE / 2, py + TILE / 2, tx * 17 + ty);
      break;
    }
    case T_ROAD: {
      ctx.fillStyle = '#20242e';
      ctx.fillRect(px, py, TILE, TILE);
      const mx = tx % PERIOD, my = ty % PERIOD;
      if (!(mx < 2 && my < 2)) {
        ctx.strokeStyle = 'rgba(232,195,90,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 14]);
        ctx.beginPath();
        if (mx === 1 && my >= 2) { ctx.moveTo(px, py); ctx.lineTo(px, py + TILE); }
        else if (my === 1 && mx >= 2) { ctx.moveTo(px, py); ctx.lineTo(px + TILE, py); }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case T_SIDEWALK: {
      ctx.fillStyle = '#454b5c';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      if (hash2(tx * 3 + 1, ty * 5 + 2) < 0.08) drawPalm(ctx, px + TILE / 2, py + TILE / 2, tx * 31 + ty);
      break;
    }
    case T_GRASS: {
      ctx.fillStyle = '#1d5438';
      ctx.fillRect(px, py, TILE, TILE);
      if (hash2(tx + 9, ty + 4) < 0.15) drawPalm(ctx, px + TILE / 2, py + TILE / 2, tx * 13 + ty * 7);
      break;
    }
    case T_BUILDING: {
      const bx = (tx / PERIOD) | 0, by = (ty / PERIOD) | 0;
      ctx.fillStyle = BLOCK_BASE[(hash2(bx, by) * BLOCK_BASE.length) | 0];
      ctx.fillRect(px, py, TILE, TILE);
      break;
    }
  }
}

// rooftop details + neon trim drawn once per visible block
function drawBlockDecor(ctx, bx, by) {
  if (bx < 0 || by < 0) return;
  const tx = bx * PERIOD + 3, ty = by * PERIOD + 3;
  const t = tileType(tx, ty);
  const x = tx * TILE, y = ty * TILE, s = 4 * TILE;
  if (t === T_BUILDING) {
    const hv = hash2(bx * 5 + 1, by * 3 + 7);
    const neon = NEON[(hv * NEON.length) | 0];
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + 12, y + 12, s - 24, s - 24);
    const rng = mulberry32(((bx * 73856093) ^ (by * 19349663)) >>> 0);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 16 + rng() * (s - 48), y + 16 + rng() * (s - 48), 12, 12);
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = neon;
    ctx.lineWidth = 7;
    ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
  } else if (t === T_GRASS) {
    const cx = x + s / 2, cy = y + s / 2;
    ctx.fillStyle = '#17486a';
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
    ctx.strokeStyle = '#9fd8ef';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.stroke();
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
