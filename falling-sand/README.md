# Falling Sand

A cellular sandbox. Pick a material, draw on the canvas, and watch it react. It opens with a small scene: a cup of water, a wooden ledge with sand on it, and a stone floor.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Drag on the canvas | pour the selected material |
| 1 to 9, 0 | pick a material |
| [ and ] | brush size |
| Space | pause |
| C | clear |

The toolbar has the same options as buttons, plus Save PNG.

## Materials

- Sand piles up and sinks through liquids.
- Water spreads flat. Oil floats on it and burns.
- Fire spreads through wood, plants, and oil, and gives off smoke. Water puts it out as steam.
- Lava flows slowly, sets things alight, and turns to stone when it touches water.
- Acid eats through sand, wood, plants, and stone.
- Plants grow into water.
- Wall and wood stay put. The eraser clears cells.

## How it works

The world is a grid with one material per cell, stored in typed arrays. Each frame the grid is updated bottom-up, alternating left-to-right and right-to-left so nothing drifts to one side. Powders and liquids move into cells holding something lighter, liquids also spread sideways, and gases rise. Fire, lava, acid, steam, smoke, and plants run their reactions before moving. A frame stamp keeps a particle from being moved twice in one step. The grid is drawn by writing straight into an `ImageData` buffer.

## Tests

`tests/falling-sand.test.js` covers sand piling up, water leveling out, sand sinking and oil floating, fire burning wood into smoke, water turning fire to steam, lava making stone, acid eating sand, plants growing, and painting and erasing with the brush.
