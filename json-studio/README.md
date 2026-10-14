# JSON Studio

Paste JSON to check that it's valid, format or minify it, and browse it as a tree. It all runs in your browser, so the data never leaves the page.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Checks the input as you type. When it's invalid, it shows the parser's error with the line and column.
- The pretty view shows the JSON with colored keys, strings, numbers, and other values. The tree view lets you fold objects and arrays, opens the first two levels, and stops after 4,000 nodes.
- Format rewrites the input with two-space indentation. Minify shows the output on one line.
- Copy takes the output as shown (pretty or minified). Download saves it pretty-printed as `data.json`.
- Stats show the total number of keys and array items, the nesting depth, and the size in characters, pretty and minified.
