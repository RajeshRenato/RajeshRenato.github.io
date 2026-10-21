# Video Call

A one-to-one video call through a link. There's no app, no account, and no server: the two browsers connect directly, and nothing is recorded or stored.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Calls need the page served over `http://localhost` or `https://`, because browsers only allow the camera there.

Allow your camera and microphone, check yourself in the preview, and click "Start a call". Send the invite link. The other person opens it, allows their camera, and gets a reply link to send back. Open the reply in your browser or paste it in, and the call starts. An invite only works once. Anyone without a camera can choose "Join without camera" and talk with audio only.

## In a call

| Control | What it does |
| --- | --- |
| Mute | turns your microphone off and on (or press M) |
| Camera | turns your camera off and on (or press V). The other side sees a placeholder. |
| Flip | switches between front and back cameras on phones |
| Share | sends your screen instead of your camera, and back |
| Chat | text messages over the same connection |
| Full | full screen |
| End | hangs up for both of you |

Your own video sits in a small window you can drag anywhere. The bars next to the timer show the connection quality from the round trip time and lost packets.

## The safety code

Both screens show the same three words and four digits, made from both browsers' connection keys. Say them out loud. If they match, nobody is in the middle. If someone had swapped the links on the way, the codes would differ, and "It doesn't match" ends the call.

## How it works

It uses [LinkPlay](../linkplay/): the invite carries the caller's connection details with an audio and a video slot, and the reply carries the other side's. WebRTC encrypts the media with SRTP and the chat with DTLS, with fresh keys for every call. Details shows what your browser reports: the DTLS version, the cipher, the route, the round trip time, packet loss, and the incoming resolution.

Screen sharing swaps the video track in place, so the call doesn't need to reconnect. The page sets a Content Security Policy so the browser blocks it from loading or sending anything else.

Limits: both people need the page open at the same time. There's no relay server, so some strict office or mobile networks can't connect, and the two browsers see each other's IP address. It's one to one only, and there's no recording.

## Tests

`tests/video-call.test.js` checks the safety code, the quality bars and timer, that mute and camera switch the real tracks and tell the other side, chat messages as plain text, hanging up and dropped connections, and closing the call when the codes don't match.
