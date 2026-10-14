# Type Velocity

A typing speed test that runs for 30 or 60 seconds. The timer starts on your first keystroke, and each letter turns green or red as you type it.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Words are drawn at random from a list of common English words. Press space to finish a word. Words typed wrong are marked red.
- Speed shows while you type. At the end you get words per minute, accuracy, and the number of words typed correctly.
- WPM counts correct characters (including the space after each correct word), divides by 5, and divides by the minutes elapsed. Accuracy is correct characters over all characters typed.
- Your best WPM is saved in `localStorage`, separately for 30 and 60 seconds.
- After a test you can download a PNG scorecard with your result.

## Shortcuts

| Key | Action |
| --- | --- |
| Space | Finish the current word |
| Tab | Restart with new words |
