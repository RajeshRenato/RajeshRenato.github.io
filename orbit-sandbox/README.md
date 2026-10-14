# Orbit Sandbox

An n-body gravity sandbox. Drag and release to launch planets around a star. Every body pulls on every other one, they leave fading trails, and when two collide they merge into one. It starts with a star and two planets already in orbit.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Drag and release | launch a planet. Pull back like a slingshot: longer drags launch faster |
| 1 / 2 / 3 | planet size: small, medium, large |
| G | remove or bring back the star |
| P | pause |
| C | clear all planets |
| S | save the canvas as a PNG |

## How it works

- Gravity is computed for every pair of bodies, with a softening term added to the squared distance so close passes don't blow up.
- Each frame runs three substeps of 1/180 of a second, updating velocity first and then position.
- When two bodies overlap, the smaller one is absorbed. The merged body keeps the combined mass and momentum, and its radius grows with the cube root of its mass. The star stays fixed in the center.
- Planets that drift more than 2000 pixels off screen are removed.
- Trails come from painting a faint layer of background over each frame instead of clearing it.
