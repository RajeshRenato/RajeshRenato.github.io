# Clue Grid

A Codenames-style word game for 4 to 8 players in two teams, played online with links and no server.

There are 25 words on the board. Each team's spymaster can see which words belong to their team, which are neutral, and which one is the assassin. On their turn, the spymaster gives a one-word clue and a number, and their teammates try to find those words. The first team to find all of theirs wins. Picking the assassin loses the game on the spot.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. It needs the page served over `http://` or `https://`, not opened as a file.

Click "Play with friends" and send each friend their own invite. Each of them sends back a reply link; open it in your browser or paste it in. Press Start once everyone is in, then pick teams: everyone chooses a side, and one person on each side becomes spymaster. The host can shuffle the teams instead.

## Rules

- The team that starts has 9 words to find, the other has 8. There are 7 neutral words and 1 assassin. The starting team alternates between games.
- A clue is one word, letters only. It can't be a word on the board or contain one (or be part of one).
- The number says how many words the clue points to. The team can make up to that many guesses plus one. A clue with 0 allows any number of guesses.
- Picking your own color lets you keep guessing. A neutral word or the other team's word ends your turn, and the other team's word counts for them.
- Your team can end its turn early with "End guessing".
- When the game ends, every card shows its color.

## How it works

It uses [LinkPlay](../linkplay/). The host's browser runs the game: it holds the key, checks every clue and guess, and sends each player their own view. Only the two spymasters receive the key, so guessers can't find it in their browser. If a spymaster leaves, the next player on that team takes over and gets the key. Players who join mid-game are put on the smaller team.

The word list has 490 common words.

## Tests

`tests/clue-grid.test.js` plays games with 4 and 5 players over in-memory channels: picking teams, who receives the key, clue checks, guessing rules, the assassin, winning, a spymaster leaving, and a late joiner.
