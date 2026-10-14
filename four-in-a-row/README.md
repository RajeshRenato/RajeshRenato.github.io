# Four in a Row

A Connect Four-style game. Take turns dropping discs into a 7 by 6 grid. The first to line up four, across, down, or diagonally, wins.

Play a friend online, two players on one screen, or the bot.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`, not opened as a file.

To play online: click "Play a friend online" and send the invite. Your friend sends back a reply link; open it in your browser or paste it in. The game starts as soon as they're in.

## Controls

| Input | Action |
| --- | --- |
| Click or tap a column | drop a disc |
| 1 to 7 | drop a disc in that column |
| Enter | play again after a game |

Players take turns going first. Scores are kept until you leave.

## The bot

The bot searches ahead with negamax and alpha-beta pruning: 2 moves on easy, 5 on normal, 7 on hard. When it can't see a win, it scores the board by counting every window of four cells that only one player has discs in, plus a bonus for the center column. Easy also adds some randomness to its choices.

## How online play works

It uses [LinkPlay](../linkplay/). The host's browser holds the game: the guest sends the column they picked, the host checks it's their turn and that the column has room, and sends the whole board back after every move.

## Tests

`tests/four-in-a-row.test.js` covers finding lines in all four directions, the bot taking wins and blocking losses, the bot beating a random player, and a full online game with a rematch.
