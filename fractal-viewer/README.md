# Fractal Viewer

A Mandelbrot and Julia set explorer. Click to zoom in on any point, switch between the Mandelbrot set and four Julia sets, pick a color palette, and raise the iteration count for more detail when you're zoomed in deep.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Click | zoom in 2.4x, centered on the click |
| Right-click | zoom out 2.4x |
| R or reset view | go back to the starting view |
| mode button | cycle Mandelbrot, then Julia 1 to 4 |
| Palette menu | neon, ember, or ice |
| detail slider | maximum iterations, 60 to 600 |

## How it works

- Each pixel runs z = z² + c until |z| passes 2 or the iteration limit is hit. For the Mandelbrot set z starts at 0 and c is the pixel. For a Julia set z starts at the pixel and c is fixed.
- The Julia constants are -0.7 + 0.27015i, -0.8 + 0.156i, 0.285 + 0.01i, and -0.4 + 0.6i.
- The image is drawn into canvas `ImageData` 36 rows at a time, with a short break between chunks so the page stays responsive. Starting a new zoom cancels the render in progress.
- The line under the canvas shows the current center and zoom level.
