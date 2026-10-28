# Highway Brawl

A Road Rash-style motorbike racer in plain HTML/CSS/JS. Race fifteen riders across five roads, from downtown streets to the desert. Punch, kick and swing your chain to get ahead, grab clubs off your rivals, keep clear of the police, and spend your prize money on faster bikes. Original code and art; not affiliated with Electronic Arts.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| W / up | throttle |
| S / down | brake |
| A D / left right | steer |
| Space or J | punch |
| E or K | kick, a shove that can put a rider off the road |
| F, L or Shift | swing your chain, or a club if you have one |
| Q or G | backhand a rider beside or just behind you |
| N | nitro, on super bikes |
| C | switch between the first-person view (the default) and the chase view behind your bike |
| Esc or P | pause |
| R | restart the race |
| M | sound on or off |

A gamepad works too: right trigger to go, left trigger to brake, the stick to steer, A punch, B kick, X chain, Y backhand, RB nitro, Start to pause. On a phone, throttle is automatic, the buttons on the left steer, and the buttons on the right brake and fight.

## Online

Two to four friends can race together. On the title screen, click "Race friends online", then "Play with friends", and send each friend their own invite link. Each of them sends back a reply link: open it in your browser or paste it in, then press Start and pick the road.

- Everyone races the host's road at the host's level, so the road, the pack of rivals, the police and the traffic start out the same for all.
- Each browser runs its own bike and sends where it is about 13 times a second. Other players ride the same bikes as everyone else, in their own colour, with their name over them.
- The host runs the pack of fifteen riders and the police for everyone and sends where they all are ten times a second, so every rider is in the same place on every screen. Riders pace themselves against the nearest player and fight whichever player is beside them; the police go after the nearest player. When you hit a rider while someone else is hosting, the hit shows at once and the host applies it, then tells you if you put them down or took their club.
- Traffic moves on a shared race clock instead of at random, so the cars are in the same places for everyone too.
- Every message says when it was sent on the host's clock. Each player keeps their clock in step with the host's by timing quick pings, so a message's age is known, network delay and all, and riders are drawn where they are now: where they were when it was sent, plus how far they've gone since. Between messages everyone keeps moving at their last speed, so nobody trails behind.
- The pack is sent six times a second, seven bytes a rider, and a message isn't sent on top of one still waiting to go out, so slow connections don't build up a backlog.
- The game runs in fixed steps and catches up after a slow frame, so every screen keeps the same pace. Online, a tab in the background keeps racing from a timer, so switching tabs doesn't freeze the race for everyone.
- Punches, kicks, backhands and chain swings land on other players too. The rider who gets hit takes it on their own screen.
- Online there's no ending a race early: a wrecked bike limps on, and getting caught by the police holds you up for a few seconds instead of a fine.
- The host collects everyone's times and shows the results, then picks the next road. Online races never change anyone's saved cash, bikes or level.
- It uses [LinkPlay](../linkplay/) for the connection: browser to browser, with no game server.

## The career

- Five roads: Downtown (office blocks, cross streets and heavy traffic), Coast Road (the sea on one side, cliffs on the other), Pine Pass (steep climbs and rock walls), Vineyard Valley (a narrow farm road with switchbacks) and Desert Run (long straights and police).
- Finish in the top three on a road to qualify. Qualify on all five to move up a level. There are five levels; each one has faster riders, longer races, more traffic and bigger prizes.
- Twelve bikes in three classes. Rat bikes are cheap, sport bikes are quick, and super bikes carry nitro. Tougher bikes survive more crashes.
- Prize money depends on your place and the level, plus a bonus for each rider you knock down.

## Fighting, crashing and the police

- Everyone starts with a chain. Some rivals carry a club or a chain of their own. Knock an armed rider down, or punch them while they wind up a swing, and the club is yours for eight swings.
- Only one rival can land a hit at a time, so a pack can't flatten you in a second, but riders do hit back.
- Crashing into traffic, walls, the guard rail or a fallen bike throws you off and damages the bike. When the bike is wrecked, the race is over and you pay for repairs.
- The police cruise until you blast past them or hit one. Then they chase you, and if you crash anywhere near them you're busted and fined. Knock the officer down, or get far enough ahead, to lose them.

## How it works

- The road is a list of 200-unit segments, each with a curve and a height. Every frame, about 240 segments are projected from the camera outwards, adding up the curves into a bend on screen and clipping anything hidden behind a hill crest. Each road and level is built from a seeded random generator, so it's the same every time you race it.
- The artwork is painted in code, once, when it's first needed (`art.js`): brick, stone, concrete and glass building facades with framed windows, blinds and reflections; shop fronts with awnings; sandstone and granite rock faces; trees made of hundreds of leaves lit from the upper left; pines, palms, cacti, rocks, lamps, traffic lights, fences, guard rails, barns and billboards; shaded clouds; skyline, mountain, hill and mesa backdrops; and cars, vans and trucks from behind and in front. A fine grain over each texture keeps the colours from looking flat.
- Buildings and rock faces are drawn as one strip per segment, with the facade texture mapped onto it, so they follow every bend and hill. Where a block starts, its end wall is drawn too, so the blocks look solid. The sea, sand, sidewalks, cross streets, tyre wear, patches and manholes are drawn into the road and the ground alongside it.
- The bikes and riders are 3D models: a sport bike with a tucked-in rider, and a police tourer with fairing, screen, panniers and top box (`tools/model.js`, built from shapes with [Three.js](https://threejs.org/)). `tools/bake.html` lights them and renders them from behind in every pose (five lean angles, punches, backhands and kicks to each side, and chain, club and baton swings) into `sprites/riders.png` and `sprites/police.png`. A second image marks the bodywork, leathers and helmet, so each of the sixteen riders is recoloured from the same frames. The game itself only draws these images, so it stays as fast as before; until they load, riders are drawn with shapes.
- Scenery, riders and cars are drawn from far to near, scaled for their distance. Distant things fade into the haze colour of each road.
- The first-person view moves the camera to the rider's eye height and draws the top of the fairing with a speedometer, a rev counter and a gear display; your fist, boot or chain swings in from the side when you fight. In the chase view your own bike goes through the same projection as everyone else, so riders level with you are exactly your size.
- The race map is made by walking the road, turning by each segment's curve.
- Rivals each have their own pace, slow down for bends, steer around traffic, and speed up a little when far behind. Police switch between patrolling and chasing.
- Engine, siren, punches and chain sounds are made with Web Audio. Your cash, bikes, level and best times are saved in `localStorage`.

## Tests

`tests/highway-brawl.test.js` builds all five roads and checks their scenery and race maps, buying bikes, the countdown and riding, punches, the chain, kicks, backhands and grabbing a club, the one-hit-at-a-time rule, crashing and wrecking the bike, police chases and getting busted, moving up a level and prize money, nitro, and drawing every screen in both views, and an online race between three copies of the page joined by in-memory links (same road and pack, the pack and traffic staying in the same places on every screen, a guest's hit on a rider reaching the host, seeing each other, hits between players, results, and the host leaving).
