# Diff Deck

Paste two versions of a text and see them side by side, with added, removed, and changed lines marked. On a changed line, the part that actually differs is highlighted.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## How it works

- Lines are compared with a longest common subsequence diff. Removed lines followed by added lines are paired up and shown as changed.
- On each changed pair, the common start and end of the two lines are left plain and the part in between is highlighted.
- The header counts added and removed lines. Swap exchanges the two sides, and Sample loads an example.
- Each side is limited to 1,500 lines. Lines past that are ignored.
- Both texts are saved in `localStorage`, so they are still there when you come back.
