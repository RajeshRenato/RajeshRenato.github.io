# DUNE DRIFT — endless sunset ride

A one-button endless rider in pure HTML/CSS/JS. Roll over procedural dunes,
jump off crests, hold to backflip, and land with the slope to keep your speed
and combo alive. The sky moves through a full day cycle while you ride.
No frameworks, no build step, no assets.

## Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8899
# then visit http://localhost:8899
```

## Controls

One button: tap, click, or hold space.

| Input | Action |
| --- | --- |
| press (on the ground) | jump |
| hold (in the air) | backflip |
| ← or A (keyboard) | jump / backflip |
| → or D (keyboard) | jump / frontflip |
| release and level out | land clean |
| M | mute |

Landing within the slope angle keeps the run going; flips multiply your
combo and boost speed. Land badly and the run ends.

## How it works

- **Terrain** is a sum of four sine waves whose amplitude grows slowly with
  distance, so late-run dunes throw bigger air. Slope and curvature come from
  sampling the same function.
- **Physics**: grounded motion is a scalar speed along the slope with gravity
  projected onto it; crest launches happen when the ground falls away faster
  than the board can follow. Landing compares board angle to slope angle.
- **Day cycle**: four palettes (day, dusk, night, dawn) smoothly interpolated
  over 110 seconds, driving sky, dune, rim-light, and star colors.
- **The scarf** is a 14-point verlet-style chain that trails the rider.
- **Audio** is a looped noise buffer low-pass filtered by speed for wind,
  plus sine chimes on flips and clean landings.
- Best score and distance persist in `localStorage`.
