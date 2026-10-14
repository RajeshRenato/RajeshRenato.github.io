# Sort Arena

Two sorting algorithms race side by side on the same shuffled array. Pick any two of bubble, insertion, selection, merge, quick, and heap sort, set the array size and speed, and press race. Each panel counts the steps its algorithm takes, and the one that finishes in fewer steps wins.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| The two menus | choose the algorithms (changing one reshuffles) |
| size slider | number of bars, 20 to 160 |
| speed slider | steps per frame, 1 to 60 |
| shuffle | new random order |
| race | start both sorts from the current order |

## How it works

- Each algorithm is a generator function that sorts the array in place and yields after every comparison or write. That yield is one op on the counter.
- Every frame, both generators are advanced by the same number of steps, so the two panels stay in sync and the counters compare like for like.
- The two bars being compared are drawn white. A panel turns green when its sort is done.
- Quick sort uses the last element as the pivot. Merge sort merges into a temporary array and then writes it back.
