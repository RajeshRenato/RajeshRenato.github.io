# Morse Coder

Translate text to Morse code and back as you type, then play it as sound. It also has a trainer that plays a random character for you to name.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Covers letters, digits, and common punctuation. In the Morse box, letters are separated by spaces and words by `/`. A code it doesn't recognize shows up as `�`.
- Plays the code as a 620 Hz tone at 8 to 30 words per minute, and can flash the screen in time with it.
- The trainer plays a random letter or digit and shows its code. Type the character on your keyboard. It tracks your streak and keeps your best streak in `localStorage`.

## How it works

Timing follows the PARIS standard: one unit lasts 1.2 / WPM seconds. A dot is 1 unit and a dash is 3. The gap is 1 unit inside a letter, 3 between letters, and 7 between words.
