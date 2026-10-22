'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const json = (page, expr) => JSON.parse(page.run(`JSON.stringify(${expr})`));
const P = '{ type: "outswing", kmh: 138, rx: -0.3, ry: 2.2, line: 0, length: 6.4, swing: 0, seam: 0, turn: 0, e: 0.53 }';

// A ball for a right-hander from the Indian side's quick, with the Australian XI fielding.
const SIM = `(p, sw, seed, extra) => {
  const sq = squad(teamById('aus')), o = Object.assign({ n: 1, p, btype: p.kmh < 110 ? 'off' : 'fast', hand: 1, seed,
    field: buildField(sq, 9, 1, p.kmh < 110), striker: { pid: 0, bat: 84 }, non: { pid: 1, bat: 80 }, win: 1.25, runMode: 'auto', margin: 0.4 }, extra || {});
  const s = newSim(o);
  if (sw) setSwing(s, typeof sw === 'function' ? sw(s.del) : sw);
  let g = 0; while (!s.done && g++ < 4000) simStep(s);
  return s;
}`;

test('deliveries: the length, the stumps, bounce, swing and turn', () => {
  const page = createPage('cricket-clash/index.html');
  const y = json(page, `(() => { const d = makeDelivery({ ...${P}, length: 1.2 }); const b = d.at(d.t1); return { z: b.z, y: b.y, hits: d.hitsStumps }; })()`);
  assert.ok(Math.abs(y.z - 1.2) < 1e-6 && Math.abs(y.y - 0.036) < 1e-6, 'it pitches where it was aimed');
  assert.ok(y.hits, 'a straight yorker hits the stumps');
  const b = json(page, `(() => { const d = makeDelivery({ ...${P}, length: 11, e: 0.63 }); return { y: d.atStumps.y, hits: d.hitsStumps }; })()`);
  assert.ok(b.y > 1.3 && !b.hits, 'a bouncer goes past head high: ' + b.y);
  // for a right-hander the off side is -x
  const sq = `squad(teamById('ind'))`;
  const at = (type, key) => json(page, `(() => { const bw = ${sq}[${key}], p = deliveryParams(bw, '${type}', [0, DTYPES['${type}'].len], 0.84, 1, () => 0.5); return makeDelivery(p).atStumps.x - p.line; })()`);
  assert.ok(at('outswing', 7) < at('inswing', 7) - 0.15, 'an outswinger finishes further toward the off side than an inswinger');
  assert.ok(at('legbreak', 8) < at('googly', 8) - 0.3, 'a leg break turns away, a googly turns in');
  const nb = json(page, `deliveryParams(${sq}[7], 'yorker', [0, 1.2], 1.1, 1, Math.random).noBall`);
  assert.strictEqual(nb, true, 'a late release oversteps');
  const spread = json(page, `(() => { let worst = 0; for (let i = 0; i < 50; i++) { const p = deliveryParams(${sq}[7], 'outswing', [0, 6], 0.84, 1, Math.random); worst = Math.max(worst, Math.abs(p.length - 6)); } return worst; })()`);
  assert.ok(spread < 1.2, 'a good release lands close to the marker: ' + spread);
  const pace = json(page, `[deliveryParams(${sq}[7], 'outswing', [0, 6], 0.84, 1, () => 0.5).kmh, deliveryParams(${sq}[8], 'legbreak', [0, 4], 0.84, 1, () => 0.5).kmh]`);
  assert.ok(pace[0] > 135 && pace[1] < 90, 'quicks are quick, spinners slow: ' + pace);
});

