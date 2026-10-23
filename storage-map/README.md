# Storage Map

See what's eating your storage. Pick a folder, like Downloads, Documents or a whole external drive, and every file shows up as a block sized by how much space it takes. Big forgotten videos and installers stand out straight away.

## Use

- Choose a folder, or drop one on the page.
- Click a folder's block to go inside it; the path at the top takes you back up. Hover any block for its name, size and where it is.
- Colour by folder or by type. The side panel shows space by type (videos, photos, documents, apps and installers) and the 40 biggest files in the folder you're looking at.

The page only reads file names and sizes. It never opens, changes or deletes your files.

## How it works

- The folder's files are listed by the browser, and each folder's total is the sum of everything inside it.
- The map is a squarified treemap: blocks are laid out in rows along the shorter side, adding a block to the row only while that keeps the blocks in it closer to square. Each folder shows one level of what's inside it.
- The page is blocked from making network requests.

## Tests

`tests/storage-map.test.js` checks that folder totals add up and file types are recognised, and that the treemap fills the box exactly, with no overlaps, areas in proportion, and big blocks close to square.
