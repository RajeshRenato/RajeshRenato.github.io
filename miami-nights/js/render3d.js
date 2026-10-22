'use strict';
// street view: pseudo-3D chase camera over the same simulation
// World stays 2D (x,y ground plane, y = top-down "down"); this projects it
// with a perspective camera at street height. z is up, ground is z=0.

let viewMode = (typeof localStorage !== 'undefined' && localStorage.getItem('vc_view')) || 'street';

const SCam = { x: 0, y: 0, yaw: 0, init: false };
let EYE = 60, FOC = 0, HOR = 0, cosYaw = 1, sinYaw = 0;

const NEAR = 10, FAR = 1400;
const CURB_H = 3;                             // sidewalks sit a curb above the road
const FOG = [34, 18, 64];                     // horizon fog color
const SUN_A = 0;                              // sun azimuth, over the ocean (+x)

const _rgbCache = {};
function hexRGB(hex) {
  let c = _rgbCache[hex];
  if (!c) c = _rgbCache[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  return c;
}
function fogged(rgb, t, shade, alpha) {
  const s = shade === undefined ? 1 : shade;
  const r = Math.min(255, rgb[0] * s * (1 - t) + FOG[0] * t);
  const g = Math.min(255, rgb[1] * s * (1 - t) + FOG[1] * t);
  const b = Math.min(255, rgb[2] * s * (1 - t) + FOG[2] * t);
  return alpha === undefined
    ? 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'
    : 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + alpha + ')';
}

function isRaised(t) { return t === T_SIDEWALK || t === T_GRASS || t === T_BUILDING; }
function groundZ(x, y) {
  return isRaised(tileType(Math.floor(x / TILE), Math.floor(y / TILE))) && onSlab(x, y) ? CURB_H : 0;
}

// projection

function camSpace(wx, wy, wz) {
  const dx = wx - SCam.x, dy = wy - SCam.y;
  return { f: dx * cosYaw + dy * sinYaw, s: -dx * sinYaw + dy * cosYaw, z: wz };
}

function projPt(p) {
  return { x: W / 2 + p.s * FOC / p.f, y: HOR + (EYE - p.z) * FOC / p.f };
}

function clipNear(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ain = a.f >= NEAR, bin = b.f >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a.f) / (b.f - a.f);
      out.push({ f: NEAR, s: a.s + (b.s - a.s) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
}

// corners: array of [wx, wy, wz]
function fillPoly3D(corners, style) {
  const cs = clipNear(corners.map(c => camSpace(c[0], c[1], c[2])));
  if (cs.length < 3) return;
  ctx.fillStyle = style;
  ctx.beginPath();
  const p0 = projPt(cs[0]);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < cs.length; i++) {
    const p = projPt(cs[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
}

function line3D(a, b, style, width) {
  const cs = clipNear([camSpace(a[0], a[1], a[2]), camSpace(b[0], b[1], b[2]),
                       camSpace(b[0], b[1], b[2])]);   // degenerate tri just to clip
  if (cs.length < 2) return;
  const p0 = projPt(cs[0]), p1 = projPt(cs[1]);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
}

// billboard ellipse on the ground plane
function groundEllipse(wx, wy, wz, r, style, hollow, lw) {
  const p = camSpace(wx, wy, wz);
  if (p.f < NEAR + 2) return;
  const b = projPt(p), k = FOC / p.f;
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, r * k, r * k * 0.35, 0, 0, 7);
  if (hollow) { ctx.strokeStyle = style; ctx.lineWidth = Math.max(1, (lw || 2) * k); ctx.stroke(); }
  else { ctx.fillStyle = style; ctx.fill(); }
}

// camera follow

function updateSCam(dt) {
  const tx = Player.fx(), ty = Player.fy();
  const targetYaw = Player.inCar ? Player.car.angle : Player.angle;
  if (!SCam.init) { SCam.yaw = targetYaw; SCam.init = true; }
  SCam.yaw += angleNorm(targetYaw - SCam.yaw) * (1 - Math.exp(-(Player.inCar ? 3.4 : 5) * dt));
  EYE = Player.inCar ? 68 : 48;
  let dist = Player.inCar ? 150 : 95;
  const cy = Math.cos(SCam.yaw), sy = Math.sin(SCam.yaw);
  // shorten the boom if a building is behind the player
  for (let s = 24; s < dist; s += 10) {
    if (isSolid(Math.floor((tx - cy * s) / TILE), Math.floor((ty - sy * s) / TILE))) { dist = Math.max(26, s - 12); break; }
  }
  SCam.x = tx - cy * dist;
  SCam.y = ty - sy * dist;
  cosYaw = cy; sinYaw = sy;
  FOC = H * 0.95;
  HOR = H * 0.42;
}

// sky

function drawSky(time) {
  const g = ctx.createLinearGradient(0, 0, 0, HOR);
  g.addColorStop(0, '#07041a');
  g.addColorStop(0.72, '#2a1050');
  g.addColorStop(1, 'rgb(' + FOG[0] + ',' + FOG[1] + ',' + FOG[2] + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HOR);
  ctx.fillStyle = 'rgb(' + FOG[0] + ',' + FOG[1] + ',' + FOG[2] + ')';
  ctx.fillRect(0, HOR, W, H - HOR);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 70; i++) {
    const az = i * 0.0897 * 2 * Math.PI;
    const rel = angleNorm(az - SCam.yaw);
    if (Math.abs(rel) > 1.25) continue;
    const x = W / 2 + Math.tan(rel) * FOC;
    if (x < 0 || x > W) continue;
    const y = hash2(i, 3) * HOR * 0.8;
    ctx.globalAlpha = 0.25 + hash2(i, 9) * 0.6;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // banded sun
  const rel = angleNorm(SUN_A - SCam.yaw);
  if (Math.abs(rel) < 1.1) {
    const sx = W / 2 + Math.tan(rel) * FOC, sy = HOR - 46, R = 64;
    const sg = ctx.createLinearGradient(0, sy - R, 0, sy + R);
    sg.addColorStop(0, '#ffd166');
    sg.addColorStop(1, '#ff4fa3');
    ctx.save();
    ctx.beginPath(); ctx.arc(sx, sy, R, 0, 7); ctx.clip();
    ctx.fillStyle = sg;
    ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
    ctx.fillStyle = '#2a1050';
    for (let i = 0; i < 5; i++) ctx.fillRect(sx - R, sy + 8 + i * 12, R * 2, 3 + i);
    ctx.restore();
  }

  // distant skyline on the landward horizon
  for (let i = 0; i < 80; i++) {
    const az = i * (Math.PI * 2 / 80);
    if (Math.cos(az) > 0.2) continue;                   // no skyline on the sea side
    const srel = angleNorm(az - SCam.yaw);
    if (Math.abs(srel) > 1.25) continue;
    const x = W / 2 + Math.tan(srel) * FOC;
    const wpx = 20 + hash2(i, 11) * 64;
    if (x + wpx < 0 || x - wpx > W) continue;
    const hpx = 12 + hash2(i, 23) * 62;
    ctx.fillStyle = 'rgba(24,13,48,0.6)';
    ctx.fillRect(x - wpx / 2, HOR - hpx, wpx, hpx + 1);
    if (hash2(i, 31) < 0.5) {
      ctx.fillStyle = 'rgba(255,210,140,0.5)';
      ctx.fillRect(x - wpx / 4, HOR - hpx * 0.6, 2, 2);
      ctx.fillRect(x + wpx / 5, HOR - hpx * 0.35, 2, 2);
    }
  }

  ctx.fillStyle = 'rgba(255,79,163,0.07)';
  ctx.fillRect(0, HOR - 12, W, 12);
  ctx.fillStyle = 'rgba(255,79,163,0.16)';
  ctx.fillRect(0, HOR - 3, W, 3);
}

// ground

const GROUND_RGB = {};
GROUND_RGB[T_ROAD] = [32, 36, 46];
GROUND_RGB[T_SIDEWALK] = [69, 75, 92];
GROUND_RGB[T_GRASS] = [29, 84, 56];
GROUND_RGB[T_SAND] = [199, 162, 99];
GROUND_RGB[T_WATER] = [12, 46, 68];
GROUND_RGB[T_BUILDING] = [26, 29, 40];

function drawGround(time) {
  const R = Math.ceil(FAR / TILE);
  const ctx0 = Math.floor(SCam.x / TILE), cty0 = Math.floor(SCam.y / TILE);
  const marks = [];

  for (let ty = cty0 - R; ty <= cty0 + R; ty++) {
    for (let tx = ctx0 - R; tx <= ctx0 + R; tx++) {
      const wx = (tx + 0.5) * TILE, wy = (ty + 0.5) * TILE;
      const dx = wx - SCam.x, dy = wy - SCam.y;
      const f = dx * cosYaw + dy * sinYaw;
      if (f < -TILE || f > FAR) continue;
      const s = -dx * sinYaw + dy * cosYaw;
      if (Math.abs(s) > (f + TILE * 2) * 1.1) continue;

      const t = tileType(tx, ty);
      // blocks are drawn as whole slabs below; under them is road
      const rgb = t === T_WATER || t === T_SAND ? GROUND_RGB[t] : GROUND_RGB[T_ROAD];
      let shade = 0.94 + hash2(tx * 3 + 11, ty * 7 + 5) * 0.1;
      if (t === T_WATER) {
        shade = 1 + 0.14 * Math.sin(time * 1.5 + tx * 0.35 + ty * 0.7);
        const az = Math.atan2(dy, dx);
        const glint = Math.cos(az - SUN_A);
        if (glint > 0.86) shade += (glint - 0.86) * 5 * (0.5 + 0.5 * Math.sin(time * 3 + tx * 1.3 + ty * 2.1));
      }
      const fog = Math.min(1, Math.max(0, f / FAR));
      const x0 = tx * TILE - 0.6, y0 = ty * TILE - 0.6, x1 = x0 + TILE + 1.2, y1 = y0 + TILE + 1.2;
      fillPoly3D([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], fogged(rgb, fog, shade));
      if (t === T_ROAD && f < FAR * 0.6) marks.push([tx, ty, fog]);
    }
  }
  for (const [tx, ty, fog] of marks) drawRoadMarks(tx, ty, fog);
  drawSlabs(time);
}

// double yellow center lines, zebra crossings, and stop lines
function drawRoadMarks(tx, ty, fog) {
  const mx = ((tx % PERIOD) + PERIOD) % PERIOD, my = ((ty % PERIOD) + PERIOD) % PERIOD;
  if (mx < 2 && my < 2) return;
  const px = tx * TILE, py = ty * TILE;
  const rect = (x0, y0, x1, y1, style) => fillPoly3D([[x0, y0, 0.05], [x1, y0, 0.05], [x1, y1, 0.05], [x0, y1, 0.05]], style);
  const yellow = fogged([240, 198, 80], fog, 1, 0.85), white = fogged([236, 238, 242], fog, 1, 0.8);
  if (mx === 1 && my >= 2) { rect(px - 2.6, py, px - 0.8, py + TILE, yellow); rect(px + 0.8, py, px + 2.6, py + TILE, yellow); }
  else if (my === 1 && mx >= 2) { rect(px, py - 2.6, px + TILE, py - 0.8, yellow); rect(px, py + 0.8, px + TILE, py + 2.6, yellow); }
  if (fog > 0.4) return;
  if (mx < 2 && (my === 2 || my === 7)) {
    const y0 = my === 2 ? py + 3 : py + TILE - 17;
    for (let i = 0; i < 4; i++) rect(px + 3 + i * 11.5, y0, px + 9 + i * 11.5, y0 + 14, white);
    if ((my === 2 && mx === 1) || (my === 7 && mx === 0)) { const yy = my === 2 ? py + 20 : py + TILE - 22; rect(px + 2, yy, px + TILE - 2, yy + 2.4, white); }
  } else if (my < 2 && (mx === 2 || mx === 7)) {
    const x0 = mx === 2 ? px + 3 : px + TILE - 17;
    for (let i = 0; i < 4; i++) rect(x0, py + 3 + i * 11.5, x0 + 14, py + 9 + i * 11.5, white);
    if ((mx === 2 && my === 0) || (mx === 7 && my === 1)) { const xx = mx === 2 ? px + 20 : px + TILE - 22; rect(xx, py + 2, xx + 2.4, py + TILE - 2, white); }
  }
}

// Each block's sidewalk is one raised slab with rounded corners, a lighter curb,
// and paving joints up close. Parks get a rounded lawn.
function drawSlabs(time) {
  const BP = PERIOD * TILE, R = Math.ceil(FAR / BP) + 1;
  const cbx = Math.floor(SCam.x / BP), cby = Math.floor(SCam.y / BP);
  const list = [];
  for (let by = cby - R; by <= cby + R; by++) for (let bx = cbx - R; bx <= cbx + R; bx++) {
    const t = tileType(bx * PERIOD + 3, by * PERIOD + 3);
    if (t !== T_BUILDING && t !== T_GRASS) continue;
    const wx = (bx * PERIOD + 5) * TILE, wy = (by * PERIOD + 5) * TILE;
    const dx = wx - SCam.x, dy = wy - SCam.y;
    const f = dx * cosYaw + dy * sinYaw;
    if (f < -BP || f > FAR + BP / 2) continue;
    if (Math.abs(-dx * sinYaw + dy * cosYaw) > (f + BP * 1.5) * 1.1) continue;
    list.push({ bx, by, t, f, fog: Math.min(1, Math.max(0, f / FAR)) });
  }
  list.sort((a, b) => b.f - a.f);
  for (const { bx, by, t, f, fog } of list) {
    const [x0, y0, x1, y1, round] = slabRect(bx, by);
    const shape = round ? 'round' : 'box';
    const outer = footprint(x0, y0, x1, y1, shape, SLAB_R);
    fillPoly3D(outer.map(p => [p[0], p[1], CURB_H]), fogged([110, 118, 140], fog, 1));
    fillPoly3D(footprint(x0 + 3, y0 + 3, x1 - 3, y1 - 3, shape, SLAB_R - 3).map(p => [p[0], p[1], CURB_H]), fogged(GROUND_RGB[T_SIDEWALK], fog, 1));
    // curb faces toward the camera
    const curb = fogged([92, 99, 120], fog, 1);
    for (let i = 0; i < outer.length; i++) {
      const A = outer[i], B = outer[(i + 1) % outer.length];
      const nx = B[1] - A[1], ny = -(B[0] - A[0]);
      if (nx * (SCam.x - A[0]) + ny * (SCam.y - A[1]) <= 0) continue;
      fillPoly3D([[A[0], A[1], 0], [B[0], B[1], 0], [B[0], B[1], CURB_H], [A[0], A[1], CURB_H]], curb);
    }
    if (f < 520) {
      const joint = fogged([0, 0, 0], fog, 1, 0.14);
      for (let v = x0 + 24; v < x1 - 12; v += 24) { line3D([v, y0 + 3, CURB_H + 0.05], [v, y0 + TILE, CURB_H + 0.05], joint, 1); line3D([v, y1 - TILE, CURB_H + 0.05], [v, y1 - 3, CURB_H + 0.05], joint, 1); }
      for (let v = y0 + 24; v < y1 - 12; v += 24) { line3D([x0 + 3, v, CURB_H + 0.05], [x0 + TILE, v, CURB_H + 0.05], joint, 1); line3D([x1 - TILE, v, CURB_H + 0.05], [x1 - 3, v, CURB_H + 0.05], joint, 1); }
    }
    if (t === T_GRASS) {
      const gx = (bx * PERIOD + 3) * TILE, gy = (by * PERIOD + 3) * TILE, S = 4 * TILE;
      fillPoly3D(footprint(gx - 4, gy - 4, gx + S + 4, gy + S + 4, 'round', 14).map(p => [p[0], p[1], CURB_H + 0.1]), fogged(GROUND_RGB[T_GRASS], fog, 1));
      const pathC = fogged([150, 132, 96], fog, 1, 0.45);
      fillPoly3D([[gx + S / 2 - 3, gy, CURB_H + 0.15], [gx + S / 2 + 3, gy, CURB_H + 0.15], [gx + S / 2 + 3, gy + S, CURB_H + 0.15], [gx + S / 2 - 3, gy + S, CURB_H + 0.15]], pathC);
      fillPoly3D([[gx, gy + S / 2 - 3, CURB_H + 0.15], [gx + S, gy + S / 2 - 3, CURB_H + 0.15], [gx + S, gy + S / 2 + 3, CURB_H + 0.15], [gx, gy + S / 2 + 3, CURB_H + 0.15]], pathC);
    }
  }
}

// buildings

function faceQuad(A, B, z0, z1) {
  return [[A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1]];
}

// Walls of a building over a footprint (points clockwise on screen), from z0 up to hgt.
function drawPrism(foot, z0, hgt, base, fog, neon, winSeed, deco, ground) {
  for (let i = 0; i < foot.length; i++) {
    const A = foot[i], B = foot[(i + 1) % foot.length];
    const ex = B[0] - A[0], ey = B[1] - A[1], len = Math.hypot(ex, ey);
    const nx = ey / len, ny = -ex / len;               // outward
    if (nx * (SCam.x - A[0]) + ny * (SCam.y - A[1]) <= 0) continue;
    // lit from the sun side, darker away from it
    const shade = 0.62 + 0.3 * Math.max(0, nx * Math.cos(SUN_A) + ny * Math.sin(SUN_A)) + 0.08 * Math.max(0, -ny);
    fillPoly3D(faceQuad(A, B, z0, hgt), fogged(base, fog, shade));
    const floors = Math.max(2, Math.min(9, ((hgt - z0) / 24) | 0));
    const fh = (hgt - z0) / floors;
    const fid = i;
    if (len > 60 && fog < 0.32) {
      const cols = Math.max(2, Math.round(len / 36));
      for (let fl = ground ? 1 : 0; fl < floors; fl++) {
        const z = z0 + fl * fh + fh * 0.24;
        for (let cI = 0; cI < cols; cI++) {
          const u0 = 0.06 + cI * (0.88 / cols), u1 = u0 + (0.88 / cols) * (deco ? 0.8 : 0.62);
          const lit = hash2(winSeed + fid * 977 + cI * 131, fl * 53 + winSeed) < 0.34;
          fillPoly3D(faceQuad([A[0] + ex * u0, A[1] + ey * u0], [A[0] + ex * u1, A[1] + ey * u1], z, z + fh * (deco ? 0.42 : 0.5)),
            lit ? fogged(hash2(winSeed + cI, fl + fid) < 0.65 ? [255, 221, 148] : [140, 228, 255], fog, 1, 0.9) : fogged([12, 14, 24], fog, 1, 0.75));
        }
      }
    } else if (fog < 0.55) {
      const band = fogged([0, 0, 0], fog, 1, 0.2);
      for (let fl = 1; fl < floors; fl++) fillPoly3D(faceQuad(A, B, z0 + fl * fh, z0 + fl * fh + 2.5), band);
    }
    // art deco: a pale ledge over every floor, wrapping the rounded corners too
    if (deco && fog < 0.6) {
      const ledge = fogged([236, 226, 210], fog, shade, 0.55);
      for (let fl = 1; fl < floors; fl++) fillPoly3D(faceQuad(A, B, z0 + fl * fh - 1.6, z0 + fl * fh + 0.6), ledge);
    }
    // the ground floor: a lit shopfront under an awning
    if (ground && len > 60 && fog < 0.45) {
      const glow = hash2(winSeed + fid * 7, 13) < 0.7;
      fillPoly3D(faceQuad([A[0] + ex * 0.08, A[1] + ey * 0.08], [A[0] + ex * 0.92, A[1] + ey * 0.92], z0 + 2, z0 + fh * 0.78),
        glow ? fogged([255, 206, 150], fog, 1, 0.55) : fogged([30, 34, 48], fog, 1, 0.9));
      fillPoly3D([[A[0] + ex * 0.06, A[1] + ey * 0.06, z0 + fh * 0.86], [A[0] + ex * 0.94, A[1] + ey * 0.94, z0 + fh * 0.86],
        [A[0] + ex * 0.94 + nx * 7, A[1] + ey * 0.94 + ny * 7, z0 + fh * 0.72], [A[0] + ex * 0.06 + nx * 7, A[1] + ey * 0.06 + ny * 7, z0 + fh * 0.72]], fogged(hexRGB(neon), fog, 0.7, 0.9));
    }
    if (len > 60 && fog < 0.42 && hash2(winSeed + fid * 311, winSeed * 2 + 9) < 0.4) {
      const u = 0.12 + hash2(winSeed + fid, 77) * 0.7;
      const zTop = Math.min(hgt - 8, z0 + 70), zBot = z0 + (ground ? fh + 4 : 8);
      fillPoly3D(faceQuad([A[0] + ex * u, A[1] + ey * u], [A[0] + ex * (u + 0.07), A[1] + ey * (u + 0.07)], zBot, zTop), fogged(hexRGB(neon), fog, 1, 0.25));
      fillPoly3D(faceQuad([A[0] + ex * (u + 0.018), A[1] + ey * (u + 0.018)], [A[0] + ex * (u + 0.052), A[1] + ey * (u + 0.052)], zBot + 3, zTop - 3), fogged(hexRGB(neon), fog, 1, 0.9));
    }
    ctx.globalAlpha = (1 - fog) * 0.9;
    line3D([A[0], A[1], hgt], [B[0], B[1], hgt], neon, 6);
    ctx.globalAlpha = (1 - fog);
    line3D([A[0], A[1], hgt], [B[0], B[1], hgt], '#ffffff', 1.5);
    ctx.globalAlpha = 1;
  }
  if (EYE > hgt) fillPoly3D(foot.map(p => [p[0], p[1], hgt]), fogged(base, fog, 0.5));
}

function drawBlock(bx, by, fog) {
  const x0 = (bx * PERIOD + 3) * TILE, y0 = (by * PERIOD + 3) * TILE;
  const S = 4 * TILE, x1 = x0 + S, y1 = y0 + S;
  const base = hexRGB(BLOCK_BASE[(hash2(bx, by) * BLOCK_BASE.length) | 0]);
  const neon = NEON[(hash2(bx * 5 + 1, by * 3 + 7) * NEON.length) | 0];
  const hgt = 90 + hash2(bx * 9 + 2, by * 7 + 5) * 180;
  const winSeed = ((bx * 73856093) ^ (by * 19349663)) >>> 0;
  const { shape, r } = blockShape(bx, by);
  const deco = shape === 'round';
  drawPrism(footprint(x0, y0, x1, y1, shape, r), CURB_H, hgt, base, fog, neon, winSeed % 10007, deco, true);

  // a setback tower on some blocks, in the same style
  if (hash2(bx * 17 + 3, by * 13 + 1) < 0.35) {
    const inset = S * 0.22;
    drawPrism(footprint(x0 + inset, y0 + inset, x1 - inset, y1 - inset, shape, Math.max(0, r - inset * 0.5)),
      hgt, hgt + 50 + hash2(bx * 23, by * 29) * 90, base, fog, neon, winSeed % 7001, deco, false);
  }
}

function drawFountain(bx, by, fog, time) {
  const cx = (bx * PERIOD + 5) * TILE, cy2 = (by * PERIOD + 5) * TILE;
  groundEllipse(cx, cy2, CURB_H + 0.5, 15, fogged([23, 72, 106], fog, 1), false);
  groundEllipse(cx, cy2, CURB_H + 0.5, 15, fogged([159, 216, 239], fog, 1), true, 1.6);
  const p = camSpace(cx, cy2, CURB_H);
  if (p.f > NEAR + 2) {
    const b = projPt(p), k = FOC / p.f;
    ctx.strokeStyle = fogged([180, 226, 248], fog, 1, 0.9);
    ctx.lineWidth = Math.max(1, 2.4 * k);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y - 14 * k); ctx.stroke();
    const spl = 1 + 0.3 * Math.sin(time * 6);
    ctx.fillStyle = fogged([200, 238, 255], fog, 1, 0.7);
    ctx.beginPath(); ctx.ellipse(b.x, b.y - 14 * k, 4 * k * spl, 2 * k * spl, 0, 0, 7); ctx.fill();
  }
}

function collectBlocks(list, time) {
  const BP = PERIOD * TILE;
  const R = Math.ceil(FAR / BP) + 1;
  const cbx = Math.floor(SCam.x / BP), cby = Math.floor(SCam.y / BP);
  for (let by = cby - R; by <= cby + R; by++) {
    for (let bx = cbx - R; bx <= cbx + R; bx++) {
      const t = tileType(bx * PERIOD + 3, by * PERIOD + 3);
      if (t !== T_BUILDING && t !== T_GRASS) continue;
      const wx = (bx * PERIOD + 5) * TILE, wy = (by * PERIOD + 5) * TILE;
      const dx = wx - SCam.x, dy = wy - SCam.y;
      const f = dx * cosYaw + dy * sinYaw;
      if (f < -BP || f > FAR) continue;
      if (Math.abs(-dx * sinYaw + dy * cosYaw) > (f + BP * 1.5) * 1.1) continue;
      const fog = Math.min(1, Math.max(0, f / FAR));
      if (t === T_BUILDING) list.push({ d: f, fn: () => drawBlock(bx, by, fog) });
      else if (f < 800) list.push({ d: f, fn: () => drawFountain(bx, by, fog, time) });
    }
  }
}

// street lamps

function drawLamp(wx, wy, armX, armY, f, fog, time) {
  const gz = CURB_H;
  const p = camSpace(wx, wy, gz);
  if (p.f < NEAR + 2) return;
  const b = projPt(p), k = FOC / p.f;
  const top = projPt(camSpace(wx, wy, gz + 38));
  const head = projPt(camSpace(wx + armX * 14, wy + armY * 14, gz + 36));
  ctx.strokeStyle = fogged([40, 44, 58], fog, 1);
  ctx.lineWidth = Math.max(1, 2.2 * k);
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(top.x, top.y); ctx.lineTo(head.x, head.y); ctx.stroke();
  ctx.fillStyle = fogged([255, 219, 160], fog, 1, 0.95);
  ctx.beginPath(); ctx.arc(head.x, head.y, Math.max(1.2, 2.6 * k), 0, 7); ctx.fill();
  ctx.fillStyle = fogged([255, 219, 160], fog, 1, 0.16);
  ctx.beginPath(); ctx.arc(head.x, head.y, 9 * k, 0, 7); ctx.fill();
  // light pool below the head
  groundEllipse(wx + armX * 16, wy + armY * 16, 0.6, 20, fogged([255, 219, 160], fog, 1, 0.08), false);
}

function collectLamps(list, time) {
  const R = Math.ceil(680 / TILE);
  const ctx0 = Math.floor(SCam.x / TILE), cty0 = Math.floor(SCam.y / TILE);
  for (let ty = cty0 - R; ty <= cty0 + R; ty++) {
    for (let tx = ctx0 - R; tx <= ctx0 + R; tx++) {
      if (tileType(tx, ty) !== T_SIDEWALK) continue;
      if (hash2(tx * 13 + 5, ty * 17 + 9) >= 0.07) continue;
      // lamp arm points at the adjacent road
      let armX = 0, armY = 0;
      if (isRoad(tx + 1, ty)) armX = 1;
      else if (isRoad(tx - 1, ty)) armX = -1;
      else if (isRoad(tx, ty + 1)) armY = 1;
      else if (isRoad(tx, ty - 1)) armY = -1;
      else continue;
      const wx = (tx + 0.5) * TILE, wy = (ty + 0.5) * TILE;
      const dx = wx - SCam.x, dy = wy - SCam.y;
      const f = dx * cosYaw + dy * sinYaw;
      if (f < NEAR || f > 680) continue;
      if (Math.abs(-dx * sinYaw + dy * cosYaw) > (f + TILE) * 1.1) continue;
      const fog = Math.min(1, f / FAR);
      list.push({ d: f, fn: () => drawLamp(wx, wy, armX, armY, f, fog, time) });
    }
  }
}

// palms (billboards)

function drawPalm3D(wx, wy, fog) {
  const gz = groundZ(wx, wy);
  const p = camSpace(wx, wy, gz);
  if (p.f < NEAR + 2) return;
  const base = projPt(p);
  const k = FOC / p.f;
  const topY = base.y - 36 * k;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(base.x + 2 * k, base.y, 6 * k, 2.2 * k, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = fogged([74, 53, 34], fog);
  ctx.lineWidth = Math.max(1, 3 * k);
  ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.quadraticCurveTo(base.x + 2 * k, base.y - 18 * k, base.x + 3 * k, topY); ctx.stroke();
  ctx.strokeStyle = fogged([31, 122, 77], fog);
  ctx.lineWidth = Math.max(1, 2.5 * k);
  const r = hash2(wx | 0, wy | 0) * 2;
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + r;
    ctx.beginPath();
    ctx.moveTo(base.x + 3 * k, topY);
    ctx.quadraticCurveTo(base.x + 3 * k + Math.cos(a) * 9 * k, topY + Math.sin(a) * 5 * k - 6 * k,
      base.x + 3 * k + Math.cos(a) * 17 * k, topY + Math.sin(a) * 8 * k + 3 * k);
    ctx.stroke();
  }
}

function collectPalms(list) {
  const R = Math.ceil(900 / TILE);
  const ctx0 = Math.floor(SCam.x / TILE), cty0 = Math.floor(SCam.y / TILE);
  for (let ty = cty0 - R; ty <= cty0 + R; ty++) {
    for (let tx = ctx0 - R; tx <= ctx0 + R; tx++) {
      const t = tileType(tx, ty);
      let has = false;
      if (t === T_SAND) has = hash2(tx, ty) < 0.05;
      else if (t === T_SIDEWALK) has = hash2(tx * 3 + 1, ty * 5 + 2) < 0.08;
      else if (t === T_GRASS) has = hash2(tx + 9, ty + 4) < 0.15;
      if (!has) continue;
      const wx = (tx + 0.5) * TILE, wy = (ty + 0.5) * TILE;
      const dx = wx - SCam.x, dy = wy - SCam.y;
      const f = dx * cosYaw + dy * sinYaw;
      if (f < NEAR || f > 900) continue;
      if (Math.abs(-dx * sinYaw + dy * cosYaw) > (f + TILE) * 1.1) continue;
      const fog = Math.min(1, f / FAR);
      list.push({ d: f, fn: () => drawPalm3D(wx, wy, fog) });
    }
  }
}

// cars

// light comes from the sun side and above
const CAR_LIGHT = (() => { const v = [0.55, -0.3, 0.78], n = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / n); })();

// Newell's method: the normal of a (possibly slightly bent) polygon
function polyNormal(P) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const n = Math.hypot(nx, ny, nz) || 1;
  return [nx / n, ny / n, nz / n];
}

