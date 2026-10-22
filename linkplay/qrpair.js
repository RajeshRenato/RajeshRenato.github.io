// QR pairing: two browsers connect by showing each other QR codes, with no
// server and no link to copy. One side shows an offer as a QR code (a link the
// other side's camera app can open); the other shows its answer as a QR code
// for the first side's camera. Needs common/qr.js, and common/jsqr/jsQR.js for
// reading codes where the browser has no built-in barcode reader.
//
// Used by Phone to Laptop and Couch Party.
'use strict';

// ---- connection details, packed small enough for an easy QR code
//
// A data-channel-only offer or answer is rebuilt from the few values that differ:
// the ICE username and password, the DTLS certificate fingerprint, the DTLS role,
// the media id, and the network candidates with the priorities the browser gave
// them (so it still prefers Wi-Fi over a VPN). About 130 bytes instead of ~800.

const b64url = b => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const TYPES = ['host', 'srflx', 'prflx', 'relay'];
const SETUPS = ['actpass', 'active', 'passive'];

function parseSdp(sdp) {
  const get = k => { const m = new RegExp('^a=' + k + ':(.+)$', 'm').exec(sdp); return m ? m[1].trim() : null; };
  const fp = get('fingerprint');
  if (!fp || !/^sha-256 /i.test(fp)) return null;
  const cands = [];
  for (const m of sdp.matchAll(/^a=candidate:\S+ \d+ (\S+) (\d+) (\S+) (\d+) typ (\S+)/gim)) {
    if (m[1].toLowerCase() !== 'udp' || !TYPES.includes(m[5])) continue;
    cands.push({ type: m[5], addr: m[3], port: +m[4], prio: Math.min(4294967295, +m[2]) });
  }
  return {
    ufrag: get('ice-ufrag'), pwd: get('ice-pwd'), setup: get('setup'), mid: get('mid') || '0',
    fp: fp.slice(8).split(':').map(h => parseInt(h, 16)), cands,
  };
}

function addrBytes(a) {
  let m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
  if (m) return [0, m.slice(1).map(Number)];
  m = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i.exec(a);
  if (m) return [2, m.slice(1).join('').match(/../g).map(h => parseInt(h, 16))];
  if (a.includes(':')) {
    const [head, tail = ''] = a.split('::');
    const h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
    if (!a.includes('::') && h.length !== 8) return null;
    const groups = [...h, ...Array(8 - h.length - t.length).fill('0'), ...t];
    if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
    return [1, groups.flatMap(g => { const v = parseInt(g, 16); return [v >> 8, v & 255]; })];
  }
  return null;
}
function addrText(kind, b) {
  if (kind === 0) return b.join('.');
  const hex = b.map(x => x.toString(16).padStart(2, '0')).join('');
  if (kind === 2) return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-') + '.local';
  return hex.match(/.{4}/g).map(g => g.replace(/^0+(?=.)/, '')).join(':');
}

// { kind: 'offer'|'answer', id: 4 bytes, ...parseSdp } -> base64url text
function packDesc(kind, id, d) {
  const out = [16 | (kind === 'answer' ? 8 : 0) | Math.max(0, SETUPS.indexOf(d.setup)), ...id];
  const str = s => { const b = Array.from(s, c => c.charCodeAt(0) & 127); out.push(b.length, ...b); };
  str(d.ufrag); str(d.pwd); str(d.mid);
  out.push(...d.fp);
  const cands = [];
  for (const c of d.cands) { const a = addrBytes(c.addr); if (a && cands.length < 8) cands.push([c, a]); }
  out.push(cands.length);
  for (const [c, [k, bytes]] of cands) {
    const p = c.prio >>> 0;
    out.push((TYPES.indexOf(c.type) << 2) | k, ...bytes, c.port >> 8, c.port & 255, p >>> 24, (p >>> 16) & 255, (p >>> 8) & 255, p & 255);
  }
  return b64url(Uint8Array.from(out));
}

