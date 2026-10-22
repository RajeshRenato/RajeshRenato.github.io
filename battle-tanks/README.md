# Battle Tanks

A Battle City (Tank 1990) style game. Twenty enemy tanks roll in each stage, and you defend the eagle at the bottom of the field. Shoot through brick walls, hide under trees, slide on ice, and pick up power-ups from the flashing red tanks. Play alone, with two players on one keyboard, or co-op with a friend online. Original code, stages, and pixel art.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`.

| Keys | |
| --- | --- |
| Arrow keys or WASD | move |
| Space | fire |
| P | pause |
| M | sound on and off |

With two players on one keyboard, player 1 uses WASD and Space, and player 2 the arrow keys and Enter. On a phone, use the pad on the left and the Fire button on the right.

To play a friend online, click "Play a friend online" and send the invite; they send back a reply link, and the game starts as soon as they're in.

## Rules

- Each stage has 20 enemy tanks. Up to four are on the field at once (six with two players), and they arrive at the three gates along the top.
- Basic tanks are slow, fast tanks are quick, power tanks fire fast shots, and armored tanks take four hits (their color changes as they weaken).
- A shot breaks an 8-pixel strip of brick. Steel stops shots, unless you've collected three stars. Water stops tanks but not shots. Trees hide tanks, and ice keeps you sliding.
- If a shot hits the eagle, or every player is out of lives, the game is over. Everyone starts with three lives.
- A shot from your teammate doesn't hurt you; it stops you for two seconds.
- Shots that meet in the air cancel out.

Tanks 4, 11, and 18 of each stage flash red. Hit one and a power-up appears somewhere on the field for 15 seconds:

| Power-up | |
| --- | --- |
| Helmet | a shield for 10 seconds |
| Clock | freezes every enemy for 8 seconds |
| Shovel | steel walls around the eagle for 15 seconds; then the brick fort comes back, fully rebuilt |
| Star | stronger shots: faster, then two at once, then steel-breaking |
| Grenade | destroys every enemy on the field |
| Tank | one more life |

Scores: 100 for a basic tank, 200 fast, 300 power, 400 armored, and 500 for a power-up. After each stage, a tally shows what each player destroyed. There are six stages, and then they repeat with harder enemy mixes.

## How it works

- The field is 26 by 26 cells of 8 pixels, drawn at 256 by 224 like the original and scaled up with crisp pixels. A tank is 2 by 2 cells. When a tank turns, it snaps to the 8-pixel grid, so it fits through gaps the way the original's tanks do.
- Bullets move in steps of 3 pixels so fast ones can't skip through a brick, and each hit clears the strip of cells across the bullet's path.
- Enemies keep rolling, turn when they're blocked or every second or two (mostly downward, toward the eagle), and fire often, especially when they're lined up with a player or the eagle.
- Online, the host's browser runs the game, and the guest sends its keys and draws snapshots sent 30 times a second. The map is only sent when bricks change. It uses [LinkPlay](../linkplay/) for the connection, with no game server.
- The sounds are synthesized with the Web Audio API.

## Tests

`tests/battle-tanks.test.js` checks that every stage leaves room to spawn, builds the fort, and lets enemies reach the eagle; the enemy wave; bricks, steel, star-3 shots, and water; stopping at walls and snapping to the grid; armored tanks and power-up carriers; every power-up, including the fort being rebuilt after the shovel; losing to a shot into the eagle or running out of lives; clearing a stage; friendly fire; and an online game with hostile messages.
