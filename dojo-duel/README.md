# Dojo Duel

A Street Fighter-style fighting game. Three fighters, each with two special moves, fight best-of-three rounds in a dojo. Play the CPU at three levels, a friend on the same keyboard, or a friend online. Original characters, code, and art.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`.

| | One player | Two on one keyboard: left | right |
| --- | --- | --- | --- |
| Move, jump, crouch | WASD or arrows | WASD | arrows |
| Punch | J | F | comma |
| Kick | K | G | period |
| Special | L | H | slash |

P pauses and M turns the sound off. On a phone there's a pad on the left and Punch, Kick, and Special buttons on the right.

- Hold back, away from your opponent, to block. Crouch and hold back to block low attacks like sweeps; stand to block jump-in attacks. With an attack on the way, holding back keeps you in place guarding.
- Crouch and punch or kick for low attacks, and punch or kick in the air for jump-ins. A crouching kick is a sweep that knocks down.
- Special moves: a quarter circle (down, down-forward, forward) or a dragon punch motion (forward, down, down-forward) and punch, the classic way. Or press Special: on its own, with down, or with back.

## The fighters

| | | Specials |
| --- | --- | --- |
| Kai | Balanced | Fireball (quarter circle forward), rising uppercut that's safe from hits as it starts (dragon punch) |
| Rena | Fast and light, less health | Dash strike (quarter circle forward), spinning kick (quarter circle back) |
| Bruno | Slow, hits hard, more health | Shoulder charge that takes hits without flinching (quarter circle forward), ground slam that knocks down (dragon punch) |

## Rules

- Each round lasts 60 seconds. Knock the other fighter out, or have more health left (as a share of the fighter's total) when time runs out.
- The first to win two rounds wins the match.
- Blocked specials still take off a little health. Damage drops a little deep into a combo.

## How it works

- The fight steps 60 times a second. Every move has startup, active, and recovery frames, a hitbox, damage, hit and block stun, and pushback; hits are checked for both fighters at once, so blows can trade.
- The fighters are jointed figures: each pose is a set of angles for the torso, arms, and legs, and moves blend from a ready pose into the strike. They're drawn with thick rounded limbs, in each fighter's colors.
- Online play uses lockstep with a 4-frame input delay. Each browser sends its buttons for a frame a little ahead, and both run the same fight from the same buttons. Positions are kept in whole sixteenths of a pixel, so the two stay exactly in step. If buttons are late, the fight waits instead of guessing. It uses [LinkPlay](../linkplay/) for the connection, with no game server.
- The CPU blocks attacks it sees coming (high or low), jumps fireballs, anti-airs jumps, punishes missed moves, and otherwise picks between closing in, keeping distance, and attacking. Higher levels react more often.

## Tests

`tests/dojo-duel.test.js` checks hits and blocking, that lows need a crouching block, fireballs from the motion and from the Special button, Rena's dash, knockouts, rounds, the timer, and the match; that the same buttons always give the same fight; that a CPU-against-CPU match finishes; and an online fight where both browsers end on exactly the same frame, waiting for late buttons, and ignore forged messages.
