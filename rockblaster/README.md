# Rock Blaster

An Asteroids-style shooter with vector-line graphics. You fly a ship that turns, thrusts, and drifts, wrapping around the edges of the screen, and shoot rocks before they hit you. Large rocks split into two medium ones, medium into two small, and small ones break apart. Clear the screen and the next level starts with one more large rock. You have 3 lives.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Left / right or A / D | rotate |
| Up or W | thrust |
| Space | fire (up to 5 shots on screen at once) |
| R | after losing your last ship: start over |
| Any key | on the title screen: start |

On a phone, on-screen buttons for rotate, thrust, and fire appear along the bottom.

## How it works

- Large rocks are worth 20 points, medium 50, and small 100. Smaller rocks move faster.
- After losing a life the ship respawns in the center and blinks for a couple of seconds, during which rocks can't hit it.
- Each rock is drawn as a jagged outline with 9 to 12 points at random distances from its center.
- Your best score is saved in `localStorage` when the game ends.
