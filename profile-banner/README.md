# Profile Banner

Make an animated SVG banner for your GitHub profile README. Type your name and a tagline, pick a theme, and download the file.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

Download `banner.svg`, commit it to your profile repo (`username/username`), and add `![banner](banner.svg)` at the top of the README. The copy button puts that line on your clipboard.

## What it does

- The banner is 960×240 and uses SVG animation, which GitHub renders: the name glows, the stars twinkle, and the cursor blinks.
- Four themes: synthwave sunset, deep ocean, terminal green, and ember. The grid floor, stars, and cursor can each be turned off.
- Star positions come from a hash of your name and tagline, so the same text always gives the same banner.
- Your text is escaped before it goes into the SVG.
- You can download the SVG or copy its source. Your settings are saved in `localStorage`, and nothing is sent anywhere.
