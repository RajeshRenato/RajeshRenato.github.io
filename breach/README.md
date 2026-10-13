# BREACH

A first-person raycast shooter built **completely from scratch** — no engine, no libraries, no asset files. Every wall texture, enemy sprite, and sound effect is generated in code at boot.

## Play

Open `index.html` (or serve the folder). Click the canvas for mouse-look (pointer lock).

| Input | Action |
| --- | --- |
| WASD | move / strafe |
| mouse or ← → | look |
| click / F | fire |
| E / SPACE | open doors |
| M | minimap |
| SHIFT | run |

Clear three sectors: fight sentinels, find the red keycards, reach the green exit portals.

## How it works

- **Rendering** — classic DDA raycasting: one ray per screen column walks the tile grid, returning perpendicular distance (fisheye-free) and wall-hit coordinates. Columns are drawn as 1px-wide slices from procedurally generated 64×64 texture canvases, with side shading and distance fog. A z-buffer per column clips billboard sprites (enemies, pickups, portals) rendered via the camera-plane transform.
- **AI** — sentinels idle until they gain line of sight (a raycast) or hear gunfire, then chase with wall-sliding collision, flock separation, and melee attacks on cooldown.
- **Combat** — cone hitscan checked against the wall ray and enemy LOS; ammo economy, medkits, keycard-locked doors.
- **Audio** — WebAudio-synthesized blaster, hits, hurt, pickups, door, and victory stingers.
- **Art** — wall textures (neon brick, tech panel, stone, hazard, door) and all sprites drawn onto canvases at boot.

~1,300 lines across 10 modules. Headless smoke-tested (raycast math, LOS, collision, AI, doors, pickups, level flow).
