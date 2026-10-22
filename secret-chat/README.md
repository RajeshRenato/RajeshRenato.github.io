# Secret Chat

A private chat between two browsers. There's no server and no account, and nothing is left behind when you close the tab. Made for passing a password or anything else sensitive to someone who's online at the same time.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. It needs the page served over `http://` or `https://`, not opened as a file.

Click "Start a secret chat" and send your friend the invite link. They get a reply link to send back. Open it in your browser or paste it in, and you're connected. An invite only works once.

## What it does

- Messages go straight from one browser to the other, encrypted on the way, and are never stored anywhere, not even in the browser.
- Hidden messages arrive blurred. Tap to show one, or copy it without showing it. A shown message blurs again after 15 seconds.
- Messages can disappear after 30 seconds, 5 minutes, or an hour. They're removed from both screens.
- Files and images up to 100 MB can be sent, with a progress bar.
- Wipe clears the chat on both screens at once.
- Connection details shows what your browser reports: the DTLS version, the cipher, whether the route is direct, and the round trip time.

## The safety code

Both screens show the same three words and four digits, made from both browsers' connection keys. Read them out to each other on a call. If they match, nobody is in the middle. If someone had swapped the links on their way, the codes would differ, so "It doesn't match" closes the chat.

## How it works

It uses [LinkPlay](../linkplay/): the invite and reply links carry the two browsers' connection details, and the browsers then talk over a WebRTC data channel. Browsers always encrypt these channels with DTLS, with fresh keys for each connection, so a recording of the traffic can't be decrypted later.

The safety code is a SHA-256 hash of the two DTLS certificate fingerprints, which the browser checks against the real connection. A public STUN server tells each browser its own address and sees nothing else. There's no relay, so the two browsers see each other's IP address, and networks that block direct connections won't connect.

The page sets a Content Security Policy so the browser blocks it from loading or sending anything else, even if a script were somehow added to it.

What it can't protect against: malware or a browser extension on either device, someone reading over your shoulder, or a screenshot.

If a relay is configured in LinkPlay, it's used only when a direct connection fails, and the chat says so. It can't read anything, because the traffic stays encrypted end to end. "Never use a relay" on the first screen ends the chat instead. The published site has no relay configured.

## Tests

`tests/secret-chat.test.js` checks the safety code (the same on both sides, different when a key changes), messages and seen receipts, that text is never treated as HTML, hidden and disappearing messages, wiping and leaving, and a file arriving byte for byte over in-memory channels.
