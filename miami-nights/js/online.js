'use strict';
// two-player cops and robbers over LinkPlay. Each browser drives its own car and
// sends where it is; the host runs the rounds and keeps score.

const ROUNDS_TO_WIN = 3;
const SEND_EVERY = 1 / 15;
const BUST_RANGE = 70, BUST_SPEED = 60, BUST_FULL = 2.5;
const SIGHT = 700, PING_EVERY = 8, PING_SHOW = 1.5;
const COUNTDOWN = 3, RESULT_TIME = 4;

const Online = {
  active: false,
  room: null,
  other: -1,
  get me() { return this.room ? this.room.me : 0; },
  names: {},
  car: null, remote: null,
  snaps: [],               // other player's recent states: { t, x, y, a, vx, vy }
  lastSent: -1,
  // round state; the host decides it and sends it to the guest
  R: null,
  spawn: null,
  ping: null,              // last revealed robber position for the cop
  hostRobberSpeed: 0,

  role(id) { return this.R ? (id === this.R.robber ? 'robber' : 'cop') : ''; },
  myRole() { return this.role(this.me); },

  attach(room) {
    this.room = room;
    this.active = true;
    this.R = null;
    this.snaps = [];
    this.ping = null;
    room.on('message', (m, from) => this.receive(m, from));
    room.on('roster', players => {
      if (!this.active) return;
      for (const p of players) this.names[p.id] = p.name;
      const o = players.find(p => p.id !== this.me);
      if (o) this.other = o.id;
      if (this.room.isHost && this.other >= 0 && !this.R) this.startMatch();
    });
    room.on('leave', () => this.stop('Your friend left.'));
    room.on('close', () => this.stop('The connection closed.'));
    for (const p of room.players) this.names[p.id] = p.name;
    const o = room.players.find(p => p.id !== this.me);
    if (o) this.other = o.id;
    Game.state = 'play';
    Game.wanted = 0; Game.police.length = 0; Game.bustProgress = 0;
    if (room.isHost && this.other >= 0) this.startMatch();
  },

  stop(why) {
    if (!this.active) return;
    this.active = false;
    for (const c of [this.car, this.remote]) {
      const i = Game.cars.indexOf(c);
      if (i >= 0) Game.cars.splice(i, 1);
    }
    if (Player.inCar && Player.car === this.car) { Player.inCar = false; Player.car = null; }
    Player.x = spawnPoint.x; Player.y = spawnPoint.y;
    this.car = this.remote = null;
    this.R = null;
    Mission.state = 'wait'; Mission.waitTimer = 2.5;
    Game.state = 'menu';
    if (why) toast(why, '#ff6b6b');
    try { this.room && this.room.close && this.room.close(); } catch (e) { }
    this.room = null;
  },

  send(m) { if (this.room) this.room.send(m); },

  // --- host

  startMatch() {
    const score = {};
    score[this.me] = 0; score[this.other] = 0;
    this.R = { round: 0, score, phase: 'idle' };
    this.startRound();
  },

  startRound() {
    const R = this.R;
    R.round++;
    // the guest robs first, then roles swap each round
    R.robber = R.round % 2 ? this.other : this.me;
    const s = randomRoadTileNear(spawnPoint.x, spawnPoint.y, 0, 900) || { tx: 44, ty: 39, dir: { x: 1, y: 0 } };
    const at = t => ({ x: (t.tx + 0.5) * TILE, y: (t.ty + 0.5) * TILE, a: Math.atan2(t.dir.y, t.dir.x) });
    const rs = at(s);
    const pickup = randomRoadPointNear(rs.x, rs.y, 400, 700) || { x: rs.x + 400, y: rs.y };
    const dropoff = randomRoadPointNear(pickup.x, pickup.y, 1400, 2000) || { x: pickup.x + 1400, y: pickup.y };
    const ct = randomRoadTileNear(rs.x, rs.y, 650, 900);
    const cs = ct ? at(ct) : { x: rs.x - 650, y: rs.y, a: 0 };
    const d = distp(rs.x, rs.y, pickup.x, pickup.y) + distp(pickup.x, pickup.y, dropoff.x, dropoff.y);
    Object.assign(R, { phase: 'countdown', phaseT: COUNTDOWN, timeLeft: Math.round(25 + d / 130), bust: 0, hasPkg: false,
      pickup, dropoff, spawnRobber: rs, spawnCop: cs, winner: -1, reason: '' });
    this.send({ t: 'start', R: this.publicRound() });
    this.placeCars();
  },

  publicRound() {
    const R = this.R;
    return { round: R.round, robber: R.robber, phase: R.phase, phaseT: R.phaseT, timeLeft: R.timeLeft, bust: R.bust, hasPkg: R.hasPkg,
      pickup: R.pickup, dropoff: R.dropoff, spawnRobber: R.spawnRobber, spawnCop: R.spawnCop, score: R.score, winner: R.winner, reason: R.reason };
  },

  hostTick(dt) {
    const R = this.R;
    if (!R || R.phase === 'idle') return;
    if (R.phase === 'countdown') {
      R.phaseT -= dt;
      if (R.phaseT <= 0) { R.phase = 'chase'; this.broadcast(true); }
    } else if (R.phase === 'chase') {
      R.timeLeft = Math.max(0, R.timeLeft - dt);
      const rob = this.posOf(R.robber), cop = this.posOf(R.robber === this.me ? this.other : this.me);
      if (rob && !R.hasPkg && distp(rob.x, rob.y, R.pickup.x, R.pickup.y) < 55) { R.hasPkg = true; this.broadcast(true); }
      if (rob && R.hasPkg && distp(rob.x, rob.y, R.dropoff.x, R.dropoff.y) < 55) return this.endRound(R.robber, 'delivered the package');
      if (rob && cop) {
        const close = distp(rob.x, rob.y, cop.x, cop.y) < BUST_RANGE && rob.speed < BUST_SPEED;
        R.bust = close ? R.bust + dt : Math.max(0, R.bust - dt * 1.2);
        if (R.bust >= BUST_FULL) return this.endRound(R.robber === this.me ? this.other : this.me, 'made the bust');
      }
      if (R.timeLeft <= 0) this.endRound(R.robber === this.me ? this.other : this.me, 'ran out the clock');
    } else if (R.phase === 'over') {
      R.phaseT -= dt;
      if (R.phaseT <= 0) {
        if (Object.values(R.score).some(v => v >= ROUNDS_TO_WIN)) { R.phase = 'done'; this.broadcast(true); }
        else this.startRound();
      }
    }
    this.broadcast(false);
  },

  endRound(winner, reason) {
    const R = this.R;
    R.phase = 'over'; R.phaseT = RESULT_TIME;
    R.winner = winner; R.reason = reason;
    R.score[winner] = (R.score[winner] || 0) + 1;
    this.broadcast(true);
  },

  rematch() {
    if (!this.room || !this.room.isHost || !this.R || this.R.phase !== 'done') return;
    this.startMatch();
  },

  lastBroadcast: -1,
  broadcast(now) {
    if (!now && Game.time - this.lastBroadcast < 1 / 6) return;
    this.lastBroadcast = Game.time;
    this.send({ t: 'round', R: this.publicRound() });
  },

  // the robber's or cop's latest known position: our own car, or what the other sent
  posOf(id) {
    if (id === this.me) return this.car ? { x: this.car.x, y: this.car.y, speed: this.car.speed } : null;
    const s = this.snaps[this.snaps.length - 1];
    return s ? { x: s.x, y: s.y, speed: Math.hypot(s.vx, s.vy) } : null;
  },

  // --- everyone

  receive(m, from) {
    if (!this.active || !this.room) return;
    if (m.t === 'car') {
      this.snaps.push({ t: Game.time, x: m.x, y: m.y, a: m.a, vx: m.vx, vy: m.vy });
      if (this.snaps.length > 30) this.snaps.shift();
    } else if (!this.room.isHost && (m.t === 'start' || m.t === 'round')) {
      const fresh = !this.R || this.R.round !== m.R.round;
      this.R = m.R;
      if (m.t === 'start' || fresh) this.placeCars();
    } else if (this.room.isHost && m.t === 'again') this.rematch();
  },

  placeCars() {
    const R = this.R;
    const mine = this.myRole() === 'robber' ? R.spawnRobber : R.spawnCop;
    const theirs = this.myRole() === 'robber' ? R.spawnCop : R.spawnRobber;
    for (const c of [this.car, this.remote]) { const i = Game.cars.indexOf(c); if (i >= 0) Game.cars.splice(i, 1); }
    const style = role => (role === 'robber' ? ['#ff6fb0', 'civ'] : ['#e9edf2', 'police']);
    const [mc, mk] = style(this.myRole()), [tc, tk] = style(this.myRole() === 'robber' ? 'cop' : 'robber');
    this.car = new Car(mine.x, mine.y, mine.a, mc, mk, mk === 'police' ? 'police' : 'sports');
    this.remote = new Car(theirs.x, theirs.y, theirs.a, tc, tk, tk === 'police' ? 'police' : 'sports');
    this.remote.remote = true;
    this.spawn = mine;
    Game.cars.push(this.car, this.remote);
    Player.car = this.car; Player.inCar = true;
    this.snaps = [{ t: Game.time, x: theirs.x, y: theirs.y, a: theirs.a, vx: 0, vy: 0 }];
    this.ping = null;
    cam.x = mine.x - W / 2; cam.y = mine.y - H / 2;
    SCam.init = false;
    toast(this.myRole() === 'robber' ? 'You are the robber. Grab the package!' : 'You are the cop. Catch the robber!', this.myRole() === 'robber' ? '#ff6fb0' : '#4f8aff');
  },

  update(dt) {
    if (!this.R || !this.car) { if (this.room && this.room.isHost) this.hostTick(dt); return; }
    const R = this.R;
    const c = this.car;
    c.hp = 100; c.wrecked = false;
    if (R.phase !== 'chase') {
      c.x = this.spawn.x; c.y = this.spawn.y; c.angle = this.spawn.a; c.vx = 0; c.vy = 0;
    }
    // the other car, drawn 100 ms behind so it can slide between updates
    const rt = Game.time - 0.1, S = this.snaps;
    let a = S[S.length - 1], b = a, k = 0;
    for (let i = S.length - 1; i > 0; i--) {
      if (S[i - 1].t <= rt) { a = S[i - 1]; b = S[i]; k = b.t > a.t ? clamp((rt - a.t) / (b.t - a.t), 0, 1) : 1; break; }
    }
    if (a) {
      const r = this.remote;
      r.x = a.x + (b.x - a.x) * k; r.y = a.y + (b.y - a.y) * k;
      r.angle = a.a + angleNorm(b.a - a.a) * k;
      r.vx = b.vx; r.vy = b.vy;
    }
    if (Game.time - this.lastSent >= SEND_EVERY) {
      this.lastSent = Game.time;
      this.send({ t: 'car', x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, a: Math.round(c.angle * 1000) / 1000,
        vx: Math.round(c.vx), vy: Math.round(c.vy) });
    }
    // the cop sees the robber nearby, or briefly every few seconds
    if (this.myRole() === 'cop' && R.phase === 'chase') {
      const near = distp(c.x, c.y, this.remote.x, this.remote.y) < SIGHT;
      const slot = Math.floor(Game.time / PING_EVERY);
      if (near) this.ping = { x: this.remote.x, y: this.remote.y, t: Game.time, live: true };
      else if (!this.ping || this.ping.slot !== slot) this.ping = { x: this.remote.x, y: this.remote.y, t: Game.time, slot, live: false };
    }
    // missions.js draws the beacon, arrow and minimap dot for this
    Mission.state = 'wait';
    if (R.phase === 'chase' || R.phase === 'countdown') {
      if (this.myRole() === 'robber') {
        Mission.state = R.hasPkg ? 'deliver' : 'pickup';
        Mission.pickup = R.pickup; Mission.dropoff = R.dropoff;
      } else if (R.hasPkg) {
        Mission.state = 'deliver'; Mission.dropoff = R.dropoff;
      }
    }
    if (this.room && this.room.isHost) this.hostTick(dt);
    else if (R.phase === 'chase') R.timeLeft = Math.max(0, R.timeLeft - dt);
    if (R.phase === 'done' && this.room && keyPressed('Enter', 'Mouse0')) {
      if (this.room.isHost) this.rematch(); else this.send({ t: 'again' });
    }
  },

  objective() {
    if (!this.R) return null;
    if (this.myRole() === 'cop' && this.R.phase === 'chase') {
      if (this.ping && (this.ping.live || Game.time - this.ping.t < PING_SHOW)) return this.ping;
      return this.R.hasPkg ? this.R.dropoff : null;
    }
    return Mission.state === 'pickup' ? Mission.pickup : Mission.state === 'deliver' ? Mission.dropoff : null;
  },

  text() {
    const R = this.R;
    if (!R) return 'Waiting for your friend…';
    if (R.phase === 'countdown') return 'Round ' + R.round + ' starts in ' + Math.max(1, Math.ceil(R.phaseT)) + '…';
    if (R.phase !== 'chase') return '';
    const t = Math.ceil(R.timeLeft) + 's';
    if (this.myRole() === 'robber') return (R.hasPkg ? 'Deliver the package: ' : 'Grab the package: ') + t;
    return (R.hasPkg ? 'They have the package. Stop them: ' : 'Find the robber: ') + t;
  },

  // drawn on top of the regular HUD
  drawHUD(ctx) {
    const R = this.R;
    ctx.save();
    ctx.textBaseline = 'top';
    if (R) {
      const role = this.myRole();
      ctx.textAlign = 'left';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = role === 'robber' ? '#ff6fb0' : '#7fa8ff';
      ctx.fillText(role === 'robber' ? 'ROBBER' : 'COP', 16, 36);
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const meN = this.names[this.me] || 'You', oN = this.names[this.other] || 'Friend';
      ctx.fillText(meN + ' ' + (R.score[this.me] || 0) + '  :  ' + (R.score[this.other] || 0) + ' ' + oN + '   first to ' + ROUNDS_TO_WIN, 16, 86);
      const tgt = this.objective();
      if (tgt && this.car) ctx.fillText('target ' + Math.round(distp(this.car.x, this.car.y, tgt.x, tgt.y) / 10) * 10 + 'm', 16, 106);
      if (R.phase === 'chase' && R.bust > 0.05) {
        const w2 = 220;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(W / 2 - w2 / 2, 52, w2, 12);
        ctx.fillStyle = '#4f8aff';
        ctx.fillRect(W / 2 - w2 / 2, 52, w2 * clamp(R.bust / BUST_FULL, 0, 1), 12);
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9fc2ff';
        ctx.fillText(role === 'robber' ? 'GET AWAY!' : 'STAY ON THEM', W / 2, 68);
      }
      this.drawTag(ctx);
      this.drawMinimapDot(ctx);
      if (R.phase === 'countdown') this.banner(ctx, String(Math.max(1, Math.ceil(R.phaseT))), role === 'robber' ? 'You are the robber. Grab the package and deliver it.' : 'You are the cop. Stay close and slow them down.');
      if (R.phase === 'over') this.banner(ctx, R.winner === this.me ? 'ROUND WON' : 'ROUND LOST', (this.names[R.winner] || 'Someone') + ' ' + R.reason + '.');
      if (R.phase === 'done') {
        const won = (R.score[this.me] || 0) >= ROUNDS_TO_WIN;
        this.banner(ctx, won ? 'YOU WIN' : 'YOU LOSE', (R.score[this.me] || 0) + ' : ' + (R.score[this.other] || 0) + '. ' +
          (this.room && this.room.isHost ? 'Press Enter or tap for a rematch.' : 'Press Enter or tap to ask for a rematch.'));
      }
    } else this.banner(ctx, 'COPS AND ROBBERS', 'Waiting for your friend…');
    ctx.restore();
  },

  banner(ctx, big, small) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, H * 0.32, W, 120);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic bold 52px "Arial Black", Arial, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(big, W / 2, H * 0.32 + 44);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(small, W / 2, H * 0.32 + 92);
    ctx.textBaseline = 'top';
  },

  // name tag over the other car, in whichever camera is active
  drawTag(ctx) {
    const r = this.remote;
    if (!r) return;
    const visible = this.myRole() === 'robber' || distp(this.car.x, this.car.y, r.x, r.y) < SIGHT;
    if (!visible) return;
    let sx, sy;
    if (typeof viewMode !== 'undefined' && viewMode === 'street') {
      const p = camSpace(r.x, r.y, 34);
      if (p.f < 40) return;
      const q = projPt(p);
      sx = q.x; sy = q.y;
    } else { sx = r.x - cam.x; sy = r.y - cam.y - 34; }
    const name = this.names[this.other] || 'Friend';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    const w = ctx.measureText(name).width + 14;
    ctx.fillStyle = 'rgba(8,10,18,0.75)';
    ctx.fillRect(sx - w / 2, sy - 18, w, 18);
    ctx.fillStyle = this.myRole() === 'robber' ? '#7fa8ff' : '#ff6fb0';
    ctx.fillText(name, sx, sy - 15);
  },

  drawMinimapDot(ctx) {
    const r = this.remote;
    if (!r) return;
    const S = 148, mx = W - S - 16, my = TouchPad.on ? 52 : H - S - 16, k = S / WORLD_W;
    let p = null;
    if (this.myRole() === 'robber') p = r;
    else if (this.ping && (this.ping.live || Game.time - this.ping.t < PING_SHOW)) p = this.ping;
    if (!p) return;
    ctx.fillStyle = this.myRole() === 'robber' ? (Math.floor(Game.time * 6) % 2 ? '#ff4356' : '#3b6cff') : '#ff6fb0';
    ctx.beginPath();
    ctx.arc(mx + p.x * k, my + p.y * k, 4, 0, 7);
    ctx.fill();
  },
};

