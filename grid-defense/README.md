# Grid Defense

A small tower defense game. Creeps walk a fixed zigzag path across a 15 by 10 grid, and you build towers on the empty cells to stop them before they reach the end. You start with $60 and 12 lives, and each creep that gets through costs a life.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Blaster or sniper button | choose which tower to build |
| Click an empty cell | build the chosen tower there |
| Send wave | start the next wave (only when the field is clear) |
| Click after a game over | start again |

## How it works

- The blaster costs $20 and fires fast at short range. The sniper costs $45, fires slowly, has long range, and does five times the damage per shot.
- Towers always shoot the creep in range that is furthest along the path.
- Wave n has 6 + 2n creeps. Creep health goes up 22% each wave, and they get a little faster too.
- A kill pays about a sixth of the creep's starting health, with a minimum of $2.
- Your best wave is saved in `localStorage`.
