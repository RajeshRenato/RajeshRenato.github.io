# Couch Party

Party games for a room full of people, Jackbox-style. Put the page on a big screen, a laptop or a TV connected to one, and everyone plays with their own phone as the controller. Up to 8 players, no app, no account, and no server.

## Play

Open this page on the computer that's showing the big screen. It needs `https://` or `http://localhost` for the camera.

1. Each player points their phone's camera at the code on the big screen and opens the link.
2. They type a name and tap Join. Their phone shows a code.
3. They hold the phone up to the computer's camera. A moment later their name appears on the big screen, and the screen shows a fresh code for the next person.

Then pick a game on the big screen:

- Sumo: everyone is a ball on a round ring. Steer with the stick on your phone, or tap "Steer by tilting" and tilt it. Bump the others off the edge. The ring starts shrinking after a few seconds, so every round ends. Last one on wins the round; three rounds. 2 or more players.
- Quiz: seven questions from [Trivia Night](../trivia-night/)'s 320, shown on the big screen. Answer on your phone in 15 seconds; a right answer scores 500 points plus up to 500 more for speed.
- Green Light: wait for green, then tap. Tap too soon and you're out for that round. The three fastest score 300, 200, and 100. Five rounds. Times are measured on each phone from the moment it turned green, so a slow connection doesn't cost you.

Points add up across games. After each game the big screen shows the standings and each phone shows your place.

## How it works

- Every phone connects straight to the computer with WebRTC, the computer passes nothing on, and it runs the games. Phones send their stick position about 20 times a second, their answers, and their taps.
- Pairing uses the same QR codes as [Phone to Laptop](../phone-to-laptop/) (`linkplay/qrpair.js`): the big screen shows a connection offer as a link in a QR code, and the phone answers with a QR code the computer's camera reads. Both are packed down to about 130 bytes so they're easy to scan. Each code works for one phone, and the computer ignores a phone's code once that phone has joined.
- The computer reads codes with the browser's built-in barcode reader where there is one, and otherwise with [jsQR](https://github.com/cozmo/jsQR), included in this repo under `common/jsqr`.
- Players, names, and colors come from [LinkPlay](../linkplay/)'s rooms.
- Sumo is a small physics simulation on the computer, stepped 120 times a second: input pushes each ball, friction slows it, and balls that touch bounce apart.

Phones need to reach the computer directly. On the same Wi-Fi that nearly always works; some guest and office networks block it.

## Tests

`tests/couch-party.test.js` runs the big screen and three phones over in-memory channels. It checks joining and names, quiz scoring (faster right answers score more, wrong and repeated answers don't), Green Light (too-soon taps, ranking, and forged times), Sumo collisions, falling off, and that a round always ends, someone leaving mid-game, results on each phone, and that the phone ignores broken or hostile screens. The whole thing was also played in three Chrome windows.
