# Key Forge

Generate passwords and passphrases in your browser, with an estimate of how strong each one is. Nothing is saved or sent anywhere, so a refresh clears it.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Password mode makes passwords of 8 to 64 characters. You choose any mix of lowercase, uppercase, digits, and symbols, and every set you pick appears at least once. You can also leave out look-alike characters (`I`, `l`, `1`, `O`, `0`, `o`).
- Passphrase mode picks 3 to 10 words from a built-in list of 549 five-letter words. You can set the separator, capitalize each word, and add a number from 0 to 99 to one of the words.
- The entropy estimate assumes an attacker knows your settings. The meter goes from weak (under 40 bits) to excellent (100 bits or more).

## How it works

Randomness comes from `crypto.getRandomValues`. Values that would bias the result toward some characters are thrown away and drawn again (rejection sampling), and the final password is shuffled the same way.
