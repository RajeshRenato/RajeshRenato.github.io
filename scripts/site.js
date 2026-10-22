#!/usr/bin/env node
'use strict';
// Keeps the shared parts of the site in sync with the projects.
//
//   node scripts/site.js
//     Rewrites, on every project page: the canonical link, structured data, and the
//     "about" section (built from the project's README, with related links). Also
//     the hub's section blurbs, search keywords, counts, and sitemap.xml.
//
//   node scripts/site.js add <folder> --section "Tools" --color "#28e0ff"
//        --thumb <drawer-key> --thumb-file <file.js> --desc "One line." [--after <folder>]
//     Adds a hub card (with its live thumbnail) and a README row, then runs the above.
//
// A project page's <title> must read "Name | words people search for".

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://rajeshrenato.github.io/';
const REPO = 'https://github.com/RajeshRenato/RajeshRenato.github.io/tree/main/';
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

const SECTIONS = {
  'Today': ['today', ''],
  'Highlights': ['highlights', 'The biggest builds: an open world, a racer, a shooter, and a puzzle with huge boards.'],
  'Play online': ['online', 'Games for two or more people, connected by links. No server, no accounts.'],
  'Games': ['games', 'Games to play on your own, from puzzles to arcade.'],
  'Classics': ['classics', 'Familiar games, rebuilt from scratch.'],
  'Tools': ['tools', 'Everyday tools that keep your files on your device.'],
  'Toys &amp; simulations': ['toys', 'Things to play with: physics, generative art, and algorithms.'],
};
const CATEGORY = { online: 'GameApplication', games: 'GameApplication', classics: 'GameApplication', highlights: 'GameApplication',
  today: 'GameApplication', tools: 'UtilitiesApplication', toys: 'EducationalApplication' };