function drawCar3D(c, time, fog) {
  const { m, faces, bodyCount } = modelFaces(c.model);
  const fxv = Math.cos(c.angle), fyv = Math.sin(c.angle), pxv = -fyv, pyv = fxv;
  const gz = groundZ(c.x, c.y);
  const at = (lo, la, z) => [c.x + fxv * lo + pxv * la, c.y + fyv * lo + pyv * la, gz + z];
  const L = m.len / 2, Wd = m.wid / 2;
  const paint = c.wrecked ? [70, 70, 76] : hexRGB(c.color);
  const camP = [SCam.x, SCam.y, EYE];
  const mid = [c.x, c.y, gz + 9];

  // soft shadow, a rounded box a little bigger than the car
  const sh = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const k = Math.pow(Math.abs(ca), 0.25) * Math.sign(ca), j = Math.pow(Math.abs(sa), 0.25) * Math.sign(sa);
    sh.push(at(k * (L + 2), j * (Wd + 2), 0.4));
  }
  fillPoly3D(sh, 'rgba(0,0,0,0.38)');

  const toward = (P, n) => {
    let gx = 0, gy = 0, gzz = 0;
    for (const p of P) { gx += p[0]; gy += p[1]; gzz += p[2]; }
    gx /= P.length; gy /= P.length; gzz /= P.length;
    if (n[0] * (gx - mid[0]) + n[1] * (gy - mid[1]) + n[2] * (gzz - mid[2]) < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
    const vis = n[0] * (camP[0] - gx) + n[1] * (camP[1] - gy) + n[2] * (camP[2] - gzz) > 0;
    return { vis, d: (gx - SCam.x) * cosYaw + (gy - SCam.y) * sinYaw };
  };
  const styleFor = (role, n) => {
    const lit = Math.max(0, n[0] * CAR_LIGHT[0] + n[1] * CAR_LIGHT[1] + n[2] * CAR_LIGHT[2]);
    if (role === 'paint') return fogged(paint, fog, 0.5 + 0.62 * lit + (n[2] > 0.8 ? 0.08 : 0));
    if (role === 'roof') return c.model === 'police' && !c.wrecked ? fogged([235, 238, 244], fog, 0.6 + 0.45 * lit) : fogged(paint, fog, 0.48 + 0.6 * lit);
    if (role === 'bed') return fogged([26, 28, 34], fog, 1);
    // glass: dark, with the sky reflected in surfaces that face up
    return n[2] > 0.35 ? fogged([38, 56, 90], fog, 0.75 + 0.45 * lit) : fogged([16, 22, 36], fog, 0.9 + 0.4 * lit);
  };
  const draw = list => {
    const out = [];
    for (const f of list) {
      const P = f.pts.map(p => at(p[0], p[1], p[2]));
      const n = polyNormal(P);
      const t = toward(P, n);
      if (t.vis) out.push({ P, style: styleFor(f.role, n), d: t.d });
    }
    out.sort((a, b) => b.d - a.d);
    for (const o of out) fillPoly3D(o.P, o.style);
  };

  draw(faces.slice(0, bodyCount));

  // police livery: a dark band along each visible side, under the windows
  if (m.livery && !c.wrecked) {
    for (const s of [-1, 1]) {
      if ((pxv * s) * (camP[0] - c.x) + (pyv * s) * (camP[1] - c.y) <= 0) continue;
      const zb = beltAt(m, 0) - 4.4, zt = beltAt(m, 0) - 1.2;
      fillPoly3D([at(-L * 0.78, s * (Wd + 0.15), zb), at(L * 0.6, s * (Wd + 0.15), zb), at(L * 0.6, s * (Wd + 0.15), zt), at(-L * 0.78, s * (Wd + 0.15), zt)], fogged([24, 40, 92], fog, 1));
    }
  }
  // racing stripes over the hood and trunk
  if (m.stripe && !c.wrecked) {
    for (const off of [-2.2, 1.0]) {
      for (const [a0, a1] of [[-0.9, -0.6], [0.48, 0.92]]) {
        const pts = [];
        for (const [a, la] of [[a0, off], [a1, off], [a1, off + 1.4], [a0, off + 1.4]]) pts.push(at(a * L, la, beltAt(m, a) + 0.08));
        fillPoly3D(pts, fogged([250, 250, 250], fog, 0.95, 0.85));
      }
    }
  }
  // wheels on the side facing the camera: a tire and a lighter rim
  for (const s of [-1, 1]) {
    if ((pxv * s) * (camP[0] - c.x) + (pyv * s) * (camP[1] - c.y) <= 0) continue;
    for (const lo of [-L * m.track * 1.25, L * m.track * 1.25]) {
      const r = m.wheel, la = s * (Wd * 0.99);
      const ring = k => { const out = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; out.push(at(lo + Math.cos(a) * r * k, la, r + Math.sin(a) * r * k)); } return out; };
      fillPoly3D(ring(1), fogged([14, 15, 19], fog));
      fillPoly3D(ring(0.58), fogged(c.wrecked ? [60, 60, 64] : [150, 156, 168], fog));
      fillPoly3D(ring(0.18), fogged([40, 42, 48], fog));
    }
  }
  // lights: headlights on the nose, a full-width bar at the back
  const front = m.body[m.body.length - 1], rear = m.body[0];
  const fwdVis = fxv * (camP[0] - c.x) + fyv * (camP[1] - c.y) > 0;
  if (fwdVis && !c.wrecked) {
    const zA = front[2] + (front[3] - front[2]) * 0.45, zB = front[3] - 0.3;
    for (const s of [-1, 1]) {
      fillPoly3D([at(L + 0.3, s * Wd * front[1] * 0.92, zA), at(L + 0.3, s * Wd * front[1] * 0.45, zA), at(L + 0.3, s * Wd * front[1] * 0.45, zB), at(L + 0.3, s * Wd * front[1] * 0.92, zB)],
        fogged([255, 244, 214], fog * 0.4, 1));
    }
  }
  if (!fwdVis) {
    const zA = rear[3] - 2.4, zB = rear[3] - 0.9, w = Wd * rear[1] * 0.92;
    fillPoly3D([at(-L - 0.3, -w, zA), at(-L - 0.3, w, zA), at(-L - 0.3, w, zB), at(-L - 0.3, -w, zB)], c.braking ? '#ff2038' : fogged([150, 18, 34], fog, 1));
  }
  // rear wing
  if (m.spoiler && !c.wrecked) {
    const z = rear[3] + 2.6;
    for (const s of [-0.55, 0.55]) fillPoly3D([at(-L * 0.9, s * Wd, rear[3]), at(-L * 0.86, s * Wd, rear[3]), at(-L * 0.86, s * Wd, z), at(-L * 0.9, s * Wd, z)], fogged([20, 22, 28], fog));
    fillPoly3D([at(-L * 0.98, -Wd * 0.92, z), at(-L * 0.84, -Wd * 0.92, z + 0.4), at(-L * 0.84, Wd * 0.92, z + 0.4), at(-L * 0.98, Wd * 0.92, z)], fogged([20, 22, 28], fog, 1.2));
  }

  draw(faces.slice(bodyCount));

  const roofZ = Math.max(...m.cabin.map(q => q[2]));
  if (m.rails && !c.wrecked) {
    for (const s of [-1, 1]) fillPoly3D([at(-L * 0.8, s * Wd * 0.72, roofZ + 1.2), at(L * 0.22, s * Wd * 0.72, roofZ + 1.2), at(L * 0.22, s * Wd * 0.62, roofZ + 1.2), at(-L * 0.8, s * Wd * 0.62, roofZ + 1.2)], fogged([22, 24, 30], fog));
  }
  if (m.lightbar && !c.wrecked) {
    const ph = Math.floor(time * 6) % 2 === 0, z = roofZ + 2;
    fillPoly3D([at(-3, -Wd * 0.62, z), at(3, -Wd * 0.62, z), at(3, 0, z), at(-3, 0, z)], ph ? '#ff4356' : '#3b6cff');
    fillPoly3D([at(-3, 0, z), at(3, 0, z), at(3, Wd * 0.62, z), at(-3, Wd * 0.62, z)], ph ? '#3b6cff' : '#ff4356');
  }
}

