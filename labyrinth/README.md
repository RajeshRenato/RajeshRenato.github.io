# Labyrinth

A maze game with fog of war. You start in the top-left corner and need to reach the gold exit in the bottom-right, but you can only see about four cells around you, plus a faint trail of the cells you've already visited. Each exit takes you one level deeper into a bigger maze, starting at 11x11 and growing by 2 per level up to 29x29.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | move one cell |

On a phone, on-screen arrow buttons appear in the bottom-left corner. Holding one keeps moving.

## How it works

- Mazes are generated with a recursive backtracker (depth-first search with a stack), so every maze has exactly one path between any two cells.
- The timer starts on your first move. Your best depth is saved in `localStorage`.
