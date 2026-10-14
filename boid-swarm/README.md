# Boid Swarm

A flocking simulation in the style of Craig Reynolds' boids. Each boid steers by separation, alignment, and cohesion, and you can change the weight of each one with a slider while it runs. The mouse cursor acts as a hawk that the flock flies away from.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Move the mouse | the boids flee the cursor |
| separation, alignment, cohesion | weight of each rule, 0 to 3 |
| boids | number of boids, 40 to 400 |
| trails | turn motion trails on or off |

## How it works

- Each boid looks at every other boid within 62 pixels. Cohesion pulls it toward their average position, alignment toward their average velocity, and separation pushes it away from any that are very close.
- Boids within 150 pixels of the cursor get pushed directly away from it.
- Speed is kept between 60 and 175 pixels per second. Boids that leave one edge come back on the opposite side.
- Each boid's color comes from its heading. Trails come from painting a mostly transparent background over the last frame instead of clearing it.
