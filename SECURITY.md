# Security

Some projects here handle things people want kept private: Secret Note, Secret Chat, Video Call, File Send, Photo Privacy, and the PDF and image tools. This page says what they protect, what they don't, and how they've been tested.

None of this has had an independent security audit. If you find a problem, please report it privately (see the end of this page).

## What runs where

- Everything runs in your browser. There is no server of ours, no accounts, no analytics, and no cookies.
- The tools that work on files (PDF Toolkit, PDF Sign & Fill, Images to PDF, Image Squeeze, Photo Privacy, Video to GIF, Screen Recorder) process them on your device. The files are never uploaded.
- Two outside libraries are used: Mozilla's pdf.js, which draws the pages in PDF Sign & Fill, and jsQR, which reads QR codes from the camera in Phone to Laptop. Copies are kept in this repo (`common/pdfjs`, `common/jsqr`), checked byte for byte against the official npm packages, and served from this site.
- The online projects connect browsers directly with WebRTC. The connection details travel inside the invite and reply links. A public STUN server (Google or Cloudflare) tells each browser its own public address. That is the only outside request.

## Secret Note

- The note is encrypted in your browser with AES-256-GCM before the link is made. The key, or with a password a salt for PBKDF2-SHA256 at 600,000 iterations, sits after the `#` in the link. Browsers never send that part to the website.
- Nothing is stored anywhere, so a note can't expire or be deleted. Anyone who ever gets the link can read it. With a password, they also need the password.
- The page clears the link from the address bar as soon as it opens, sends no referrer, and has a Content Security Policy that stops it from loading or sending anything else.

## Secret Chat and Video Call

- Browsers always encrypt WebRTC connections (DTLS, with fresh keys for each connection), so nobody on the network can read or watch them, and a recording of the traffic can't be decrypted later.
- The weak point is the links. Someone who could intercept and swap both links on their way could sit in the middle. The safety code (three words and four digits made from both connection keys) is there to catch this. If the two of you read out the same code, nobody is in the middle.
- Nothing is stored. Closing the tab ends the conversation.
- The two browsers can see each other's IP address.
- If a relay is configured in `linkplay/linkplay.js`, it is used only when a direct connection fails. It passes on encrypted traffic and can't read it, but it does see that the two addresses are talking. Secret Chat and Video Call have a setting to never use one. The published site has no relay configured.

## Phone to Laptop

- Files and text go over an encrypted WebRTC connection straight between the two devices. The QR codes carry only connection details, never your files.
- The computer only accepts a reply to the code it showed. Someone who photographed an old code can't use it once the page has made a new one.
- Received files are saved or shown as pictures only. A file that claims to be a web page is saved as plain bytes, names are cleaned, and anything sent beyond a file's announced size is dropped.

## Secret Chat groups

- Group members all connect to the host's browser, which passes messages on. Every message is also encrypted end to end: a fresh AES-256-GCM key per message, locked for each member with a key from ECDH P-256 between that member and the sender. The host can only open the copy meant for it, and can't forge a message from another member.
- The group safety code is a hash of every member's public key. If the host or anyone else swapped a key, members would see different codes. It changes whenever someone joins or leaves.
- The host's browser does see who is in the group and when messages are sent.

## Walkie-Talkie

- Every connection is encrypted (DTLS-SRTP), but the channel isn't end to end: everyone connects to the browser that started it, and that browser passes each voice on to the others, so it hears everything.
- Your microphone is muted except while you hold the button and have the channel. The browser may still show the microphone as in use while the page is open.
- Nothing is recorded or stored.

## What this can't protect against

- Malware or a malicious browser extension on either device.
- Someone reading over your shoulder, or a screenshot.
- A change to the code if this GitHub account were taken over. The code is public and can be checked, but browsers run whatever is served at the time.
- The host of a game seeing the game's secrets. In Mafia and Clue Grid the host's browser holds every role or key. Mafia's narrator-only mode keeps the host out of the game.

## How it's tested

- `tests/security.test.js` sends Secret Chat, Video Call, and Watch Party malformed, oversized, and hostile messages (markup in names, text, and file names, impossible sizes and clock values) and checks that nothing breaks and no markup ends up on the page. It also feeds Secret Note damaged and hostile links.
- `tests/secret-chat.test.js` and `tests/video-call.test.js` check that the safety code is the same on both sides and changes when a connection key changes.
- `tests/secret-chat-group.test.js` checks group chats: every member gets the same code, a swapped key changes it, the host can't open a copy sealed for someone else, a message can't be passed off as another member's, and a late joiner can't read earlier messages.
- `tests/browser/secret-chat-mitm.html` runs a real man-in-the-middle attack in the browser: an attacker page intercepts both links and relays every message. The chat works, the attacker can read it, and the two safety codes differ, which is how you'd catch it. Open it from a local server (`python3 -m http.server`, then `/tests/browser/secret-chat-mitm.html`).
- The tests run on every push (see `.github/workflows/test.yml`).

## Reporting a problem

Please don't open a public issue for a security problem. Use GitHub's private reporting instead: on the repository page, open the Security tab and choose "Report a vulnerability". Include what you found, how to reproduce it, and which browser you used.
