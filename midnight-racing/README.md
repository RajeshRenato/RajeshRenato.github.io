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
| O | on the menu: race friends online |
| G | after a race: copy a ghost link |
| R | restart the race |
| M | mute |
| Esc | online: leave the race |

On a phone: arrow buttons on the left steer, throttle is automatic, and the buttons on the right punch, kick, and brake.

## Online

Two to four friends can race the same track. Press O on the menu (or tap the line under "tap here to race"), click "Play with friends", and send each friend their own invite. Each of them sends back a reply link. Open it in your browser or paste it in, then press Start.

- The host's difficulty and level are used for everyone, so the track, the AI riders, and the traffic start out the same for all.
- Each browser runs its own bike and sends where it is about 13 times a second. Other players appear as riders with their name over them.
- Punches and kicks work on other players too. The rider who gets hit takes the damage on their own screen, so a hit counts when it looks like it landed for them.
- Places go by each rider's own race time, collected by the host. The host starts the next race from the results screen.
- Online races don't change your saved level, cash, or bike. Everyone rides the bike from their own garage.
- AI riders and traffic are worked out on each screen separately, so they drift apart a little during a race. Only the players are shared.

## How it works

- The road is an array of 200-unit segments, each with a curve and a hill value. Rendering walks about 300 segments ahead, adds up the curves into a screen-space bend, and clips anything behind a hill crest.
- Each level seeds a random generator that strings together straights, bends, S-curves, and hills. Later levels are longer and the rivals are faster.
- Punches do damage. Kicks shove sideways, and leaving the road counts as a knockdown. Some rivals carry clubs that hit harder; knock one down and the club is yours for six swings.
- Difficulty changes rival pace and aggression, traffic density, how many cars come at you, and the payout. Hard adds a police rider who fines you for crashing near him.
- Winnings buy bikes with better top speed, acceleration, and grip. A top-3 finish moves you up a level. Cash, level, bike, and difficulty are saved in `localStorage`.
- Engine and crash sounds are synthesized with Web Audio.
- Ghost links pack your run into the URL: track position and lane five times a second, 2 bytes each. Whoever opens it races your ghost on the same level and difficulty without touching their own saved progress.

## Tests

`tests/midnight-racing.test.js` covers the menu and garage, Hard mode spawns, riding and crashing, clubs and kicks, finishing a race, touch controls, and ghost links, plus online races between three copies of the page joined by in-memory channels (same track, sharing positions, hits between players, finish order, and leaving).
