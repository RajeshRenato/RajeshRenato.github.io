# Markdown Pad

A markdown editor with the source on the left and a live preview on the right. The parser is written by hand, with no libraries, and everything stays in your browser.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Renders headings, bold, italic, strikethrough, inline code, fenced code blocks, links, images, ordered and unordered lists, blockquotes, and horizontal rules. Lists don't nest.
- Saves your text to `localStorage` as you type.
- Shows a word and character count.
- Downloads the source as `document.md`, or copies the rendered HTML to the clipboard.
- HTML in your input is escaped before parsing, so it shows as text instead of running.
