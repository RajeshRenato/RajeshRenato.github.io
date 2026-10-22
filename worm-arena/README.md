# Worm Arena

A Slither.io-style arena game. Steer a worm around a big round arena, eat the glowing food to grow, and make other worms run their heads into your body. When a worm crashes, it bursts into food for everyone else. Play alone against bots, or with up to 7 friends online over a link.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`.

- Steer with the mouse: your worm heads toward the pointer. The arrow keys or A and D turn too.
- Hold the mouse button or Space to boost. Boosting doubles your speed but burns length, which drops behind you as food.
- On a phone, touch where you want to go, and hold the Boost button.
- Running your head into another worm's body, or into the red edge of the arena, ends your run. Your body turns into food.
- Bigger worms are wider and turn a little slower. The camera zooms out as you grow.

"Play now" starts a game against twelve bots. To play friends, click "Play with friends" and send each friend their own invite; they send back a reply link. Press Start when everyone is in. "Invite friends" in the game makes more invites, and new players drop into the arena as they join. Bots fill the arena either way, and the leaderboard shows the eight longest worms. Your best length is saved in this browser.

## How it works

- The host's browser runs the whole arena 60 times a second: movement, eating, crashes, food, and the bots. Each worm's body is a list of points laid exactly 5 units apart along the path its head took.
- Crashes are checked with a grid of every body point, so each head only looks at the bodies near it.
- Bots look ahead along their heading for bodies and the edge and turn toward whichever side is clearer, go for the best food nearby, and big bots sometimes try to cut in front of smaller worms.
- Guests get the whole arena once when they join, then a small update 20 times a second: each worm's head position, heading, and length, plus the food eaten and added. A guest rebuilds every body from the trail of head positions, so long worms cost no more to send than short ones. Guests draw everything a tenth of a second behind, sliding between updates, so movement stays smooth.
- It uses [LinkPlay](../linkplay/) for the connection, with no game server.

## Tests

`tests/worm-arena.test.js` checks eating and growing, a head into another worm's body (the victim dies, the killer gets the credit, the body becomes food), the edge, boosting speed and its cost, that a minute of bots eats and grows without constant crashes, that a worm shrinking mid-step can't trip the collision check, and an online game over an in-memory channel: the guest's rebuilt bodies match the host's to within a pixel or two, steering works, hostile messages are ignored, and dying and respawning work.
