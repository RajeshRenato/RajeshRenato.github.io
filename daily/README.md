# Daily puzzles

One page for the three daily puzzles: Penta, Sudoku, and Arrow Flux. Everyone gets the same puzzles on the same day, and the page tracks a streak of days where you solved all three.

## How it works

Each game saves its own result for the day in `localStorage` (`penta_day_N`, `sud_day_N`, `af_day_N`), and this page reads them, since every page on the site shares one origin. Day `N` counts from 1 January 2026 and rolls over at midnight UTC, so everyone's day number matches. Nothing is sent anywhere.
