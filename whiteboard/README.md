# Whiteboard

A whiteboard you can share with friends over a link. Draw with a pen or marker, add lines, arrows, boxes, circles, and text, and save the board as a PNG. Everyone sees each other's strokes and cursors as they happen. It also works alone.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Drawing together needs the page served over `http://` or `https://`, not opened as a file.

To draw with friends: click "Play with friends" (or "Draw with friends" if you started alone) and send each friend their own invite. Each of them sends back a reply link; open it in your browser or paste it in, then press Start. Whatever is already on the board comes with you, and friends who join later get the board as it is.

## Tools

| Tool | What it does |
| --- | --- |
| Pen | freehand line |
| Marker | wide, see-through line for highlighting |
| Line, Arrow | drag from start to end |
| Box, Circle | drag a corner to the opposite corner. Hold Shift for a square or a circle. |
| Text | click where it goes, type, press Enter |
| Eraser | drag over anything to remove it, including other people's work |

Undo (or Ctrl+Z) removes your own last item, never someone else's. Only the host can clear the whole board. Save PNG downloads the board at 1600 by 1000 pixels. On a phone, turn it sideways for a bigger board.

## How it works

The board is 1600 by 1000 units and scales to fit the screen, so everyone sees the same layout on any device. Each item (a stroke, shape, or text) has an ID and an owner. Pen strokes are sent while you draw, as batches of points about 20 times a second. Shapes are sent when you let go.

It uses [LinkPlay](../linkplay/) for the connection. Every guest is connected to the host, and the host passes each change on to everyone else and keeps the full board for people who join late. The host also checks that an undo only removes the sender's own items.

## Tests

`tests/whiteboard.test.js` draws with the pen and shapes, undoes, erases, and clears, then runs a host and two guests over in-memory channels: strokes reaching everyone, a late joiner getting the board, and the undo and clear rules.
