'use strict';
// Highway Brawl artwork. Everything is painted once, on first use, into offscreen canvases:
// building facades, rock faces, trees and other scenery, clouds, backdrops and traffic.
// The game then draws these images scaled into the road scene every frame.

const Art = (() => {
  const cache = new Map();
  const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb = (c, f = 1, a = 1) => 'rgba(' + c.map(v => Math.max(0, Math.min(255, Math.round(v * f)))).join(',') + ',' + a + ')';
  const tone = (h, f, a) => rgb(hex(h), f, a);

  // grainy noise, laid over textures so flat colours look like real surfaces
  function noise(size, seed) {
    return once('noise' + size + ':' + seed, () => {
      const [c, x] = canvas(size, size), img = x.createImageData(size, size), r = rng(seed);
      for (let i = 0; i < size * size; i++) { const v = 40 + r() * 175; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      x.putImageData(img, 0, 0);
      return c;
    });
  }
  function grain(x, w, h, alpha, seed) {
    // only over what's already painted, so transparent edges stay transparent
    const p = x.createPattern(noise(128, seed || 7), 'repeat');
    x.save(); x.globalAlpha = alpha * 0.6; x.globalCompositeOperation = 'source-atop'; x.fillStyle = p; x.fillRect(0, 0, w, h); x.restore();
  }

  // ---------- building facades
  // One texture covers one road segment of facade (two window bays), from the ground to the
  // roof of the tallest building. PX texture pixels per world unit.
  // one texture spans three road segments across, so windows sit about 3 m apart; floors are about 3.2 m
  const PX = 0.3, FW = 120, FH = 1600, FLOOR = 204;
  const FACADES = [
    { kind: 'brick', base: '#9c5034', mortar: '#c9b9a6', frame: '#efe9dc' },
    { kind: 'stone', base: '#c2b08c', line: '#a8946e', frame: '#7d6b52' },
    { kind: 'concrete', base: '#9a9c9e', line: '#84878a', frame: '#3b3f44' },
    { kind: 'glass', base: '#4f6f84', line: '#2f4250', frame: '#c9d2d8' },
    { kind: 'brick', base: '#7a4a38', mortar: '#a69a8a', frame: '#d9d0bd' },
    { kind: 'stucco', base: '#d8c9a8', line: '#c4b28c', frame: '#6b5a44' },
  ];
  function windowAt(x, wx, wy, ww, wh, frame, r, lit) {
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(wx - 3, wy + wh, ww + 6, 5);               // sill shadow
    x.fillStyle = frame; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
    const g = x.createLinearGradient(wx, wy, wx + ww * 0.6, wy + wh);
    if (lit) { g.addColorStop(0, '#fff2c4'); g.addColorStop(1, '#e8c070'); }
    else { g.addColorStop(0, '#a9c8dc'); g.addColorStop(0.45, '#5d7f96'); g.addColorStop(1, '#22323e'); }
    x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
    if (!lit && r() < 0.35) { x.fillStyle = 'rgba(230,220,195,0.85)'; x.fillRect(wx, wy, ww, wh * (0.25 + r() * 0.5)); }   // blinds
    x.fillStyle = 'rgba(255,255,255,0.22)'; x.beginPath(); x.moveTo(wx, wy + wh * 0.7); x.lineTo(wx + ww * 0.55, wy); x.lineTo(wx + ww * 0.8, wy); x.lineTo(wx, wy + wh); x.fill();
    x.fillStyle = frame; x.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); x.fillRect(wx, wy + wh * 0.38, ww, 3);
  }
  function facade(style, variant) {
    return once('facade' + style + ':' + variant, () => {
      const f = FACADES[style], [c, x] = canvas(FW, FH), r = rng(style * 97 + variant * 13 + 1);
      x.fillStyle = f.base; x.fillRect(0, 0, FW, FH);
      if (f.kind === 'brick') {
        x.fillStyle = f.mortar; x.fillRect(0, 0, FW, FH);
        const b = hex(f.base);
        for (let y = 0, row = 0; y < FH; y += 7, row++) for (let bx = (row % 2) * -8; bx < FW; bx += 16) { x.fillStyle = rgb(b, 0.85 + r() * 0.3); x.fillRect(bx + 1, y + 1, 14, 5); }
      } else if (f.kind === 'stone' || f.kind === 'stucco') {
        for (let y = 0; y < FH; y += f.kind === 'stone' ? 18 : 60) { x.fillStyle = f.line; x.fillRect(0, y, FW, 2); }
      } else if (f.kind === 'concrete') {
        for (let y = 0; y < FH; y += FLOOR / 2) { x.fillStyle = f.line; x.fillRect(0, y, FW, 2); }
        x.fillStyle = f.line; x.fillRect(FW / 2 - 1, 0, 2, FH);
      }
      grain(x, FW, FH, f.kind === 'glass' ? 0.15 : 0.35, style + 3);
      // floors of windows, from the top of the texture down (the ground floor is a shop front, drawn separately)
      for (let fy = 30; fy < FH - 150; fy += FLOOR) {
        if (f.kind === 'glass') {
          const g = x.createLinearGradient(0, fy, FW, fy + FLOOR);
          g.addColorStop(0, '#9fc2d6'); g.addColorStop(0.5, '#4e7389'); g.addColorStop(1, '#2a4252');
          x.fillStyle = g; x.fillRect(0, fy, FW, FLOOR - 26);
          x.fillStyle = f.frame; for (let gx = 0; gx <= FW; gx += 30) x.fillRect(gx - 1, fy, 3, FLOOR - 26); x.fillRect(0, fy + FLOOR - 28, FW, 28);
          x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.moveTo(0, fy + FLOOR * 0.6); x.lineTo(FW * 0.5, fy); x.lineTo(FW * 0.7, fy); x.lineTo(0, fy + FLOOR * 0.85); x.fill();
        } else if (f.kind === 'concrete') {
          windowAt(x, 6, fy + 50, FW - 12, 80, f.frame, r, r() < 0.12);
        } else {
          const tall = f.kind === 'stone' ? 110 : 96;
          for (const wx of [16, 70]) windowAt(x, wx, fy + 50, 34, tall, f.frame, r, r() < 0.1);
          if (f.kind === 'stone') { x.fillStyle = f.line; x.fillRect(0, fy + 40, FW, 6); }
        }
      }
      return c;
    });
  }
  // street-level shop fronts: an awning, a big window and a door
  const AWNINGS = ['#c8322a', '#2a62b8', '#2f8f4e', '#e0a21c', '#6b3fa0', '#333438'];
  function shopfront(i) {
    return once('shop' + i, () => {
      const [c, x] = canvas(FW, 110), r = rng(i * 31 + 5), col = AWNINGS[i % AWNINGS.length];
      x.fillStyle = '#2b2d31'; x.fillRect(0, 0, FW, 110);
      const g = x.createLinearGradient(0, 30, 0, 110); g.addColorStop(0, '#8fb2c6'); g.addColorStop(1, '#273642');
      x.fillStyle = g; x.fillRect(8, 34, 70, 70);
      x.fillStyle = 'rgba(255,240,200,0.35)'; for (let k = 0; k < 4; k++) x.fillRect(12 + k * 16, 70 + r() * 20, 10, 30);
      x.fillStyle = '#3a2a1e'; x.fillRect(86, 40, 26, 70); x.fillStyle = 'rgba(160,200,220,0.6)'; x.fillRect(90, 46, 18, 30);
      for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? col : '#f2efe6'; x.fillRect(k * 15, 8, 15, 22); }
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 30, FW, 4);
      return c;
    });
  }
  // rock faces: sandstone by the sea, grey granite in the mountains
  function rock(kind) {
    return once('rock' + kind, () => {
      const W = 120, Hh = 900, [c, x] = canvas(W, Hh), r = rng(kind === 'sand' ? 11 : 23);
      const base = kind === 'sand' ? '#a07a56' : '#7d7a74';
      x.fillStyle = base; x.fillRect(0, 0, W, Hh);
      for (let y = 0; y < Hh; y += 6 + r() * 26) {
        const h = 6 + r() * 24, f = 0.78 + r() * 0.4;
        x.fillStyle = tone(base, f); x.beginPath(); x.moveTo(0, y); for (let px = 0; px <= W; px += 20) x.lineTo(px, y + (r() - 0.5) * 8); x.lineTo(W, y + h); x.lineTo(0, y + h); x.fill();
      }
      x.strokeStyle = 'rgba(30,25,20,0.45)'; x.lineWidth = 1.5;
      for (let k = 0; k < 40; k++) { let px = r() * W, py = r() * Hh; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 4; s++) { px += (r() - 0.5) * 20; py += 8 + r() * 18; x.lineTo(px, py); } x.stroke(); }
      grain(x, W, Hh, 0.45, kind === 'sand' ? 5 : 9);
      if (kind !== 'sand') { x.fillStyle = 'rgba(80,110,60,0.5)'; for (let k = 0; k < 25; k++) { x.beginPath(); x.ellipse(r() * W, r() * 60, 6 + r() * 14, 3 + r() * 5, 0, 0, 7); x.fill(); } }
      return c;
    });
  }

  // ---------- scenery sprites. Each has an image and its size in world units.
  function leafCrown(x, cx, cy, rx, ry, n, r, greens) {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const px = cx + Math.cos(a) * rx * d, py = cy + Math.sin(a) * ry * d;
      // light from the upper left: leaves there are brighter
      const light = 0.62 + 0.55 * (1 - ((px - cx) / rx + (py - cy) / ry + 2) / 4) + (r() - 0.5) * 0.25;
      x.fillStyle = rgb(hex(greens[(r() * greens.length) | 0]), light);
      x.beginPath(); x.ellipse(px, py, 6 + r() * 12, 5 + r() * 9, r() * 3, 0, 7); x.fill();
    }
  }
  const SPRITES = {
    tree(v) {
      const [c, x] = canvas(300, 380), r = rng(v * 7 + 3);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(160, 372, 110, 12, 0, 0, 7); x.fill();
      const tg = x.createLinearGradient(135, 0, 165, 0); tg.addColorStop(0, '#7a5a3a'); tg.addColorStop(1, '#3e2b1a');
      x.fillStyle = tg; x.beginPath(); x.moveTo(132, 375); x.quadraticCurveTo(142, 260, 138, 190); x.lineTo(162, 190); x.quadraticCurveTo(158, 260, 170, 375); x.fill();
      x.strokeStyle = '#4a3420'; x.lineWidth = 9; x.beginPath(); x.moveTo(150, 240); x.quadraticCurveTo(120, 200, 95, 170); x.moveTo(150, 225); x.quadraticCurveTo(185, 190, 210, 160); x.stroke();
      const greens = ['#3f7a34', '#4f8f3e', '#356a2c', '#5c9a45', '#2e5e27'];
      x.fillStyle = '#2a4f22'; x.beginPath(); x.ellipse(150, 140, 125, 115, 0, 0, 7); x.fill();
      leafCrown(x, 150, 140, 120, 112, 650, r, greens);
      return { img: c, ww: 760, wh: 960 };
    },
    pine(v) {
      const [c, x] = canvas(220, 420), r = rng(v * 11 + 5);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(112, 414, 80, 8, 0, 0, 7); x.fill();
      x.fillStyle = '#4a3523'; x.fillRect(104, 340, 14, 76);
      for (let t = 0; t < 8; t++) {
        const y = 360 - t * 44, w = 104 - t * 11, top = y - 80;
        for (const [side, f] of [[-1, 1.15], [1, 0.75]]) {
          x.fillStyle = rgb(hex(t % 2 ? '#2f5d34' : '#2a5530'), f + (r() - 0.5) * 0.1);
          // a tier: down the outer edge from the tip, then a ragged hem back to the trunk
          x.beginPath(); x.moveTo(110, top); x.lineTo(110 + side * w, y + r() * 6);
          for (let k = 5; k >= 0; k--) x.lineTo(110 + side * w * k / 6, y - (k % 2) * 12 + r() * 6);
          x.closePath(); x.fill();
        }
      }
      grain(x, 220, 420, 0.3, 4);
      return { img: c, ww: 520, wh: 1000 };
    },
    palm(v) {
      const [c, x] = canvas(320, 440), r = rng(v * 5 + 9);
      x.fillStyle = 'rgba(0,0,0,0.22)'; x.beginPath(); x.ellipse(150, 434, 90, 8, 0, 0, 7); x.fill();
      x.strokeStyle = '#8a6a48'; x.lineWidth = 18; x.lineCap = 'round'; x.beginPath(); x.moveTo(140, 432); x.quadraticCurveTo(160, 250, 196, 110); x.stroke();
      x.strokeStyle = 'rgba(60,40,20,0.5)'; x.lineWidth = 2;
      for (let t = 0; t < 1; t += 0.05) { const px = 140 + (196 - 140) * t + Math.sin(t * 3) * 14, py = 432 - (432 - 110) * t; x.beginPath(); x.moveTo(px - 9, py); x.lineTo(px + 9, py - 3); x.stroke(); }
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI * 0.95 + i * Math.PI * 1.9 / 8 + (r() - 0.5) * 0.2, len = 120 + r() * 40;
        const ex = 196 + Math.cos(a) * len, ey = 110 + Math.sin(a) * len * 0.5 + 60 * Math.abs(Math.cos(a));
        x.strokeStyle = '#3d7a33'; x.lineWidth = 4; x.beginPath(); x.moveTo(196, 110); x.quadraticCurveTo(196 + Math.cos(a) * len * 0.5, 110 + Math.sin(a) * len * 0.3 - 30, ex, ey); x.stroke();
        for (let k = 1; k < 14; k++) {
          const t = k / 14, px = 196 + (ex - 196) * t, py = 110 + (ey - 110) * t - Math.sin(t * Math.PI) * 30;
          x.strokeStyle = r() < 0.5 ? '#4f9a3f' : '#2f6e2a'; x.lineWidth = 2.5;
          x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6 - r() * 12, py + 16 + r() * 10); x.stroke();
        }
      }
      x.fillStyle = '#5a4428'; x.beginPath(); x.arc(196, 112, 10, 0, 7); x.fill();
      return { img: c, ww: 760, wh: 1050 };
    },
    bush(v) {
      const [c, x] = canvas(240, 130), r = rng(v + 40);
      x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(120, 124, 110, 8, 0, 0, 7); x.fill();
      x.fillStyle = '#2f5a25'; x.beginPath(); x.ellipse(120, 80, 110, 50, 0, 0, 7); x.fill();
      leafCrown(x, 120, 78, 105, 48, 260, r, ['#4e7d36', '#3f6e2c', '#5f8f40']);
      return { img: c, ww: 420, wh: 230 };
    },
    cactus(v) {
      const [c, x] = canvas(170, 320), r = rng(v + 60);
      x.fillStyle = 'rgba(0,0,0,0.22)'; x.beginPath(); x.ellipse(90, 314, 60, 6, 0, 0, 7); x.fill();
      const limb = (lx, ly, w, h) => {
        const g = x.createLinearGradient(lx, 0, lx + w, 0); g.addColorStop(0, '#6f9d50'); g.addColorStop(0.45, '#4f7d3a'); g.addColorStop(1, '#2f5226');
        x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(lx, ly, w, h, w / 2) : x.rect(lx, ly, w, h); x.fill();
        x.strokeStyle = 'rgba(20,40,15,0.35)'; x.lineWidth = 1.5; for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(lx + w * k / 4, ly + w / 2); x.lineTo(lx + w * k / 4, ly + h - 4); x.stroke(); }
      };
      limb(70, 30, 36, 284);
      limb(22, 120, 26, 90); limb(22, 186, 56, 24);
      if (r() < 0.7) { limb(124, 80, 26, 100); limb(96, 160, 54, 22); }
      return { img: c, ww: 360, wh: 680 };
    },
    rock(v) {
      const [c, x] = canvas(240, 150), r = rng(v + 80);
      const pts = []; for (let i = 0; i < 9; i++) { const a = Math.PI + i * Math.PI / 8; pts.push([120 + Math.cos(a) * (100 + r() * 20), 146 + Math.sin(a) * (110 + r() * 30)]); }
      x.fillStyle = '#a5765a'; x.beginPath(); x.moveTo(10, 148); pts.forEach(p => x.lineTo(p[0], Math.min(148, p[1]))); x.lineTo(230, 148); x.fill();
      for (let i = 0; i < pts.length - 1; i++) { x.fillStyle = i < 4 ? 'rgba(255,230,200,0.18)' : 'rgba(40,20,10,0.22)'; x.beginPath(); x.moveTo(120, 120); x.lineTo(pts[i][0], Math.min(148, pts[i][1])); x.lineTo(pts[i + 1][0], Math.min(148, pts[i + 1][1])); x.fill(); }
      grain(x, 240, 150, 0.4, 12);
      return { img: c, ww: 440, wh: 280 };
    },
    lamp() {
      const [c, x] = canvas(200, 400);
      const g = x.createLinearGradient(20, 0, 32, 0); g.addColorStop(0, '#8a8d92'); g.addColorStop(1, '#45484d');
      x.fillStyle = g; x.fillRect(20, 30, 12, 366); x.fillRect(14, 380, 24, 18);
      x.strokeStyle = '#5a5d62'; x.lineWidth = 8; x.beginPath(); x.moveTo(26, 40); x.quadraticCurveTo(40, 14, 120, 20); x.stroke();
      x.fillStyle = '#3b3e42'; x.beginPath(); x.ellipse(150, 24, 40, 12, 0, 0, 7); x.fill();
      x.fillStyle = '#f4ecd2'; x.beginPath(); x.ellipse(150, 30, 30, 5, 0, 0, 7); x.fill();
      return { img: c, ww: 420, wh: 840, ax: 26 / 200 };
    },
    signal() {
      const [c, x] = canvas(280, 380);
      x.fillStyle = '#3a3d40'; x.fillRect(20, 40, 14, 340); x.fillRect(20, 40, 220, 12);
      x.fillStyle = '#1e1f22'; x.beginPath(); x.roundRect ? x.roundRect(200, 52, 50, 130, 8) : x.rect(200, 52, 50, 130); x.fill();
      for (let i = 0; i < 3; i++) { x.fillStyle = '#0c0c0d'; x.beginPath(); x.arc(225, 76 + i * 40, 15, 0, 7); x.fill(); }
      x.fillStyle = '#e8c33a'; x.fillRect(196, 52, 4, 130);
      return { img: c, ww: 600, wh: 820, ax: 27 / 280 };
    },
    pole() {
      const [c, x] = canvas(200, 440);
      const g = x.createLinearGradient(92, 0, 108, 0); g.addColorStop(0, '#8a6a48'); g.addColorStop(1, '#4a3420');
      x.fillStyle = g; x.fillRect(92, 20, 16, 420);
      x.fillStyle = '#5a4128'; x.fillRect(20, 40, 160, 10); x.fillRect(40, 80, 120, 8);
      x.fillStyle = '#d8dadc'; for (const px of [28, 70, 130, 172]) x.fillRect(px - 3, 30, 6, 10);
      return { img: c, ww: 400, wh: 880 };
    },
    fence() {
      const [c, x] = canvas(220, 90);
      const wood = y => { const g = x.createLinearGradient(0, y, 0, y + 10); g.addColorStop(0, '#a5865e'); g.addColorStop(1, '#6b5034'); return g; };
      x.fillStyle = wood(16); x.fillRect(0, 16, 220, 10); x.fillStyle = wood(46); x.fillRect(0, 46, 220, 10);
      x.fillStyle = '#5e452c'; x.fillRect(4, 6, 12, 84); x.fillRect(204, 6, 12, 84);
      grain(x, 220, 90, 0.35, 6);
      return { img: c, ww: 440, wh: 180 };
    },
    guard() {
      const [c, x] = canvas(220, 60);
      x.fillStyle = '#7d8084'; x.fillRect(100, 18, 12, 42);
      const g = x.createLinearGradient(0, 8, 0, 30); g.addColorStop(0, '#f1f3f4'); g.addColorStop(0.5, '#a9adb1'); g.addColorStop(1, '#e2e5e7');
      x.fillStyle = g; x.fillRect(0, 8, 220, 22);
      x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(0, 18, 220, 2);
      return { img: c, ww: 440, wh: 130 };
    },
    barn() {
      const [c, x] = canvas(500, 420);
      x.fillStyle = '#9a3a2b'; x.fillRect(30, 170, 440, 250);
      for (let px = 30; px < 470; px += 14) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(px, 170, 2, 250); }
      x.fillStyle = '#5a2a22'; x.beginPath(); x.moveTo(10, 180); x.lineTo(250, 40); x.lineTo(490, 180); x.fill();
      x.fillStyle = '#4a221b'; x.fillRect(10, 176, 480, 10);
      x.strokeStyle = '#efe6d2'; x.lineWidth = 8; x.strokeRect(180, 260, 140, 160); x.beginPath(); x.moveTo(180, 260); x.lineTo(320, 420); x.moveTo(320, 260); x.lineTo(180, 420); x.stroke();
      x.fillStyle = '#efe6d2'; x.fillRect(225, 190, 50, 40); x.fillStyle = '#2b2b2b'; x.fillRect(231, 196, 38, 28);
      grain(x, 500, 420, 0.3, 8);
      return { img: c, ww: 1100, wh: 920 };
    },
    sign(dir) {
      const [c, x] = canvas(160, 260);
      x.fillStyle = '#6d7076'; x.fillRect(74, 110, 12, 150);
      x.fillStyle = '#f2c230'; x.beginPath(); x.roundRect ? x.roundRect(10, 20, 140, 100, 8) : x.rect(10, 20, 140, 100); x.fill();
      x.strokeStyle = '#111'; x.lineWidth = 4; x.strokeRect(16, 26, 128, 88);
      x.fillStyle = '#111'; x.beginPath();
      for (let i = -1; i <= 1; i++) { const cx = 80 + i * 36; x.moveTo(cx - dir * 14, 38); x.lineTo(cx + dir * 14, 70); x.lineTo(cx - dir * 14, 102); x.lineTo(cx - dir * 2, 70); x.closePath(); }
      x.fill();
      return { img: c, ww: 300, wh: 490 };
    },
  };
  const VARIANTS = { tree: 3, pine: 3, palm: 2, bush: 2, cactus: 3, rock: 3 };
  function sprite(kind, seed) {
    const n = VARIANTS[kind] || 1, v = kind === 'sign' ? (seed > 0 ? 1 : -1) : Math.abs(seed | 0) % n;
    return once('sp' + kind + v, () => SPRITES[kind](v));
  }
  // billboards: a painted advert per slogan
  function billboard(word, color) {
    return once('bill' + word, () => {
      const [c, x] = canvas(480, 300), r = rng(word.length * 31);
      x.fillStyle = '#5a5d62'; x.fillRect(110, 200, 16, 100); x.fillRect(354, 200, 16, 100);
      x.fillStyle = '#f4f0e4'; x.fillRect(10, 10, 460, 200);
      const g = x.createLinearGradient(0, 18, 0, 202); g.addColorStop(0, color); g.addColorStop(1, tone(color, 0.6));
      x.fillStyle = g; x.fillRect(18, 18, 444, 184);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.arc(390, 110, 70, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(390, 110, 44, 0, 7); x.fill();
      x.fillStyle = color; x.font = '900 40px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(word[0], 390, 112);
      x.fillStyle = '#fff'; x.font = '900 52px Impact, "Arial Black", sans-serif'; x.textAlign = 'left';
      const parts = word.split(' ');
      x.fillText(parts[0], 40, parts[1] ? 80 : 110); if (parts[1]) x.fillText(parts[1], 40, 140);
      x.fillStyle = 'rgba(255,255,255,0.75)'; x.font = 'bold 18px Arial, sans-serif'; x.fillText(['NOW OPEN', 'NEXT EXIT', 'SINCE 1971', 'CALL TODAY'][(r() * 4) | 0], 42, 182);
      grain(x, 480, 300, 0.2, 2);
      return { img: c, ww: 1000, wh: 620 };
    });
  }

  // ---------- sky and backdrops
  function cloud(v) {
    return once('cloud' + v, () => {
      const [c, x] = canvas(320, 130), r = rng(v * 17 + 2);
      for (let i = 0; i < 26; i++) {
        const px = 40 + r() * 240, py = 60 + (r() - 0.5) * 40 - Math.sin((px - 40) / 240 * Math.PI) * 25, rad = 18 + r() * 28;
        const g = x.createRadialGradient(px - rad * 0.3, py - rad * 0.4, rad * 0.2, px, py, rad);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, 'rgba(236,242,248,0.9)'); g.addColorStop(1, 'rgba(200,214,228,0)');
        x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill();
      }
      return c;
    });
  }
  const BW = 2048, BH = 320;
  function backdrop(kind) {
    return once('back' + kind, () => {
      const [c, x] = canvas(BW, BH), r = rng(kind.length * 101);
      const ridge = (base, amp, freq, col, seed) => {
        const rr = rng(seed); const ph = [rr() * 9, rr() * 9, rr() * 9];
        x.fillStyle = col; x.beginPath(); x.moveTo(0, BH);
        for (let px = 0; px <= BW; px += 8) {
          // periodic in the width so the backdrop tiles seamlessly
          const t = px / BW * Math.PI * 2;
          const y = base - amp * (0.55 * Math.sin(t * freq + ph[0]) + 0.3 * Math.sin(t * freq * 2.3 + ph[1]) + 0.15 * Math.sin(t * freq * 5.1 + ph[2]));
          x.lineTo(px, y);
        }
        x.lineTo(BW, BH); x.fill();
      };
      if (kind === 'skyline') {
        for (const [layer, col, hk] of [[0, '#a9b6c3', 1], [1, '#8796a6', 0.75]]) {
          let px = -20;
          while (px < BW) {
            const w = 40 + r() * 70, h = (60 + r() * 190) * hk, top = BH - h;
            x.fillStyle = tone(col, 0.92 + r() * 0.16); x.fillRect(px, top, w, h);
            if (r() < 0.25) { x.fillRect(px + w * 0.4, top - 30, w * 0.2, 30); x.fillRect(px + w * 0.48, top - 50, 3, 20); }
            x.fillStyle = layer ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.15)';
            for (let wy = top + 8; wy < BH - 6; wy += 9) for (let wx = px + 5; wx < px + w - 5; wx += 7) if (r() < 0.55) x.fillRect(wx, wy, 3, 4);
            px += w + (r() < 0.2 ? 10 : 1);
          }
        }
      } else if (kind === 'sea') {
        ridge(BH - 30, 50, 3, '#7d8f73', 3); ridge(BH - 14, 22, 5, '#64795e', 4);
      } else if (kind === 'peaks') {
        ridge(BH - 60, 200, 4, '#8fa4bb', 5);
        // snow on the high ground of the far range
        x.save(); x.globalCompositeOperation = 'source-atop'; const sg = x.createLinearGradient(0, 0, 0, BH - 120); sg.addColorStop(0, '#f4f7fa'); sg.addColorStop(1, 'rgba(244,247,250,0)'); x.fillStyle = sg; x.fillRect(0, 0, BW, BH - 120); x.restore();
        ridge(BH - 30, 110, 6, '#6f8a74', 6); ridge(BH - 8, 50, 9, '#4f6f50', 7);
      } else if (kind === 'hills') {
        ridge(BH - 40, 60, 3, '#9cbd84', 8); ridge(BH - 20, 40, 5, '#7da862', 9);
        for (let k = 0; k < 400; k++) { x.fillStyle = r() < 0.5 ? '#4f7d3a' : '#3f6e2c'; x.beginPath(); x.arc(r() * BW, BH - 10 - r() * 40, 2 + r() * 4, 0, 7); x.fill(); }
      } else if (kind === 'mesas') {
        let px = 0;
        while (px < BW) {
          const w = 120 + r() * 260, h = 40 + r() * 110, top = BH - h;
          x.fillStyle = tone('#c4805a', 0.9 + r() * 0.2); x.beginPath(); x.moveTo(px, BH); x.lineTo(px + w * 0.15, top); x.lineTo(px + w * 0.85, top); x.lineTo(px + w, BH); x.fill();
          for (let s = top + 8; s < BH; s += 10 + r() * 10) { x.fillStyle = 'rgba(120,60,40,0.18)'; x.fillRect(px + w * 0.15, s, w * 0.7, 3); }
          px += w + 80 + r() * 300;
        }
      }
      grain(x, BW, BH, 0.12, 3);
      return c;
    });
  }

  // ---------- traffic, seen from behind (going your way) or from the front (coming at you)
  function vehicle(kind, color, dir) {
    return once('car' + kind + color + dir, () => {
      const [c, x] = canvas(300, 240);
      const W = 300, base = 226, tall = kind === 'truck' ? 220 : kind === 'van' ? 170 : 135, wide = kind === 'truck' ? 290 : kind === 'van' ? 270 : 260;
      const L = (W - wide) / 2, R = L + wide, top = base - tall;
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(W / 2, base + 6, wide * 0.56, 10, 0, 0, 7); x.fill();
      x.fillStyle = '#121214'; x.fillRect(L + 14, base - 30, 40, 36); x.fillRect(R - 54, base - 30, 40, 36);
      const body = kind === 'truck' && dir > 0 ? '#e8e8e2' : color;
      const g = x.createLinearGradient(0, top, 0, base);
      g.addColorStop(0, tone(body, 1.18)); g.addColorStop(0.5, body); g.addColorStop(1, tone(body, 0.5));
      x.fillStyle = g;
      x.beginPath();
      if (kind === 'car') { x.moveTo(L, base - 20); x.lineTo(L + 6, top + 50); x.lineTo(L + 40, top + 4); x.lineTo(R - 40, top + 4); x.lineTo(R - 6, top + 50); x.lineTo(R, base - 20); x.closePath(); }
      else { x.roundRect ? x.roundRect(L, top, wide, tall - 16, 10) : x.rect(L, top, wide, tall - 16); }
      x.fill();
      // windows
      if (kind === 'car' || dir < 0) {
        const wy = kind === 'car' ? top + 10 : top + 14, wh = kind === 'car' ? 40 : 50;
        const wg = x.createLinearGradient(0, wy, 0, wy + wh); wg.addColorStop(0, '#b9d3e2'); wg.addColorStop(0.6, '#4d6878'); wg.addColorStop(1, '#1f2a32');
        x.fillStyle = wg; x.beginPath(); x.moveTo(L + 46, wy); x.lineTo(R - 46, wy); x.lineTo(R - 22, wy + wh); x.lineTo(L + 22, wy + wh); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.3)'; x.beginPath(); x.moveTo(L + 60, wy); x.lineTo(L + 90, wy); x.lineTo(L + 60, wy + wh); x.lineTo(L + 36, wy + wh); x.fill();
      } else {
        x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(W / 2 - 2, top + 8, 4, tall - 30);
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(L + 20, top + 30, 6, 30); x.fillRect(R - 26, top + 30, 6, 30);
        if (kind === 'truck') { x.fillStyle = color; x.fillRect(L + 20, top + 70, wide - 40, 40); x.fillStyle = '#fff'; x.font = 'bold 26px Impact, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('FREIGHT', W / 2, top + 100); }
      }
      // bumper, lights, plate
      x.fillStyle = tone(body, 0.35); x.fillRect(L - 2, base - 36, wide + 4, 16);
      x.fillStyle = '#c9ccd0'; x.fillRect(L + 2, base - 38, wide - 4, 3);
      if (dir < 0) {
        x.fillStyle = '#fff6d0'; x.fillRect(L + 12, base - 66, 46, 18); x.fillRect(R - 58, base - 66, 46, 18);
        x.fillStyle = 'rgba(255,246,208,0.35)'; x.beginPath(); x.ellipse(L + 35, base - 57, 40, 22, 0, 0, 7); x.ellipse(R - 35, base - 57, 40, 22, 0, 0, 7); x.fill();
        x.fillStyle = '#2b2d31'; x.fillRect(W / 2 - 40, base - 70, 80, 22); for (let k = 0; k < 5; k++) { x.fillStyle = '#55585e'; x.fillRect(W / 2 - 36, base - 67 + k * 4, 72, 2); }
      } else {
        x.fillStyle = '#b3141c'; x.fillRect(L + 8, base - 70, 42, 22); x.fillRect(R - 50, base - 70, 42, 22);
        x.fillStyle = 'rgba(255,60,60,0.5)'; x.fillRect(L + 12, base - 66, 34, 6); x.fillRect(R - 46, base - 66, 34, 6);
      }
      x.fillStyle = '#e9e4c4'; x.fillRect(W / 2 - 26, base - 34, 52, 14); x.fillStyle = '#334'; x.fillRect(W / 2 - 20, base - 30, 40, 6);
      grain(x, W, 240, 0.15, 13);
      // the image is wider than the vehicle; scale it so the vehicle comes out its real width
      const ww = (kind === 'truck' ? 520 : kind === 'van' ? 430 : 380) * W / wide;
      return { img: c, ww, wh: ww * 240 / W, base: (base + 8) / 240 };
    });
  }

  return { facade, shopfront, rock, sprite, billboard, cloud, backdrop, vehicle, FACADES, PX, FW, FH, FLOOR, BW, BH };
})();
