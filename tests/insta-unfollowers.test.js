'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');
const { File } = require('buffer');

function page() { const p = createPage('insta-unfollowers/index.html'); p.sandbox.File = File; return p; }
const entry = (u, ts) => ({ title: '', media_list_data: [], string_list_data: [{ href: 'https://www.instagram.com/' + u, value: u, timestamp: ts }] });

test('JSON download: who does not follow back, who you do not follow back, and mutuals', async () => {
  const p = page();
  p.sandbox.FOL = JSON.stringify([entry('neha.k', 1), entry('raj_x', 2), entry('fan.only', 3)]);
  p.sandbox.ING = JSON.stringify({ relationships_following: [entry('neha.k', 4), entry('raj_x', 5), entry('celeb', 6)] });
  const o = JSON.parse(await p.run(`(async () => {
    const s = await readDownload([new File([FOL], 'followers_1.json'), new File([ING], 'following.json')]);
    const c = compare(s);
    return JSON.stringify({ notBack: c.notBack.map(x => x.u), fans: c.fans.map(x => x.u), mutual: c.mutual.map(x => x.u).sort() });
  })()`));
  assert.deepStrictEqual(o, { notBack: ['celeb'], fans: ['fan.only'], mutual: ['neha.k', 'raj_x'] });
});

test('newer following.json entries without a value use the title', () => {
  const p = page();
  p.sandbox.T = JSON.stringify({ relationships_following: [{ title: 'Some.User', string_list_data: [{ href: 'https://www.instagram.com/_u/some.user', timestamp: 9 }] }] });
  assert.deepStrictEqual(JSON.parse(p.run(`JSON.stringify(parseJson(T, 'relationships_following'))`)), [{ u: 'some.user', ts: 9 }]);
});

test('HTML download: usernames and follow dates', () => {
  const p = page();
  p.sandbox.H = '<div><div><a target="_blank" href="https://www.instagram.com/neha.k">neha.k</a></div><div>Jan 05, 2024 3:42 pm</div></div>' +
    '<div><div><a target="_blank" href="https://www.instagram.com/raj_x">raj_x</a></div><div>Feb 01, 2025 4:30 am</div></div>';
  const rows = JSON.parse(p.run(`JSON.stringify(parseHtml(H).map(r => [r.u, new Date(r.ts * 1000).getFullYear(), new Date(r.ts * 1000).getHours()]))`));
  assert.deepStrictEqual(rows, [['neha.k', 2024, 15], ['raj_x', 2025, 4]]);
});

test('a download with neither list is refused with a pointer to the right folder', async () => {
  const p = page();
  const msg = await p.run(`(async () => { try { await readDownload([new File(['{}'], 'liked_posts.json')]); return 'ok'; } catch (e) { return e.message; } })()`);
  assert.match(msg, /followers_and_following/);
});
