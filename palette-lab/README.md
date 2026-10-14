# Palette Lab

Generate five-color palettes by pressing space. Lock the colors you like and keep rolling the rest.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Palettes follow an analogous, complementary, or triadic hue scheme, or are fully random ("chaos"). The default, auto harmony, picks one of the first three each time.
- Locked colors stay put when you generate a new palette.
- Click a color to copy its hex code. Each swatch also shows its HSL values.
- Export gives the palette as CSS custom properties, a JSON array, and a share link.
- The five hex codes are kept in the URL after `#`, so the link opens the same palette. The last palette is also saved in `localStorage`.

## Shortcuts

| Key | Action |
| --- | --- |
| Space | New palette |
