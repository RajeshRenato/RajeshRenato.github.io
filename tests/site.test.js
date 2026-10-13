'use strict';
// Repo-wide checks: every project is complete, linked, and its scripts compile.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT, ctx2d, load, run, pageScripts } = require('./helpers/browser');

const BASE = 'https://rajeshrenato.github.io/playground';
const NOT_PROJECTS = new Set(['tests', 'template', 'docs', 'node_modules']);

const projects = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && !NOT_PROJECTS.has(d.name))
  .map(d => d.name)
  .sort();

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const hub = read('index.html');

test('every project folder has a page, a README, and a 1200x630 preview image', () => {
  assert.ok(projects.length >= 50, 'expected at least 50 projects, found ' + projects.length);
  for (const p of projects) {
    for (const f of ['index.html', 'README.md', 'og.png']) {
      assert.ok(fs.existsSync(path.join(ROOT, p, f)), p + '/' + f + ' is missing');
    }
    const png = fs.readFileSync(path.join(ROOT, p, 'og.png'));
    assert.strictEqual(png.toString('ascii', 1, 4), 'PNG', p + '/og.png is not a PNG');
    assert.deepStrictEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], p + '/og.png should be 1200x630');
  }
});

test('preview tags, favicon, and back link are set on every project page', () => {
  const problems = [];
  for (const p of projects) {
    const html = read(p + '/index.html');
    if (!html.includes(`<meta property="og:url" content="${BASE}/${p}/">`)) problems.push(p + ': og:url should be ' + BASE + '/' + p + '/');
    if (!html.includes(`<meta property="og:image" content="${BASE}/${p}/og.png">`)) problems.push(p + ': og:image is wrong');
    if (!/<meta name="description" content="[^"]+">/.test(html)) problems.push(p + ': missing description');
    if (!html.includes('rel="icon"')) problems.push(p + ': missing favicon');
    if (!/href="\.\.\/"/.test(html)) problems.push(p + ': missing a link back to the hub');
  }
  assert.deepStrictEqual(problems, []);
});

test('the hub has exactly one card per project', () => {
  const cards = [...hub.matchAll(/<a href="([a-z0-9-]+)\/"[^>]*data-t="/g)].map(m => m[1]).sort();
  assert.deepStrictEqual(cards, projects);
});

test('the README lists every project', () => {
  const readme = read('README.md');
  const rows = [...new Set([...readme.matchAll(/\]\(([a-z0-9-]+)\/\)/g)].map(m => m[1]))].sort();
  assert.deepStrictEqual(rows, projects);
});

test('relative links in the root docs point at real files', () => {
  for (const doc of ['README.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md']) {
    for (const m of read(doc).matchAll(/\]\(([^)#:\s]+)\)/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, m[1])), doc + ' links to missing ' + m[1]);
    }
  }
});

test('no placeholder URLs are left', () => {
  for (const p of ['index.html', 'README.md', ...projects.map(p => p + '/index.html')]) {
    assert.ok(!/YOUR-USERNAME|YOUR-REPO/.test(read(p)), p + ' still has a placeholder URL');
  }
});

test('every script on every page compiles', () => {
  for (const p of ['index.html', '404.html', ...projects.map(p => p + '/index.html')]) {
    for (const s of pageScripts(p)) {
      assert.doesNotThrow(() => new vm.Script(s.code, { filename: s.filename }), 'syntax error in ' + s.filename);
    }
  }
});

test('every hub card has a thumbnail that draws without errors', () => {
  load('index.html');
  const TH = run('TH');
  const keys = [...hub.matchAll(/data-t="([a-z0-9]+)"/g)].map(m => m[1]);
  for (const k of keys) {
    assert.strictEqual(typeof TH[k], 'function', 'no thumbnail function for data-t="' + k + '"');
    const state = {};
    for (const t of [0, 0.5, 3.3, 12.7]) {
      assert.doesNotThrow(() => TH[k].call(state, ctx2d, 304, 171, '#28e0ff', t), k + ' thumbnail failed at t=' + t);
    }
  }
});
