# LinkPlay

A small kit for making a browser game multiplayer with no server of your own. Players connect by sending each other links. This folder's `index.html` is the demo: invite friends and you see each other's cursors.

Most of the online projects here are built on it: Chess, Ludo, Mafia, Clue Grid, Sketch & Guess, Trivia Night, Watch Party, Secret Chat, Video Call, and the online modes in Highway Brawl, Midnight Racing and Miami Nights. Video Call and Watch Party also send camera and microphone over the same connection (see the media options in `linkplay.js`).

## How the connection works

Browsers can talk directly over WebRTC, but first they have to swap a description of themselves (an "offer" and an "answer"). Normally a signaling server carries those. Here the players carry them:

1. The host creates an invite. The offer is packed into the link: `page/#offer=ID.CODE`.
2. The friend opens it, or pastes the link or just the `ID.CODE` key into the lobby. Their page makes an answer and shows a reply link: `page/#answer=ID.CODE`.
3. The friend sends the reply back. The host opens it in the same browser (a `BroadcastChannel` passes it to the game tab) or pastes it in.
4. The data channel opens.

For games and chat, which use only a data channel, the code is short: about 110 characters, so a whole link is about 160. The browsers' descriptions are long, but only a few values in them differ from one connection to the next: the ICE username and password, the DTLS certificate fingerprint and role, and the network addresses. A short code (starting with `k`) carries just those, packed bit by bit, with the public address and one local address (for players on the same Wi-Fi); the page rebuilds the rest. The password and fingerprint are random security values, so this is about as short as a handshake can get; a 6 to 8 character room code would need a server, or a public relay, to pass the handshake along. Connections with audio or video (Video Call, Watch Party) still use the longer deflated form, about 800 characters, starting with `z`.

The ID ties a reply to its invite, so a host can have several invites out at once. A public STUN server (Google or Cloudflare) tells each browser its public address. That is the only outside request. There is no TURN relay, so on networks that block direct connections, players can't connect.

## Relay

On networks that block direct connections (many offices, colleges, and some mobile carriers), browsers need a TURN relay to reach each other. LinkPlay has none configured, so on those networks players can't connect.

To turn one on, add a provider's credentials to `RELAY` near the top of `linkplay.js`. Providers like Metered give credentials meant to be used in a web page. The relay is used only when a direct connection fails, and it can't read anything, because the traffic stays encrypted end to end. `LinkPlay.route(pc)` tells you whether a connection went direct or through the relay, and `host()` and `join()` take `relay: false` to never use it.

## Files

| File | What it does | Needs |
| --- | --- | --- |
| `linkplay.js` | The handshake: invites, replies, link codes | nothing |
| `room.js` | Rooms of up to 8: player list, names, colors, host relay | `linkplay.js` |
| `lobby.js` | The invite screens: name, invite links, a box to paste a reply (host) or an invite (friend), Start. With `max: 2` it starts by itself once the friend is in. | both of the above |
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

`tests/linkplay.test.js` checks the link codes (short codes keep every value the connection needs, leave out TCP and extra IPv6 addresses, and audio or video falls back to the long form), and runs a host and two guests in separate sandboxes over in-memory channels: joining, relaying, and leaving.
