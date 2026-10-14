# QR Studio

QR codes for links, Wi-Fi, contacts, email, text messages, and phone calls, with your own colors, shapes, and logo. Download as PNG or SVG. No watermark and no tracking: the code points straight at your content, not at a redirect.

## How it works

The encoder is written from scratch, following ISO/IEC 18004:

- picks numeric, alphanumeric, or byte (UTF-8) mode automatically
- chooses the smallest of the 40 versions that fits, at the error correction level you pick
- adds Reed-Solomon error correction over GF(256), split into blocks and interleaved as the standard specifies
- places function patterns, format and version information, and data, then tries all 8 masks and keeps the one with the lowest penalty score

Adding a logo raises error correction to the highest level so the covered modules can be recovered. Finder patterns are always drawn square, even in the dot and rounded styles, so scanners lock on quickly.

Wi-Fi codes use the `WIFI:` format with special characters escaped, contacts use vCard 3.0, and email and phone codes use `mailto:` and `tel:` links.

## Tests

`tests/qr-studio.test.js` checks data capacities, the textbook "HELLO WORLD" data and error correction bytes, format and version information bits, alignment pattern positions, the 2,953-byte limit, and the Wi-Fi and contact builders. Generated codes were also scanned with Chrome's `BarcodeDetector` across versions, levels, modes, shapes, and with a logo.
