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

  // A session description as a URL-safe code: 'z' + deflated, or 'r' + raw where
  // CompressionStream is missing.
  async function pack(desc) {
    const raw = new TextEncoder().encode(JSON.stringify({ type: desc.type, sdp: desc.sdp }));
    if (typeof CompressionStream === 'function') return 'z' + b64url(await streamBytes(raw, CompressionStream));
    return 'r' + b64url(raw);
  }
  async function unpack(code) {
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
    const m = /^#(offer|answer)=([a-z0-9]{6})\.([zr][A-Za-z0-9_-]+)$/.exec(hash || '');
    return m ? { kind: m[1], id: m[2], code: m[3] } : null;
  }

  // Finds a reply in pasted text: a whole link, or just 'ID.CODE'.
  function parseReply(text) {
    const m = /(?:answer=)?([a-z0-9]{6})\.([zr][A-Za-z0-9_-]+)/.exec(String(text).trim());
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

  return { host, join, forwardReply, fromHash, parseReply, pageLink, pack, unpack, share, route, ICE, hasRelay: () => RELAY.length > 0 };
})();
