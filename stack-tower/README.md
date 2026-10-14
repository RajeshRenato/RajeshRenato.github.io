# Stack Tower

A one-button stacking game. A block slides back and forth above the tower, and you drop it onto the stack. Whatever hangs over the edge of the block below is cut off and falls away, so the next block is narrower. Miss the stack completely and the game is over. Your score is the tower's height.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Click, tap, or Space | drop the block |
| Click, tap, or Space after a miss | start a new tower |

## How it works

- If a block lands within 5 pixels of the one below, it counts as a perfect drop. It snaps into line, keeps its full width, and the screen flashes.
- The sliding block gets a little faster with each level of the tower, and the view scrolls up as it grows.
- Your best height is saved in `localStorage`.
