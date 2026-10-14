# Cycle Duel

Light-cycle duels, like the ones in Tron. Your cycle leaves a wall behind it. Cut your rival off and make them crash. First to 3 rounds wins.

You can play a friend online, two players on one keyboard, or against a bot.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`, not opened as a file.

To play online: click "Play a friend online" and send the invite link. Your friend opens it and sends back a reply link. Open the reply (or paste it in) and you're connected.

## Controls

| Input | Action |
| --- | --- |
| W A S D | steer (blue, in a two-player game) |
| Arrow keys | steer (pink, in a two-player game) |
| Arrow keys or W A S D | steer, against the bot or online |
| Swipe | steer, on a phone |
| Enter, Space, or tap | rematch after a match ends |
| Esc | leave the match |

## How online play works

There is no game server. The two browsers connect directly over a WebRTC data channel, using [LinkPlay](../linkplay/).

- WebRTC needs both sides to swap a connection description first. Here that swap happens through the links: the invite carries the host's description and the reply carries the guest's, each compressed and base64url-encoded. If the host opens the reply link in the same browser, a `BroadcastChannel` hands it to the game tab automatically.
- Public STUN servers (Google and Cloudflare) tell each browser its public address. Those are the only outside requests the game makes. Some strict networks block direct connections, and there's no relay to fall back on, so on those it won't connect.
- The host runs the game at about 14 ticks a second. The guest sends its turns and draws the snapshots the host sends back. If a snapshot goes missing, the guest asks for a full copy of the board. The ping shown in the corner is the measured round trip.

## Tests

`tests/cycle-duel.test.js` covers the rules and the bot, and plays a full online match between two copies of the game connected by an in-memory channel, including a dropped snapshot and a disconnect.
