# Penta

A Wordle-style word game. Guess the five-letter word in six tries. After each guess, green means the letter is in the right spot, yellow means it's in the word but somewhere else, and gray means it isn't in the word.

There are two modes. Daily gives everyone the same word each day, and free play picks a random word with a "new word" button. The daily word is also part of the [daily puzzles](../daily/) page.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Letter keys | type a letter |
| Enter | submit the guess |
| Backspace | delete a letter |

The on-screen keyboard does the same thing, and its keys are colored by the best result you've had for each letter.

## How it works

- Answers come from a list of 551 common words in the page. Any five letters are accepted as a guess, so there's no dictionary check.
- Repeated letters are scored the same way as Wordle: exact matches are marked first, then yellows are handed out only as many times as the letter is left in the answer.
- The daily word is picked by hashing the number of days since 1 January 2026. Your daily guesses are saved, so reloading the page restores the board.
- Played, won, and current streak are saved in `localStorage`, along with a separate streak for daily puzzles.
- After a game, "share result" copies a grid of colored squares to the clipboard.
