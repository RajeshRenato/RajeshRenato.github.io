# Brickfall

A Breakout-style brick breaker. Bounce the ball off your paddle to clear every brick across 8 levels. You have 3 lives for the whole run, and each brick is worth 10 points.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Mouse, or left / right arrows, or A / D | move the paddle |
| Click or Space | launch the ball |
| R | play again after a game over or a win |

## How it works

- Where the ball hits the paddle sets the angle it leaves at, up to about 60 degrees from straight up at the edges.
- Each level adds a row of bricks, up to 8 rows, with a few gaps that depend on the level number. The ball gets a little faster every level.
- Your best score is saved in `localStorage`.
