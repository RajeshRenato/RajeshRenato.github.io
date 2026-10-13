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
  return isRaised(tileType(Math.floor(x / TILE), Math.floor(y / TILE))) ? CURB_H : 0;
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
  const raised = [];

  for (let ty = cty0 - R; ty <= cty0 + R; ty++) {
    for (let tx = ctx0 - R; tx <= ctx0 + R; tx++) {
      const wx = (tx + 0.5) * TILE, wy = (ty + 0.5) * TILE;
      const dx = wx - SCam.x, dy = wy - SCam.y;
      const f = dx * cosYaw + dy * sinYaw;
      if (f < -TILE || f > FAR) continue;
      const s = -dx * sinYaw + dy * cosYaw;
      if (Math.abs(s) > (f + TILE * 2) * 1.1) continue;

      const t = tileType(tx, ty);
      const rgb = GROUND_RGB[t];
      // per-tile shade noise
      let shade = 0.93 + hash2(tx * 3 + 11, ty * 7 + 5) * 0.14;
      if (t === T_WATER) {
        shade = 1 + 0.14 * Math.sin(time * 1.5 + tx * 0.35 + ty * 0.7);
        // sun glint on the water
        const az = Math.atan2(dy, dx);
        const glint = Math.cos(az - SUN_A);
        if (glint > 0.86) shade += (glint - 0.86) * 5 * (0.5 + 0.5 * Math.sin(time * 3 + tx * 1.3 + ty * 2.1));
      }
      const fog = Math.min(1, Math.max(0, f / FAR));
      const x0 = tx * TILE - 0.6, y0 = ty * TILE - 0.6, x1 = x0 + TILE + 1.2, y1 = y0 + TILE + 1.2;
      fillPoly3D([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], fogged(rgb, fog, shade));

      if (isRaised(t) && f < 1000) raised.push({ tx, ty, t, f, fog, shade });

      // lane dashes on the nearer roads
      if (t === T_ROAD && f < FAR * 0.55) {
        const mx = ((tx % PERIOD) + PERIOD) % PERIOD, my = ((ty % PERIOD) + PERIOD) % PERIOD;
        const dashStyle = fogged([232, 195, 90], fog, 1, 0.8);
        if (mx === 1 && my >= 2) {
          const lx = tx * TILE;
          fillPoly3D([[lx - 1.2, y0 + 3, 0], [lx + 1.2, y0 + 3, 0], [lx + 1.2, y0 + 13, 0], [lx - 1.2, y0 + 13, 0]], dashStyle);
          fillPoly3D([[lx - 1.2, y0 + 27, 0], [lx + 1.2, y0 + 27, 0], [lx + 1.2, y0 + 37, 0], [lx - 1.2, y0 + 37, 0]], dashStyle);
        } else if (my === 1 && mx >= 2) {
          const ly = ty * TILE;
          fillPoly3D([[x0 + 3, ly - 1.2, 0], [x0 + 13, ly - 1.2, 0], [x0 + 13, ly + 1.2, 0], [x0 + 3, ly + 1.2, 0]], dashStyle);
          fillPoly3D([[x0 + 27, ly - 1.2, 0], [x0 + 37, ly - 1.2, 0], [x0 + 37, ly + 1.2, 0], [x0 + 27, ly + 1.2, 0]], dashStyle);
        }
      }
    }
  }

  // raised slabs: tops first (they only ever overlap farther, lower ground),
  // then curb faces along road/beach edges
  for (const r of raised) {
    const x0 = r.tx * TILE - 0.6, y0 = r.ty * TILE - 0.6, x1 = x0 + TILE + 1.2, y1 = y0 + TILE + 1.2;
    fillPoly3D([[x0, y0, CURB_H], [x1, y0, CURB_H], [x1, y1, CURB_H], [x0, y1, CURB_H]],
      fogged(GROUND_RGB[r.t], r.fog, r.shade));
  }
  for (const r of raised) {
    if (r.f > 750) continue;
    const x0 = r.tx * TILE, y0 = r.ty * TILE, x1 = x0 + TILE, y1 = y0 + TILE;
    const curb = fogged([96, 104, 126], r.fog, 1);
    if (!isRaised(tileType(r.tx, r.ty - 1)) && SCam.y < y0)
      fillPoly3D([[x0, y0, 0], [x1, y0, 0], [x1, y0, CURB_H], [x0, y0, CURB_H]], curb);
    if (!isRaised(tileType(r.tx, r.ty + 1)) && SCam.y > y1)
      fillPoly3D([[x1, y1, 0], [x0, y1, 0], [x0, y1, CURB_H], [x1, y1, CURB_H]], curb);
    if (!isRaised(tileType(r.tx - 1, r.ty)) && SCam.x < x0)
      fillPoly3D([[x0, y1, 0], [x0, y0, 0], [x0, y0, CURB_H], [x0, y1, CURB_H]], curb);
    if (!isRaised(tileType(r.tx + 1, r.ty)) && SCam.x > x1)
      fillPoly3D([[x1, y0, 0], [x1, y1, 0], [x1, y1, CURB_H], [x1, y0, CURB_H]], curb);
  }
}

