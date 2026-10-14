# Sketch & Guess

A drawing and guessing game for 2 to 8 players. Each turn one player picks a word and draws it, and everyone else types guesses. Everyone draws once per round, for 2 rounds.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. It needs the page served over `http://` or `https://`, not opened as a file.

Click "Play with friends" and send each friend their own invite. Each of them sends back a reply link; open it in your browser or paste it in. Press Start when everyone is in. You can invite more players during a game.

## Rules

- The drawer picks one of three words, or gets the first one after 12 seconds. Then there are 80 seconds to draw.
- A right guess scores 50 to 100 points, more the faster you are, plus 20 for being first. The drawer gets 25 for each player who gets it.
- Guesses one letter off are flagged as close, only to the player who typed them.
- Wrong guesses show in the chat for everyone. Once you've guessed it, your messages only go to the drawer and the others who got it, so nobody can give it away.
- Halfway through, and again at three quarters, one letter of the word is shown.
- The turn ends early when everyone has guessed.

## How it works

It uses [LinkPlay](../linkplay/) for the connection. The host runs the game: it holds the word, checks guesses, keeps score and the timer, and sends each player only what they're allowed to see. Guessers never receive the word until the turn is over. Strokes are sent as point lists on a 1000 by 750 board, about 25 times a second while drawing, and a player who joins mid-turn gets the drawing so far.

## Tests

`tests/sketch-guess.test.js` plays full turns with a host and two or three guests over in-memory channels: picking, drawing, guessing, hints, scoring, timeouts, a drawer leaving, and a late joiner.
