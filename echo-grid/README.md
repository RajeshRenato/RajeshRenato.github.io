# Echo Grid

A Simon memory game. Four pads light up in a pattern, each with its own tone, and you repeat it back. Every round adds one more step, and the playback gets faster as the pattern grows.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Click or tap a pad | press that pad |
| Q, W, A, S | press pads 1 to 4 |
| 1, 2, 3, 4 | press pads 1 to 4 |
| Start button | start a new game |
| Strict checkbox | on: one mistake ends the game. Off: a mistake replays the pattern |

## How it works

- Playback starts at 560 ms per step and drops by 18 ms for each step in the pattern, down to 220 ms.
- Tones are made with the Web Audio API.
- Your best round is saved in `localStorage`.
