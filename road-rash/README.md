# ROAD RASH — neon bike combat racing

A pseudo-3D motorcycle combat racer in pure HTML/CSS/JS — no frameworks, no
build step, no assets. OutRun-style projected road with curves and hills,
seven rival riders you can punch off their bikes (they punch back), highway
traffic to dodge, cash, and levels that get longer and meaner. Inspired by
the 16-bit classic; entirely original code and art (not affiliated with
Electronic Arts).

## Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8899
# then visit http://localhost:8899
```

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | throttle |
| S / ↓ | brake |
| A / D | steer |
| SPACE or F | punch the nearest rival |
| E or K | kick — a hard shove, boot them off the road |
| 1 / 2 / 3 | (menu) Easy / Medium / Hard |
| B | (menu) buy the next bike with your winnings |
| R | restart race |
| M | mute |

## How it works

- **Classic segment road** — the track is an array of 200-unit segments with
  per-segment curve and hill values; rendering walks ~300 segments out,
  accumulating curve into a screen-space bend and clipping behind hill crests.
- **Procedural tracks** — each level seeds an RNG that strings together
  straights, bends, S-curves, and hills; higher levels are longer with faster
  rivals.
- **Combat** — punch (damage) or kick (a hard sideways shove — off the road
  counts as a knockdown). Some rivals carry clubs that hit harder; put one
  down and the club is yours for six heavy swings.
- **Difficulties** — Easy / Medium / Hard scale rival pace and aggression,
  traffic density, the share of oncoming cars, and payouts. Hard adds a
  police rider who fines you for crashing near him.
- **Garage** — race winnings buy faster bikes (Rat Bike → Street Hawk →
  Neon GP: top speed, acceleration, grip).
- **Race economy** — top-3 finishes advance a level; cash, level, bike and
  difficulty persist in `localStorage`.
- **WebAudio** — engine hum pitched by speed plus noise-burst thuds, all
  synthesized live.
