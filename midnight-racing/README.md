# Midnight Racing

A Road Rash-style bike combat racer in plain HTML/CSS/JS. Race a pseudo-3D highway under the moon, punch and kick seven rivals off their bikes (they hit back), dodge traffic in both directions, and spend your winnings on faster bikes. Original code and art; not affiliated with Electronic Arts.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| W / up | throttle |
| S / down | brake |
| A / D | steer |
| Space or F | punch the nearest rival |
| E or K | kick, a hard shove that can put a rider off the road |
| 1 / 2 / 3 | on the menu: Easy, Medium, Hard |
| B | on the menu: buy the next bike |
| G | after a race: copy a ghost link |
| R | restart the race |
| M | mute |

On a phone: arrow buttons on the left steer, throttle is automatic, and the buttons on the right punch, kick, and brake.

## How it works

- The road is an array of 200-unit segments, each with a curve and a hill value. Rendering walks about 300 segments ahead, adds up the curves into a screen-space bend, and clips anything behind a hill crest.
- Each level seeds a random generator that strings together straights, bends, S-curves, and hills. Later levels are longer and the rivals are faster.
- Punches do damage. Kicks shove sideways, and leaving the road counts as a knockdown. Some rivals carry clubs that hit harder; knock one down and the club is yours for six swings.
- Difficulty changes rival pace and aggression, traffic density, how many cars come at you, and the payout. Hard adds a police rider who fines you for crashing near him.
- Winnings buy bikes with better top speed, acceleration, and grip. A top-3 finish moves you up a level. Cash, level, bike, and difficulty are saved in `localStorage`.
- Engine and crash sounds are synthesized with Web Audio.
- Ghost links pack your run into the URL: track position and lane five times a second, 2 bytes each. Whoever opens it races your ghost on the same level and difficulty without touching their own saved progress.

## Tests

`tests/midnight-racing.test.js` covers the menu and garage, Hard mode spawns, riding and crashing, clubs and kicks, finishing a race, touch controls, and ghost links.
