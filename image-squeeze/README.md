# Image Squeeze

Make images smaller. Compress them, resize them, convert them to JPEG, WebP, PNG, or AVIF, or fit them under a size limit. Nothing is uploaded, and everything runs on your device.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Fit under a size: type a limit like 200 KB and it finds the highest quality that fits. It shrinks the image only if quality alone isn't enough.
- Resize to a maximum width and height. Proportions are kept and images are never enlarged.
- Convert between JPEG, WebP, and PNG. AVIF appears as an option when the browser can encode it.
- Click a thumbnail to compare before and after with a slider.
- If re-saving in the same format and size would make a file bigger, it keeps the original and says so.
- Download all results as a `.zip`.

Re-saving also drops hidden photo details like location. Photos taken sideways come out upright.

## How it works

Images are decoded with `createImageBitmap` (which applies the EXIF rotation), drawn to a canvas, and re-encoded with `canvas.toBlob`. Large reductions are done in halving steps first, which keeps edges sharper than one big downscale. Transparent images converted to JPEG are flattened onto white.

"Fit under" runs a binary search on quality (7 steps between 0.3 and your quality setting). If nothing fits, it scales the image down by the square root of how far over the limit it was and searches again. Lossless PNG skips straight to scaling.

## Tests

`tests/image-squeeze.test.js` covers resizing, output types and file names, the fit-under search (with a stand-in encoder), and the zip writer and its CRC-32.
