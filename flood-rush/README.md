# Flood Rush

A Flood-It puzzle. You start owning the top-left cell. Each move, pick a color from the palette: your region changes to that color and takes in every neighboring cell that already matches. Fill the whole grid before you run out of moves.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

Click a color in the palette below the board to make a move, or press 1 to 6 for the colors from left to right (Tab to a color and press Enter works too). "New puzzle" gives you a different board, and "share seed" copies a link to the current one.

## How it works

- When a board is generated, a greedy bot solves it by always picking the color that grows the region the most. Its move count is the par, and your budget is par plus 2, so every board can be beaten. Finishing in fewer moves than par means you beat the bot.
- The grid starts at 7 by 7 and grows by one every two levels, up to 14 by 14. Boards start with 4 colors and gain one every five levels, up to 6.
- Boards come from a seeded random generator. The seed and level are kept in the URL as `#seed.level`, so a friend who opens your link gets the same board.
- The number of boards you've cleared is saved in `localStorage`.
