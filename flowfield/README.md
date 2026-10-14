# Flow Field

Generative art. About 2,200 particles follow a vector field made from noise and leave trails that slowly fade. You can roll a new field, switch color themes, pull particles toward the mouse, and save the canvas as a PNG.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Space | new field |
| 1 to 4 | color theme: synthwave, deep sea, ember, matrix |
| Hold the mouse button | pull nearby particles toward the pointer |
| C | clear the canvas |
| S | save as PNG |

## How it works

- The field angle at each point comes from two layers of value noise at different scales, mixed 3 to 1.
- Each frame, every particle moves a fixed step in the direction of the field. Its color depends on that angle.
- Particles that leave the screen respawn at a random spot, and a few respawn at random each frame so the picture keeps changing.
- Trails come from drawing a faint layer of background color over the canvas each frame instead of clearing it.