// missions.js handles the solo deliveries; online it shows the round's targets instead
(() => {
  const point = Mission.objectivePoint.bind(Mission), text = Mission.text.bind(Mission);
  Mission.objectivePoint = () => (Online.active ? Online.objective() : point());
  Mission.text = () => (Online.active ? Online.text() : text());
})();

// the online lobby, opened from the menu or by an invite link
let onlineLobby = null;
function openOnlineLobby() {
  const el = document.getElementById('lobby');
  if (!el || typeof Lobby === 'undefined') return;
  if (onlineLobby) { onlineLobby.start(); return; }
  onlineLobby = Lobby.mount(el, {
    game: 'miami-nights', title: 'Cops and robbers',
    blurb: 'Two players in the same city. The robber grabs a package and races it across town. The cop has to stay right on them. Roles swap each round, first to 3 wins.',
    min: 2, max: 2,
    extra: [{ label: 'Back to the game', note: 'Play Miami Nights on your own.', onClick: () => {} }],
    onStart: room => Online.attach(room),
    onJoin: room => Online.attach(room),
  });
}
(() => {
  const btn = document.getElementById('onlineBtn');
  if (btn && btn.addEventListener) {
    btn.addEventListener('pointerdown', e => e.stopPropagation());
    btn.addEventListener('click', e => { e.stopPropagation(); openOnlineLobby(); });
  }
  if (typeof LinkPlay !== 'undefined' && LinkPlay.fromHash()) openOnlineLobby();
})();

function syncOnlineButton() {
  const btn = document.getElementById('onlineBtn');
  if (!btn) return;
  const lobbyEl = document.getElementById('lobby');
  const want = Game.state !== 'menu' || Online.active || (lobbyEl && !lobbyEl.hidden);
  if (btn.hidden !== want) btn.hidden = want;
}