test('batting: timing grades, where the ball goes, and the shot names', () => {
  const page = createPage('cricket-clash/index.html');
  page.run(`globalThis.d = makeDelivery(${P})`);
  const shot = (err, dir = 0, kind = 'attack') => json(page, `(() => { const r = judgeShot(d, { t: d.timeAtZ(CONTACT_Z[footFor(d)]) + ${err}, dir: ${dir}, kind: '${kind}' }, { hand: 1, win: 1, bat: 80 }, () => 0.5); return { kind: r.kind, grade: r.grade, vx: r.vel && r.vel.x, name: r.name }; })()`);
  assert.strictEqual(shot(0).grade, 'perfect');
  assert.strictEqual(shot(0.06).grade, 'good');
  assert.strictEqual(shot(-0.1).grade, 'mistimed');
  assert.strictEqual(shot(0.15).grade, 'edge');
  assert.strictEqual(shot(0.3).kind, 'miss');
  assert.strictEqual(json(page, `judgeShot(d, null, { hand: 1, win: 1, bat: 80 }, Math.random).kind`), 'leave');
  assert.ok(shot(-0.03).vx > shot(0.03).vx, 'early goes to the leg side (+x for a right-hander), late to the off');
  assert.strictEqual(shot(0, 55).name, 'Cover drive');
  assert.strictEqual(shot(0, 55, 'loft').name, 'Lofted cover drive');
  assert.strictEqual(shot(0, -30).name, 'On drive');
  assert.strictEqual(shot(0, 0, 'defend').name, 'Forward defence');
  page.run(`globalThis.sh = makeDelivery({ ...${P}, length: 10, e: 0.6 })`);
  assert.strictEqual(json(page, `judgeShot(sh, { t: sh.timeAtZ(CONTACT_Z.back), dir: -80, kind: 'attack' }, { hand: 1, win: 1, bat: 80 }, () => 0.5).name`), 'Pull');
  page.run(`globalThis.sp = makeDelivery({ ...${P}, kmh: 84, length: 4.2, ry: 2 })`);
  assert.strictEqual(json(page, `judgeShot(sp, { t: sp.timeAtZ(CONTACT_Z.front), dir: -70, kind: 'loft' }, { hand: 1, win: 1, bat: 80 }, () => 0.5).name`), 'Slog sweep');
  // a left-hander's off side is the other way
  assert.ok(json(page, `judgeShot(d, { t: d.timeAtZ(CONTACT_Z.front), dir: 60, kind: 'attack' }, { hand: -1, win: 1, bat: 80 }, () => 0.5).vel.x`) > 0);
});

test('lbw: hitting the pads in line is out; pitching outside leg or a shot outside off is not', () => {
  const page = createPage('cricket-clash/index.html');
  const out = json(page, `lbwCheck(makeDelivery({ ...${P}, line: 0.02, length: 3 }), 'leave', false, 1)`);
  assert.ok(out && out.out, 'a straight full ball on the pads');
  // find a ball that would hit the stumps after pitching outside leg (+x for a right-hander) and coming back in
  const leg = json(page, `(() => { for (let s = -0.4; s > -3; s -= 0.05) { const d = makeDelivery({ ...${P}, line: 0.3, length: 3.5, seam: s }); const l = lbwCheck(d, 'leave', false, 1); if (d.hitsStumps && l) return l; } return null; })()`);
  assert.ok(leg && !leg.out, 'pitched outside leg');
  const off = json(page, `(() => { for (let s = 0.4; s < 3; s += 0.05) { const d = makeDelivery({ ...${P}, line: -0.3, length: 3.5, seam: s }); const l = lbwCheck(d, 'front', true, 1); if (d.hitsStumps && l && -l.at.x > 0.16) return l; } return null; })()`);
  assert.ok(off && !off.out, 'hit outside off while playing a shot');
});

