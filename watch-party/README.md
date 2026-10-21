# Watch Party

Watch a video with friends, in sync, from wherever you each are. Everyone opens their own copy of the same file, so nothing is uploaded or streamed and big files are fine. Play, pause, seeking, and speed stay matched for everyone. There's a text chat, emoji reactions that float over the video, and an optional mic.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. It needs the page served over `http://` or `https://`, not opened as a file.

Click "Start a watch party" and send each friend their own invite link (up to 7 friends). Each of them sends back a reply link. Open it in your browser, or paste it into the box under "Invite friends". Then everyone chooses the same video from their own device.

| Input | Action |
| --- | --- |
| Play button, Space, or K | play or pause for everyone |
| Position bar, or left and right arrows | seek for everyone (arrows jump 5 seconds) |
| Speed menu | change the speed for everyone |
| Mic button | turn your microphone on or off |
| Emoji buttons | send a reaction that floats over everyone's video |

Anyone can play, pause, seek, or change speed, not just the host.

## What you see

- Everyone's name, file name and length, and whether they're picking a file, loading, ready, buffering, or watching.
- A warning when someone's video is more than a second and a half longer or shorter than the host's, since it's probably a different file or edit and scenes won't line up.

## How it works

- The host's browser keeps the shared clock: whether the video is playing, the position, the speed, and when that was set. It sends the clock to everyone on every change and every 2.5 seconds. Commands from guests go to the host, which updates the clock and sends it out.
- Every browser, the host's included, steers its own video toward the clock four times a second. A gap under half a second is closed by playing up to 12 percent faster or slower until it's gone, so there's no visible jump. A bigger gap seeks straight to the right spot. When paused, the video snaps to the exact frame.
- When the clock passes the end of the longest video, the host stops it, so nobody is left "playing" past the end.
- Connections use [LinkPlay](../linkplay/) and its rooms: every guest connects to the host, and the host passes chat and reactions on to everyone. Nothing goes through a server.
- Voice uses an audio slot that LinkPlay opens on each connection. Guests start with a silent track in it, so the mic can be switched on later without reconnecting.

## Limits

- Voice is host-centred: the host hears everyone and everyone hears the host, but guests don't hear each other. With two people that makes no difference.
- Everyone needs their own copy of the video. It's local files only: playing YouTube or other sites together would mean loading their scripts into this page, which this project avoids.
- Each browser measures time from when the clock message arrives, so a slow connection can leave someone a fraction of a second behind.
- The party ends if the host leaves. Your video keeps working, but it's no longer in sync.
- Some browsers won't start a video until you've clicked something on the page. If that happens, the chat says so: press play once.
- Some strict office or mobile networks block direct connections. If a friend can't connect, try another network.

## Tests

`tests/watch-party.test.js` checks the drift correction and clock math, play, seek, speed, and pause from a guest reaching everyone through the host, steering a local video toward the clock, file length warnings, chat and reactions, and stopping at the end of the longest video.
