// LinkPlay: connect browsers to each other with links, no server of your own.
// See README.md in this folder for the flow and a minimal example.
const LinkPlay = (() => {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

  // A TURN relay carries the traffic only when the two browsers can't reach each
  // other directly. It still can't read anything: the data stays encrypted end to
  // end. Empty means no relay. To turn one on, add a provider's credentials, e.g.
  //   { urls: ['turn:example.relay.com:443?transport=tcp'], username: '...', credential: '...' }
  // See README.md in this folder.
  const RELAY = [];
  const servers = relay => (relay === false || !RELAY.length ? ICE : ICE.concat(RELAY));

  // 'direct' or 'relay' once connected, from the browser's own statistics.
  async function route(pc) {
    try {
      const stats = await pc.getStats();
      const byId = {};
      let pair = null;
      stats.forEach(r => { byId[r.id] = r; });
      stats.forEach(r => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = byId[r.selectedCandidatePairId]; });
      if (!pair) stats.forEach(r => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected)) pair = r; });
      if (!pair) return 'unknown';
      const l = byId[pair.localCandidateId], r = byId[pair.remoteCandidateId];
      return (l && l.candidateType === 'relay') || (r && r.candidateType === 'relay') ? 'relay' : 'direct';
    } catch (e) { return 'unknown'; }
  }

  function b64url(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, c => c.charCodeAt(0));
  }
  async function streamBytes(bytes, Stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate')));
    return new Uint8Array(await res.arrayBuffer());
  }

  // ---- short codes
  // A data-channel-only offer or answer differs from any other in only a few values: the ICE
  // username and password, the DTLS fingerprint and role, and the network addresses. 'k' codes
  // carry just those, packed bit by bit, and the page rebuilds the rest; about 100 characters
  // instead of about 800. Descriptions with audio or video still use 'z'.
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const CAND_TYPES = ['host', 'srflx', 'prflx', 'relay'];
  const SETUPS = ['actpass', 'active', 'passive'];
  function bitWriter() {
    const bytes = []; let acc = 0, n = 0;
    return {
      put(v, bits) { for (let i = bits - 1; i >= 0; i--) { acc = (acc << 1) | ((v >> i) & 1); if (++n === 8) { bytes.push(acc); acc = 0; n = 0; } } },
      done() { if (n) bytes.push(acc << (8 - n)); return Uint8Array.from(bytes); },
    };
  }
  function bitReader(b) {
    let pos = 0;
    return { get(bits) { let v = 0; for (let i = 0; i < bits; i++) { const byte = b[pos >> 3]; if (byte === undefined) throw new Error('short'); v = (v << 1) | ((byte >> (7 - (pos & 7))) & 1); pos++; } return v; } };
  }
  // address kinds: 0 IPv4, 1 IPv6, 2 an mDNS name (a uuid ending in .local)
  function addrBytes(a) {
    let m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
    if (m) return [0, m.slice(1).map(Number)];
    m = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i.exec(a);
    if (m) return [2, m.slice(1).join('').match(/../g).map(h => parseInt(h, 16))];
    if (a.includes(':')) {
      const [head, tail = ''] = a.split('::');
      const h = head ? head.split(':') : [], t = tail ? tail.split(':') : [];
      const groups = a.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
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
  // the addresses worth sending: the public one (for players on other networks) and one local
  // one (for players on the same Wi-Fi). IPv6 addresses are long, so they only go when there's
  // no IPv4 public address.
  function pickCands(sdp) {
    const all = [];
    for (const m of sdp.matchAll(/^a=candidate:\S+ \d+ (\S+) (\d+) (\S+) (\d+) typ (\S+)/gim)) {
      if (m[1].toLowerCase() !== 'udp' || !CAND_TYPES.includes(m[5])) continue;
      const a = addrBytes(m[3]);
      if (a) all.push({ type: m[5], kind: a[0], bytes: a[1], port: +m[4] });
    }
    const pick = [], add = c => { if (c && !pick.includes(c) && pick.length < 3) pick.push(c); };
    const by = (type, kinds) => all.find(c => c.type === type && kinds.includes(c.kind));
    add(by('srflx', [0])); add(by('host', [0, 2]));
    if (!pick.some(c => c.type === 'srflx')) { add(by('srflx', [1])); add(by('host', [1])); }
    if (pick.length < 2) add(by('relay', [0, 1]));
    return pick;
  }
  // { type, sdp } -> 'k' code, or null when the description can't be carried this way
  function packShort(desc) {
    const sdp = desc.sdp || '';
    if (/^m=(audio|video)/m.test(sdp)) return null;
    const get = k => { const m = new RegExp('^a=' + k + ':(.+)$', 'm').exec(sdp); return m ? m[1].trim() : null; };
    const ufrag = get('ice-ufrag'), pwd = get('ice-pwd'), fp = get('fingerprint'), setup = get('setup'), mid = get('mid') || '0';
    const ok = s => s && /^[A-Za-z0-9+/]+$/.test(s);
    if (!ok(ufrag) || !ok(pwd) || ufrag.length > 31 || pwd.length > 63 || !fp || !/^sha-256 ([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(fp) || !/^[0-9]{1,3}$/.test(mid) || +mid > 255) return null;
    const cands = pickCands(sdp);
    if (!cands.length) return null;
    const w = bitWriter();
    w.put(1, 2);                                                   // format version
    w.put(desc.type === 'answer' ? 1 : 0, 1);
    w.put(Math.max(0, SETUPS.indexOf(setup)), 2);
    if (mid === '0') w.put(0, 1); else { w.put(1, 1); w.put(+mid, 8); }   // almost always '0'
    w.put(ufrag.length, 5); for (const c of ufrag) w.put(B64.indexOf(c), 6);
    w.put(pwd.length, 6); for (const c of pwd) w.put(B64.indexOf(c), 6);
    for (const h of fp.slice(8).split(':')) w.put(parseInt(h, 16), 8);
    w.put(cands.length, 2);
    for (const c of cands) {
      w.put(CAND_TYPES.indexOf(c.type), 2); w.put(c.kind, 2);
      for (const x of c.bytes) w.put(x, 8);
      w.put(c.port, 16);
    }
    return 'k' + b64url(w.done());
  }
  function unpackShort(code) {
    const r = bitReader(unb64url(code.slice(1)));
    if (r.get(2) !== 1) throw new Error('unknown code version');
    const type = r.get(1) ? 'answer' : 'offer', setup = SETUPS[r.get(2)] || 'actpass', mid = r.get(1) ? String(r.get(8)) : '0';
    let ufrag = '', pwd = '';
    for (let n = r.get(5); n > 0; n--) ufrag += B64[r.get(6)];
    for (let n = r.get(6); n > 0; n--) pwd += B64[r.get(6)];
    const fp = []; for (let i = 0; i < 32; i++) fp.push(r.get(8).toString(16).padStart(2, '0').toUpperCase());
    const lines = [
      'v=0', 'o=- ' + (1e15 + Math.floor(Math.random() * 8e15)) + ' 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
      'a=group:BUNDLE ' + mid, 'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
      'a=ice-ufrag:' + ufrag, 'a=ice-pwd:' + pwd, 'a=fingerprint:sha-256 ' + fp.join(':'),
      'a=setup:' + setup, 'a=mid:' + mid, 'a=sctp-port:5000', 'a=max-message-size:262144',
    ];
    for (let i = 0, n = r.get(2); i < n; i++) {
      const t = CAND_TYPES[r.get(2)], kind = r.get(2);
      if (kind > 2) throw new Error('bad address');
      const bytes = []; for (let j = 0; j < (kind === 0 ? 4 : 16); j++) bytes.push(r.get(8));
      const port = r.get(16), addr = addrText(kind, bytes);
      // priorities as the browser would give them: same-network addresses first, IPv4 a little ahead
      const prio = ((t === 'host' ? 126 : t === 'srflx' ? 100 : 0) << 24) + ((kind === 0 ? 65535 : 65000 - i) << 8) + 255;
      lines.push('a=candidate:' + (i + 1) + ' 1 udp ' + prio + ' ' + addr + ' ' + port + ' typ ' + t + (t === 'host' ? '' : ' raddr 0.0.0.0 rport 0') + ' generation 0');
    }
    lines.push('a=end-of-candidates');
    return { type, sdp: lines.join('\r\n') + '\r\n' };
  }

  // A session description as a URL-safe code: a short 'k' code when it has only a data channel,
  // otherwise 'z' + deflated, or 'r' + raw where CompressionStream is missing.
  async function pack(desc) {
    const short = packShort(desc);
    if (short) return short;
    const raw = new TextEncoder().encode(JSON.stringify({ type: desc.type, sdp: desc.sdp }));
    if (typeof CompressionStream === 'function') return 'z' + b64url(await streamBytes(raw, CompressionStream));
    return 'r' + b64url(raw);
  }
  async function unpack(code) {
    if (code[0] === 'k') return unpackShort(code);
    const body = unb64url(code.slice(1));
    const raw = code[0] === 'z' ? await streamBytes(body, DecompressionStream) : body;
    return JSON.parse(new TextDecoder().decode(raw));
  }

  // No trickle ICE: wait for candidates so the whole description fits in one link.
  function waitIce(pc) {
    return new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const t = setTimeout(resolve, 3500);
      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve(); }
      });
    });
  }

  const newId = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  const pageLink = hash => location.origin + location.pathname + '#' + hash;

  // '#offer=ID.CODE' or '#answer=ID.CODE' in the current URL, or null.
  function fromHash(hash = location.hash) {
    const m = /^#(offer|answer)=([a-z0-9]{6})\.([zrk][A-Za-z0-9_-]+)$/.exec(hash || '');
    return m ? { kind: m[1], id: m[2], code: m[3] } : null;
  }

  // Finds a reply in pasted text: a whole link, or just 'ID.CODE'.
  function parseReply(text) {
    const m = /(?:answer=)?([a-z0-9]{6})\.([zrk][A-Za-z0-9_-]+)/.exec(String(text).trim());
    return m ? { id: m[1], code: m[2] } : null;
  }

  function watch(pc, onFail) {
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' && onFail) onFail();
    });
  }

  // The side that sends invites. One invite connects one friend; call invite()
  // again for each extra player. onChannel(channel, id) fires once per friend.
  // For audio or video, pass media: true (and stream, if you send any); the
  // friend's tracks arrive through onTrack(event, id).
  // relay: false keeps this host's side from ever using the relay.
  function host(name, { onChannel, onFail, media, stream, onTrack, relay } = {}) {
    const invites = new Map();
    let bc = null;
    try {
      bc = new BroadcastChannel('linkplay:' + name);
      bc.onmessage = async e => {
        const d = e.data || {};
        if (d.answer && invites.has(d.id)) {
          bc.postMessage({ ack: d.nonce });
          await accept(d.id + '.' + d.answer);
        }
      };
    } catch (e) { }

    async function invite() {
      const id = newId();
      const pc = new RTCPeerConnection({ iceServers: servers(relay) });
      const channel = pc.createDataChannel(name, { ordered: true });
      if (media || stream) {
        for (const kind of ['audio', 'video']) {
          const track = stream && stream.getTracks().find(t => t.kind === kind);
          pc.addTransceiver(track || kind, { direction: 'sendrecv', streams: stream ? [stream] : [] });
        }
        pc.ontrack = e => onTrack && onTrack(e, id);
      }
      invites.set(id, { pc, channel });
      watch(pc, () => onFail && onFail(id));
      channel.addEventListener('open', () => onChannel && onChannel(channel, id));
      await pc.setLocalDescription(await pc.createOffer());
      await waitIce(pc);
      return { id, link: pageLink('offer=' + id + '.' + await pack(pc.localDescription)) };
    }

    // Returns '' when the reply was taken, or a sentence saying what went wrong.
    async function accept(text) {
      const r = parseReply(text);
      if (!r) return "That doesn't look like a reply link. Paste the whole link your friend sent.";
      const inv = invites.get(r.id);
      if (!inv) return "That reply is for a different invite. Ask your friend to open the invite you sent them.";
      if (inv.pc.signalingState !== 'have-local-offer') return '';
      try {
        await inv.pc.setRemoteDescription(await unpack(r.code));
        return '';
      } catch (e) {
        return "That reply didn't work. Ask your friend to open your invite again and send the new reply.";
      }
    }

    function close() {
      for (const { pc } of invites.values()) { try { pc.close(); } catch (e) { } }
      invites.clear();
      try { if (bc) bc.close(); } catch (e) { }
    }

    return { invite, accept, close, invites };
  }

  // The side that opened an invite. Resolves to the reply link to send back.
  // stream (optional) is sent on the audio and video slots the host offered.
  async function join(name, invite, { onChannel, onFail, stream, onTrack, relay } = {}) {
    const pc = new RTCPeerConnection({ iceServers: servers(relay) });
    watch(pc, onFail);
    pc.ontrack = e => onTrack && onTrack(e);
    pc.ondatachannel = e => {
      const ch = e.channel;
      if (ch.readyState === 'open') onChannel && onChannel(ch);
      else ch.addEventListener('open', () => onChannel && onChannel(ch));
    };
    await pc.setRemoteDescription(await unpack(invite.code));
    if (stream) {
      for (const t of pc.getTransceivers()) {
        const track = stream.getTracks().find(x => x.kind === t.receiver.track.kind);
        if (!track) continue;
        await t.sender.replaceTrack(track);
        t.direction = 'sendrecv';
        if (t.sender.setStreams) t.sender.setStreams(stream);
      }
    }
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc);
    const link = pageLink('answer=' + invite.id + '.' + await pack(pc.localDescription));
    return { pc, link, close: () => { try { pc.close(); } catch (e) { } } };
  }

  // On the page a reply link opens: hand the reply to the host's tab if it is
  // open in this browser. Resolves true if it was taken.
  function forwardReply(name, reply, wait = 1500) {
    return new Promise(resolve => {
      let ch;
      try { ch = new BroadcastChannel('linkplay:' + name); } catch (e) { return resolve(false); }
      const nonce = newId();
      const done = ok => { clearTimeout(t); try { ch.close(); } catch (e) { } resolve(ok); };
      const t = setTimeout(() => done(false), wait);
      ch.onmessage = e => { if (e.data && e.data.ack === nonce) done(true); };
      ch.postMessage({ id: reply.id, answer: reply.code, nonce });
    });
  }

  async function share(text) {
    if (navigator.share) {
      try { await navigator.share({ url: text }); return true; } catch (e) { }
    }
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  return { host, join, forwardReply, fromHash, parseReply, pageLink, pack, unpack, packShort, unpackShort, share, route, ICE, hasRelay: () => RELAY.length > 0 };
})();