test('a ball in play: sixes, fours, bowled, caught behind, and every ball comes to an end', () => {
  const page = createPage('cricket-clash/index.html');
  page.run(`globalThis.SIM = ${SIM}`);
  const perfect = (dir, kind) => `d => ({ t: d.timeAtZ(CONTACT_Z[footFor(d)]), dir: ${dir}, kind: '${kind}' })`;
  const sixes = json(page, `(() => { let n = 0; for (let i = 1; i <= 20; i++) if (SIM(${P}, ${perfect(-10, 'loft')}, i).res.boundary === 6) n++; return n; })()`);
  assert.ok(sixes >= 15, 'a perfect loft down the ground clears the rope: ' + sixes + '/20');
  const fours = json(page, `(() => { let n = 0, runs = 0; for (let i = 1; i <= 30; i++) { const r = SIM(${P}, d => ({ t: d.timeAtZ(CONTACT_Z.front), dir: i % 2 ? 50 : -40, kind: 'attack' }), i).res; if (r.boundary === 4) n++; runs += r.boundary || r.runs; } return [n, runs]; })()`);
  assert.ok(fours[0] >= 6 && fours[1] >= 50, 'perfect drives find the gaps: ' + fours);
  const bowled = json(page, `SIM({ ...${P}, length: 4 }, null, 3).res.out`);
  assert.ok(['bowled', 'lbw'].includes(bowled.kind), 'leave a straight one and you are out: ' + bowled.kind);
  const gate = json(page, `SIM({ ...${P}, length: 4 }, d => ({ t: d.timeAtZ(CONTACT_Z.front) + 0.4, dir: 0, kind: 'attack' }), 3).res.out`);
  assert.ok(gate && ['bowled', 'lbw'].includes(gate.kind), 'so is missing it');
  const edges = json(page, `(() => { let n = 0; for (let i = 1; i <= 20; i++) { const r = SIM({ ...${P}, line: -0.25 }, d => ({ t: d.timeAtZ(CONTACT_Z.front) + 0.19, dir: 40, kind: 'attack' }), i).res; if (r.out && r.out.kind === 'caught') n++; } return n; })()`);
  assert.ok(edges >= 6, 'late edges carry to the keeper and slip: ' + edges);
  const free = json(page, `SIM({ ...${P}, length: 4 }, null, 3, { freeHit: true }).res.out`);
  assert.strictEqual(free, null, 'not out bowled on a free hit');
  // random balls and random swings always finish, with sensible results
  const all = json(page, `(() => { const r = seeded(5); let bad = 0, n = 0;
    for (let i = 0; i < 250; i++) {
      const p = { ...${P}, line: (r() - 0.5) * 2, length: 0.5 + r() * 11, kmh: 80 + r() * 65, swing: (r() - 0.5) * 2, turn: (r() - 0.5) * 2 };
      const s = SIM(p, r() < 0.15 ? null : d => ({ t: d.timeAtZ(1.2) + (r() - 0.5) * 0.3, dir: (r() - 0.5) * 300, kind: ['attack', 'loft', 'defend'][i % 3] }), i + 1, { runMode: i % 2 ? 'auto' : 'manual' });
      if (!s.done || s.t > 29 || s.res.runs < 0 || s.res.runs > 7) bad++; n++;
    } return [bad, n]; })()`);
  assert.strictEqual(all[0], 0, 'every ball ends cleanly');
});

test('running between the wickets: the batsmen run, and greedy running gets you run out', () => {
  const page = createPage('cricket-clash/index.html');
  page.run(`globalThis.SIM = ${SIM}`);
  // a firm push into the off-side gap with automatic running
  const runs = json(page, `(() => { const out = []; for (let i = 1; i <= 24; i++) { const r = SIM(${P}, d => ({ t: d.timeAtZ(CONTACT_Z.front) + 0.05, dir: -90 + i * 7, kind: 'attack' }), i).res; out.push(r.boundary ? 'b' + r.boundary : r.out ? 'out' : r.runs); } return out; })()`);
  assert.ok(runs.some(r => r === 1 || r === 2 || r === 3), 'singles and twos come: ' + runs);
  // manual running: call for three on a defensive push to the bowler
  const ro = json(page, `(() => { let outs = 0; for (let i = 1; i <= 10; i++) {
      const sq = squad(teamById('aus')), o = { n: 1, p: ${P}, btype: 'fast', hand: 1, seed: i, field: buildField(sq, 9, 1, false), striker: { pid: 0, bat: 84 }, non: { pid: 1, bat: 80 }, win: 1.25, runMode: 'manual', margin: 0.4 };
      const s = newSim(o); setSwing(s, { t: s.del.timeAtZ(CONTACT_Z.front), dir: 0, kind: 'defend' });
      let called = false, g = 0;
      while (!s.done && g++ < 4000) { simStep(s); if (s.phase === 'live' && !called) { called = true; cmdRun(s); cmdRun(s); cmdRun(s); } }
      if (s.res.out && s.res.out.kind === 'runout') outs++;
    } return outs; })()`);
  assert.ok(ro >= 7, 'three runs to a ball dropped at your feet is suicide: ' + ro + '/10');
  // turning back early on a call saves you
  const back = json(page, `(() => { const sq = squad(teamById('aus')), o = { n: 1, p: ${P}, btype: 'fast', hand: 1, seed: 4, field: buildField(sq, 9, 1, false), striker: { pid: 0, bat: 84 }, non: { pid: 1, bat: 80 }, win: 1.25, runMode: 'manual', margin: 0.4 };
      const s = newSim(o); setSwing(s, { t: s.del.timeAtZ(CONTACT_Z.front), dir: 0, kind: 'defend' });
      let step = 0, g = 0; while (!s.done && g++ < 4000) { simStep(s); if (s.phase === 'live') { step++; if (step === 2) cmdRun(s); if (step === 20) cmdStop(s); } }
      return [s.res.out, s.res.runs, s.res.end0]; })()`);
  assert.deepStrictEqual(back, [null, 0, 0], 'sent back in time: no run, no wicket, same striker');
});

