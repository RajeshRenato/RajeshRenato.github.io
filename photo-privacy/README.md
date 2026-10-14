# Photo Privacy

See the hidden details inside a photo (where and when it was taken, which phone took it, serial numbers, embedded previews) and remove them before you share it. Photos never leave the page.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## How it works

Everything happens at the byte level, so the picture itself is never re-encoded.

- JPEG: it walks the segments up to the image data. EXIF (in APP1) is parsed as TIFF: the main directory, the EXIF sub-directory, the GPS directory, and the embedded thumbnail. XMP, IPTC, comments, multi-picture indexes, and data appended after the end of the image are reported too. Cleaning drops all of those and keeps the JFIF header, the ICC color profile, the Adobe color transform marker, and the compressed image data byte for byte.
- PNG: it reports and removes `tEXt`, `iTXt`, `zTXt`, `eXIf`, and `tIME` chunks.
- WebP: it removes the `EXIF` and `XMP ` chunks, clears their flags in `VP8X`, and rewrites the RIFF size.

If a JPEG has a rotation tag, cleaning writes a tiny new EXIF block holding only that tag, so the photo still shows the right way up.

Several cleaned photos can be downloaded together as a `.zip`, written by a small built-in zip writer (stored entries with CRC-32).

## Limits

HEIC photos from iPhones aren't supported. Most share sheets convert them to JPEG, and the camera can be set to "Most Compatible" in its settings.

## Tests

`tests/photo-privacy.test.js` runs against real JPEG, PNG, and WebP files in `tests/fixtures/` and checks every finding, that cleaning leaves only the orientation tag, that the JPEG image data stays byte for byte the same, and that the zip of cleaned photos is valid.
