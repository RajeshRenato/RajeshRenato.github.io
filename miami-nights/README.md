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

## Online: cops and robbers

Two friends in the same city. On the title screen, press O or click "Play a friend online", send your friend the invite, and open the reply they send back. The game starts as soon as they're in. Online play needs the page served over `http://` or `https://`.

- One of you drives a getaway car, the other a police car. The guest is the robber in round 1, then the roles swap every round. The first to win 3 rounds wins the match.
- The robber has to pick up a package and deliver it across town before the clock runs out. The time limit depends on the distance.
- The cop wins by staying right on the robber: a bust meter fills while the cop is within a few car lengths and the robber is nearly stopped, and empties again when the robber gets away. If it fills, or time runs out, the cop wins the round.
- The robber always sees the cop on the minimap. The cop sees the robber when they're close, and otherwise only gets a brief ping on the minimap every 8 seconds. Once the robber has the package, the cop also sees where it's going.
- Traffic, pedestrians, and AI police are separate on each screen, so they won't match between the two of you. There are no wanted stars online, and you can't leave your car.

Each browser drives its own car and sends its position 15 times a second. The other car is drawn a tenth of a second behind, sliding between updates, so it moves smoothly. The host's browser runs the rounds: it checks the pickup, the delivery, and the bust meter, and keeps the score. It uses [LinkPlay](../linkplay/) for the connection, with no game server.

## How it works

- The city is a pure function of tile coordinates (`tileType(tx, ty)`), so nothing is stored and it's the same every visit: road grid, sidewalks, buildings, parks, palms, a beach, and the ocean.
- Street view projects the same 2D world through a perspective camera at street height. Each block is one raised sidewalk slab with rounded corners and a curb, and the roads have double yellow lines, zebra crossings, and stop lines. Buildings stand on rounded art deco, cut-corner, or square footprints, with lit windows, pale ledges on the deco ones, neon signs, and lit shopfronts under awnings at street level. Top-down view draws the same shapes from above.
- Traffic is a mix of sports coupes, sedans, hatchbacks, SUVs, and pickups, plus police cars, in modern paint. Each model is a body and a cabin described by cross-sections along its length (`models.js`): sloped ends of the cabin become the windshield and rear window. Faces facing away from the camera are skipped, the rest are lit by their angle to the sun, and the cars get round wheels, headlights, a full-width tail light bar, and model details like a rear wing and stripes, roof rails, a load bed, or a light bar and livery.
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
  models.js     car models: the shapes of each body style
  entities.js   cars (physics and AI) and pedestrians
  player.js     walking, getting in and out of cars
  missions.js   deliveries
  hud.js        HUD, menu, busted screen, minimap
  main.js       game state, spawning, update and render loop
  online.js     cops and robbers: lobby, rounds, the other car, online HUD
```

## Tests

`tests/miami-nights.test.js` walks, turns, drives, triggers a police chase, switches cameras, and checks the touch joystick. It also plays cops and robbers between two copies of the game over an in-memory channel: roles and car positions, the bust meter, a delivery, the role swap, a match to 3 with a rematch, and leaving.
