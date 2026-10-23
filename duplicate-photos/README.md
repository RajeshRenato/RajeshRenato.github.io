# Duplicate Photos

Find duplicate and look-alike photos in a folder: exact copies, re-saved WhatsApp versions, resized ones and burst shots. See them side by side, keep the best, and free up the space. Nothing is uploaded.

## Use

- Choose a folder (your camera roll copied to a computer, Downloads, WhatsApp Images) or select many photos at once.
- Each group shows the best copy first, marked Best, with the others ticked for removal. Change the ticks as you like, and click a photo to see it larger.
- Strictness: further left finds only exact copies; further right also groups photos that look alike, such as burst shots.
- In Chrome and Edge, "Move selected to a Duplicates folder" moves the ticked photos into a new folder inside the one you chose, so you can look them over and delete it. In other browsers, download the list as CSV and delete them yourself.

Nothing is ever deleted by the page.

## How it works

- Exact copies have identical bytes, found with a SHA-256 fingerprint. Only files that share a size with another file get one, which keeps big folders quick.
- Look-alikes use a difference hash: the photo is shrunk to 9 by 8 grey pixels and each pixel is compared with its right-hand neighbour, giving 64 bits that barely change when a photo is resized, recompressed or brightened. Two photos are look-alikes when their hashes differ in only a few bits and their shapes match.
- The best of a group has the most pixels, then the biggest file, then is the oldest.
- The page is blocked from making network requests.

## Tests

`tests/duplicate-photos.test.js` checks that the hash matches a brightened copy and not a different picture, and that grouping finds exact copies and look-alikes at each strictness, keeps a different shape apart, and puts the best copy first.
