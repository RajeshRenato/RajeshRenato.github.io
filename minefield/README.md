# Minefield

Minesweeper. Open every cell that isn't a mine. Numbers tell you how many of the eight neighbouring cells hold mines, and you can flag the ones you're sure about. There are three board sizes: 9x9 with 10 mines, 16x16 with 40, and 24x16 with 99.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Left click | reveal a cell |
| Right click | place or remove a flag |
| Flag button | switch taps to flagging instead of revealing (for touchscreens) |
| New button | start a new board at the current size |

## How it works

- Mines are placed after your first click, never on that cell or the eight around it, so the first click always opens an area.
- Clicking an empty cell opens all connected empty cells and their numbered edges.
- The timer starts on the first click. The best time for each board size is saved in `localStorage`.
