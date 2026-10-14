# Secret Note

Write a note and get a link with the note encrypted inside it. Nothing is stored anywhere.

## How it works

- The note is compressed (deflate) and then encrypted in your browser with AES-256-GCM, using a fresh random key and IV for every link.
- Without a password, the key travels in the link. With a password, the key is derived from it with PBKDF2 (SHA-256, 600,000 iterations) and the link carries only a random salt.
- Everything sits after the `#` in the link. Browsers never send that part to a server, so not even GitHub Pages sees it. The page also sets `referrer` to `no-referrer`.
- GCM authenticates the ciphertext, so a damaged or tampered link is rejected instead of showing garbage.
- After a note is opened, the page removes it from the address bar.

## Limits

Because nothing is stored, a note can't be deleted, expire, or be limited to one view. Anyone with the link (and the password, if you set one) can open it, as often as they like. For anything sensitive, set a strong password and send it a different way than the link.

Long notes make long links; past roughly 4,000 characters some chat apps may cut the link off.

## Tests

`tests/secret-note.test.js` checks round trips (with emoji and line breaks), compression, password protection, that tampered links are rejected, and that opening a link clears it from the address bar.