const FALLBACK_RELATED = ['chess', 'pdf-toolkit', 'ludo', 'photo-privacy', 'clue-grid', 'images-to-pdf'];
const AUTHOR = { '@type': 'Person', name: 'Rajesh Renato', url: 'https://github.com/RajeshRenato' };

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" };
const unescape = s => s.replace(/&(amp|lt|gt|quot|#x27|#39);/g, m => ENT[m]);
const escText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => escText(s).replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

// JSON written the way the pages already have it: ", " and ": " separators.
function json(v) {
  if (Array.isArray(v)) return '[' + v.map(json).join(', ') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + json(x)).join(', ') + '}';
  return JSON.stringify(v);
}

// --- README to the HTML used in the about section

function inline(s) {
  return escText(s).split(/(`[^`]+`)/).map(p => (p.length > 1 && p.startsWith('`') && p.endsWith('`')
    ? '<code>' + p.slice(1, -1) + '</code>'
    : p.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>'))).join('');
}

function readmeHtml(slug) {
  const text = read(slug + '/README.md').replace(/```[\s\S]*?```/g, '').trim();
  const out = [];
  let section = null;
  for (let b of text.split(/\n\s*\n/)) {
    b = b.trim();
    if (!b || b.startsWith('# ')) continue;
    if (b.startsWith('## ')) {
      const nl = b.indexOf('\n');
      section = (nl < 0 ? b : b.slice(0, nl)).slice(3).trim();
      if (section === 'Tests' || section === 'Files') continue;
      out.push('<h3>' + inline(section) + '</h3>');
      b = nl < 0 ? '' : b.slice(nl + 1).trim();
      if (!b) continue;
    }
    if (section === 'Tests' || section === 'Files') continue;
    if (!b.startsWith('|') && !b.startsWith('- ')) {
      b = b.split(/(?<=[.!?])\s+/).filter(x => !/index\.html|http\.server|served over/.test(x)).join(' ').trim();
      if (!b) continue;
    }
    const lines = b.split('\n');
    if (lines.every(l => l.startsWith('|'))) {
      const rows = lines.filter(l => !/^\|\s*-/.test(l)).map(l => l.replace(/^\|+|\|+$/g, '').split('|'));
      out.push('<table>' + rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c.trim()) + '</td>').join('') + '</tr>').join('') + '</table>');
    } else if (lines.every(l => /^(- |\d+\. | {2})/.test(l))) {
      const items = [];
      let cur = '';
      for (const l of lines) {
        if (/^(- |\d+\. )/.test(l)) { if (cur) items.push(cur); cur = l.replace(/^(- |\d+\. )/, ''); } else cur += ' ' + l.trim();
      }
      items.push(cur);
      out.push('<ul>' + items.map(i => '<li>' + inline(i) + '</li>').join('') + '</ul>');
    } else {
      out.push('<p>' + inline(lines.map(l => l.trim()).join(' ')) + '</p>');
    }
  }
  return out.filter((b, i) => !(b.startsWith('<h3>') && (i + 1 === out.length || out[i + 1].startsWith('<h3>')))).join('\n');
}

// --- the hub

function hubSections(hub) {
  hub = hub.replace(/<h2(?: id="[^"]*")?>([^<]+)(<small>\d+<\/small>)?<\/h2>\n(?:<p class="sec">[^<]*<\/p>\n)?/g, (m, name, small) => {
    const [sid, desc] = SECTIONS[name] || [];
    if (!sid) throw new Error('unknown hub section: ' + name);
    return '<h2 id="' + sid + '">' + name + (small || '') + '</h2>\n' + (desc ? '<p class="sec">' + desc + '</p>\n' : '');
  });
  if (!hub.includes('.sec {')) hub = hub.replace('  h2 small {', '  p.sec { margin: -8px 0 18px; color: var(--muted); font-size: 15px; max-width: 64ch; }\n  h2 small {');
  return hub;
}

function readCards(hub) {
  const cards = new Map(), sectionOf = {}, order = [];
  let cur = null;
  const re = /<h2 id="([^"]+)">([^<]+)|<a href="([a-z0-9-]+)\/"[^>]*data-t="[^"]*"[^>]*><canvas[^>]*><\/canvas><div class="txt"><strong>(.*?)<\/strong><span>(.*?)<\/span>/g;
  for (const m of hub.matchAll(re)) {
    if (m[1]) { cur = [m[1], unescape(m[2]).trim()]; continue; }
    cards.set(m[3], { name: unescape(m[4]), desc: unescape(m[5]) });
    sectionOf[m[3]] = cur;
    order.push(m[3]);
  }
  return { cards, sectionOf, order };
}

function relatedHtml(slug, ctx) {
  const { cards, sectionOf, order } = ctx;
  const [sid, sname] = sectionOf[slug];
  const i = order.indexOf(slug);
  const same = order.filter(x => sectionOf[x][0] === sid && x !== slug)
    .sort((a, b) => ((order.indexOf(a) - i + order.length) % order.length) - ((order.indexOf(b) - i + order.length) % order.length));
  let picks = slug === 'daily' ? ['penta', 'sudoku', 'arrow-flux', 'pixel-logic'] : same.slice(0, 4);
  if (picks.length < 4) picks = picks.concat(FALLBACK_RELATED.filter(x => x !== slug && !picks.includes(x)).slice(0, 4 - picks.length));
  const links = picks.map(x => '<a href="../' + x + '/">' + escAttr(cards.get(x).name) + '</a>').join(', ');
  if (sid === 'today' || sid === 'highlights') return '<p class="pg-more">More like this: ' + links + '. Or see <a href="../">everything in the playground</a>.</p>\n';
  const label = { online: 'online games', toys: 'toys and simulations' }[sid] || sname.toLowerCase();
  return '<p class="pg-more">More like this: ' + links + '. Or see <a href="../#' + sid + '">all ' + label + '</a>.</p>\n';
}

function titlePhrase(html, slug) {
  const t = /<title>([^<]*)<\/title>/.exec(html);
  const parts = t ? unescape(t[1]).split(' | ') : [];
  if (parts.length < 2) throw new Error(slug + '/index.html: the <title> should read "Name | words people search for"');
  return parts.slice(1).join(' | ');
}

function patchPage(slug, ctx) {
  const file = slug + '/index.html';
  let s = read(file);
  const { name } = ctx.cards.get(slug);
  const url = BASE + slug + '/';
  const meta = /<meta name="description" content="([^"]*)">/.exec(s);
  const desc = meta ? unescape(meta[1]) : ctx.cards.get(slug).desc;
  const [sid, sname] = ctx.sectionOf[slug];
  const oldApp = /"@type": "WebApplication"[\s\S]*?"applicationCategory": "([A-Za-z]+)"/.exec(s);
  const category = oldApp ? oldApp[1] : CATEGORY[sid];

  s = s.replace(/\n<link rel="canonical"[^>]*>/g, '').replace('</title>', () => '</title>\n<link rel="canonical" href="' + url + '">');
  s = s.replace(/\n<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: "Rajesh's Playground", item: BASE },
    { '@type': 'ListItem', position: 2, name: sid === 'today' ? 'Today' : sname, item: BASE + '#' + sid },
    { '@type': 'ListItem', position: 3, name, item: url }] };
  const app = { '@context': 'https://schema.org', '@type': 'WebApplication', name, url, description: desc, applicationCategory: category,
    operatingSystem: 'Any (runs in a web browser)', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: AUTHOR };
  s = s.replace('</head>', () => '<script type="application/ld+json">' + json(crumbs) + '</script>\n</head>');
  s = s.replace('</head>', () => '<script type="application/ld+json">' + json(app) + '</script>\n</head>');

  s = s.replace(/\n<link rel="stylesheet" href="\.\.\/common\/about\.css">/g, '').replace('</title>', '</title>\n<link rel="stylesheet" href="../common/about.css">');
  s = s.replace(/\n<div class="pg-about" id="pg-about"[\s\S]*?<\/div><!-- \/about -->\n<script src="\.\.\/common\/about\.js"><\/script>/g, '');
  if (s.split('</body>').length !== 2) throw new Error(file + ' should have exactly one </body>');
  const about = '<div class="pg-about" id="pg-about" hidden>\n<h2>' + inline(name) + '</h2>\n' + readmeHtml(slug) + '\n' + relatedHtml(slug, ctx) +
    '<p class="pg-src">Free, no sign-up, and it runs entirely in your browser. Part of <a href="../">Rajesh\'s Playground</a>. ' +
    'Source code: <a href="' + REPO + slug + '">' + slug + ' on GitHub</a>.</p>\n</div><!-- /about -->\n<script src="../common/about.js"></script>\n';
  s = s.replace('</body>', () => about + '</body>');
  write(file, s);
  return titlePhrase(s, slug);
}

function update() {
  let hub = hubSections(read('index.html'));
  const ctx = readCards(hub);
  const phrases = {};
  for (const slug of ctx.order) phrases[slug] = patchPage(slug, ctx);

  hub = hub.replace(/<a href="([a-z0-9-]+)\/"[^>]*data-t="[^"]*"[^>]*>/g, (tag, slug) => {
    tag = tag.replace(/ data-k="[^"]*"/, '');
    return phrases[slug] ? tag.slice(0, -1) + ' data-k="' + escAttr(phrases[slug]) + '">' : tag;
  });
  const n = +/(\d+) games, tools, and toys that run straight/.exec(hub)[1];
  const hubDesc = n + ' free browser games and tools: online multiplayer games, puzzles, and private tools like a PDF merger and photo metadata remover. No sign-up, nothing to install.';
  hub = hub.replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*(">)/g, (m, a, b) => a + escAttr(hubDesc) + b);
  hub = hub.replace(/<title>[^<]*<\/title>/, () => "<title>Rajesh's Playground | " + n + ' free browser games and tools</title>');
  hub = hub.replace(/\n<link rel="canonical"[^>]*>/g, '').replace('</title>', () => '</title>\n<link rel="canonical" href="' + BASE + '">');
  hub = hub.replace(/\n<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  hub = hub.replace('</head>', () => '<script type="application/ld+json">' + json({ '@context': 'https://schema.org', '@type': 'WebSite',
    name: "Rajesh's Playground", url: BASE, description: hubDesc, author: AUTHOR }) + '</script>\n</head>');
  write('index.html', hub);

  const day = new Date().toISOString().slice(0, 10);
  write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [BASE, ...ctx.order.map(s => BASE + s + '/')].map(u => '  <url><loc>' + u + '</loc><lastmod>' + day + '</lastmod></url>\n').join('') + '</urlset>\n');
  console.log('updated ' + ctx.order.length + ' pages, the hub, and sitemap.xml (' + n + ' projects)');
}

// --- adding a project

function add(slug, opt) {
  for (const k of ['section', 'color', 'thumb', 'thumb-file', 'desc']) if (!opt[k]) throw new Error('missing --' + k);
  for (const f of ['index.html', 'README.md', 'og.png']) if (!fs.existsSync(path.join(ROOT, slug, f))) throw new Error(slug + '/' + f + ' is missing');
  titlePhrase(read(slug + '/index.html'), slug);
  const name = unescape(/<title>([^<|]*)/.exec(read(slug + '/index.html'))[1].trim());
  let hub = read('index.html');
  if (hub.includes('href="' + slug + '/"')) throw new Error(slug + ' is already on the hub');
  const sectionHtml = opt.section.replace(/&(?!amp;)/g, '&amp;');
  const head = new RegExp('(<h2(?: id="[^"]*")?>)' + sectionHtml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<small>(\\d+)</small></h2>\\n((?:<p class="sec">[^<]*</p>\\n)?)<ul class="list">\\n');
  const m = head.exec(hub);
  if (!m) throw new Error('no hub section called ' + opt.section);
  const card = '  <li><a href="' + slug + '/" style="--c:' + opt.color + '" data-t="' + opt.thumb + '"><canvas width="304" height="171"></canvas>' +
    '<div class="txt"><strong>' + escText(name) + '</strong><span>' + escText(opt.desc) + '</span></div></a></li>\n';
  const newHead = m[1] + sectionHtml + '<small>' + (+m[2] + 1) + '</small></h2>\n' + m[3] + '<ul class="list">\n';
  if (opt.after) {
    const i = hub.indexOf('<li><a href="' + opt.after + '/"', m.index);
    if (i < 0) throw new Error('--after ' + opt.after + ' is not on the hub');
    const j = hub.indexOf('\n', i) + 1;
    hub = hub.slice(0, m.index) + newHead + hub.slice(m.index + m[0].length, j) + card + hub.slice(j);
  } else {
    hub = hub.slice(0, m.index) + newHead + card + hub.slice(m.index + m[0].length);
  }
  const anchor = 'snake(g, w, h, c, t) {';
  if (!hub.includes(anchor)) throw new Error('thumbnail anchor not found in index.html');
  const drawer = fs.readFileSync(path.resolve(opt['thumb-file']), 'utf8').trimEnd();
  hub = hub.replace(anchor, () => drawer + '\n\n' + anchor);
  const total = +/(\d+) games, tools, and toys that run straight/.exec(hub)[1];
  hub = hub.replace(total + ' games, tools, and toys that run straight', (total + 1) + ' games, tools, and toys that run straight');
  write('index.html', hub);

  let readme = read('README.md');
  const row = '| [' + slug + '](' + slug + '/) | ' + opt.desc.replace(/\.$/, '') + ' |\n';
  if (opt.after && readme.includes('| [' + opt.after + '](' + opt.after + '/)')) {
    const i = readme.indexOf('| [' + opt.after + '](' + opt.after + '/)'), j = readme.indexOf('\n', i) + 1;
    readme = readme.slice(0, j) + row + readme.slice(j);
  } else {
    const h = readme.indexOf('### ' + opt.section.replace(/&amp;/g, '&') + '\n');
    if (h < 0) throw new Error('no README section called ' + opt.section);
    const t = readme.indexOf('| --- | --- |\n', h) + '| --- | --- |\n'.length;
    readme = readme.slice(0, t) + row + readme.slice(t);
  }
  readme = readme.replace(total + ' games, tools, and toys', (total + 1) + ' games, tools, and toys');
  write('README.md', readme);
  const prof = read('profile-readme-template.md').replace('## Playground: ' + total + ' games', '## Playground: ' + (total + 1) + ' games');
  write('profile-readme-template.md', prof);
  console.log('added ' + slug + ' to ' + opt.section + ' (' + (total + 1) + ' projects). Remake the hub preview: python3 scripts/og-card.py hub');
  update();
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'add') {
  const opt = {};
  for (let i = 1; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
  add(rest[0], opt);
} else if (!cmd) update();
else { console.error('usage: node scripts/site.js [add <folder> --section ... --color ... --thumb ... --thumb-file ... --desc ... [--after ...]]'); process.exit(1); }
