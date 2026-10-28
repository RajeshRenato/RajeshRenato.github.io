# Carrom

Carrom on a full board: flick the striker, pocket your coins, and cover the queen. Two players head to head, or four as partners. Play a friend online, pass the device around, or take on a bot at three levels.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`.

- Drag the striker along your baseline to place it (or use the arrow keys). It can't sit on top of a coin.
- Then press anywhere on the board, pull back, and let go. The striker goes the opposite way to your pull, and the farther you pull, the harder the shot. A dotted line shows where it's headed.
- Online, everyone sees the striker move and the aim line while the player lines up a shot.

"Play on this device" lets you set each of the four seats to a player, a bot, or empty: fill two seats to play head to head, or all four to play as partners (South and North play white, East and West black). Online, two players face each other, and three or four sit all round with a bot in a spare seat.

The board turns so whoever is shooting has their line at the bottom, so aiming works the same way from every seat. On one screen it turns to each player in turn (a bot's turn keeps the last person's view), and you can switch that off before the game. Online, your own side is always at the bottom.

## Rules

- White breaks. Each side has 9 coins, and the red queen sits in the middle.
- Pocket one of your coins and you shoot again. Pocket only the other side's coins, or nothing, and the turn passes.
- Pocketing the striker is a foul: one of your pocketed coins comes back to the middle, and the turn passes.
- The queen has to be covered: pocket her, then pocket one of your own coins on the same shot or the next one. If you don't, she goes back to the middle.
- You can't finish before the queen is covered. If your last coin goes in while she's still out, it comes back.
- Back shots, at coins behind your own line, are allowed, as in most home games. Untick "Allow back shots" before the game to play the tournament rule, where the striker has to go forward.
- The first side to pocket all 9 of its coins wins, scoring a point for each coin the other side has left, and 3 more if they covered the queen.

## How it works

- The board is 1000 units square, with coins, a bigger and heavier striker, and pockets in their real proportions. Pieces slow down with friction, bounce off the cushions and each other, and fall when their center is over a pocket. The physics steps 240 times a second.
- The physics uses only adding, multiplying, dividing, and square roots, which give exactly the same answer in every browser. So online, the player's shot (where the striker sat and how fast it went) is sent to everyone, every screen plays it out the same way, and the host then sends the final positions so nothing can drift.
- The bot looks at every coin it could pocket, works out where the striker has to hit it to send it toward each pocket, and plays each shot out in a fast simulation. It takes the one that pockets the most of its own coins without fouling. An easier bot considers fewer shots and aims and judges power less precisely.
- It uses [LinkPlay](../linkplay/) for the connection, with no game server.

## Tests

`tests/carrom.test.js` checks the rack, the striker driving a coin, cushions, pockets, and that the same shot always ends the same way; extra turns, fouls, covering and losing the queen, the last-coin rule, and the points; that the sharp bot pockets on most tries and more often than the easy one; and an online game where the guest's replay of a shot ends exactly where the host's does, with broken states ignored.
