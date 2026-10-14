# Arcade Tycoon

An idle clicker game about running an arcade. Click the coin button to earn credits, then spend them on five kinds of generator that earn credits on their own: arcade cabinets, snack bars, VR pods, neon sign factories, and space elevators. The arcade keeps earning while the tab is closed, for up to 8 hours.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Insert coin button | earn credits (1 per click to start) |
| Buy button on a generator row | buy one more of that generator |
| Golden Thumb upgrade | double the credits per click |
| Hard reset | wipe all progress |

## How it works

- Each generator's price goes up by 15% for every one you own. Base prices run from 15 credits for a cabinet to 130,000 for a space elevator.
- The click upgrade starts at 50 credits and costs 6 times more each level.
- Income is added ten times a second. Progress is saved to `localStorage` every 3 seconds and after every purchase.
- When you come back, the game works out how long you were gone (capped at 8 hours) and adds that much income.
