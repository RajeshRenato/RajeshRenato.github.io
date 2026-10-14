# Type Race

A typing race. Everyone gets the same passage and a 3 second countdown; first to type all of it, with every mistake fixed, wins.

Play with up to 8 friends online, or practice alone against the pace of your best run.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Online play needs the page served over `http://` or `https://`, not opened as a file.

To race friends: click "Play with friends" and send each friend their own invite. Each of them sends back a reply link; open it in your browser or paste it in. Press Start when everyone is in.

## Rules

- A wrong letter turns red, and you can't get more than 8 characters past it. Backspace to fix it.
- Speed is words per minute, counting 5 characters as a word. Accuracy is the share of keystrokes that were right.
- Each player's time is measured on their own device from the end of their countdown, so a slow connection doesn't cost you the race.
- Your best speed is saved in `localStorage`.

## How online play works

It uses [LinkPlay](../linkplay/): browsers connect directly over WebRTC, and the invite and reply links carry the connection details. The host picks the passage and passes each player's progress on to everyone else, about 7 times a second.

## Tests

`tests/type-race.test.js` covers typing and mistakes, the solo best, and a three-player race over in-memory channels.
