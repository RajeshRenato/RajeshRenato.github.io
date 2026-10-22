# File Lock

Password-protect any file. Lock a document, photo or video, then send it or store it anywhere: only someone with the password can open it. Everything happens in your browser.

## Use

- Drop files (or click to choose), type a password twice, and press Lock. Each file downloads as `name.locked`. Suggest gives you a strong random password.
- Tick "Hide the file names too" and the locked files get random names; the real name comes back when they're unlocked.
- To open one, switch to Unlock (or just drop a `.locked` file; the page notices), type the password, and press Unlock. You get the original file back, with its name.
- There's no way to recover a forgotten password. Keep it somewhere safe, and send it a different way than the file.

## How it works

- The password is turned into a 256-bit key with PBKDF2 (SHA-256, 600,000 iterations) and a random salt, so guessing passwords is slow even with fast hardware.
- The file is encrypted with AES-256-GCM in 4 MB pieces, so big files don't have to fit in memory at once. Each piece has its own IV, made from a random base IV and the piece's number.
- Each piece is sealed together with the file's header, its number, and whether it's the last piece. Changing a single bit, cutting the file short, dropping or reordering pieces, or mixing pieces from two files is detected, and the file is refused instead of opened wrong.
- The first sealed piece holds the original name and type. A wrong password fails right there, so you're told it's the wrong password rather than that the file is damaged.
- The page's content security policy forbids every network request, so your files and password can't be sent anywhere.

The format: `FILELOCK`, a version byte, the iteration count, the 16-byte salt, the 12-byte base IV, and the piece size; then for each piece, its length followed by the ciphertext.

## Tests

`tests/file-lock.test.js` locks and unlocks a 9 MB file byte for byte, checks that wrong passwords, flipped bits, cut-short files, reordered pieces, and a missing last piece are each caught, hidden names, empty files, the password strength rating, and that the page can't make network requests.
