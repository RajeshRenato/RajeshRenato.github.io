# Sudoku

Sudoku with generated puzzles. Fill the 9x9 grid so every row, column, and 3x3 box has the digits 1 to 9 once each. Pick easy, medium, or hard, or the daily puzzle, which is the same for everyone that day.

Open `#daily` (for example `sudoku/#daily`) to go straight to today's puzzle. It's also listed on the [daily puzzles](../daily/) page.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Click a cell | select it |
| Arrow keys | move the selection |
| 1 to 9, or the number pad under the board | enter a digit |
| 0, Backspace, Delete, or the ⌫ button | clear the cell |
| New button | new puzzle at the current difficulty |

## How it works

- The generator fills a complete grid with randomized backtracking, then removes digits one at a time in random order. A digit is only removed if a solver still finds exactly one solution afterwards, so every puzzle has a single answer.
- Removal stops at 40 clues for easy, 32 for medium and daily, and 27 for hard. A puzzle keeps more clues than that if no further digit can be removed safely.
- The daily puzzle seeds the random generator from the number of days since 1 January 2026. Solving it copies your time and mistake count to the clipboard and saves the time in `localStorage`.
- Selecting a cell highlights its row, column, and box. Digits that clash with another digit in the same row, column, or box turn red.
- Entering a digit that doesn't match the solution adds one to the mistake counter.
