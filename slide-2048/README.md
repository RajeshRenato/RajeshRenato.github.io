# Slide 2048

A version of 2048. Slide all the tiles on a 4x4 board in one direction, and two tiles with the same number merge into one with their sum. A new 2 (or sometimes a 4) appears after every move. Reach a 2048 tile to win, then keep playing if you want. The game ends when no move is possible.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Arrow keys or WASD | slide the tiles |
| Swipe on the board | slide the tiles (touchscreens) |
| New game button | start over |

## How it works

- Each merge adds the new tile's value to your score. Your best score is saved in `localStorage`.
- A tile can only merge once per move, so sliding 2, 2, 4 left gives 4, 4 rather than 8.
- Tile colors shift with the tile's value, and tiles of 128 and up get a glow.
