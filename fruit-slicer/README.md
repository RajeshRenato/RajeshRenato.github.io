# Fruit Slicer

A Fruit Ninja-style game you play with your webcam. Fruit is thrown up from the bottom of the screen, and you slice it by moving your hands in front of the camera. You can also play with a mouse or a finger by swiping. Don't slice the bombs.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. The camera needs the page served over `http://` or `https://` (or opened from localhost), not as a file.

Pick a mode, then "Play with the camera" or "Play with mouse or touch". With the camera, hold still for a moment at the start while the game measures how noisy the picture is. Stand back far enough that your hands fit in the frame.

| Input | Action |
| --- | --- |
| Move your hands in front of the camera | slice |
| Drag with the mouse, or swipe with a finger | slice |
| Sensitivity slider | how much movement counts as a slice |
| Enter | play again after a game |

## Rules

- Classic: you have 3 lives. Each fruit that falls without being sliced costs one, and so does slicing a bomb.
- Zen: 90 seconds, no bombs, and missed fruit costs nothing.
- Every fruit is 1 point. Slicing 3 or more in one quick stroke is a combo, worth that many extra points.
- Waves get bigger and come faster as the game goes on.
- Your best score for each mode is saved in `localStorage`.

## How the camera works

There's no AI model. Each frame is drawn mirrored into a small canvas about 160 pixels wide and turned to grayscale. Comparing it with the previous frame gives a map of the pixels that changed. A fruit is sliced when enough of the area under it moved. The slice direction comes from how the centre of the movement shifted over the last few frames, and the blade trail follows that centre.

The hold-still step at the start measures how much the picture changes on its own (camera noise, flicker, a fan in the background) and raises the bar by that much. The sensitivity slider moves both the per-pixel threshold and the share of a fruit that has to move.

The camera picture never leaves the device. Nothing is recorded or sent.

Limits: any movement counts, not just hands, so a busy background or someone walking past can slice fruit. A plain background and good light work best. If the camera isn't available or permission is refused, the game switches to swipes.

## Tests

`tests/fruit-slicer.test.js` covers the motion map from synthetic frames, slicing when movement covers a fruit and not on still frames, swipes and combos, lives lost to bombs and missed fruit, the Zen timer and saved best, and the calibration step.
