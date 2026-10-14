# Images to PDF

Turn photos, scans, and screenshots into one PDF, one image per page. JPEGs go into the PDF exactly as they are, so there is no quality loss. Everything happens in your browser. The images are never uploaded.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

Drop images on the page, click to choose them, or paste them. JPEG, PNG, WebP, and GIF work everywhere. HEIC photos work in browsers that can open them, like Safari. Then:

- Drag the pages to reorder them, or use the arrow buttons on each one.
- Rotate an image by 90 degrees, or remove it.
- Pick a page size (A4, Letter, or the same size as each image), the orientation, the margin, and whether the image fits on the page or fills it.
- Each tile shows how its image will sit on the page, and the total shows the expected file size.
- Name the file and press Make PDF.

## What it does

- Photos taken sideways on a phone come out the right way up. The camera's orientation tag is read from the JPEG, and the page turns the image instead of changing it.
- JPEG photos are copied into the PDF byte for byte. The output is about the size of the photos added together.
- Mirrored JPEGs (from some front cameras) and other formats are drawn onto a canvas first. Images with no see-through parts are saved as JPEG at quality 0.92. Images with see-through parts, like logos, are stored without loss, with their transparency kept.
- Grayscale and CMYK JPEGs are kept in their own color space.

## How it works

- The JPEG header is read directly: the frame marker gives the width, height, and number of color channels, the Adobe marker says whether CMYK values are stored inverted, and the EXIF block gives the orientation.
- The PDF is written from scratch as a PDF 1.7 file with a classic cross-reference table. Each page holds one image, placed with a transform that scales, centers, and turns it. With Fill, the image is clipped to the area inside the margin.
- JPEGs are stored with the DCTDecode filter, so PDF viewers decode the original data. Lossless images are stored as RGB with the FlateDecode filter, compressed with the browser's CompressionStream, and their transparency becomes a soft mask.
- The file info names the tool and the time it was made. Nothing else about you or your photos is added.

## Tests

`tests/images-to-pdf.test.js` reads the JPEG headers of the test images (rotated, mirrored, grayscale, CMYK), checks the page layouts, builds PDFs and checks the cross-reference table and that each JPEG is embedded byte for byte, and checks that see-through images get a mask.
