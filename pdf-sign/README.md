# PDF Sign & Fill

Sign a PDF and fill it in, in your browser. Type text anywhere on a page, add the date, checkmarks, and crosses, and draw, type, or upload your signature and initials. The file is never uploaded.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

Open a PDF or drop it on the page. Then pick a tool and click the page where it should go:

- Text and Date put a line of text where you click. Type to change it; Enter starts a new line. A− and A+ change the size of the selected text.
- Check and Cross put a mark where you click, as many times as you like.
- Signature and Initials ask you to make one first: draw it with a mouse, finger, or pen, type your name in a handwriting font, or upload a photo of it on paper (the paper turns transparent). Tick "Remember on this device" to keep it for next time.
- Drag a mark or signature to move it, or drag its corner to resize it. Text moves by the handle on its left. The × removes anything, and so do Delete and Backspace.
- Black and blue work for text, marks, and signatures.

Save signed PDF downloads a new file with "-signed" added to the name.

## What you get

Text and marks are drawn into the page itself, so they look the same in every PDF viewer and can't be dragged around by whoever opens the file. Text in Latin letters is real text in Helvetica, so it stays sharp and can be searched and copied. Text in other scripts goes in as a high-resolution picture. Signatures are pictures with a transparent background.

This isn't a certificate-based digital signature. It's the same as signing a printout: the PDF shows your signature, but nothing proves who added it.

As in [PDF Toolkit](../pdf-toolkit/), the saved file keeps every page as it was, along with links, but not bookmarks, the document title and author, or working form fields. Form fields still show what they showed before. Password-protected PDFs can't be opened.

## How it works

- Pages are drawn by Mozilla's [pdf.js](https://mozilla.github.io/pdf.js/), version 4.10.38, which is included in this repo under `common/pdfjs` with its Apache 2.0 license. It runs from this site, so nothing is fetched from anywhere else.
- Saving uses the same PDF reader and writer as PDF Toolkit (`common/pdf-core.js`). Each page with something on it gets two new pieces of content around its own: one before that saves the drawing state, and one after that restores it and then draws your additions. Your additions can't be shifted or clipped by whatever the page's own content leaves behind.
- Everything is placed in screen coordinates and turned into the page's coordinates with the inverse of the matrix pdf.js used to draw it, so rotated pages and pages with an offset media box come out right.
- Signatures and pictures of text are stored as compressed RGB images with a separate grayscale soft mask for transparency.
- The page has a Content Security Policy that stops it from loading or sending anything outside this site.

## Tests

`tests/pdf-sign.test.js` signs Chrome-made PDFs and reads the result back with the same parser. It checks that additions sit on top of the original content, that brackets and backslashes in text are escaped, that the page's own fonts are kept, that signatures keep their transparency, that untouched pages are unchanged, that other scripts fall back to pictures, and that only valid saved signatures are read back from storage. A file signed in Chrome was also checked in macOS's own PDF renderer.