test('the scorecard: strike, overs, bowlers, extras, wickets, and the result', () => {
  const page = createPage('cricket-clash/index.html');
  page.run(`globalThis.m = newMatch(['ind', 'aus'], 2, 0); m.inns[0].bowler = 9`);
  page.run(`applyBall(m, { runs: 1, end0: 1 })`);
  assert.deepStrictEqual(json(page, '[m.inns[0].striker, m.inns[0].non, m.inns[0].card[0].r, m.inns[0].card[0].b]'), [1, 0, 1, 1], 'a single changes the strike');
  page.run(`applyBall(m, { runs: 0, boundary: 4, end0: 1 }); applyBall(m, { wide: true, runs: 0, end0: 1 })`);
  assert.deepStrictEqual(json(page, '[m.inns[0].runs, m.inns[0].balls, m.inns[0].extras, m.inns[0].card[1].f4]'), [6, 2, 1, 1], 'a wide is a run but not a ball');
  page.run(`applyBall(m, { runs: 0, noBall: true, end0: 1 })`);
  assert.strictEqual(page.run('m.inns[0].freeHit'), true);
  page.run(`applyBall(m, { runs: 0, out: { kind: 'bowled', who: 1 }, end0: 1 })`);
  assert.strictEqual(page.run('m.inns[0].wkts'), 0, "you can't be bowled on a free hit");
  page.run(`applyBall(m, { runs: 0, out: { kind: 'caught', who: 1, by: 4 }, end0: 1 })`);
  assert.deepStrictEqual(json(page, '[m.inns[0].wkts, m.inns[0].striker, m.inns[0].card[1].out.kind, m.inns[0].bw[9].wk]'), [1, 2, 'caught', 1], 'the new batsman takes strike');
  page.run(`applyBall(m, { runs: 0, end0: 2 }); applyBall(m, { runs: 0, end0: 2 })`);
  assert.deepStrictEqual(json(page, '[m.inns[0].balls, m.inns[0].bowler, m.inns[0].last, m.inns[0].striker, m.inns[0].prevOver]'), [6, null, 9, 0, ['1', '4', 'wd', 'nb', '0', 'W', '0', '0']], 'end of the over: ends change and a new bowler is needed');
  assert.ok(!json(page, `eligible(m, squad(teamById('aus')))`).includes(9), 'no bowler bowls two overs in a row');
  page.run(`m.inns[0].bowler = 10; for (let i = 0; i < 6; i++) applyBall(m, { runs: 0, end0: m.inns[0].striker })`);
  assert.strictEqual(page.run('m.cur'), 1, 'two overs and the innings is done');
  assert.strictEqual(page.run('m.inns[0].runs'), 7);
  page.run(`m.inns[1].bowler = 7; applyBall(m, { runs: 0, boundary: 6, end0: 0 }); applyBall(m, { runs: 2, end0: 0 })`);
  assert.deepStrictEqual(json(page, '[m.done, m.winner, m.margin]'), [true, 1, '10 wickets'], 'the chase ends as soon as the target is passed');
  page.run(`globalThis.m2 = newMatch(['ind', 'aus'], 20, 0); m2.inns[0].bowler = 9; for (let i = 0; i < 10; i++) applyBall(m2, { runs: 0, out: { kind: 'bowled', who: m2.inns[0].striker }, end0: m2.inns[0].striker });`);
  assert.deepStrictEqual(json(page, '[m2.cur, m2.inns[0].wkts, m2.inns[0].balls]'), [1, 10, 10], 'ten wickets and they are all out');
});

