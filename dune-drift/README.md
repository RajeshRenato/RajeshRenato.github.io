# Dune Drift

A one-button endless rider. You slide over rolling sand dunes, jump off the crests, hold the button to flip in the air, and land at the angle of the slope to keep going. Land badly and the run ends. The sky moves through day, dusk, night, and dawn as you ride.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Click, tap, or Space (on the ground) | jump |
| Hold click, tap, or Space (in the air) | backflip |
| Left arrow, up arrow, A, or W | same as Space |
| Right arrow or D | jump, and frontflip while held |
| G | copy a ghost link after a run |
| M | mute |

## How it works

- The ground is four sine waves added together. Their height grows slowly with distance, so later dunes throw you higher. Slope comes from sampling the same function.
- On the ground, gravity along the slope speeds you up or slows you down. If you're going fast enough over a crest, the ground drops away and you launch on your own.
- Landing compares the board's angle with the slope. Within about 60 degrees you keep riding. Each flip landed scores 100 times your combo, raises the combo (up to 8), and gives a 10% speed boost. A very flat landing with no flips scores 25. A rough landing with no flips resets the combo.
- The sky blends between four color palettes over a 110 second day.
- The scarf is a 14-point chain that trails behind the rider.
- Wind is a looped noise buffer through a low-pass filter that opens up with speed. Flips and landings play short chimes.
- Your best score and distance are saved in `localStorage`.
- Ghosts: after a run, press G or tap "Share your ghost" to copy a link. The run is packed into the URL as position, height, and spin five times a second, 3 bytes each. Whoever opens it rides alongside your ghost and sees a flag where it wiped out.

## Tests

`tests/dune-drift.test.js` covers starting a run, jumping and flipping, clean and bad landings, the forward flip, and making and replaying ghost links.
