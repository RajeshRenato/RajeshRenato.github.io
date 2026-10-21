# Air Drums

Play a drum kit in the air. Wave your hands over the pads around the edge of the webcam picture to hit them: crash, hi-hat, two toms, ride, snare, and kick. Faster moves hit harder. The camera picture stays on your device.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. The camera needs the page served over `http://localhost` or `https://`.

Press "Start the camera" and allow camera access. Sit with your face in the middle, so it's between the pads, and wave a hand over a pad. If the camera is blocked or missing, the page switches to keyboard mode.

| Input | Action |
| --- | --- |
| Wave over a pad | hit it |
| C, H, T, R, S, F, K | crash, hi-hat, tom 1, ride, snare, floor tom, kick |
| Space | kick |
| Tap or click a pad | hit it |

## Controls

- Sensitivity: how much movement it takes to hit a pad.
- Calibrate: hold still for 2 seconds. The page measures how much each pad moves on its own (a flickering light, a fan, a TV behind you) and ignores that much from then on.
- Record loop: play a pattern, press again to stop, and it repeats while you play over it.
- Metronome: a click at 100 beats per minute.
- Show motion: paints the pixels that changed, so you can see what the camera is reacting to.

## How it works

- Every video frame is drawn, mirrored, onto a 160 by 120 canvas and turned to grayscale. The page compares it with the previous frame and counts, for each pad, the share of pixels that changed by more than a small amount.
- A pad is hit when that share jumps above a threshold, and it can't be hit again until the motion settles and 140 ms have passed. That way one wave is one hit, not a burst.
- Each pad keeps a slowly moving noise floor, learned while nothing is happening, and the threshold sits above it. Calibrating sets the floor from a few seconds of stillness.
- Frames are processed as they arrive from the camera (`requestVideoFrameCallback`) to keep the delay short.
- Every drum is synthesized with Web Audio: pitched sine sweeps for the kick and toms, filtered noise for the snare, hats, crash, and ride, and a compressor on the output.

There's no hand tracking. It only sees change, so it reacts to anything that moves over a pad: a hand, a sleeve, or a shadow. It works best with light in front of you, a still background, and your head between the pads. Low light makes the camera noisier, which raises the floor and makes hits harder.

## Tests

`tests/air-drums.test.js` feeds made-up frames to the detector: still frames hit nothing, motion in a pad hits that drum once, the refractory period spaces hits out, calibration stops steady background motion from triggering, a recorded loop replays on time, and the keyboard plays without a camera.