test('the CPU plays whole matches with believable scores', () => {
  const page = createPage('cricket-clash/index.html');
  const r = json(page, `(() => { const out = [];
    for (const [ov, seed] of [[2, 1], [5, 2], [5, 3]]) {
      let s = seed * 7919; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
      dSetup(['eng', 'pak'], ['cpu', 'cpu'], { overs: ov, level: 2, running: 'auto' }); D.toss = { winner: 1 }; dToss(1, false);
      let g = 0; while (!D.m.done && g++ < 100000) dTick(1 / 30);
      const sums = D.m.inns.map(i => i.card.reduce((a, c) => a + c.r, 0) + i.extras === i.runs);
      out.push({ ov, done: D.m.done, runs: D.m.inns.map(i => i.runs), wk: D.m.inns.map(i => i.wkts), sums, first: D.m.inns[0].bat, bowlers: D.m.inns.map(i => Object.keys(i.bw).length) });
    } return out; })()`);
  for (const m of r) {
    assert.ok(m.done, 'finished');
    assert.deepStrictEqual(m.sums, [true, true], 'the batters\' runs and extras add up to the total');
    assert.strictEqual(m.first, 0, 'Pakistan won the toss and bowled, so England batted');
    for (const runs of m.runs) assert.ok(runs >= m.ov * 3 && runs <= m.ov * 20, m.ov + ' overs, ' + runs + ' runs');
    assert.ok(m.bowlers.every(b => b >= Math.min(m.ov, 2)), 'they change the bowling');
  }
});

