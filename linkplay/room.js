// Room: more than two players on top of LinkPlay. Every guest connects to the
// host, and the host relays, so guests never talk to each other directly.
// Needs linkplay.js loaded first.
//
// Events, via room.on(name, fn):
//   'message' (msg, fromId)   on the host fromId is the guest; on a guest it is 0
//   'roster'  (players)       someone joined or left
//   'leave'   (id)            host only
//   'close'   ()              guest only: the host left or the connection dropped
//   'fail'    ()              a connection couldn't be made
const Room = (() => {
  const COLORS = ['#28e0ff', '#ff4fa3', '#ffd166', '#7dffc9', '#b28cff', '#ff8a5c', '#9be15d', '#ff6b6b'];
  const cleanName = (s, id) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Player ' + (id + 1);
  const parse = raw => { try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };

  function emitter(obj) {
    const subs = {};
    obj.on = (name, fn) => { (subs[name] = subs[name] || []).push(fn); return obj; };
    obj.off = (name, fn) => { subs[name] = (subs[name] || []).filter(f => f !== fn); return obj; };
    return (name, ...args) => { for (const fn of (subs[name] || []).slice()) fn(...args); };
  }

  function create(name, myName, { relay } = {}) {
    const players = [{ id: 0, name: cleanName(myName, 0), color: COLORS[0] }];
    const chans = new Map();
    let nextId = 1;
    const room = { isHost: true, me: 0, players, send, sendTo, invite, close, addChannel, drop, buffered: () => Math.max(0, ...[...chans.values()].map(c => c.bufferedAmount || 0)) };
    const emit = emitter(room);
    const lp = LinkPlay.host(name, { onChannel: ch => addChannel(ch), onFail: () => emit('fail'), relay });
    room.accept = lp.accept;

    function roster() {
      send({ t: '_roster', players });
      emit('roster', players);
    }

    function addChannel(ch) {
      const id = nextId++;
      chans.set(id, ch);
      ch.onmessage = e => {
        const m = parse(e.data);
        if (!m) return;
        if (m.t === '_hello') {
          if (!players.some(p => p.id === id)) players.push({ id, name: cleanName(m.name, id), color: COLORS[id % COLORS.length] });
          sendTo(id, { t: '_you', id });
          roster();
        } else emit('message', m, id);
      };
      ch.onclose = () => drop(id);
      return id;
    }

    function drop(id) {
      if (!chans.has(id)) return;
      const ch = chans.get(id);
      chans.delete(id);
      try { ch.close(); } catch (e) { }
      const i = players.findIndex(p => p.id === id);
      if (i >= 0) players.splice(i, 1);
      emit('leave', id);
      roster();
    }

    function send(m) {
      const s = JSON.stringify(m);
      for (const ch of chans.values()) if (ch.readyState === 'open') ch.send(s);
    }
    function sendTo(id, m) {
      const ch = chans.get(id);
      if (ch && ch.readyState === 'open') ch.send(JSON.stringify(m));
    }

    async function invite() { return (await lp.invite()).link; }

    function close() {
      send({ t: '_closed' });
      for (const ch of chans.values()) { try { ch.close(); } catch (e) { } }
      chans.clear();
      lp.close();
    }

    return room;
  }

  // Guest side, over an open channel.
  function joinChannel(ch, myName) {
    const room = { isHost: false, me: -1, players: [], send, close, buffered: () => ch.bufferedAmount || 0 };
    const emit = emitter(room);
    let closed = false;
    function send(m) { if (ch.readyState === 'open') ch.send(JSON.stringify(m)); }
    function ended() {
      if (closed) return;
      closed = true;
      emit('close');
    }
    function close() {
      closed = true;
      try { ch.close(); } catch (e) { }
    }
    ch.onmessage = e => {
      const m = parse(e.data);
      if (!m) return;
      if (m.t === '_you') room.me = m.id;
      else if (m.t === '_roster') { room.players = m.players; emit('roster', m.players); }
      else if (m.t === '_closed') ended();
      else emit('message', m, 0);
    };
    ch.onclose = ended;
    send({ t: '_hello', name: myName });
    return room;
  }

  // Guest side, from an invite. Resolves to { link, close } right away; the
  // room arrives through onReady(room) once the host takes the reply.
  function join(name, invite, myName, { onReady, onFail, relay } = {}) {
    return LinkPlay.join(name, invite, {
      onChannel: ch => onReady && onReady(joinChannel(ch, myName)),
      onFail,
      relay,
    });
  }

  return { create, join, joinChannel, COLORS };
})();
