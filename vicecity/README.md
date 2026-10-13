# VICE CITY — an open-world microgame

An 80s-neon-Miami open-world driving game in pure HTML/CSS/JS —
no frameworks, no build step, no assets to download. Plays in a street-level
pseudo-3D chase camera (extruded buildings, perspective ground, synthwave sky)
with a classic top-down mode one key away. Inspired by the vibe of
classic GTA, but entirely original code, map, and art (not affiliated
with Rockstar Games).

## Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8899
# then visit http://localhost:8899
```

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | walk / drive |
| E | enter / exit car (yes, including occupied ones) |
| SPACE | handbrake — drift! |
| SHIFT | sprint on foot |
| V | camera: street view / top-down |
| M | mute |

## What's in the box

- **Procedural city** — the whole map is a pure function of coordinates
  (`tileType(tx, ty)`), so it costs zero memory and is identical every visit.
  Road grid, sidewalks, neon-trimmed buildings, parks, palm trees, a beach,
  and the ocean.
- **Arcade car physics** — velocity split into forward/lateral components,
  with the handbrake cutting lateral grip for drifts.
- **Traffic** — lane-following AI cars obeying right-hand traffic, with
  obstacle braking. Carjack them (E) for a wanted star.
- **Pedestrians** — they stroll, they flee, they... don't always make it.
- **Wanted system** — 5 stars, police pursuit, arrest meter, BUSTED screen
  with a fine. Lay low and the heat dies down.
- **Endless delivery missions** — pick up, race the timer, get paid. Money
  persists in `localStorage`.
- **Synth audio** — engine hum and collision thuds generated with WebAudio,
  no audio files.

## Project layout

```
index.html
css/style.css
js/
  utils.js      math + seeded random helpers
  input.js      keyboard/mouse state
  audio.js      WebAudio engine hum + thuds
  city.js       procedural map, rendering, world collision
  particles.js  sparks + stains
  entities.js   Car (player physics + AI), Ped
  player.js     on-foot movement, enter/exit cars
  missions.js   delivery gig state machine
  hud.js        HUD, menu, busted overlay, minimap
  main.js       game state, spawning, update/render loop
```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repo (e.g. `vicecity`).
2. Repo → Settings → Pages → Source: `main` branch, `/ (root)`.
3. Play at `https://<username>.github.io/vicecity/`.

## Roadmap ideas

- Mobile touch controls
- More mission types (chases, timed checkpoints, taxi fares)
- Radio stations (WebAudio synthwave loops)
- Shared leaderboard (needs a free Supabase/Firebase backend)
- Sprites/decals to replace the vector-drawn cars and peds
