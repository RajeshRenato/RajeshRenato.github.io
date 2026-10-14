# Ludo

Ludo for 2 to 4 players. Race your four tokens from your yard, around the board, and into your home column. Play friends online with links, pass one phone around, or play against bots.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`, not opened as a file.

To play online: click "Play with friends" and send each friend their own invite. Each of them sends back a reply link; open it in your browser or paste it in, then press Start. Seats go in join order, and with two players you sit opposite each other. You can fill the empty seats with bots.

To play on one device: pick "Play on this device" and set each seat to a player, a bot, or empty.

| Input | Action |
| --- | --- |
| Click the dice, or Space or Enter | roll |
| Click a highlighted token, or 1 to 4 | move it |

When only one token can move, it moves by itself.

## Rules

- You need a six to bring a token out of your yard onto your start square.
- Rolling a six gives you another roll. Three sixes in a row lose the turn.
- Landing on another player's token sends it back to their yard and gives you another roll.
- Start squares and star squares are safe: nobody can be captured there.
- After going once around, a token turns into its home column. It needs an exact roll to reach home, and getting a token home gives another roll.
- The first player to get all four tokens home wins.

There are no blockades: two tokens on the same square don't stop anyone from passing.

## How it works

The 52 track squares are listed once, in order. Each seat starts 13 squares after the previous one, so a token's position is just a number from its own start, and the board square comes from adding the seat's offset.

Bots score every legal move: capturing, getting home, leaving the yard, and reaching the home column count for a move, and ending up within six squares in front of an opponent counts against it.

Online, it uses [LinkPlay](../linkplay/). The host's browser rolls the dice for everyone, so nobody can choose their roll, and checks that each move is legal. If a player leaves, a bot takes their seat and the game goes on.

## Tests

`tests/ludo.test.js` checks the board path, starting with a six, exact rolls home, captures and safe squares, extra rolls and three sixes, a full four-bot game, the bot choosing a capture, and an online game between a host and a guest.
