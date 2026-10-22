# Phone to Laptop

Send photos, files, and text between your phone and your computer. Open the page on the computer, scan its code with your phone, and hold your phone up to the computer's camera. The two connect directly, and whatever you send goes straight across. No cable, no app, no account, and nothing is uploaded.

## Use

Open this page on your computer. It needs to be served over `https://` or `http://localhost` for the camera to work.

1. Point your phone's camera at the code on the computer's screen and open the link it shows.
2. Your phone shows a code of its own. Click "Turn on this computer's camera" and hold the phone up to it. (If the camera is already allowed, it turns on by itself.)
3. Both screens say Connected. Pick photos or files, or type or paste text, on either side.

Everything sent shows up on both screens. Received files have a Save button, and on phones a Share button too, which can save photos straight to the photo library. Links in text can be opened with a tap. Text can be copied with one click, and on the computer you can paste a screenshot or a file straight into the page to send it.

No camera on the computer? Under the phone's code is the same reply as text. Send it to yourself in a note or chat and paste it into "No camera here?".

It also works between two computers or two phones.

## How it works

- The devices connect with WebRTC, browser to browser. The connection is encrypted (DTLS), and files go over it in 64 KB pieces, with the sender slowing down whenever the receiver falls behind.
- WebRTC needs the two sides to swap connection details, which are normally around 800 characters each. That's too much for a QR code a laptop camera can read reliably, so the page packs them down to the few values that change: the ICE username and password, the certificate fingerprint, the DTLS role, and the network addresses with their priorities. That's about 130 bytes, and the full description is rebuilt on the other side. The computer's code is a version 10 QR code, and the phone's is about version 8.
- The computer reads the phone's code with the browser's built-in barcode reader where there is one (Chrome and Edge on Mac and Android), and otherwise with [jsQR](https://github.com/cozmo/jsQR) 1.4.0, which is included in this repo under `common/jsqr` with its Apache 2.0 license.
- QR codes are drawn with the same encoder as [QR Studio](../qr-studio/) (`common/qr.js`).
- Received files are only ever saved or shown as pictures. File names are cleaned, and a file that says it's a web page is saved as plain bytes so it can't open as one here. Data past the size a file announced is dropped.
- A public STUN service (Google or Cloudflare) tells each device its public address. Nothing else is contacted, and the page has a Content Security Policy that blocks anything outside this site.

On the same Wi-Fi the files go over your local network. On different networks they go over the internet directly, which usually works, but some mobile and office networks block it.

## Tests

`tests/phone-to-laptop.test.js` checks that connection details pack small and come back exactly (IPv4, IPv6, and private `.local` addresses, priorities kept, TCP dropped), that broken or foreign codes are refused, that the computer only takes a reply to its own code, that text and a 200 KB file go across byte for byte, and that hostile file names, types, and sizes are handled. The whole flow was also run in two Chrome windows, with the phone's code read from a camera feed by both the built-in reader and jsQR.
