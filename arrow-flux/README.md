# Arrow Flux

A packed board of bent arrows. Tap one and it slides out head-first, its body
following its own path like a snake, as long as nothing sits in the straight
line ahead of its head. Clear every arrow to finish the board.

A blocked tap bumps into whatever is in the way and costs a heart (3 on small
boards, 5 from 16 columns up).

## Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8899
# then visit http://localhost:8899
```

## Features

- Board sizes from 6×8 up to 26×37, either growing with each level or fixed
- A daily board at `#daily`, the same for everyone that day, timed and listed on the [daily puzzles](../daily/) page
- Hint (always points at a legal move), undo, and new puzzle
- The seed, level, and size live in the URL, so a shared link opens the same board
- Light and dark color schemes follow your system setting

## How the boards are generated

Every cell is covered, and every board is solvable.

The generator builds the board in the order you could solve it. At each step
it picks a cell and a direction whose straight line to the edge crosses only
cells that are already taken by earlier arrows, then grows the arrow's body
backwards from there through unassigned cells. So the arrows, removed in the
order they were made, always have a clear way out.

Removing an arrow can only ever open space, never block anything, so no tap
order can reach a dead end: if you could tap it before, you still can.