// buildings

function faceQuad(A, B, z0, z1) {
  return [[A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1]];
}

function drawBoxFaces(x0, y0, x1, y1, z0, hgt, base, fog, neon, winSeed) {
  const faces = [
    [[x0, y0], [x1, y0], 0.72, SCam.y < y0, 0],   // north
    [[x1, y1], [x0, y1], 0.95, SCam.y > y1, 1],   // south
    [[x0, y1], [x0, y0], 0.62, SCam.x < x0, 2],   // west
    [[x1, y0], [x1, y1], 0.85, SCam.x > x1, 3]    // east
  ];
  for (const [A, B, shade, vis, fid] of faces) {
    if (!vis) continue;
    fillPoly3D(faceQuad(A, B, z0, hgt), fogged(base, fog, shade));

    const floors = Math.max(2, Math.min(8, ((hgt - z0) / 26) | 0));
    const fh = (hgt - z0) / floors;
    if (fog < 0.3) {
      // full window grid, lit and dark, per-face deterministic
      const cols = 5;
      for (let fl = 0; fl < floors; fl++) {
        const z = z0 + fl * fh + fh * 0.22;
        for (let cI = 0; cI < cols; cI++) {
          const u0 = 0.08 + cI * (0.84 / cols), u1 = u0 + (0.84 / cols) * 0.62;
          const lit = hash2(winSeed + fid * 977 + cI * 131, fl * 53 + winSeed) < 0.34;
          const ax = A[0] + (B[0] - A[0]) * u0, ay = A[1] + (B[1] - A[1]) * u0;
          const bx2 = A[0] + (B[0] - A[0]) * u1, by2 = A[1] + (B[1] - A[1]) * u1;
          fillPoly3D(faceQuad([ax, ay], [bx2, by2], z, z + fh * 0.5),
            lit
              ? fogged(hash2(winSeed + cI, fl + fid) < 0.65 ? [255, 221, 148] : [140, 228, 255], fog, 1, 0.9)
              : fogged([12, 14, 24], fog, 1, 0.75));
        }
      }
    } else if (fog < 0.55) {
      // mid distance: floor bands instead of windows
      const band = fogged([0, 0, 0], fog, 1, 0.2);
      for (let fl = 1; fl < floors; fl++) {
        const z = z0 + fl * fh;
        fillPoly3D(faceQuad(A, B, z, z + 2.5), band);
      }
    }

    // vertical neon sign near street level on some facades
    if (fog < 0.42 && hash2(winSeed + fid * 311, winSeed * 2 + 9) < 0.4) {
      const u = 0.12 + hash2(winSeed + fid, 77) * 0.7;
      const sx0 = A[0] + (B[0] - A[0]) * u, sy0 = A[1] + (B[1] - A[1]) * u;
      const sx1 = A[0] + (B[0] - A[0]) * (u + 0.07), sy1 = A[1] + (B[1] - A[1]) * (u + 0.07);
      const zTop = Math.min(hgt - 8, z0 + 64);
      fillPoly3D(faceQuad([sx0, sy0], [sx1, sy1], z0 + 8, zTop), fogged(hexRGB(neon), fog, 1, 0.25));
      const ix0 = A[0] + (B[0] - A[0]) * (u + 0.018), iy0 = A[1] + (B[1] - A[1]) * (u + 0.018);
      const ix1 = A[0] + (B[0] - A[0]) * (u + 0.052), iy1 = A[1] + (B[1] - A[1]) * (u + 0.052);
      fillPoly3D(faceQuad([ix0, iy0], [ix1, iy1], z0 + 11, zTop - 3), fogged(hexRGB(neon), fog, 1, 0.9));
    }

    // neon trim along the roofline
    ctx.globalAlpha = (1 - fog) * 0.9;
    line3D([A[0], A[1], hgt], [B[0], B[1], hgt], neon, 6);
    ctx.globalAlpha = (1 - fog);
    line3D([A[0], A[1], hgt], [B[0], B[1], hgt], '#ffffff', 1.5);
    ctx.globalAlpha = 1;
  }
  if (EYE > hgt) {
    fillPoly3D([[x0, y0, hgt], [x1, y0, hgt], [x1, y1, hgt], [x0, y1, hgt]], fogged(base, fog, 0.5));
  }
}