test('online: the host runs the match, the guest bats and bowls through messages', () => {
  const host = createPage('cricket-clash/index.html'), guest = createPage('cricket-clash/index.html');
  const c = channelPair();
  host.sandbox.ch = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('cricket-clash', 'Ana'); r.addChannel(ch); startOnline(r);`);
  guest.run(`startOnline(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run(`dSetup(['ind', 'nz'], ['local', 'remote'], { overs: 1, level: 2, running: 'auto' }); D.toss = { winner: 1 }; dPublish();`);
  c.pump();
  assert.deepStrictEqual(json(guest, '[G.phase, G.toss.winner, G.teams]'), ['toss', 1, ['ind', 'nz']]);
  host.run(`dToss(0, true)`);
  assert.strictEqual(host.run('D.m'), null, 'only the toss winner chooses');
  guest.run(`room.send({ t: 'toss', bat: true })`);
  c.pump();
  assert.deepStrictEqual(json(host, '[D.m.inns[0].bat, D.phase]'), [1, 'start'], 'the guest won the toss and bats first');
  host.run(`for (let i = 0; i < 80 && D.phase !== 'pickBowler'; i++) dTick(1 / 30)`);
  c.pump();
  assert.strictEqual(guest.run('G.phase'), 'pickBowler');
  host.run(`dSetBowler(0, 0)`);
  assert.strictEqual(host.run('D.phase'), 'pickBowler', "a batsman who doesn't bowl is refused");
  host.run(`dSetBowler(0, 9)`);
  c.pump();
  assert.strictEqual(json(guest, 'G.m.inns[0].bowler'), 9);
  // the host bowls a straight one; the guest plays a perfect drive on its own clock
  host.run(`dBowl(0, { type: 'outswing', spot: [0.1, 6.4], meter: 0.84 })`);
  c.pump();
  assert.strictEqual(guest.run('G.n'), 1);
  guest.run(`globalThis.del = makeDelivery(G.o.p); room.send({ t: 'swing', n: 1, s: { t: del.timeAtZ(CONTACT_Z[footFor(del)]), dir: 20, kind: 'attack' } })`);
  c.pump();
  assert.strictEqual(host.run('D.sim.swing.dir'), 20, "the host takes the guest's swing");
  host.run(`globalThis.res = null; for (let i = 0; i < 1200 && D.phase === 'ball'; i++) { dTick(1 / 60); }`);
  c.pump();
  assert.ok(guest.run('G.snaps.length') > 20, 'the guest gets the ball as snapshots');
  assert.deepStrictEqual(json(guest, 'G.m.inns[0]'), json(host, 'D.m.inns[0]'), 'both have the same scorecard');
  assert.strictEqual(json(host, 'D.m.inns[0].card[0].b'), 1);
  // forged or out-of-turn messages are ignored
  host.run(`for (let i = 0; i < 120 && D.phase !== 'aim'; i++) dTick(1 / 30)`);
  guest.run(`room.send({ t: 'bowl', p: { type: 'outswing', spot: [0, 6], meter: 0.8 } }); room.send({ t: 'bowler', pid: 3 }); room.send({ t: 'swing', n: 7, s: { t: 0.5, dir: 0, kind: 'loft' } }); room.send({ t: 'run', n: 1, c: 'run' })`);
  c.pump();
  assert.deepStrictEqual(json(host, '[D.phase, D.n, D.m.inns[0].balls]'), ['aim', 1, 1], "the batting side can't bowl or pick the bowler");
  host.run(`dBowl(0, { type: 'legbreak', spot: [0, 6], meter: 0.8 })`);
  assert.strictEqual(host.run('D.n'), 1, "a quick can't bowl a leg break");
  host.run(`dBowl(0, { type: 'yorker', spot: [0, 99], meter: 0.8 })`);
  assert.strictEqual(host.run('D.n'), 1, 'a spot off the pitch is refused');
});

test('ball tracking: pitching, impact and wickets, with umpire\'s call', () => {
  const page = createPage('cricket-clash/index.html');
  const v = (extra, foot = 'leave', played = false) => json(page, `(() => { const l = lbwCheck(makeDelivery({ ...${P}, ...${extra} }), '${foot}', ${played}, 1); return l && [l.verdict, l.pitch, l.impact, l.wickets]; })()`);
  assert.deepStrictEqual(v('{ line: 0.02, length: 3 }'), ['out', 'in', 'in', 'hit']);
  const clip = json(page, `(() => { for (let x = 0.08; x < 0.3; x += 0.002) { const d = makeDelivery({ ...${P}, line: -x, length: 3 }); const l = lbwCheck(d, 'leave', false, 1); if (l && l.wickets === 'call') return [l.verdict, l.wickets]; } return null; })()`);
  assert.deepStrictEqual(clip, ['call', 'call'], 'only just clipping the stumps is umpire\'s call');
  const leg = json(page, `(() => { for (let s = -0.4; s > -3; s -= 0.05) { const l = lbwCheck(makeDelivery({ ...${P}, line: 0.3, length: 3.5, seam: s }), 'leave', false, 1); if (l && l.wickets !== 'miss' && l.pitch === 'leg') return [l.verdict, l.pitch]; } return null; })()`);
  assert.deepStrictEqual(leg, ['notout', 'leg']);
  const ump = json(page, `(() => { const r = seeded(4); let out = 0, wrong = 0; for (let i = 0; i < 400; i++) { if (umpireCall({ verdict: 'out', pitch: 'in', missBy: 0 }, r)) out++; if (umpireCall({ verdict: 'notout', pitch: 'in', missBy: 0.02 }, r)) wrong++; } return [out, wrong]; })()`);
  assert.ok(ump[0] > 340 && ump[1] > 30 && ump[1] < 120, 'the umpire gets most right and some wrong: ' + ump);
});

test('reviews: overturned, lost, umpire\'s call, and none left', () => {
  const page = createPage('cricket-clash/index.html');
  // a fake finished ball with the given lbw details, then the review step
  page.run(`globalThis.ball = (lbw, out) => {
    D.sim = { o: { striker: { pid: D.m.inns[D.m.cur].striker }, p: ${P}, hand: 1 }, res: { runs: 0, boundary: 0, wide: false, noBall: false, out: out ? { kind: 'lbw', who: D.m.inns[D.m.cur].striker, by: null } : null, end0: D.m.inns[D.m.cur].striker, lbw: { appealed: true, freeHit: false, padT: 0.5, at: [0, 0.3, 1], ...lbw } } };
    D.phase = 'ball'; dFinishBall();
  }`);
  page.run(`dSetup(['ind', 'aus'], ['local', 'cpu'], { overs: 5, level: 2, running: 'auto' }); D.toss = { winner: 0 }; dToss(0, true); D.m.inns[0].bowler = 9;`);
  page.run(`ball({ verdict: 'notout', pitch: 'leg', impact: 'in', wickets: 'hit', given: true }, true)`);
  assert.deepStrictEqual(json(page, '[D.phase, D.review.side]'), ['review', 0], 'given out: the batting side may review');
  page.run(`dReview(0, true)`);
  assert.deepStrictEqual(json(page, '[D.phase, D.review.result.final, D.review.result.overturned]'), ['hawk', false, true]);
  page.run(`for (let i = 0; i < 300; i++) dTick(1 / 30)`);
  assert.deepStrictEqual(json(page, '[D.m.inns[0].wkts, D.m.inns[0].rv.bat]'), [0, 1], 'overturned: not out, review kept');
  page.run(`D.phase = 'aim'; ball({ verdict: 'out', pitch: 'in', impact: 'in', wickets: 'hit', given: true }, true); dReview(0, true); for (let i = 0; i < 300; i++) dTick(1 / 30)`);
  assert.deepStrictEqual(json(page, '[D.m.inns[0].wkts, D.m.inns[0].rv.bat]'), [1, 0], 'stands: out, review lost');
  page.run(`D.phase = 'aim'; ball({ verdict: 'out', pitch: 'in', impact: 'in', wickets: 'hit', given: true }, true)`);
  assert.notStrictEqual(page.run('D.phase'), 'review', 'no reviews left');
  assert.strictEqual(page.run('D.m.inns[0].wkts'), 2);
  // the CPU bowlers review a not out; umpire's call keeps both the decision and the review
  page.run(`for (let i = 0; i < 100; i++) dTick(1 / 30); D.phase = 'aim'; Math.random = () => 0.01; ball({ verdict: 'call', pitch: 'in', impact: 'in', wickets: 'call', given: false }, false)`);
  assert.strictEqual(page.run('D.phase'), 'review');
  page.run(`for (let i = 0; i < 70; i++) dTick(1 / 30)`);
  assert.deepStrictEqual(json(page, '[D.phase, D.review.result.final, D.review.result.call]'), ['hawk', false, true]);
  page.run(`for (let i = 0; i < 300; i++) dTick(1 / 30)`);
  assert.deepStrictEqual(json(page, '[D.m.inns[0].wkts, D.m.inns[0].rv.bowl]'), [2, 1], "umpire's call: not out stands, review kept");
});

test('a tie goes to a Super Over', () => {
  const page = createPage('cricket-clash/index.html');
  page.run(`globalThis.m = newMatch(['ind', 'aus'], 1, 0); m.inns[0].bowler = 9; for (let i = 0; i < 6; i++) applyBall(m, { runs: 1, end0: m.inns[0].non });`);
  page.run(`m.inns[1].bowler = 7; for (let i = 0; i < 6; i++) applyBall(m, { runs: 1, end0: m.inns[1].non });`);
  assert.deepStrictEqual(json(page, '[m.done, m.super, m.cur, m.inns.length, m.inns[2].bat, m.inns[2].ov, m.inns[2].wl]'), [false, true, 2, 4, 1, 1, 2], 'the side that batted second goes first');
  page.run(`m.inns[2].bowler = 9; applyBall(m, { runs: 0, out: { kind: 'bowled', who: 0 }, end0: 0 }); applyBall(m, { runs: 0, out: { kind: 'bowled', who: 2 }, end0: 2 })`);
  assert.deepStrictEqual(json(page, '[m.cur, m.inns[2].wkts]'), [3, 2], 'two wickets ends a Super Over');
  page.run(`m.cur = 2; m.inns[2] = newInns(m.inns[2].bat, 1, 2); m.inns[2].bowler = 9; for (let i = 0; i < 6; i++) applyBall(m, { runs: 1, end0: m.inns[2].non })`);
  page.run(`m.inns[3].bowler = 9; applyBall(m, { runs: 0, boundary: 4, end0: 0 }); applyBall(m, { runs: 2, end0: 0 }); for (let i = 0; i < 4; i++) applyBall(m, { runs: 0, end0: 0 })`);
  assert.deepStrictEqual(json(page, '[m.done, m.winner, m.margin]'), [true, 0, 'the Super Over, on boundaries'], 'level again: more boundaries wins');
  assert.strictEqual(json(page, `resultText(m, s => ['India', 'Australia'][s])`), 'India won in the Super Over, on boundaries');
});

test('fields: attacking crowds the bat, defensive guards the rope, and the CPU picks to suit', () => {
  const page = createPage('cricket-clash/index.html');
  const f = (spin, preset) => json(page, `(() => { const fl = buildField(squad(teamById('ind')), 9, 1, ${spin}, '${preset}').slice(2); return [fl.filter(x => Math.hypot(x.x, x.z) < 18).length, fl.filter(x => Math.hypot(x.x, x.z - MIDZ) > 45).length, fl.every(x => Math.hypot(x.x, x.z - MIDZ) < BOUNDARY - 2)]; })()`);
  for (const spin of [false, true]) {
    const [a, d] = [f(spin, 'attack'), f(spin, 'defend')];
    assert.ok(a[0] > d[0] && d[1] > a[1], 'spin ' + spin + ': ' + a + ' vs ' + d);
    assert.ok(a[2] && d[2], 'everyone stands inside the rope');
  }
  const lefty = json(page, `buildField(squad(teamById('ind')), 9, -1, false, 'attack')[2].x`);
  assert.ok(lefty > 0, 'the slips swap sides for a left-hander');
  assert.strictEqual(json(page, `(() => { const m = newMatch(['ind', 'aus'], 5, 0); return cpuField(m); })()`), 'attack', 'new ball: attack');
  assert.strictEqual(json(page, `(() => { const m = newMatch(['ind', 'aus'], 5, 0); m.inns[0].balls = 24; m.inns[0].fow.push({ runs: 0, balls: 0 }); return cpuField(m); })()`), 'defend', 'last overs: defend');
});

test('close run outs go to the third umpire, and milestones and hat-tricks are noticed', () => {
  const page = createPage('cricket-clash/index.html');
  page.run(`globalThis.SIM = ${SIM}`);
  const close = json(page, `(() => { const r = seeded(8); let closes = 0, wrong = 0;
    for (let i = 0; i < 300 && closes < 6; i++) {
      const sq = squad(teamById('aus')), o = { n: 1, p: ${P}, btype: 'fast', hand: 1, seed: i + 1, field: buildField(sq, 9, 1, false), striker: { pid: 0, bat: 84 }, non: { pid: 1, bat: 80 }, win: 1.25, runMode: 'manual', margin: 0.4 };
      const s = newSim(o); setSwing(s, { t: s.del.timeAtZ(CONTACT_Z.front) + (r() - 0.5) * 0.1, dir: (r() - 0.5) * 200, kind: 'attack' });
      let g = 0, k = 0; while (!s.done && g++ < 4000) { simStep(s); if (s.phase === 'live' && k++ % 40 === 5) cmdRun(s); }
      if (s.res.close) { closes++; if (s.res.close.out !== !!(s.res.out && s.res.out.kind === 'runout')) wrong++; }
    } return [closes, wrong]; })()`);
  assert.ok(close[0] > 0, 'some run outs are close');
  assert.strictEqual(close[1], 0, 'and the call matches the result');
  page.run(`globalThis.m = newMatch(['ind', 'aus'], 20, 0); m.inns[0].bowler = 9; m.inns[0].card[0].r = 48;`);
  assert.strictEqual(json(page, `applyBall(m, { runs: 0, boundary: 4, end0: m.inns[0].striker }).milestone`), 50, 'fifty up');
  const hat = json(page, `[0, 1, 2].map(() => { const r = applyBall(m, { runs: 0, out: { kind: 'bowled', who: m.inns[0].striker }, end0: m.inns[0].striker }); return [r.hatTrickBall, r.hatTrick]; })`);
  assert.deepStrictEqual(hat, [[false, false], [true, false], [false, true]]);
});

test('online: the guest reviews a decision and sees the ball tracking', () => {
  const host = createPage('cricket-clash/index.html'), guest = createPage('cricket-clash/index.html');
  const c = channelPair();
  host.sandbox.ch = c.a; guest.sandbox.ch = c.b;
  host.run(`globalThis.r = Room.create('cricket-clash', 'Ana'); r.addChannel(ch); startOnline(r);`);
  guest.run(`startOnline(Room.joinChannel(ch, 'Bo'))`);
  c.pump();
  host.run(`dSetup(['ind', 'nz'], ['local', 'remote'], { overs: 2, level: 2, running: 'auto' }); D.toss = { winner: 0 }; dToss(0, false); D.m.inns[0].bowler = 9;
    D.sim = { o: { striker: { pid: 0 }, p: ${P}, hand: 1 }, res: { runs: 0, boundary: 0, wide: false, noBall: false, out: { kind: 'lbw', who: 0, by: null }, end0: 0, lbw: { appealed: true, freeHit: false, padT: 0.5, at: [0, 0.3, 1], verdict: 'notout', pitch: 'in', impact: 'off', wickets: 'hit', given: true } } };
    D.phase = 'ball'; dFinishBall();`);
  c.pump();
  assert.deepStrictEqual(json(guest, '[G.phase, G.review.side]'), ['review', 1], 'the guest is batting, so it can review');
  host.run(`dReview(0, true)`);
  assert.strictEqual(host.run('D.phase'), 'review', 'the host can\'t review for the guest');
  guest.run(`room.send({ t: 'review', yes: true })`);
  c.pump();
  assert.deepStrictEqual(json(guest, '[G.phase, G.review.result.final, G.review.result.overturned]'), ['hawk', false, true]);
  host.run(`for (let i = 0; i < 300; i++) dTick(1 / 30)`);
  c.pump();
  assert.deepStrictEqual(json(guest, '[G.m.inns[0].wkts, G.m.inns[0].rv.bat]'), [0, 1]);
});
