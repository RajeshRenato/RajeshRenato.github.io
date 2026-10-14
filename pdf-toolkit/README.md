# PDF Toolkit

Merge PDFs, save some of their pages as a new file, split a file into single pages, and reorder, rotate, or delete pages. Everything happens in your browser. The files are never uploaded.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

Drop one or more PDFs on the page, or click to open them. All their pages go into one list, each tile showing the file it came from, its page number there, its size, and its orientation. Then:

- Drag tiles to reorder them, or use the arrow buttons on each tile.
- Rotate a page by 90 degrees, delete it, or tick it to select it. Rotate and delete also work on the whole selection.
- View shows the page as it will come out, in your browser's own PDF viewer.
- Save as one PDF writes every page in the current order. Save selected pages writes only the ticked ones. Split into single pages saves a ZIP with one PDF per page.

## What is kept

Pages are copied as they are: text, fonts, images, and vector drawings come across byte for byte, so text stays sharp and searchable. Links to websites and other annotations stay. These are not kept:

- Bookmarks (the outline).
- Form fields as a working form.
- Links that jump to another page in the file, since that page may not be in the output.
- Document info such as title and author.

Password-protected or encrypted PDFs can't be opened.

## How it works

- The reader is written from scratch. A tokenizer handles every PDF object type: numbers, names with #xx escapes, literal strings with nesting and escapes, hex strings, arrays, dictionaries, references, and streams.
- It finds the cross-reference data through startxref. It reads both classic xref tables and compressed xref streams (including the PNG predictors they use), follows the /Prev chain of incremental updates so the newest version of each object wins, and unpacks objects stored inside object streams. Compressed data is inflated with the browser's DecompressionStream.
- If the cross-reference data is broken, it rebuilds it by scanning the file for every "N G obj" and keeping the last one of each number.
- It walks the page tree from the catalog and works out each page's inherited resources, media box, crop box, and rotation.
- The writer builds a new PDF 1.7 file with a classic xref table. For each page it copies the page and everything the page refers to, giving the objects new numbers. Objects shared by several pages of the same file, like fonts, are copied once per output file. Inherited values are written onto each page, rotation is added to the page's /Rotate, and stream data is copied without decoding.
- The ZIP for splitting is written by hand, stored without compression, with a CRC-32 per file.

## Tests

`tests/pdf-toolkit.test.js` loads Chrome-made fixtures and a hand-built PDF with object streams, a predictor-compressed xref stream, and an incremental update. It checks merging, order, rotation, which links are kept, font sharing, rebuilding a broken file, refusing encrypted files, the lexer, and the split ZIP.
