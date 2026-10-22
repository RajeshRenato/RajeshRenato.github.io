'use strict';
// Group chats. Everyone connects to the host's browser, which passes messages on
// (linkplay/room.js). On top of that, every message is encrypted end to end:
//
// - Each member makes an ECDH P-256 key pair and shares the public half.
// - Every pair of members derives a shared AES-GCM key (ECDH, then HKDF-SHA256).
// - A message is encrypted once with a fresh random key, and that key is wrapped
//   for each member with the pair key. The sender and recipient ids are bound in
//   as associated data, so nobody can pass a message off as someone else's.
// - The group safety code is a hash of every member's public key. If anyone
//   swapped a key to listen in, members would see different codes.
//
// The host relays the sealed messages without being able to open the ones not
// meant for it, and it can't forge one from another member.

const GROUP = (() => {
  const NAME = 'secret-chat-group';
  const MAX_FILE = 5 * 1024 * 1024, CHUNK = 12 * 1024;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const g = { active: false, room: null, me: -1, keys: null, pub: '', members: new Map(), code: null, verified: '', inbox: Promise.resolve(), files: new Map(), joining: null };

  // --- bytes

  function b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const unb64 = s => Uint8Array.from(atob(String(s || '')), c => c.charCodeAt(0));
  const rand = n => crypto.getRandomValues(new Uint8Array(n));

  // --- keys

  async function makeKeys() {
    g.keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    g.pub = b64(new Uint8Array(await crypto.subtle.exportKey('raw', g.keys.publicKey)));
  }

  async function pairKey(theirPub) {
    const pub = await crypto.subtle.importKey('raw', unb64(theirPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, g.keys.privateKey, 256);
    const base = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode([g.pub, theirPub].sort().join('|')), info: enc.encode('secret-chat group v1') },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function groupCode(pubs) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(pubs.slice().sort().join('|'))));
    return { words: [0, 1, 2].map(i => SAS_WORDS[hash[i] % 64]), digits: String(((hash[3] << 8) | hash[4]) % 10000).padStart(4, '0') };
  }

  // --- sealing and opening

  async function seal(body) {
    const raw = rand(32);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    const iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(body))));
    const keys = {};
    for (const [id, m] of g.members) {
      if (id === g.me || !m.pair) continue;
      const wiv = rand(12);
      const wk = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wiv, additionalData: enc.encode(g.me + '>' + id) }, m.pair, raw));
      keys[id] = [b64(wiv), b64(wk)];
    }
    return { t: 'e', iv: b64(iv), ct: b64(ct), keys };
  }

  async function unseal(env, from) {
    const sender = g.members.get(from);
    const mine = env && env.keys && env.keys[g.me];
    if (!sender || !sender.pair || !Array.isArray(mine)) return null;
    try {
      const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(mine[0]), additionalData: enc.encode(from + '>' + g.me) }, sender.pair, unb64(mine[1]));
      const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.ct));
      const body = JSON.parse(dec.decode(pt));
      return body && typeof body === 'object' ? body : null;
    } catch (e) { return null; }
  }

  // --- members and the group code

  async function setMembers(list) {
    if (!Array.isArray(list)) return;
    const next = new Map();
    for (const m of list.slice(0, 12)) {
      if (!m || typeof m.pub !== 'string' || !(m.id >= 0)) continue;
      const old = g.members.get(m.id);
      let pair = old && old.pub === m.pub ? old.pair : null;
      if (!pair && m.id !== g.me) { try { pair = await pairKey(m.pub); } catch (e) { continue; } }
      next.set(m.id, { id: m.id, name: String(m.name || 'Someone').slice(0, 16), color: String(m.color || '#888').slice(0, 9), pub: m.pub, pair });
    }
    const before = g.code ? g.code.words.join(' ') + g.code.digits : '';
    g.members = next;
    g.code = next.size > 1 ? await groupCode([...next.values()].map(m => m.pub)) : null;
    const after = g.code ? g.code.words.join(' ') + g.code.digits : '';
    if (before && after !== before) {
      g.verified = '';
      sys('The group changed, so the safety code changed. Compare the new one with everyone.', true);
    }
    renderHeader();
  }

  function memberList() {
    return g.room.players.filter(p => keysById[p.id]).map(p => ({ id: p.id, name: p.name, color: p.color, pub: keysById[p.id] }));
  }
  const keysById = {};

  function hostShare() {
    const list = memberList();
    g.room.send({ t: 'members', list });
    return setMembers(list);
  }

  // --- the room

  function startWithRoom(room) {
    g.room = room;
    g.active = true;
    g.me = room.isHost ? 0 : room.me;
    open = true;
    room.on('message', (m, from) => { g.inbox = g.inbox.then(() => receive(m, from)).catch(() => { }); });
    room.on('roster', () => {
      if (room.isHost) { for (const id of Object.keys(keysById)) if (!room.players.some(p => p.id === +id)) delete keysById[id]; hostShare(); }
      if (!room.isHost && g.me < 0) g.me = room.me;
    });
    room.on('leave', () => { if (room.isHost) hostShare(); });
    room.on('close', () => { g.active = false; peerGone('The host left, so the group chat ended. Everything here disappears when you close this tab.'); });
    if (room.isHost) { keysById[0] = g.pub; hostShare(); }
    else room.send({ t: 'key', pub: g.pub });
    show('chat');
    $('dot').classList.remove('off');
    $('send').disabled = !$('input').value.trim();
    sys('You\'re in a group chat. Messages are encrypted end to end, so the host passes them on but can\'t read anyone else\'s.');
    sys('When everyone is in, compare the group safety code on a call before sending anything sensitive.', true);
    renderHeader();
  }

  async function receive(m, from) {
    if (!m || typeof m !== 'object') return;
    const room = g.room;
    if (room.isHost) {
      if (m.t === 'key' && typeof m.pub === 'string' && m.pub.length < 200 && from > 0) { keysById[from] = m.pub; await hostShare(); return; }
      if (m.t === 'e' || m.t === 'fc' || m.t === 'typing') room.send(Object.assign({}, m, { from }));
      if (m.t === 'e') return handleSealed(m, from);
      if (m.t === 'fc') return fileChunk(m, from);
      if (m.t === 'typing') return typing(from);
      return;
    }
    if (m.t === 'members') return setMembers(m.list);
    if (m.t === 'wipe') { wipe(); sys('The host wiped the chat for everyone.'); return; }
    const sender = +m.from;
    if (sender === g.me) return;
    if (m.t === 'e') return handleSealed(m, sender);
    if (m.t === 'fc') return fileChunk(m, sender);
    if (m.t === 'typing') return typing(sender);
  }

  async function handleSealed(env, from) {
    const body = await unseal(env, from);
    if (!body) return;
    const who = g.members.get(from);
    if (body.k === 'msg') {
      addMessage({ id: from + ':' + String(body.id).slice(0, 40), text: String(body.text || '').slice(0, 20000), mine: false, secret: !!body.secret, ttl: +body.ttl || 0, who });
      showTyping(false);
    } else if (body.k === 'file') {
      const size = Math.max(0, Math.min(+body.size || 0, MAX_FILE));
      const meta = { name: String(body.name || 'file').slice(0, 200), size, mime: String(body.mime || ''), ttl: +body.ttl || 0 };
      let key = null;
      try { key = await crypto.subtle.importKey('raw', unb64(body.key), 'AES-GCM', false, ['decrypt']); } catch (e) { return; }
      const id = from + ':' + String(body.id).slice(0, 40);
      const rec = fileBubble(id, meta, false, who);
      g.files.set(id, { key, meta, parts: [], got: 0, rec, next: 0 });
      if (size === 0) rec.done(new Blob([], { type: meta.mime || 'application/octet-stream' }));
    } else if (body.k === 'verified') {
      sys((who ? who.name : 'Someone') + ' says the group safety code matches.');
    }
  }

  async function fileChunk(m, from) {
    const id = from + ':' + String(m.id).slice(0, 40);
    const f = g.files.get(id);
    if (!f || +m.n !== f.next) return;
    let bytes;
    try { bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) }, f.key, unb64(m.data))); } catch (e) { return; }
    f.next++;
    f.parts.push(bytes);
    f.got += bytes.length;
    f.rec.setProgress(f.meta.size ? f.got / f.meta.size : 1);
    if (f.got >= f.meta.size) {
      g.files.delete(id);
      f.rec.done(new Blob(f.parts, { type: f.meta.mime || 'application/octet-stream' }));
    }
  }

  let typingAt = 0;
  function typing(from) {
    const who = g.members.get(from);
    clearTimeout(typingAt);
    $('typing').textContent = (who ? who.name : 'Someone') + ' is typing…';
    typingAt = setTimeout(() => { $('typing').textContent = ''; }, 3000);
  }

  // --- sending

  async function sendBody(body) {
    if (g.members.size < 2) { sys('Nobody else is here yet. Invite someone first.', true); return false; }
    const env = await seal(body);
    g.room.send(g.room.isHost ? Object.assign(env, { from: 0 }) : env);
    return true;
  }

  async function sendText() {
    const text = $('input').value;
    if (!text.trim() || !g.active) return;
    const secret = $('secretChip').getAttribute('aria-pressed') === 'true';
    const ttl = +$('timer').value;
    const id = newId();
    $('input').value = '';
    autosize();
    $('send').disabled = true;
    if (secret) setSecret(false);
    if (await sendBody({ k: 'msg', id, text, secret, ttl })) addMessage({ id: 'me:' + id, text, mine: true, secret, ttl });
  }

  let queue = Promise.resolve();
  function sendFiles(files) {
    for (const f of files) queue = queue.then(() => sendFile(f)).catch(() => sys('A file could not be sent.', true));
  }

  async function sendFile(file) {
    if (!g.active) return;
    if (file.size > MAX_FILE) { sys(file.name + ' is over 5 MB. In a group, every file goes to everyone through the host, so keep them small, or use File Send.', true); return; }
    const raw = rand(32);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    const id = newId();
    const ttl = +$('timer').value;
    if (!await sendBody({ k: 'file', id, name: file.name, size: file.size, mime: file.type, ttl, key: b64(raw) })) return;
    const rec = fileBubble('me:' + id, { name: file.name, size: file.size, mime: file.type, ttl }, true);
    const buf = new Uint8Array(await file.arrayBuffer());
    let n = 0;
    for (let off = 0; off < buf.length; off += CHUNK) {
      while (g.room.buffered() > 512 * 1024) await new Promise(r => setTimeout(r, 30));
      const iv = rand(12);
      const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf.subarray(off, off + CHUNK)));
      const m = { t: 'fc', id, n: n++, iv: b64(iv), data: b64(data) };
      g.room.send(g.room.isHost ? Object.assign(m, { from: 0 }) : m);
      rec.setProgress(Math.min(1, (off + CHUNK) / buf.length));
    }
    rec.done(new Blob([buf], { type: file.type || 'application/octet-stream' }));
  }

  // --- header, members, and the code sheet

  function renderHeader() {
    if (!g.active) return;
    const n = g.members.size;
    $('peerName').textContent = 'Group chat';
    $('peerState').textContent = n + (n === 1 ? ' person: ' : ' people: ') + [...g.members.values()].map(m => m.name + (m.id === g.me ? ' (you)' : '')).join(', ');
    const chip = $('sasChip');
    chip.hidden = !g.code;
    if (!g.code) return;
    const code = g.code.words.join(' · ') + ' ' + g.code.digits;
    const ok = g.verified === code;
    chip.classList.toggle('ok', ok);
    if (chip.firstChild) chip.firstChild.textContent = ok ? '✓ ' : '⚠ ';
    $('sasShort').textContent = ok ? 'Verified' : g.code.words.join(' · ');
    $('sasWords').textContent = g.code.words.join(' · ');
    $('sasDigits').textContent = g.code.digits;
    $('wipeBtn').textContent = g.room.isHost ? 'Wipe all' : 'Clear';
    $('inviteMore').hidden = !g.room.isHost;
  }

  function verify() {
    if (!g.code) return;
    g.verified = g.code.words.join(' · ') + ' ' + g.code.digits;
    renderHeader();
    sys('You marked the group safety code as matching.');
    sendBody({ k: 'verified' });
  }

  function mismatch() {
    sys('The codes don\'t match, so someone may be listening in. Leave this chat and start a new one, sending the links a different way.', true);
    leave();
  }

  function wipeAll() {
    wipe();
    if (g.room.isHost) { g.room.send({ t: 'wipe' }); sys('You wiped the chat for everyone.'); }
    else sys('You cleared the chat on your screen.');
  }

  function leave() {
    try { g.room.close(); } catch (e) { }
    g.active = false;
    location.replace(location.pathname);
  }

  async function details() {
    const rows = [
      ['Encryption', 'End to end: AES-256-GCM per message, with keys from ECDH P-256 between each pair of members'],
      ['Links', 'DTLS between each member and the host, like every WebRTC connection'],
      ['Host', g.room.isHost ? 'You. Messages pass through your browser, sealed for each member.' : 'Passes messages on. It can only open the ones sent to it.'],
      ['Members', [...g.members.values()].map(m => m.name).join(', ')],
      ['Stored', 'Nothing. The chat ends when the host leaves or you close the tab.'],
    ];
    if (g.code) rows.push(['Group safety code', g.code.words.join(' · ') + ' ' + g.code.digits + (g.verified ? ' (verified)' : ' (not compared yet)')]);
    const dl = $('detailsList');
    dl.innerHTML = '';
    for (const [k, v] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); }
    $('detailsSheet').hidden = false;
  }

  // --- starting and joining

  const myName = () => (($('guestName').value || $('groupName').value || '').trim().slice(0, 16)) || 'Me';

  async function startHost() {
    await makeKeys();
    const room = Room.create(NAME, myName(), { relay: !noRelay() });
    startWithRoom(room);
    inviteSheet();
  }

  function inviteSheet() {
    $('inviteSheet').hidden = false;
    if (!$('inviteList').children.length) addInvite();
  }

  async function addInvite() {
    const row = document.createElement('div');
    row.className = 'code';
    const input = document.createElement('input');
    input.readOnly = true;
    input.placeholder = 'Making an invite…';
    const btn = document.createElement('button');
    btn.className = 'plain';
    btn.textContent = 'Copy';
    btn.onclick = () => copyText(input.value, btn);
    row.append(input, btn);
    $('inviteList').appendChild(row);
    try { input.value = (await g.room.invite()).replace('#', '?group#'); }
    catch (e) { input.value = ''; input.placeholder = "Couldn't make an invite in this browser"; }
  }

  async function acceptReply() {
    const err = await g.room.accept($('groupReply').value);
    $('groupStatus').textContent = err || 'Connecting… they\'ll show up in the member list.';
    if (!err) $('groupReply').value = '';
  }

  function guestScreen(invite) {
    show('guestScreen');
    $('guestTitle').textContent = 'You\'re invited to a group chat';
    $('guestStatus').textContent = 'Pick the name the others will see, then join.';
    $('groupJoin').hidden = false;
    $('groupJoinBtn').onclick = async () => {
      $('groupJoinBtn').disabled = true;
      $('guestStatus').textContent = 'Setting up a direct connection…';
      try {
        await makeKeys();
        g.joining = await Room.join(NAME, invite, myName(), { onReady: room => startWithRoom(room), onFail: () => failed('guestStatus') });
        try { history.replaceState(null, '', location.pathname); } catch (e) { }
        $('answerLink').value = g.joining.link.replace('#', '?group#');
        $('groupJoin').hidden = true;
        $('guestReply').hidden = false;
        $('guestStatus').textContent = 'Almost there.';
      } catch (e) {
        $('guestStatus').textContent = "This invite didn't work. It may have been used already. Ask for a fresh one.";
      }
    };
  }

  async function forwardReply(reply) {
    show('replyScreen');
    try { history.replaceState(null, '', location.pathname); } catch (e) { }
    if (await LinkPlay.forwardReply(NAME, reply)) {
      $('replyTitle').textContent = 'Connected';
      $('replyMsg').textContent = 'Go back to your group chat tab. You can close this one.';
      return;
    }
    $('replyTitle').textContent = 'Paste this into your group chat';
    $('replyMsg').textContent = "The tab where you started the group isn't open in this browser. Copy this reply and paste it into its invite panel.";
    $('replyCode').value = LinkPlay.pageLink('answer=' + reply.id + '.' + reply.code).replace('#', '?group#');
    $('replyBox').hidden = false;
  }

  function route() {
    if (!/[?&]group\b/.test(location.search)) return false;
    const link = LinkPlay.fromHash();
    if (link && link.kind === 'offer') guestScreen(link);
    else if (link && link.kind === 'answer') forwardReply(link);
    else return false;
    return true;
  }

  return {
    get active() { return g.active; }, g, seal, open: unseal, groupCode, makeKeys, startWithRoom, setMembers,
    startHost, inviteSheet, addInvite, acceptReply, route,
    sendText, sendFiles, typing: () => g.room && g.room.send(g.room.isHost ? { t: 'typing', from: 0 } : { t: 'typing' }), verify, mismatch, wipeAll, leave, details,
  };
})();

$('groupBtn').onclick = () => GROUP.startHost();
$('inviteMore').onclick = () => GROUP.inviteSheet();
$('addInvite').onclick = () => GROUP.addInvite();
$('groupConnect').onclick = () => GROUP.acceptReply();
$('groupReply').addEventListener('keydown', e => { if (e.key === 'Enter') GROUP.acceptReply(); });
$('inviteClose').onclick = () => { $('inviteSheet').hidden = true; };
GROUP.route();
