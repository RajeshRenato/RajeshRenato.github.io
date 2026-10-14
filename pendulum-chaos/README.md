# Pendulum Chaos

A row of identical double pendulums that start almost in the same position. The upper arm of each one is 0.0005 radians further out than the one before. They swing together at first and then drift apart. You can run 1 to 12 of them, change gravity, and turn trails on or off.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| pendulums slider | how many pendulums, 1 to 12 (restarts the run) |
| gravity slider | strength of gravity, 200 to 1600 |
| trails | turn fading trails on or off |
| new random start | pick new starting angles and restart |

## How it works

- Each pendulum has two arms of equal length and two equal masses. Its state is the two angles and their angular velocities, stepped with the standard double pendulum equations of motion.
- Integration uses fourth-order Runge-Kutta (RK4), six steps per frame.
- A new start picks both angles at random within about 45 degrees of horizontal, then offsets only the first angle of each pendulum by 0.0005 radians times its index.
