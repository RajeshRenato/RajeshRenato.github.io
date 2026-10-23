# Speed Reader

Read two to three times faster. Paste an article, or open a PDF, EPUB or text file, and the words appear one at a time in the same spot, so your eyes stop jumping along the line. The red letter is where your eye should land.

## Use

- Paste text and press Start reading, or open a file. Try a sample shows how it works.
- Space plays and pauses. The arrow keys go back or forward a sentence, and up and down change the speed. Click the bar to jump anywhere.
- When paused, the text around the current word shows below; click any word to jump there.
- Show two or three words at a time if you prefer, and use Full screen to focus.
- It remembers where you stopped in each document, on this device.

Start around 300 words a minute. Most people can follow 450 to 500 after a few minutes of practice.

## How it works

- This is called RSVP, rapid serial visual presentation. Each word is lined up on its optimal recognition point, a letter a little left of the middle, so the eye never moves.
- Words stay a little longer at the end of a sentence (but not after "Dr." or "e.g."), at commas, at the end of a paragraph, on long words and on numbers, and it starts a little slower for the first few words after you press play.
- PDFs are read with Mozilla's pdf.js and their lines joined back into paragraphs. EPUB books are read chapter by chapter in the book's own order; copy-protected books can't be opened.
- Nothing is uploaded. Where you stopped is saved in this browser.

## Tests

`tests/speed-reader.test.js` checks how text is split into words, sentences and paragraphs, the timing of pauses, where the red letter falls, and reading an EPUB in order and refusing a copy-protected one.