function collectCars(list, time) {
  for (const c of Game.cars.concat(Game.police)) {
    const p = camSpace(c.x, c.y, 0);
    if (p.f < -60 || p.f > 1000) continue;
    if (Math.abs(p.s) > (p.f + 80) * 1.15) continue;
    const fog = Math.min(1, Math.max(0, p.f / FAR));
    // headlight pool ahead of working cars
    if (!c.wrecked && p.f < 480) {
      const hx = c.x + Math.cos(c.angle) * (c.len / 2 + 30);
      const hy = c.y + Math.sin(c.angle) * (c.len / 2 + 30);
      const hp = camSpace(hx, hy, 0);
      list.push({ d: hp.f + 1, fn: () => groundEllipse(hx, hy, 0.5, 24, 'rgba(255,240,190,0.08)', false) });
    }
    list.push({ d: p.f, fn: () => drawCar3D(c, time, fog) });
  }
}

// people (billboards)

function drawPerson3D(x, y, shirt, dead, fog, walking, time) {
  const gz = groundZ(x, y);
  const p = camSpace(x, y, gz);
  if (p.f < NEAR + 2) return;
  const b = projPt(p);
  const k = FOC / p.f;
  if (dead) {
    ctx.fillStyle = fogged(hexRGB(shirt), fog, 0.8);
    ctx.beginPath(); ctx.ellipse(b.x, b.y, 7 * k, 3 * k, 0, 0, 7); ctx.fill();
    return;
  }
  const bob = walking ? Math.sin((x + y) * 0.35) * 1.1 * k : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(b.x, b.y, 5 * k, 2 * k, 0, 0, 7); ctx.fill();
  ctx.fillStyle = fogged([30, 32, 46], fog);
  ctx.fillRect(b.x - 2.8 * k, b.y - 6 * k, 2.2 * k, 6 * k);
  ctx.fillRect(b.x + 0.6 * k, b.y - 6 * k, 2.2 * k, 6 * k);
  ctx.fillStyle = fogged(hexRGB(shirt), fog);
  ctx.fillRect(b.x - 3.4 * k, b.y - 13 * k - bob, 6.8 * k, 7.5 * k);
  ctx.fillStyle = fogged([217, 160, 107], fog);
  ctx.beginPath(); ctx.arc(b.x, b.y - 15.5 * k - bob, 3 * k, 0, 7); ctx.fill();
}

