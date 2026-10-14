# Glow Out

A Lights Out puzzle. Pressing a tile flips it and the tiles directly above, below, left, and right of it. Turn every tile off to clear the level.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

Click a tile to press it. The buttons above the board show a hint, reset the board to its starting state, give you a new puzzle, or copy a link to the current one.

## How it works

- Each board starts dark, and the game presses some random tiles to light it up. Those presses are a known solution, so every board can be solved.
- Pressing a tile twice cancels out, and the order of presses doesn't matter. So the game keeps the solution up to date as you play: each press adds that tile to the set or removes it. The hint button highlights a tile from that set.
- Par is the number of presses used to build the board. Clearing it in exactly par presses counts as perfect.
- The grid starts at 3 by 3 and grows by one every three levels, up to 7 by 7. Each level uses one more scrambling press than the last.
- Boards come from a seeded random generator. The seed and level are kept in the URL as `#seed.level`, so a friend who opens your link gets the same board.
- The number of boards you've cleared is saved in `localStorage`.
