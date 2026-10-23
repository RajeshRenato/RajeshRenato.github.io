# Carousel Splitter

Turn a wide photo or panorama into a seamless Instagram carousel. When people swipe, the picture carries on from one slide to the next.

## Use

- Drop a photo, or paste one.
- Pick how many slides (2 to 10) and the shape: square, portrait 4:5, or landscape. The page suggests a count that fits the photo.
- Drag the photo to frame it, and zoom in if you like. The dashed lines show where each slide ends. "Fit whole photo" shows all of it, with a plain colour or a blurred copy of the photo behind.
- Try it on the phone preview, then save all the slides as a ZIP, save them one by one, or on a phone share them straight to Instagram. Post them in order.

## How it works

- Instagram shows carousel posts 1080 pixels wide, so the page lays the photo across a strip that many slides wide and cuts it into 1080-pixel slices, each saved as a high quality JPEG.
- The photo can be moved but never pulled off the strip, so no slide has an empty edge unless you choose to fit the whole photo.
- Everything happens in your browser. The page is blocked from making network requests.

## Tests

`tests/carousel-splitter.test.js` checks the slide sizes for each shape, the suggested count, and that the photo can't be dragged off the strip. `tests/zip.test.js` checks the ZIP it saves, including that Python can open it.
