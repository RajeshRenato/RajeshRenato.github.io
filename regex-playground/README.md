# Regex Playground

Test a regular expression against your own text and see the matches as you type. It uses the browser's JavaScript regex engine, and nothing leaves the page.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Shows the match count, or the error message if the pattern or flags are invalid.
- Highlights every match in the text. An empty match shows as `∅`.
- Lists each match with its position, numbered groups (`$1`, `$2`), and named groups (`$<name>`). The list shows the first 100 matches, and counting stops at 1,000.
- Previews a replacement using `$1` and `$<name>`. The replace uses your flags as typed, so without `g` only the first match is replaced.
- Includes a short cheatsheet.
- The pattern, flags, test text, and replacement are saved in `localStorage`.
