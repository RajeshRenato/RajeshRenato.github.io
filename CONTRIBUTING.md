# Contributing

Issues and pull requests are welcome, no need to ask first.

## Setup

Nothing to install:

```bash
python3 -m http.server 8742
```

Then open http://localhost:8742.

## Tests

Needs Node 18 or newer, no packages:

```bash
node --test
```

The tests check that every project is complete and linked from the hub, that all scripts compile, and they play through the bigger games headlessly. They also run on every pull request.

## Rules

- Plain HTML/CSS/JS. No frameworks, npm packages, build step, or CDN scripts.
- Each project is self-contained in its own folder.
- Should work in Chrome, Firefox, and Safari, on desktop and mobile. Games need touch controls.
- No analytics, ads, or third-party requests. The one exception: the online games (everything built on `linkplay/`) use public STUN servers to set up a direct browser-to-browser connection.
- Keep comments short, and only where the code isn't obvious.

One fix or feature per PR, and mention how you tested it.

## Bugs

Include the project, your browser and device, and steps to reproduce. For the puzzle games, paste the Share link too, since it has the seed.

## Adding a project

- Copy `template/` to a new folder, lowercase-hyphenated and named after what it is. The template's README lists what to rename.
- Set the page's `<title>` to "Name | the words people would search for", for example "Chess | play chess online with a friend or the computer".
- Add a 1200×630 `og.png`. `python3 scripts/og-card.py project ...` makes one from a screenshot (it needs Pillow).
- Prefix localStorage keys with something short and unique to the project, and wrap access in try/catch.
- Write a thumbnail function that draws the hub card's live preview. It gets `(g, w, h, c, t)` and draws a full frame; `t` is 0 for the still image and counts up on hover. See the `TH` object in the root `index.html` for examples.
- Run `node scripts/site.js add <folder> --section "Games" --color "#28e0ff" --thumb <key> --thumb-file <file.js> --desc "One line."`. It adds the hub card and README row, updates the counts, and builds the page's about section, search tags, and sitemap entry from your README.
- `node --test` will tell you if anything is missing.

## Open tasks

- Touch controls for Breach
- Type Velocity with mobile keyboards
- Colorblind palettes for Penta and Flood Rush
- Keyboard focus and screen reader labels in the tools

## License

Contributions are MIT licensed, same as the rest of the repo. Please follow the [code of conduct](CODE_OF_CONDUCT.md).
