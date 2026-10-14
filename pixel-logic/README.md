# Pixel Logic

Nonograms (also called Picross). The numbers beside each row and above each column give the lengths of the runs of filled cells in that line, in order. Fill in the grid until every clue matches and the picture appears. Levels start at 5x5 and grow by one each level up to 12x12, with thicker guide lines every 5 cells.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Click | fill a cell, or clear it if it's already filled |
| Right click | mark a cell as empty with an x |
| Click and drag | paint the same change across several cells |
| Fill / mark buttons | choose what a left click does |
| Check | flash any filled cells that are wrong |
| New puzzle | new random seed at the current level |
| Share seed | copy a link to this exact puzzle |

## How it works

- Each puzzle is a random picture that is run through a line solver before you see it. The solver works one row or column at a time, trying every legal placement of the runs and keeping the cells that agree in all of them. A picture is only used if the solver can finish it that way, which means it can be solved without guessing and has only one solution.
- A row or column clue is marked as done once your fills match it.
- The seed and level are kept in the URL (`#seed.level`), so a shared link gives the same picture. The number of puzzles you've solved is saved in `localStorage`.
