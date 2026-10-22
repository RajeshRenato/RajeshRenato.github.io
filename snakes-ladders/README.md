# Snakes & Ladders

Snakes and ladders for 2 to 4 players. Roll the dice, climb the ladders, slide down the snakes, and be the first to reach 100. Play friends online with a link, pass one phone around, or fill seats with bots.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`.

"Play on this device" lets you set each of the four seats to a player, a bot, or empty. To play online, click "Play with friends" and send each friend their own invite; they send back a reply link. Seats go in join order, and the host can fill the rest with bots. If someone leaves, a bot takes their seat.

Click the dice, or press Space or Enter, to roll on your turn.

## Rules

- Tokens start off the board, next to square 1.
- Landing at the foot of a ladder takes you up it; landing on a snake's head takes you down to its tail.
- A six rolls again. Three sixes in a row and the turn passes, with the third six not moved.
- Two options before you start: "Roll a six to start" (off by default) and "Land on 100 exactly" (on by default; a roll that would go past 100 doesn't move you).

The board has 8 ladders and 9 snakes. Tokens hop square by square, then climb or slide, so you can follow every move.

## How it works

- The board is drawn once onto its own canvas whenever its size changes, and tokens are drawn on top each frame. Snakes are wavy curves that thin toward the tail, with a head, eyes, and a tongue; tokens follow the same curve when they slide.
- The host's browser (or yours, playing on one device) rolls the dice and runs the turns. Online, guests send "roll" on their turn and get the whole game state back after every change, which they check before using. It uses [LinkPlay](../linkplay/) for the connection, with no game server.

## Tests

`tests/snakes-ladders.test.js` checks the board numbering, that ladders go up, snakes go down, and no square is two things at once, moves with ladders, snakes, the exact finish, and the six to start, turns, extra rolls and three sixes, a bots-only game to the end, and an online game where the guest can only roll on its own turn and broken states are ignored.
