# Reflex Lab

Three short reaction tests: plain reaction time, aim, and a left/right choice test. Each one gives you an average in milliseconds and a rating, keeps your best average in `localStorage`, and can save the result as a PNG scorecard.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Tabs | switch between reaction, aim, and choice |
| Click the box | start a test, or react in the reaction test |
| Click a target | hit it in the aim test |
| Left / Right arrow | answer in the choice test |
| save scorecard | download the last result as a PNG |

## Rules

- Reaction: wait for the box to turn green, then click. It goes green after a random delay of 0.9 to 3.5 seconds. Five rounds. Clicking too early cancels that round and you click again to retry it.
- Aim: hit 10 targets that appear one at a time at random spots. Your score is the average time per target, and clicks that miss are counted.
- Choice: an arrow appears and you press the matching arrow key. Ten rounds. A wrong key adds 250 ms to that round and is counted.

Lower is better in all three. A new best is marked when you beat your previous average.
