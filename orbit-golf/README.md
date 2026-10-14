# Orbit Golf

Golf in space. You fling the ball toward a hole, and gravity wells along the way bend its path. Gold wells pull the ball in, red wells push it away. There are 9 fixed holes, each with a par, and the course par is 24.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Drag back from the ball, release | shoot (longer drag, harder shot) |
| R | give up on a shot in flight and go back to the tee, with a one-stroke penalty |
| Click after the last hole | play the course again |

## Rules

- Each shot is a stroke. Hitting a gold well, leaving the screen, or drifting for more than 11 seconds puts the ball back on the tee and adds a penalty stroke.
- After each hole you get a callout against par (eagle, birdie, par, or strokes over), and the total is shown at the end.

## How it works

- Gravity follows an inverse-square pull from each well, softened near the center so the ball doesn't get flung at infinite speed. The physics runs four substeps per frame.
