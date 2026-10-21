'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage, channelPair } = require('./helpers/browser');

const fp = n => Array.from({ length: 32 }, (_, i) => ((i * 11 + n) % 256).toString(16).padStart(2, '0').toUpperCase()).join(':');
const sdp = n => 'v=0\r\na=fingerprint:sha-256 ' + fp(n) + '\r\n';
const plain = v => JSON.parse(JSON.stringify(v));

function pair() {
  const a = createPage('video-call/index.html');
  const b = createPage('video-call/index.html');
  const c = channelPair();
  a.sandbox.ch = c.a; b.sandbox.ch = c.b;
  a.run(`S.role = 'h'; attach(ch)`);
  b.run(`S.role = 'g'; attach(ch)`);
  c.pump();
  return { a, b, c };
}

test('the safety code is the same on both sides and changes if a key is swapped', async () => {
  const { run } = createPage('video-call/index.html');
  const x = plain(await run(`safetyCode(${JSON.stringify(sdp(1))}, ${JSON.stringify(sdp(2))})`));
  const y = plain(await run(`safetyCode(${JSON.stringify(sdp(2))}, ${JSON.stringify(sdp(1))})`));
  const z = plain(await run(`safetyCode(${JSON.stringify(sdp(1))}, ${JSON.stringify(sdp(9))})`));
  assert.deepStrictEqual(x, y);
  assert.notDeepStrictEqual(x, z);
  assert.strictEqual(x.words.length, 3);
  assert.match(x.digits, /^\d{4}$/);
  assert.strictEqual(await run(`safetyCode(${JSON.stringify(sdp(1))}, ${JSON.stringify(sdp(1))})`), null, 'one key on both sides is not a real pair');
  assert.strictEqual(run('SAS_WORDS.length'), 64);
});

test('quality bars and the call timer', () => {
  const { run } = createPage('video-call/index.html');
  assert.strictEqual(run('quality(40, 0)'), 3);
  assert.strictEqual(run('quality(300, 0)'), 2);
  assert.strictEqual(run('quality(80, 0.03)'), 2);
  assert.strictEqual(run('quality(900, 0)'), 1);
  assert.strictEqual(run('quality(50, 0.2)'), 1);
  assert.strictEqual(run('quality(null, null)'), 3);
  assert.strictEqual(run('fmtTime(0)'), '0:00');
  assert.strictEqual(run('fmtTime(75)'), '1:15');
  assert.strictEqual(run('fmtTime(3725)'), '1:02:05');
});

test('mute and camera switch the real tracks and tell the other side', () => {
  const { a, b, c } = pair();
  a.run(`globalThis.aud = { kind: 'audio', enabled: true, stop() {} }; globalThis.vid = { kind: 'video', enabled: true, stop() {} };
         S.local = { getAudioTracks: () => [aud], getVideoTracks: () => [vid], getTracks: () => [aud, vid] }; S.camTrack = vid; S.camOn = true;`);
  a.run('toggleMic()');
  c.pump();
  assert.strictEqual(a.run('aud.enabled'), false);
  assert.strictEqual(a.run(`$('micBtn').getAttribute('aria-pressed')`), 'true');
  a.run('toggleCam()');
  c.pump();
  assert.strictEqual(a.run('vid.enabled'), false);
  assert.strictEqual(b.run('S.peerCam'), false, 'the other side learns the camera is off');
  assert.strictEqual(b.run(`$('remoteOff').hidden`), false, 'and shows the placeholder');
  a.run('toggleCam(); toggleMic()');
  c.pump();
  assert.strictEqual(a.run('aud.enabled && vid.enabled'), true);
  assert.strictEqual(b.run(`$('remoteOff').hidden`), true);

  b.run('S.camTrack = null; S.camOn = false; toggleCam()');
  assert.match(b.run(`$('banner').textContent`), /without a camera/);
});

test('chat messages go both ways and are shown as text', () => {
  const { a, b, c } = pair();
  a.run(`$('chatIn').value = '<b>hi</b> there'; sendChat()`);
  c.pump();
  const msgs = b.run(`$('chatLog').children.filter(x => x.className === 'm them').map(x => x.textContent)`);
  assert.deepStrictEqual(plain(msgs), ['<b>hi</b> there']);
  assert.strictEqual(b.run(`$('chatLog').children.at(-1).innerHTML`), '', 'set as text, not markup');
  b.run(`$('chatIn').value = 'ok'; sendChat()`);
  c.pump();
  assert.strictEqual(a.run(`$('chatLog').children.at(-1).textContent`), 'ok');
  assert.strictEqual(a.run(`$('chatIn').value`), '');
});

test('hanging up ends the call on both sides, and so does a dropped channel', () => {
  const { a, b, c } = pair();
  assert.strictEqual(a.run('S.open && S.startedAt > 0'), true);
  a.run('hangUp()');
  c.pump();
  assert.strictEqual(a.run('S.ended'), true);
  assert.strictEqual(b.run('S.ended'), true);
  assert.match(b.run(`$('endedMsg').textContent`), /hung up/);
  assert.strictEqual(b.run(`$('ended').hidden`), false);

  const p = pair();
  p.c.close();
  assert.strictEqual(p.b.run('S.ended'), true);
  assert.match(p.b.run(`$('endedMsg').textContent`), /hung up or closed/);
});

test('a mismatched safety code closes the call', () => {
  const { a, b, c } = pair();
  a.run(`S.sas = { words: ['amber', 'comet', 'lotus'], digits: '1234' }; renderSas()`);
  assert.strictEqual(a.run(`$('sasShort').textContent`), 'amber · comet · lotus');
  a.run(`$('sasYes').onclick()`);
  c.pump();
  assert.strictEqual(a.run(`$('sasShort').textContent`), 'Verified');
  assert.match(b.run(`$('chatLog').children.at(-1).textContent`), /matches/);
  a.run(`$('sasNo').onclick()`);
  c.pump();
  assert.strictEqual(a.run('S.ended'), true);
  assert.strictEqual(b.run('S.ended'), true);
});
