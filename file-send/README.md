# File Send

Send files from your browser straight to someone else's. Nothing is uploaded: the files go directly from one device to the other.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

1. Choose the files, click "Create a send link", and send the link.
2. The other person opens it and gets a reply link to send back.
3. Open the reply link (or paste it in) and you're connected.
4. They see the file names and sizes and choose Accept or Decline. Once connected, either of you can send.

## How it works

- The two browsers connect over a WebRTC data channel. The send link and the reply link carry each side's connection details in compressed form, so there's no signaling server. A public STUN service helps the browsers find each other, but file data never goes through it.
- Files are read in 64 KB chunks and sent in order. At most about 1 MB waits in the send buffer at once, so memory use stays low and the connection isn't flooded.
- The receiver reports how much it has every 256 KB. The sender's progress bar, speed, and time left come from those reports. A file is only marked delivered once the receiver confirms it has every byte.
- Nothing is transferred until the receiver accepts the batch.

## Limits

- Received files are held in the browser's memory until you save them, so very large files (several GB) may not fit, especially on phones.
- Both pages need to stay open during the transfer.
- Some strict office or mobile networks block direct connections, and there's no relay to fall back on. Trying another network usually works.

## Tests

`tests/file-send.test.js` connects two copies of the page over an in-memory channel and checks that files arrive byte for byte only after the receiver accepts, that a declined batch is never sent, and that the other side can send back.
