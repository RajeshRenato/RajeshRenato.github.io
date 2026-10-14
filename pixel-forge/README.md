# Pixel Forge

A small pixel art editor. Draw on a 16×16 or 32×32 grid and export the result as a PNG.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Tools: draw, erase, fill (flood fill of touching cells with the same color), and pick (eyedropper).
- A 16-color palette, plus a color picker for any other color.
- Undo goes back up to 40 steps.
- Empty cells are transparent and shown as a checkerboard.
- Your drawing is saved in `localStorage`. Starting a new canvas clears it and the undo history.
- PNG export scales each pixel to 16×16, so a 32×32 drawing becomes a 512×512 image with a transparent background.
