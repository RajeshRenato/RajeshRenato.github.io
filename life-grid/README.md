# Life Grid

Conway's Game of Life on a 96 by 60 grid whose edges wrap around. Draw cells with the mouse or load a preset, then run it, step through it one generation at a time, or change the speed. Cells that just died leave a blue glow that fades out.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Click or drag on the grid | draw cells (starting on a live cell erases instead) |
| Space or play | run or pause |
| step | advance one generation |
| random | fill about 22% of cells at random |
| clear | stop and empty the grid |
| Presets menu | glider, pulsar, or Gosper glider gun |
| speed slider | 2 to 40 generations per second |

## How it works

- Each generation counts the eight neighbors of every cell, wrapping across the edges. A live cell with 2 or 3 neighbors survives, and a dead cell with exactly 3 comes alive.
- A cell that dies gets a glow value that shrinks a little every frame until it's gone.
- The bar shows the generation number and the current population. The page opens with a random grid.
