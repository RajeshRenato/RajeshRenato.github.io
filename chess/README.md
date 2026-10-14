# Chess

Chess with the full rules. Play a friend online with a link, two players on one screen, or a bot with three levels.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`, not opened as a file.

To play online: click "Play a friend online" and send the invite. Your friend sends back a reply link; open it in your browser or paste it in. The game starts as soon as they're in. The host plays white first, and colors swap on every rematch. Each player sees their own pieces at the bottom.

## Controls

| Input | Action |
| --- | --- |
| Tap a piece, then a square | move. Dots show where it can go, rings show captures. |
| Drag a piece (mouse) | move |
| Escape | cancel a selection |
| Enter | pick a queen when promoting |

The moves are listed in standard notation under the board, with the pieces each side has captured and who is ahead in material. The last move and a king in check are highlighted.

## Rules

- Castling is allowed only if the king and that rook haven't moved, the squares between them are empty, and the king isn't in check, doesn't pass through an attacked square, and doesn't land on one.
- En passant is allowed on the move right after a pawn's two-square advance.
- A pawn that reaches the last rank promotes to a queen, rook, bishop, or knight. You choose.
- The game is drawn by stalemate, the fifty-move rule (50 moves each with no capture or pawn move), the same position appearing three times with the same player to move, or when neither side has enough material to mate (king against king, or king and one bishop or knight, or kings and bishops all on one color of square).
- Against the bot or online you can resign. Scores are kept until you leave.

## The bot

The bot searches with negamax and alpha-beta pruning, deepening one move at a time until its time runs out: about 0.1 seconds on easy (2 moves deep, with some randomness), 0.5 seconds on normal, and 1.5 seconds on hard. It looks at captures to the end so it doesn't stop counting in the middle of a trade, tries captures of valuable pieces with cheap ones first, and judges positions by material plus tables of good squares for each piece. It avoids repeating positions when it is ahead.

## How it works

The board is a 0x88 array: 128 squares where a square is off the board when its index ANDed with 0x88 is not zero, which makes edge checks one operation. Move generation is checked against the standard perft counts (the number of positions after every possible sequence of moves) for the starting position and several tricky test positions.

Online play uses [LinkPlay](../linkplay/). The guest sends each move in coordinate form, the host checks it against the legal moves, and sends back the whole move list. Both sides replay it from the start, so they always agree on the position.

## Tests

`tests/chess.test.js` covers perft counts, FEN round trips, castling rules, notation, en passant, every kind of draw, the bot's tactics and time limit, a game against the bot, and an online game with a rematch.
