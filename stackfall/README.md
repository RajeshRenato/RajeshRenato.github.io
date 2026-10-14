# Stackfall

A Tetris-style falling block game. Pieces made of four squares drop into a 10x20 well. Move and rotate them so they fill complete rows, which then clear. The game ends when a new piece has no room to appear. It has a ghost piece that shows where the current piece will land, a next-piece preview, and a hold slot.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Left / right | move |
| Up or X | rotate clockwise |
| Z | rotate counter-clockwise |
| Down | soft drop |
| Space | hard drop |
| C | hold the current piece (once per piece) |
| P | pause or resume |
| R or Enter | after game over: restart |
| Any key | on the title screen: start |

On a phone, on-screen buttons for move, rotate, soft drop, hold, and drop appear at the bottom.

## How it works

- Pieces come from a shuffled bag of all seven shapes, so you see each one once before any repeats.
- If a rotation would hit a wall or another block, the game tries shifting the piece 1 or 2 cells sideways before giving up.
- Clearing 1, 2, 3, or 4 lines at once scores 100, 300, 500, or 800, multiplied by the level plus one. Soft drop adds 1 point per row and hard drop adds 2.
- The level goes up every 10 lines, and pieces fall faster with each level.
- Your best score is saved in `localStorage`.
