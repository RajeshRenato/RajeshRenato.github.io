// Lobby: the invite screens for a Room game. Needs linkplay.js and room.js.
//
//   const lobby = Lobby.mount(document.getElementById('lobby'), {
//     game: 'type-race', title: 'Type Race', blurb: '...', min: 2, max: 8,
//     extra: [{ label: 'Practice alone', note: '...', onClick() {} }],
//     onStart(room) {},   // host pressed Start
//     onJoin(room) {},    // guest connected
//   });
//   Optional wording for pages that aren't games: hostLabel, hostNote, startLabel, more, noun.
//   lobby.start()        back to the first screen, leaving any room
//   lobby.reopen()       host only: show the invite screen again between games
//
// The page styles it; every element has an lp- class.
const Lobby = (() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function savedName() { try { return localStorage.getItem('linkplay_name') || ''; } catch (e) { return ''; } }
  function saveName(n) { try { localStorage.setItem('linkplay_name', n); } catch (e) { } }

  async function copy(input, btn) {
    if (!input.value) return;
    try { await navigator.clipboard.writeText(input.value); }
    catch (e) { input.select(); try { document.execCommand('copy'); } catch (e2) { } }
    if (btn) { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1400); }
  }
  async function share(input) {
    try { await navigator.share({ url: input.value }); } catch (e) { }
  }
  const canShare = () => typeof navigator !== 'undefined' && !!navigator.share;

  function codeRow(value, placeholder) {
    const row = document.createElement('div');
    row.className = 'lp-code';
    row.innerHTML = '<input readonly><button class="lp-copy">Copy</button>' + (canShare() ? '<button class="lp-share">Share</button>' : '');
    const input = row.querySelector('input') || row.children[0];
    if (input) { input.value = value || ''; input.placeholder = placeholder || ''; }
    const c = row.querySelector('.lp-copy'), s = row.querySelector('.lp-share');
    if (c) c.onclick = () => copy(input, c);
    if (s) s.onclick = () => share(input);
    return { row, input };
  }

  function mount(el, opts) {
    const min = opts.min || 2, max = opts.max || 8, noun = opts.noun || 'game';
    let room = null, joining = null;

    const panel = html => { el.hidden = false; el.innerHTML = '<div class="lp-box">' + html + '</div>'; };
    const $ = sel => el.querySelector(sel);

    function nameField() {
      return '<label class="lp-name">Your name <input id="lpName" maxlength="16" autocomplete="nickname" value="' + esc(savedName()) + '"></label>';
    }
    function readName() {
      const v = (($('#lpName') || {}).value || '').trim();
      if (v) saveName(v);
      return v;
    }

    function start() {
      leave();
      panel(
        '<h1>' + esc(opts.title) + '</h1>' +
        '<p>' + esc(opts.blurb) + '</p>' + nameField() +
        '<div class="lp-modes"><button id="lpCreate">' + (opts.hostLabel ? esc(opts.hostLabel) + '<span>' + esc(opts.hostNote || '') + '</span>' : max === 2 ? 'Play a friend online<span>Send a link, they send one back, and you\'re connected.</span>' : 'Play with friends<span>Up to ' + max + ' players. Send each friend their own link.</span>') + '</button>' +
        (opts.extra || []).map((x, i) => '<button data-extra="' + i + '">' + esc(x.label) + (x.note ? '<span>' + esc(x.note) + '</span>' : '') + '</button>').join('') +
        '</div>' +
        // a friend's invite can be pasted here as well as opened: the whole link, or just the key after the #
        '<div class="lp-code"><input id="lpPaste" placeholder="Got an invite? Paste the link or key"><button id="lpPasteGo">Join</button></div>' +
        '<p id="lpStatus" class="lp-status"></p>' +
        '<p class="lp-small">' + (noun === 'game' ? 'Players' : 'People') + ' connect browser to browser, with no ' + esc(noun) + ' server. A public STUN service helps the browsers find each other. Some strict office or mobile networks block direct connections; if a friend can\'t connect, try another network.</p>'
      );
      $('#lpCreate').onclick = () => host(readName());
      const pasted = () => {
        const m = /(?:offer=)?([a-z0-9]{6})\.([zrk][A-Za-z0-9_-]+)/.exec($('#lpPaste').value.trim());
        if (!m || /answer=/.test($('#lpPaste').value)) { setStatus("That isn't an invite. Paste the invite link or key your friend sent."); return; }
        readName(); guest({ kind: 'offer', id: m[1], code: m[2] });
      };
      $('#lpPasteGo').onclick = pasted;
      $('#lpPaste').onkeydown = e => { if (e.key === 'Enter') pasted(); };
      for (const b of el.querySelectorAll('[data-extra]')) b.onclick = () => { readName(); el.hidden = true; opts.extra[+b.dataset.extra].onClick(); };
    }

    function host(myName) {
      room = Room.create(opts.game, myName);
      room.on('roster', drawRoster);
      room.on('fail', () => setStatus("A friend couldn't connect. One of your networks may block direct connections; send them a new invite or try another network."));
      panel(
        '<h2>Invite friends</h2>' +
        '<p>' + (max === 2 ? 'Send your friend this invite.' : 'Send each friend their own invite.') + ' They\'ll get a reply link to send back: open it in this browser, or paste it below.' + (max === 2 ? ' The ' + esc(noun) + ' starts as soon as they\'re in.' : '') + '</p>' +
        '<div id="lpInvites"></div>' +
        '<button id="lpMore" class="lp-link">' + esc(opts.more || 'Invite another player') + '</button>' +
        '<div class="lp-code"><input id="lpReply" placeholder="Paste a reply link"><button id="lpConnect">Connect</button></div>' +
        '<p id="lpStatus" class="lp-status"></p>' +
        '<ul id="lpRoster" class="lp-roster"></ul>' +
        '<div class="lp-row"><button id="lpStart" disabled>' + esc(opts.startLabel || 'Start') + '</button><button class="lp-link" id="lpCancel">Cancel</button></div>'
      );
      $('#lpMore').onclick = () => addInvite();
      $('#lpConnect').onclick = () => accept($('#lpReply').value);
      $('#lpReply').onkeydown = e => { if (e.key === 'Enter') accept($('#lpReply').value); };
      if (max === 2) { $('#lpStart').hidden = true; $('#lpMore').hidden = true; }
      $('#lpStart').onclick = () => { if (room.players.length >= min) { el.hidden = true; opts.onStart(room); } };
      $('#lpCancel').onclick = start;
      drawRoster();
      addInvite();
      return room;
    }

    let invites = 0;
    async function addInvite() {
      if (!room || invites + 1 >= max) return;
      invites++;
      const n = invites;
      const wrap = document.createElement('div');
      wrap.className = 'lp-invite';
      wrap.innerHTML = '<span>Invite ' + n + '</span>';
      const { row, input } = codeRow('', 'Creating the invite…');
      wrap.appendChild(row);
      $('#lpInvites').appendChild(wrap);
      try { input.value = await room.invite(); }
      catch (e) { input.value = ''; setStatus("Your browser couldn't create an invite. Try an up-to-date Chrome, Firefox, or Safari."); }
      if (invites + 1 >= max) $('#lpMore').hidden = true;
    }

    async function accept(text) {
      if (!room) return false;
      const err = await room.accept(text);
      setStatus(err || 'Connecting…');
      if (!err && $('#lpReply')) $('#lpReply').value = '';
      return !err;
    }

    function setStatus(t) { const s = $('#lpStatus'); if (s) s.textContent = t; }

    function drawRoster() {
      const ul = $('#lpRoster');
      if (!ul || !room || !room.isHost) return;
      ul.innerHTML = room.players.map(p => '<li><i style="background:' + p.color + '"></i>' + esc(p.name) + (p.id === room.me ? ' (you)' : '') + '</li>').join('');
      const ok = room.players.length >= min;
      $('#lpStart').disabled = !ok;
      if (max === 2 && ok && !el.hidden) { el.hidden = true; opts.onStart(room); return; }
      if (room.players.length > 1) setStatus(ok ? (opts.startLabel || 'Start') + ' when everyone is in.' : '');
    }

    function guest(invite) {
      panel(
        '<h2>Join ' + esc(opts.title) + '</h2>' + nameField() +
        '<div class="lp-row"><button id="lpJoin">Join</button></div>' +
        '<p id="lpStatus" class="lp-status"></p><div id="lpBack"></div>' +
        '<button class="lp-link" id="lpCancel">Leave</button>'
      );
      $('#lpCancel').onclick = start;
      $('#lpJoin').onclick = async () => {
        const myName = readName();
        $('#lpJoin').disabled = true;
        setStatus('Setting up the connection…');
        try {
          joining = await Room.join(opts.game, invite, myName, {
            onReady: r => { room = r; el.hidden = true; opts.onJoin(r); },
            onFail: () => setStatus("Couldn't connect. One of your networks may block direct connections; try another network."),
          });
          try { history.replaceState(null, '', location.pathname); } catch (e) { }
          setStatus('Send this reply link back to your friend. You\'re in as soon as they open it or paste it in. Keep this page open.');
          $('#lpBack').appendChild(codeRow(joining.link).row);
        } catch (e) {
          setStatus("This invite didn't work. Ask your friend for a fresh one.");
        }
      };
    }

    async function reply(r) {
      panel('<h2 id="lpTitle">Connecting…</h2><p id="lpStatus" class="lp-status"></p><div id="lpBack"></div>');
      if (await LinkPlay.forwardReply(opts.game, r)) {
        $('#lpTitle').textContent = 'Connected';
        setStatus('Go back to the ' + noun + ' tab. You can close this one.');
        return;
      }
      $('#lpTitle').textContent = 'Paste this into the ' + noun;
      setStatus("The " + noun + " isn't open in this browser. Copy this reply and paste it into the tab where you sent the invite.");
      $('#lpBack').appendChild(codeRow(LinkPlay.pageLink('answer=' + r.id + '.' + r.code)).row);
    }

    function leave() {
      if (room) { try { room.close(); } catch (e) { } }
      if (joining) { try { joining.close(); } catch (e) { } }
      room = null; joining = null; invites = 0;
    }

    const fromLink = LinkPlay.fromHash();
    if (fromLink && fromLink.kind === 'offer') guest(fromLink);
    else if (fromLink && fromLink.kind === 'answer') reply(fromLink);
    else start();

    function reopen() {
      if (!room || !room.isHost) return start();
      el.hidden = false;
      drawRoster();
    }

    return { start, host, accept, leave, reopen, get room() { return room; } };
  }

  return { mount };
})();
