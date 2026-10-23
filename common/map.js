// A small map you can drag and zoom, drawn on a canvas from map tiles, with a heatmap layer.
// Shared by Location Map and Live Location. Tiles come from Esri's free basemaps (OpenStreetMap
// and other data); your own locations are never sent anywhere, only the requests for the map images.
'use strict';

const MiniMap = (() => {
  const TILE = 256;
  const STYLES = {
    dark: { url: 'https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', max: 16 },
    light: { url: 'https://{s}.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', max: 19 },
  };
  // Web Mercator: longitude and latitude to a 0..1 square
  const mx = lng => (lng + 180) / 360;
  const my = lat => { const s = Math.sin(Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
  const lngOf = x => x * 360 - 180;
  const latOf = y => { const n = Math.PI - 2 * Math.PI * y; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

  function create(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const m = { lat: 20, lng: 78, zoom: 4, style: opts.style || 'dark', tiles: opts.tiles !== false, layers: [], onChange: null };
    const cache = new Map();
    let W = 0, H = 0, dpr = 1, raf = 0;
    const scale = () => TILE * Math.pow(2, m.zoom);
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      draw();
    }
    // screen pixel of a point, and back
    const toScreen = (lat, lng) => { const s = scale(); return [(mx(lng) - mx(m.lng)) * s + W / 2, (my(lat) - my(m.lat)) * s + H / 2]; };
    const toLatLng = (x, y) => { const s = scale(); return [latOf(my(m.lat) + (y - H / 2) / s), lngOf(mx(m.lng) + (x - W / 2) / s)]; };
    const unitToScreen = (ux, uy) => { const s = scale(); return [(ux - mx(m.lng)) * s + W / 2, (uy - my(m.lat)) * s + H / 2]; };

    function tile(z, x, y) {
      const n = 1 << z, key = z + '/' + x + '/' + y + m.style;
      if (cache.has(key)) return cache.get(key);
      const im = new Image();
      im.referrerPolicy = 'strict-origin-when-cross-origin';
      im.crossOrigin = 'anonymous';
      im.onload = () => schedule();
      // Esri serves the same tiles from two hosts; using both lets twice as many load at once
      im.src = STYLES[m.style].url.replace('{s}', (x + y) & 1 ? 'services' : 'server').replace('{z}', z).replace('{x}', ((x % n) + n) % n).replace('{y}', y);
      cache.set(key, im);
      if (cache.size > 600) cache.delete(cache.keys().next().value);
      return im;
    }
    function drawTiles() {
      const z = Math.max(0, Math.min(STYLES[m.style].max, Math.round(m.zoom))), n = 1 << z, ts = TILE * Math.pow(2, m.zoom - z);
      const cx = mx(m.lng) * n, cy = my(m.lat) * n;
      const x0 = Math.floor(cx - W / 2 / ts), x1 = Math.floor(cx + W / 2 / ts), y0 = Math.max(0, Math.floor(cy - H / 2 / ts)), y1 = Math.min(n - 1, Math.floor(cy + H / 2 / ts));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = (x - cx) * ts + W / 2, py = (y - cy) * ts + H / 2, im = tile(z, x, y);
        if (im.complete && im.naturalWidth) ctx.drawImage(im, px, py, ts + 0.5, ts + 0.5);
        else {
          // while it loads, borrow the parent tile scaled up
          const pz = z - 1, pim = pz >= 0 ? cache.get(pz + '/' + (x >> 1) + '/' + (y >> 1) + m.style) : null;
          if (pim && pim.complete && pim.naturalWidth) ctx.drawImage(pim, (x & 1) * 128, (y & 1) * 128, 128, 128, px, py, ts + 0.5, ts + 0.5);
        }
      }
    }
    function draw() {
      raf = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = m.style === 'dark' ? '#0e1117' : '#e8e6e1';
      ctx.fillRect(0, 0, W, H);
      if (m.tiles) drawTiles();
      else drawGrid();
      for (const L of m.layers) L(ctx, api);
      if (m.tiles) {
        ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'right';
        const t = 'Esri, HERE, Garmin, © OpenStreetMap contributors', tw = ctx.measureText(t).width;
        ctx.fillStyle = m.style === 'dark' ? 'rgba(14,17,23,0.7)' : 'rgba(255,255,255,0.75)'; ctx.fillRect(W - tw - 10, H - 18, tw + 10, 18);
        ctx.fillStyle = m.style === 'dark' ? '#9aa3b2' : '#444'; ctx.fillText(t, W - 5, H - 5); ctx.textAlign = 'left';
      }
      if (m.onChange) m.onChange(api);
    }
    // without map images: a faint grid of latitude and longitude lines
    function drawGrid() {
      ctx.strokeStyle = m.style === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
      const step = [30, 30, 15, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01][Math.max(0, Math.min(12, Math.floor(m.zoom) - 1))] || 0.01;
      const [la1, lo1] = toLatLng(0, 0), [la2, lo2] = toLatLng(W, H);
      ctx.beginPath();
      for (let lo = Math.ceil(lo1 / step) * step; lo <= lo2; lo += step) { const [x] = toScreen(0, lo); ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let la = Math.ceil(la2 / step) * step; la <= la1; la += step) { const [, y] = toScreen(la, 0); ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
    function setView(lat, lng, zoom) { m.lat = Math.max(-85, Math.min(85, lat)); m.lng = lng; if (zoom !== undefined) m.zoom = Math.max(1, Math.min(19, zoom)); schedule(); }
    function fit(points, pad = 40, maxZoom = 15) {
      if (!points.length) return;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [lat, lng] of points) { const x = mx(lng), y = my(lat); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const span = Math.max((x1 - x0) / Math.max(1, W - 2 * pad), (y1 - y0) / Math.max(1, H - 2 * pad), 1e-9);
      const zoom = Math.min(maxZoom, Math.log2(1 / span / TILE));
      setView(latOf((y0 + y1) / 2), lngOf((x0 + x1) / 2), zoom);
    }
    function zoomAt(z, sx, sy) {
      const [lat, lng] = toLatLng(sx, sy);
      m.zoom = Math.max(1, Math.min(19, z));
      // keep the point under the cursor where it is
      const s = scale();
      m.lng = lngOf(mx(lng) - (sx - W / 2) / s); m.lat = latOf(my(lat) - (sy - H / 2) / s);
      schedule();
    }
    // dragging, wheel and pinch zoom, double click or tap to zoom in
    const ptrs = new Map();
    let pinch = null, lastTap = 0;
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e));
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: m.zoom }; }
      const now = Date.now();
      if (ptrs.size === 1 && now - lastTap < 300) zoomAt(m.zoom + 1, ...pos(e));
      lastTap = now;
    });
    canvas.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId), now = pos(e);
      ptrs.set(e.pointerId, now);
      if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; zoomAt(pinch.z + Math.log2(Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
      else if (ptrs.size === 1) { const s = scale(); m.lng = lngOf(mx(m.lng) - (now[0] - prev[0]) / s); m.lat = Math.max(-85, Math.min(85, latOf(my(m.lat) - (now[1] - prev[1]) / s))); if (api.onPan) api.onPan(); schedule(); }
    });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(m.zoom - e.deltaY * 0.002, ...pos(e)); }, { passive: false });
    window.addEventListener('resize', size);

    const api = {
      get lat() { return m.lat; }, get lng() { return m.lng; }, get zoom() { return m.zoom; }, get width() { return W; }, get height() { return H; },
      set tiles(v) { m.tiles = !!v; schedule(); }, get tiles() { return m.tiles; },
      set style(v) { m.style = v; schedule(); },
      set onChange(f) { m.onChange = f; },
      onPan: null,
      addLayer(f) { m.layers.push(f); schedule(); }, clearLayers() { m.layers = []; schedule(); },
      toScreen, toLatLng, unitToScreen, setView, fit, zoomAt, redraw: schedule, resize: size,
      zoomBy(d) { zoomAt(m.zoom + d, W / 2, H / 2); },
    };
    size();
    return api;
  }

  // A heatmap of many points, given as unit coordinates (Float32Array x, y pairs) with optional weights.
  // Points are counted into a coarse grid, spread into soft round spots, and coloured on a log scale.
  function heatLayer(points, weights, { radius = 10, palette = 'fire' } = {}) {
    const COLORS = palette === 'fire'
      ? [[0, 0, 0, 0], [70, 20, 140, 90], [200, 40, 90, 170], [255, 120, 30, 220], [255, 220, 90, 245], [255, 255, 230, 255]]
      : [[0, 0, 0, 0], [20, 80, 200, 110], [30, 170, 230, 190], [120, 230, 200, 230], [255, 255, 255, 255]];
    let off = null, grid = null;
    return (ctx, map) => {
      const W = map.width, H = map.height, cell = 2, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
      if (!grid || grid.length !== gw * gh) { grid = new Float32Array(gw * gh); off = document.createElement('canvas'); off.width = gw; off.height = gh; }
      grid.fill(0);
      const [ox, oy] = map.unitToScreen(0, 0), [ex] = map.unitToScreen(1, 0), s = ex - ox;
      for (let i = 0, n = points.length / 2; i < n; i++) {
        const x = (points[i * 2] * s + ox) / cell, y = (points[i * 2 + 1] * s + oy) / cell;
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        grid[(y | 0) * gw + (x | 0)] += weights ? weights[i] : 1;
      }
      // spread each filled cell over a round spot that fades smoothly to nothing at its edge,
      // so even very busy places stay round on the log scale
      const R = Math.max(2, Math.round(radius * 1.6 / cell)), kw = R * 2 + 1, K = new Float32Array(kw * kw);
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const q = 1 - (x * x + y * y) / (R * R); K[(y + R) * kw + x + R] = q > 0 ? q * q * q : 0; }
      const out = new Float32Array(grid.length);
      for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
        const v = grid[cy * gw + cx];
        if (!v) continue;
        const y0 = Math.max(0, cy - R), y1 = Math.min(gh - 1, cy + R), x0 = Math.max(0, cx - R), x1 = Math.min(gw - 1, cx + R);
        for (let y = y0; y <= y1; y++) { const kr = (y - cy + R) * kw + R - cx, row = y * gw; for (let x = x0; x <= x1; x++) out[row + x] += v * K[kr + x]; }
      }
      grid.set(out);
      let max = 0;
      for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
      if (!max) return;
      const oc = off.getContext('2d'), img = oc.createImageData(gw, gh), d = img.data, lm = Math.log1p(max);
      for (let i = 0; i < grid.length; i++) {
        const v = grid[i];
        if (!v) continue;
        const t = Math.log1p(v) / lm * (COLORS.length - 1), k = Math.min(COLORS.length - 2, Math.floor(t)), f = t - k, a = COLORS[k], b = COLORS[k + 1];
        d[i * 4] = a[0] + (b[0] - a[0]) * f; d[i * 4 + 1] = a[1] + (b[1] - a[1]) * f; d[i * 4 + 2] = a[2] + (b[2] - a[2]) * f; d[i * 4 + 3] = a[3] + (b[3] - a[3]) * f;
      }
      oc.putImageData(img, 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, gw * cell, gh * cell); ctx.restore();
    };
  }

  return { create, heatLayer, mx, my, latOf, lngOf };
})();
