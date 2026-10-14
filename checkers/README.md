# Checkers

Checkers (American rules, also called English draughts) on an 8 by 8 board. Play a friend online, two players on one screen, or the bot.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`, not opened as a file.

Tap one of your pieces, then the square to move to. The pieces that can move are outlined, and dots show where the selected piece can go. For a multi-jump, tap each landing square in turn. Escape cancels a selection, and Enter starts a new game when one ends.

When playing online, the guest plays white and sees the board turned around, so your own pieces are always at the bottom.

## Rules

- Men move one square diagonally forward. Kings move one square diagonally in any direction.
- If you can capture, you must. When a piece can keep jumping, it has to continue, but you can choose which capture to make.
- A man that reaches the far row becomes a king, and that ends its move, even if it could jump again as a king.
- You lose when you have no pieces left or no legal move.
- The game is a draw after 40 moves each with no capture and no man moved.

## The bot

The bot uses alpha-beta search over whole moves: 2 moves ahead on easy, 4 on normal, 6 on hard. It values a king at 1.75 men and adds small bonuses for advancing men, keeping the back row, and holding the center.

## Tests

`tests/checkers.test.js` covers the opening position, forced captures and multi-jumps, crowning, winning by blocking, the tap-to-move flow, and an online game where an illegal move from the guest is refused.