function unpackDesc(text) {
  try {
    const b = unb64url(String(text).trim());
    let i = 0;
    const need = n => { if (i + n > b.length) throw new Error('short'); };
    const byte = () => { need(1); return b[i++]; };
    const bytes = n => { need(n); const v = Array.from(b.subarray(i, i + n)); i += n; return v; };
    const str = () => String.fromCharCode(...bytes(byte()));
    const head = byte();
    if ((head & 0xf0) !== 16) return null;
    const d = { kind: head & 8 ? 'answer' : 'offer', setup: SETUPS[head & 3] || 'actpass', id: bytes(4) };
    d.ufrag = str(); d.pwd = str(); d.mid = str();
    d.fp = bytes(32);
    d.cands = [];
    for (let n = byte(); n > 0; n--) {
      const t = byte(), k = t & 3;
      if (k > 2) return null;
      const addr = addrText(k, bytes(k === 0 ? 4 : 16));
      const port = (byte() << 8) | byte();
      const prio = ((byte() << 24) >>> 0) + (byte() << 16) + (byte() << 8) + byte();
      d.cands.push({ type: TYPES[t >> 2], addr, port, prio });
    }
    if (!/^[A-Za-z0-9+/]{1,256}$/.test(d.ufrag) || !/^[A-Za-z0-9+/]{1,256}$/.test(d.pwd) || !/^[A-Za-z0-9_-]{1,32}$/.test(d.mid)) return null;
    return d;
  } catch (e) { return null; }
}

function buildSdp(d) {
  const lines = [
    'v=0', 'o=- ' + (1e15 + Math.floor(Math.random() * 8e15)) + ' 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
    'a=group:BUNDLE ' + d.mid, 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
    'a=ice-ufrag:' + d.ufrag, 'a=ice-pwd:' + d.pwd,
    'a=fingerprint:sha-256 ' + d.fp.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(':'),
    'a=setup:' + d.setup, 'a=mid:' + d.mid, 'a=sctp-port:5000', 'a=max-message-size:262144',
  ];
  d.cands.forEach((c, i) => {
    lines.push('a=candidate:' + (i + 1) + ' 1 udp ' + c.prio + ' ' + c.addr + ' ' + c.port + ' typ ' + c.type + (c.type === 'host' ? '' : ' raddr 0.0.0.0 rport 0') + ' generation 0');
  });
  lines.push('a=end-of-candidates');
  return lines.join('\r\n') + '\r\n';
}

function waitIce(conn) {
  return new Promise(res => {
    if (conn.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 2500);
    conn.addEventListener('icegatheringstatechange', () => { if (conn.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
}

function drawQr(cv, text) {
  const qr = makeQR(text, 'M');
  if (!qr) return;
  const quiet = 2, n = qr.size + quiet * 2;
  cv.width = cv.height = n * 8;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#111';
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) g.fillRect((x + quiet) * 8, (y + quiet) * 8, 8, 8);
}

// ---- reading a QR code from a camera

// Starts the camera in video and calls onText(text) for every code it reads,
// until stop() is called. Resolves to { stop } or rejects with the camera error.
// onWait(text), if given, hears that the camera request is still waiting.
async function startScanner(video, onText, onWait) {
  const quiet = onWait && typeof CameraHelp !== 'undefined' ? CameraHelp.watch(onWait) : () => {};
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
  finally { quiet(); }
  video.srcObject = stream;
  try { await video.play(); } catch (e) { }
  let detector = null, timer = 0, live = true;
  try { if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; }
  const grab = document.createElement('canvas');
  async function scan() {
    if (!live) return;
    if (video.videoWidth) {
      let text = null;
      try {
        if (detector) { const found = await detector.detect(video); if (found[0]) text = found[0].rawValue; }
        else {
          const k = Math.min(1, 800 / video.videoWidth);
          grab.width = Math.round(video.videoWidth * k); grab.height = Math.round(video.videoHeight * k);
          const g = grab.getContext('2d', { willReadFrequently: true });
          g.drawImage(video, 0, 0, grab.width, grab.height);
          const img = g.getImageData(0, 0, grab.width, grab.height);
          const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
          if (r) text = r.data;
        }
      } catch (e) { }
      if (text && live) await onText(text);
    }
    if (live) timer = setTimeout(scan, 160);
  }
  scan();
  return { stop() { live = false; clearTimeout(timer); for (const t of stream.getTracks()) t.stop(); video.srcObject = null; } };
}

// A sentence for the camera errors people actually hit (uses common/camera.js when loaded).
async function cameraError(e) {
  if (typeof CameraHelp !== 'undefined') return CameraHelp.explain(e, 'camera');
  const name = e && e.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The camera is blocked for this page. Allow it in the address bar.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found.';
  if (name === 'NotReadableError') return 'Another app is using the camera. Close it and try again.';
  return "Couldn't open the camera.";
}
