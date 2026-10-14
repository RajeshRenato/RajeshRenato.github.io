# Video to GIF

Trim a clip from a video and turn it into a GIF, with control over width, frame rate, speed, and looping. It runs on your device, so nothing is uploaded and there's no watermark.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## How it works

- Frames: the video plays in a `<video>` element. The tool seeks to each frame time in the clip and copies it to a canvas at the chosen width. Speed changes how far apart in the video the frames are taken, not the delay between them.
- Palette: pixels sampled from all frames go through median cut to build one shared palette of 255 colors. The 256th slot is kept for transparency. Colors are matched with a weighted distance that follows how the eye sees them, and the matches are cached by 15-bit color.
- Dithering is optional and uses Floyd-Steinberg error diffusion.
- Smaller files: each frame after the first stores only the pixels that changed. Unchanged pixels become transparent and the frame is cropped to the changed area. Frames that didn't change at all are merged into the previous frame's delay.
- Encoding: GIF89a with LZW compression (variable code size up to 12 bits, dictionary reset at 4096 codes) and a NETSCAPE2.0 block for looping. The encoder runs in a Web Worker built from the same functions, so the page stays responsive.

Clips are capped at 400 frames to keep files and memory use reasonable.

## Tests

`tests/video-to-gif.test.js` checks the encoder's output with an independent GIF decoder (LZW round trips with dictionary resets, median cut colors, frame count, timing, positions, and dithering) and checks that clip planning respects speed, frame rate, and video length.
