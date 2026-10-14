# Screen Recorder

Record your screen, a window, or a browser tab, with your microphone, the screen's own sound, and an optional camera bubble. No install, no watermark, and the video is saved straight to your computer.

Needs a desktop browser (Chrome, Edge, Firefox, or Safari). Phones and tablets don't let web pages record the screen.

## Features

- Microphone and screen audio, mixed into one track
- A round camera bubble in the corner, mirrored like a selfie view
- 3-second countdown, pause and resume, live timer and file size
- Stop from the page or from the browser's own "Stop sharing" button
- Preview before downloading

## How it works

The screen comes from `getDisplayMedia` and the microphone and camera from `getUserMedia`. With the camera on, both videos are drawn onto a canvas each frame and the canvas stream is recorded; otherwise the screen stream is recorded directly. When there's more than one audio source, they're mixed through a Web Audio `MediaStreamDestination`, since recorders only reliably keep one audio track.

`MediaRecorder` writes MP4 when the browser supports it, and WebM otherwise. Browsers write WebM recordings without a duration, which leaves many players unable to show the length or seek. After recording, the page walks the file's EBML structure, finds `Segment > Info`, and inserts a `Duration` element (or updates one that's there), resizing `Info` and, if needed, the `Segment`.

## Tests

`tests/screen-recorder.test.js` covers the WebM duration fix on minimal WebM files (unknown and known segment sizes, files that already have a duration), format selection, and formatting. The full flow was also run in Chrome with a captured tab, a fake microphone and camera, a pause, and both MP4 and WebM output; without the fix the WebM reported its duration as `Infinity`, with it 3.07 s and seekable.