function collectPeople(list) {
  for (const pd of Game.peds) {
    const p = camSpace(pd.x, pd.y, 0);
    if (p.f < NEAR || p.f > 750) continue;
    if (Math.abs(p.s) > (p.f + 30) * 1.15) continue;
    const fog = Math.min(1, p.f / FAR);
    list.push({ d: p.f, fn: () => drawPerson3D(pd.x, pd.y, pd.shirt, pd.state === 'dead', fog, pd.state !== 'dead', 0) });
  }
  if (!Player.inCar && Game.state !== 'menu') {
    const p = camSpace(Player.x, Player.y, 0);
    if (p.f > NEAR) list.push({ d: p.f, fn: () => drawPerson3D(Player.x, Player.y, '#ff6fb0', false, Math.min(1, p.f / FAR), true, 0) });
  }
}

// particles

function collectParticles(list) {
  for (const s of Particles.stains) {
    const p = camSpace(s.x, s.y, 0);
    if (p.f < NEAR || p.f > 500) continue;
    list.push({ d: p.f + 2, fn: () => groundEllipse(s.x, s.y, groundZ(s.x, s.y) + 0.3, s.r, 'rgba(110,12,28,0.5)', false) });
  }
  for (const sp of Particles.list) {
    const p = camSpace(sp.x, sp.y, 8);
    if (p.f < NEAR || p.f > 600) continue;
    list.push({
      d: p.f, fn: () => {
        const b = projPt(p), k = FOC / p.f;
        ctx.globalAlpha = clamp(sp.life * 3, 0, 1);
        ctx.fillStyle = sp.c;
        ctx.fillRect(b.x - sp.r * k, b.y - sp.r * k, sp.r * 2 * k, sp.r * 2 * k);
        ctx.globalAlpha = 1;
      }
    });
  }
}

