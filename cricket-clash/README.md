# Cricket Clash

An EA Cricket-style cricket game in a 3D stadium under lights. Pick one of eight teams, call the toss, and play a limited-overs match: time your shots, run between the wickets, choose your bowlers, and bowl pace or spin. Play against the CPU, or a friend online where one side bats while the other bowls. The players are made up.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`.

Choose your team and the opposition, 2, 5, 10 or 20 overs a side, the CPU's level, and whether the batsmen run on their own or you call the runs. Then call the toss and bat or bowl first.

### Batting

Hold a direction with the arrows or WASD while the bowler runs in. Left and right are the two sides of the ground as you see them, up is straight back past the bowler, and down is behind the wicket. Diagonals work too. As the ball arrives, press:

| Key | Shot |
| --- | --- |
| Space or J | Along the ground |
| K | Lofted, in the air |
| L | Block |
| nothing | Leave it |

Front or back foot follows the length of the ball, and the shot you play follows from where you aimed and how you played it: a cover drive, a pull, a cut, a sweep against spin, and so on.

- Timing decides everything: perfect, good, mistimed, an edge, or a miss. Early shots go squarer on the leg side, late ones squarer on the off side. A timing bar after each shot shows how early or late you were.
- A perfect loft clears the rope. A mistimed one goes up and gets caught. Ground shots are safer and run for four through the gaps.
- Playing against the line of the ball, lofting a yorker, or going forward to a bouncer makes a mistake more likely. Better batsmen have more time; tailenders less.
- Miss a straight ball and you're bowled or out leg before wicket.
- With "I call the runs" on, R calls for a run (press it again for another) and X sends your partner back. Turn back early enough and you're safe; be greedy and you'll be run out.

### Bowling

At the start of each over pick a bowler. Each can bowl a fifth of the overs, never two in a row. Pick a delivery with 1 to 6:

| Bowler | Deliveries |
| --- | --- |
| Fast and medium pace | Outswinger, inswinger, yorker, bouncer, off cutter, slower ball |
| Off spin | Off break, arm ball, top spinner, quicker one |
| Leg spin | Leg break, googly, top spinner, flipper |

Move the marker with the arrows or WASD (or tap the pitch) to choose where it pitches, press Space to run in, and press Space again with the meter in the green. Too early costs pace and accuracy; too late and you overstep for a no-ball, and the next ball is a free hit.

Press F to change the field: attacking (slips, gully, and close catchers to the spinners), balanced, or defensive (men back on the rope). The CPU captain sets its own: catchers with the new ball and for a new batsman, the rope protected at the end of an innings.

### Reviews

The umpire gets the clear LBWs right and the close ones about half the time. Each side has one review an innings: the batting side can review an out, the bowling side a not out. Press Y to review or N to accept. Ball tracking then shows where the ball pitched, where it hit the pad, and whether it would have hit the stumps. If it's only just clipping, or the impact is only just in line, it's umpire's call: the decision stands and you keep your review. Otherwise a review that doesn't change the decision is lost.

Close run outs go to the third umpire, who watches a replay level with the crease before giving it.

H shows the controls, M turns the sound off, V turns the spoken commentary off, and P pauses a game against the CPU. Scorecard opens the full card with a wagon wheel. On a phone there's a pad for the direction, buttons for the shots and for running, and the bowling marker goes where you tap.

## The match

- Each side's eleven bat in order: the openers and middle order bat best, the bowlers least. Batsmen change ends when they run an odd number and at the end of each over, and a new batsman comes in after each wicket.
- Out bowled, caught, leg before wicket, or run out. LBW follows the real conditions: the ball would have hit the stumps, didn't pitch outside leg, and didn't hit the pad outside off if a shot was played.
- Wides and no-balls add a run and are bowled again. After a no-ball comes a free hit, when you can only be run out.
- The side batting second chases the target. The scorebar shows the score, both batsmen, the bowler's figures, this over, and the runs needed. At the end of each over a card shows the over's runs, the partnership, and the bowler's figures.
- Fifties, hundreds, hat-trick balls and hat-tricks get their moment.
- A tie goes to a Super Over: one over each with two wickets, the side that batted second going first. If that's level too, the side that hit more boundaries in it wins.

## How it works

- Each delivery is a real path: released at the bowler's pace (spinners about 85 km/h, quicks over 140), curving with swing, bouncing where it was aimed (give or take, depending on the release and the bowler), then moving off the seam or turning. Bounce depends on the type, so bouncers climb and flippers skid.
- A shot's direction, speed, and height come from your timing, the shot you chose, the batsman's rating and the pace of the ball. Edges keep much of the bowler's pace and fly toward the keeper and slip.
- The hit ball flies with gravity and air drag, skims or bounces, and rolls to a stop. Each fielder works out where they can reach the ball's path. Whoever gets there first chases it, accelerating up to speed. A ball in the air they reach is a catch chance, and diving ones are harder to hold. A ball on the ground gets picked up and thrown to whichever end gives the best chance of a run out.
- The batsmen run between the wickets and make their ground when the bat crosses the crease. When running on their own they go if the throw can't beat them by a safe margin, and turn back if it suddenly can.
- The fields change for pace and spin and mirror for left-handers. The keeper stands back to the quicks and up to the spinners.
- The CPU picks bowlers and deliveries, and bats by reading length and line, playing more shots as the required rate climbs. Sometimes a slower ball or a googly fools it.
- The view is drawn in 3D on a canvas: a TV camera behind the bowler's arm, a camera that follows the ball once it's hit, and replays of wickets and sixes from side-on or from behind the stumps. The players are shaded, jointed figures in their team kits with numbers on their backs, and a side whose kit clashes switches to its change kit. The stands are full, and big screens at each end show the score. While you bat, an arrow on the grass shows where the shot you're holding will go.
- Commentary is spoken with your browser's built-in voices (it picks a British, Australian or Indian English voice if there is one), and a crowd swells and roars with the play.
- Online, the host runs the match. Whoever is bowling picks the bowler and the delivery, and the host bowls it on both screens. The batsman's swing is timed on their own screen against the ball they saw, then sent to the host, which plays out the ball and sends it back as snapshots, along with the score. It uses [LinkPlay](../linkplay/) for the connection, with no game server.

## Tests

`tests/cricket-clash.test.js` checks:
- deliveries pitch where they're aimed, yorkers hit the stumps and bouncers climb, swing and turn go the right way, and late releases overstep;
- the timing grades, shot directions and shot names, for left-handers too;
- the LBW rules;
- perfect lofts go for six, drives find the gaps, a straight ball left or missed is out, late edges get caught, a free hit protects you, and hundreds of random balls all come to an end;
- running, including run outs from greedy calls and safely turning back;
- the scorecard: strike changes, overs, bowling changes, extras, the free hit, wickets, all out and the chase;
- CPU-against-CPU matches finish with believable scores that add up;
- an online match: the toss, picking a bowler, a ball bowled by the host and played by the guest, the same scorecard on both screens, and out-of-turn or forged messages refused;
- ball tracking verdicts and umpire's call, the umpire's error rate, and reviews that are overturned, lost, kept on umpire's call, or not available;
- the Super Over, including a tie decided on boundaries;
- attacking and defensive fields, mirrored for left-handers, and the CPU captain's choices;
- close run outs flagged for the third umpire, fifties and hat-tricks;
- a guest reviewing a decision online.
