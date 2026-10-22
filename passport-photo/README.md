# Passport Photo

Make a passport or visa photo at the right size from any photo. Line up the face with the guides, clean up the background, then download the photo or print a sheet of copies. Your photo never leaves your device.

## Use

1. Choose a photo, or take one on a phone. Stand in front of a plain wall, in even light, facing the camera.
2. Pick the size. There are presets for India (passport, visa, PAN card, and the 35×45 mm size many online forms use), the US, UK, Schengen countries, Canada, Australia, China, Japan, the UAE and Singapore, plus a custom size.
3. Drag the photo and zoom (scroll, pinch, or the slider) until the top of the head sits on the upper line, the chin on the lower line, and the face fills the oval. Straighten it if it's tilted, and adjust brightness and contrast if needed.
4. Tick "Clean up the background" to replace a plain wall with white, light grey or light blue.
5. Download the photo as a JPEG. For online forms, set the largest file size (20 KB, 50 KB and so on) and it's compressed to fit.
6. Or download a print sheet: as many copies as fit on a 4×6 inch photo print or on A4 or Letter paper, as a JPEG or a PDF. Print at actual size, not "fit to page".

## How it works

- The photo is drawn at 300 dots per inch into the exact size in millimetres, so a 2×2 inch photo is 600×600 pixels.
- Each size has the allowed height for the head, from chin to crown. The guides put the crown and chin lines for the middle of that range, with the green band showing how far the top of the head can move.
- Background clean-up samples the wall along the top and sides, then fills from the photo's edges into every neighbouring pixel close to that colour, stopping at the person. The boundary is softened over a few pixels so hair doesn't get a hard edge. It works on plain walls; patterned backgrounds need a plain wall photo.
- To fit a file size limit, the JPEG quality is found by binary search; if even low quality is too big, the photo is scaled down a little and tried again.
- On a 4×6 print, 2×2 photos go edge to edge, as photo labs print them, so six fit. On A4 and Letter there's a margin, because home printers can't print to the edge, and light lines mark where to cut. The PDF stores the photo once and places it on the page as many times as fit.

## Tests

`tests/passport-photo.test.js` checks that every preset's guides sit inside the photo, the pixel sizes at 300 DPI, how many copies fit on each paper and that they all stay on it, and that the PDF stores the photo once.