// mission beacon

function collectMarker(list, time) {
  const o = Mission.objectivePoint();
  if (!o || Game.state === 'menu') return;
  const color = Mission.state === 'deliver' ? '#ffd166' : '#28e0ff';
  const p = camSpace(o.x, o.y, 0);
  if (p.f < -40 || p.f > FAR) return;
  list.push({
    d: p.f, fn: () => {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.globalAlpha = 0.3 + pulse * 0.25;
      for (const [ax, ay] of [[14, 0], [0, 14]]) {
        fillPoly3D([
          [o.x - ax, o.y - ay, 0], [o.x + ax, o.y + ay, 0],
          [o.x + ax, o.y + ay, 190], [o.x - ax, o.y - ay, 190]
        ], color);
      }
      ctx.globalAlpha = 1;
      const b = camSpace(o.x, o.y, 0);
      if (b.f > NEAR + 2) {
        const pt2 = projPt(b);
        const k = FOC / b.f, r = (24 + pulse * 6) * k;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, 3 * k);
        ctx.beginPath(); ctx.ellipse(pt2.x, pt2.y, r, r * 0.35, 0, 0, 7); ctx.stroke();
      }
    }
  });
}

// frame

function render3D(time, dt) {
  updateSCam(dt || 0.016);
  drawSky(time);
  drawGround(time);
  const list = [];
  collectBlocks(list, time);
  collectLamps(list, time);
  collectPalms(list);
  collectCars(list, time);
  collectPeople(list);
  collectParticles(list);
  collectMarker(list, time);
  list.sort((a, b) => b.d - a.d);
  for (const it of list) it.fn();
}
