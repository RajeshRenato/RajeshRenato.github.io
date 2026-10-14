# Coil

Snake on a 24 by 24 grid. Eat the pink diamonds to grow, and don't run into the walls or your own tail. Each one you eat is a point and makes the snake a little faster.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Arrow keys or W A S D | turn (the first press starts the game) |
| Swipe | turn, on a phone (a tap starts the game) |
| P | pause or resume |
| R or Enter | restart after a game over |

## How it works

- The snake moves one cell every 140 ms at the start. Each point takes 2.5 ms off that, down to a floor of 60 ms.
- Up to three turns are queued, so quick presses between steps aren't lost. A turn straight back into yourself is ignored.
- Your best score is saved in `localStorage`.