function drawBlock(bx, by, fog) {
  const x0 = (bx * PERIOD + 3) * TILE, y0 = (by * PERIOD + 3) * TILE;
  const S = 4 * TILE, x1 = x0 + S, y1 = y0 + S;
  const base = hexRGB(BLOCK_BASE[(hash2(bx, by) * BLOCK_BASE.length) | 0]);
  const hv = hash2(bx * 5 + 1, by * 3 + 7);
  const neon = NEON[(hv * NEON.length) | 0];
  const hgt = 90 + hash2(bx * 9 + 2, by * 7 + 5) * 180;
  const winSeed = ((bx * 73856093) ^ (by * 19349663)) >>> 0;

  drawBoxFaces(x0, y0, x1, y1, CURB_H, hgt, base, fog, neon, winSeed % 10007);

  // setback tower on some blocks
  if (hash2(bx * 17 + 3, by * 13 + 1) < 0.35) {
    const inset = S * 0.22;
    drawBoxFaces(x0 + inset, y0 + inset, x1 - inset, y1 - inset,
      hgt, hgt + 50 + hash2(bx * 23, by * 29) * 90, base, fog, neon, winSeed % 7001);
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

function drawCar3D(c, time, fog) {
  const fxv = Math.cos(c.angle), fyv = Math.sin(c.angle);
  const pxv = -fyv, pyv = fxv;
  const pt = (lo, la) => [c.x + fxv * lo + pxv * la, c.y + fyv * lo + pyv * la];
  const L = c.len / 2, Wd = c.wid / 2;
  const bodyRGB = c.wrecked ? [74, 74, 79] : hexRGB(c.color);
  const gz = groundZ(c.x, c.y);
  const BODY_Z = gz + 3.5, BODY_H = gz + 12, CAB_H = gz + 19;

  fillPoly3D([
    [...pt(-L - 2, -Wd - 2), gz + 0.4], [...pt(L + 2, -Wd - 2), gz + 0.4],
    [...pt(L + 2, Wd + 2), gz + 0.4], [...pt(-L - 2, Wd + 2), gz + 0.4]
  ], 'rgba(0,0,0,0.35)');

  // depth-sort the car faces
  const faces = [];
  const addFace = (A, B, z0, z1, style) => {
    const mx = (A[0] + B[0]) / 2 - SCam.x, my = (A[1] + B[1]) / 2 - SCam.y;
    faces.push({ d: mx * cosYaw + my * sinYaw, q: faceQuad(A, B, z0, z1), style });
  };
  const addTop = (corners, z, style) => {
    faces.push({ d: camSpace(c.x, c.y, z).f, q: corners.map(q => [q[0], q[1], z]), style });
  };

  const wheel = fogged([16, 17, 22], fog);
  for (const side of [-1, 1]) {
    for (const lo of [-L * 0.55, L * 0.55]) {
      addFace(pt(lo - 4.5, side * (Wd + 0.6)), pt(lo + 4.5, side * (Wd + 0.6)), gz, gz + 7, wheel);
    }
  }

  addFace(pt(-L, -Wd), pt(L, -Wd), BODY_Z, BODY_H, fogged(bodyRGB, fog, 0.72));
  addFace(pt(L, Wd), pt(-L, Wd), BODY_Z, BODY_H, fogged(bodyRGB, fog, 0.72));
  addFace(pt(L, -Wd), pt(L, Wd), BODY_Z, BODY_H, fogged(bodyRGB, fog, 0.88));
  addFace(pt(-L, Wd), pt(-L, -Wd), BODY_Z, BODY_H, fogged(bodyRGB, fog, 0.6));
  addTop([pt(-L, -Wd), pt(L, -Wd), pt(L, Wd), pt(-L, Wd)], BODY_H, fogged(bodyRGB, fog, 1));
  addTop([pt(L * 0.5, -Wd * 0.65), pt(L * 0.92, -Wd * 0.65), pt(L * 0.92, Wd * 0.65), pt(L * 0.5, Wd * 0.65)],
    BODY_H + 0.1, fogged(bodyRGB, fog, 1.25, 0.6));

  // cabin: bright windshield, darker side/back glass
  const cl0 = -L * 0.62, cl1 = L * 0.45, cw = Wd * 0.8;
  const glass = fogged([14, 24, 42], fog, 1, 0.95);
  const shield = fogged([80, 130, 180], fog, 1, 0.95);
  addFace(pt(cl0, -cw), pt(cl1, -cw), BODY_H, CAB_H, glass);
  addFace(pt(cl1, cw), pt(cl0, cw), BODY_H, CAB_H, glass);
  addFace(pt(cl1, -cw), pt(cl1, cw), BODY_H, CAB_H, shield);
  addFace(pt(cl0, cw), pt(cl0, -cw), BODY_H, CAB_H, glass);
  addTop([pt(cl0, -cw), pt(cl1, -cw), pt(cl1, cw), pt(cl0, cw)], CAB_H,
    c.kind === 'police' && !c.wrecked ? fogged([233, 237, 242], fog, 0.9) : fogged(bodyRGB, fog, 0.92));

  if (c.kind === 'police' && !c.wrecked) {
    const ph = Math.floor(time * 6) % 2 === 0;
    addTop([pt(-4, -cw * 0.7), pt(0, -cw * 0.7), pt(0, cw * 0.7), pt(-4, cw * 0.7)], CAB_H + 3, ph ? '#ff4356' : '#3b6cff');
    addTop([pt(0, -cw * 0.7), pt(4, -cw * 0.7), pt(4, cw * 0.7), pt(0, cw * 0.7)], CAB_H + 3, ph ? '#3b6cff' : '#ff4356');
  }
  if (!c.wrecked) {
    for (const sgn of [-1, 1]) {
      addFace(pt(L + 0.3, sgn * Wd * 0.75 - 2), pt(L + 0.3, sgn * Wd * 0.75 + 2), gz + 5, gz + 10, fogged([255, 233, 168], fog * 0.4, 1));
    }
  }
  for (const sgn of [-1, 1]) {
    addFace(pt(-L - 0.3, sgn * Wd * 0.75 + 2), pt(-L - 0.3, sgn * Wd * 0.75 - 2), gz + 5, gz + 10,
      c.braking ? '#ff2038' : fogged([122, 20, 32], fog, 1));
  }

  faces.sort((a, b) => b.d - a.d);
  for (const fc of faces) fillPoly3D(fc.q, fc.style);
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
