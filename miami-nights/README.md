# Miami Nights

A GTA Vice City-style open world in plain HTML/CSS/JS. Drive a procedural 80s Miami from a street-level chase camera, steal cars, outrun the cops, and run deliveries for cash. Original code and art, not affiliated with Rockstar Games.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| W A S D / arrows | drive or walk (on foot in street view, A and D turn) |
| E | get in or out of a car (occupied ones too) |
| Space | handbrake, for drifting |
| Shift | run |
| V | switch between street view and top-down |
| M | mute |
| Enter or click | start from the title screen |

On a phone: a joystick on the left half of the screen, and buttons for the car, camera, and handbrake on the right.

## How it works

- The city is a pure function of tile coordinates (`tileType(tx, ty)`), so nothing is stored and it's the same every visit: road grid, sidewalks, buildings, parks, palms, a beach, and the ocean.
- Street view projects the same 2D world through a perspective camera at street height. Buildings are extruded with lit windows, and there are curbs, street lamps, and cars built from depth-sorted boxes. Top-down view draws the world directly.
- Driving splits velocity into forward and sideways parts. The handbrake cuts sideways grip so the car slides.
- Traffic follows lanes on right-hand roads and stops for cars or people in front of it.
- Crimes raise your wanted level, up to five stars. Carjacking or ramming a police car adds one star, running someone over adds one, and stealing a police car adds two. One police car chases you per star. Stay slow near them for too long and you're busted and fined $150. Lie low and you lose a star every 16 seconds.
- Deliveries are endless: pick up, beat the timer, get paid. Cash is saved in `localStorage`.
- Sound (engine hum and crashes) is synthesized with Web Audio.

## Files

```
index.html
css/style.css
js/
  utils.js      math and seeded random helpers
  input.js      keyboard and touch input
  audio.js      Web Audio engine hum and thuds
  city.js       procedural map, top-down rendering, collision
  render3d.js   street-level camera
  particles.js  sparks and stains
  entities.js   cars (physics and AI) and pedestrians
  player.js     walking, getting in and out of cars
  missions.js   deliveries
  hud.js        HUD, menu, busted screen, minimap
  main.js       game state, spawning, update and render loop
```

## Tests

`tests/miami-nights.test.js` walks, turns, drives, triggers a police chase, switches cameras, and checks the touch joystick.
