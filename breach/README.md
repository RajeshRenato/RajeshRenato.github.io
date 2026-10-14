# Breach

A first-person shooter in the style of Wolfenstein 3D, running on a raycasting engine written in plain JavaScript. Fight through three sectors of sentinel robots, find the red keycard to open locked doors, and reach the exit portal in each one. The wall textures, sprites, and sound effects are all generated in code when the page loads.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Click the game to start and to lock the mouse for looking around.

## Controls

| Input | Action |
| --- | --- |
| W A S D | move and strafe |
| Up / down arrows | move forward and back |
| Mouse, or left / right arrows | turn |
| Click, F, or Ctrl | fire |
| E or Space | open a door you're facing |
| Shift | run |
| M | show or hide the minimap |
| Enter | start, or go to the next sector |
| R | retry the sector after dying |

## How it works

- Walls are drawn with DDA raycasting: one ray per screen column steps through the tile grid and returns the perpendicular distance, which avoids fisheye distortion. Each column is a slice of a 64 by 64 texture, darkened by distance and on one side of each wall.
- A depth buffer of those wall distances clips the sprites (enemies, pickups, the exit portal), which are projected onto the camera plane and drawn back to front.
- Sentinels stay put until they can see you within 9 tiles, or within 11 when you fire. Then they chase you, slide along walls, keep a little space from each other, and hit you when they get close.
- Shots are hitscan: the nearest sentinel in a narrow cone in front of you, with no wall in the way, takes the hit. You start each sector with 100 health and 24 energy cells. Pickups give 12 more cells or 25 health.
- Levels are stored as rows of text in `js/maps.js`. Digits 1 to 4 are wall types, D is a locked door, P is the player start, E is an enemy, K, H, and A are keycard, medkit, and ammo, and X is the exit.
- Sounds are synthesized with the Web Audio API.
