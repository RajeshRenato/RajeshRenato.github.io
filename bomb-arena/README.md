# Bomb Arena

A Bomberman-style arena game. Drop bombs, blow up crates, pick up what's inside, and be the last one standing. First to win 3 rounds takes the match.

Play with up to 3 friends online, against bots, or with two people on one keyboard. Bots fill any empty corners, and the host can turn them off between matches.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`, not opened as a file.

To play friends: click "Play with friends" and send each friend their own invite. Each of them sends back a reply link; open it in your browser or paste it in. Press Start when everyone is in.

- Move with the arrow keys or WASD, and drop a bomb with Space.
- Two on one keyboard: the left player uses WASD and Space, the right player the arrow keys and Enter.
- On a phone, use the stick on the left and the Bomb button on the right.

## Rules

- A bomb goes off after about 2.4 seconds. The flames go out in a cross and stop at the first wall, crate, or bomb they reach. A bomb caught in the flames goes off too.
- You start with one bomb at a time and flames 2 tiles long. Some crates hide a power-up: one more bomb, longer flames, or more speed. Flames burn up any power-up lying in the open.
- You can't walk through crates or bombs, but you can always walk off the bomb you just dropped.
- After 90 seconds the walls start closing in from the outside, so every round ends.
- If the last two players go down in the same blast, nobody wins the round.

## How online play works

It uses [LinkPlay](../linkplay/): browsers connect directly over WebRTC, and the invite and reply links carry the connection details. The host's browser runs the game and the bots. Guests send their key presses, and the host sends everyone the state of the arena 20 times a second.

## Tests

`tests/bomb-arena.test.js` covers the arena layout, blasts and chain reactions, walking, power-ups, rounds and draws, sudden death, bots surviving their own bombs over a dozen bot-only rounds, and a three-player online game over in-memory channels, including broken and hostile messages.
