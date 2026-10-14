# LinkPlay

A small kit for making a browser game multiplayer with no server of your own. Players connect by sending each other links. This folder's `index.html` is the demo: invite friends and you see each other's cursors.

Cycle Duel, Type Race, Sketch & Guess, Four in a Row, Checkers, Clue Grid, Trivia Night, and Whiteboard are built on it.

## How the connection works

Browsers can talk directly over WebRTC, but first they have to swap a description of themselves (an "offer" and an "answer"). Normally a signaling server carries those. Here the players carry them:

1. The host creates an invite. The offer is compressed into the link: `page/#offer=ID.CODE`.
2. The friend opens it. Their page makes an answer and shows a reply link: `page/#answer=ID.CODE`.
3. The friend sends the reply back. The host opens it in the same browser (a `BroadcastChannel` passes it to the game tab) or pastes it in.
4. The data channel opens.

Each link is around 800 characters. The ID ties a reply to its invite, so a host can have several invites out at once. A public STUN server (Google or Cloudflare) tells each browser its public address. That is the only outside request. There is no TURN relay, so on networks that block direct connections, players can't connect.

## Files

| File | What it does | Needs |
| --- | --- | --- |
| `linkplay.js` | The handshake: invites, replies, link codes | nothing |
| `room.js` | Rooms of up to 8: player list, names, colors, host relay | `linkplay.js` |
| `lobby.js` | The invite screens: name, invite links, paste box, Start. With `max: 2` it starts by itself once the friend is in. | both of the above |
| `lobby.css` | Styles for `lobby.js`; recolor with `--lp-*` variables | |

Copy the folder, or link the files from `../linkplay/` as the games here do.

## Two players, handshake only

```html
<script src="linkplay.js"></script>
<script>
const link = LinkPlay.fromHash();

if (link && link.kind === 'offer') {
  // a friend's invite
  LinkPlay.join('my-game', link, { onChannel: ch => play(ch) })
    .then(({ link }) => showReplyToSend(link));
} else if (link && link.kind === 'answer') {
  // the reply, opened in the host's browser
  LinkPlay.forwardReply('my-game', link).then(ok => { if (!ok) showPasteThis(link); });
} else {
  const host = LinkPlay.host('my-game', { onChannel: ch => play(ch) });
  host.invite().then(({ link }) => showInviteToSend(link));
  // if they paste the reply instead: host.accept(text) resolves to '' or an error sentence
}

function play(ch) {
  ch.onmessage = e => console.log(JSON.parse(e.data));
  ch.send(JSON.stringify({ hello: 1 }));
}
</script>
```

The name (`'my-game'`) keeps different games' tabs from picking up each other's replies.

## A room with the lobby

```html
<link rel="stylesheet" href="lobby.css">
<div id="lobby" class="lp-panel"></div>
<script src="linkplay.js"></script>
<script src="room.js"></script>
<script src="lobby.js"></script>
<script>
Lobby.mount(document.getElementById('lobby'), {
  game: 'my-game', title: 'My Game', blurb: 'One line about it.', min: 2, max: 8,
  onStart: room => begin(room),   // host pressed Start
  onJoin: room => begin(room),    // a guest got in
});

function begin(room) {
  room.on('message', (msg, from) => {
    if (room.isHost) room.send({ ...msg, id: from });  // the host passes it on
  });
  room.on('roster', players => {});  // [{ id, name, color }]
}
</script>
```

The host is player 0. `room.send(msg)` goes to the host from a guest, and to every guest from the host; `room.sendTo(id, msg)` is host only. Messages are JSON. Guests never talk to each other, so the host decides what's true: it runs the game and sends out the state, and guests send their inputs.

## Tests

`tests/linkplay.test.js` checks the link codes, and runs a host and two guests in separate sandboxes over in-memory channels: joining, relaying, and leaving.
