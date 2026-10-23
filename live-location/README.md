# Live Location

Share your live location with family or friends over a link, and see where they are, on one map. No app, no account, and no server: locations go straight from phone to phone, and are gone when you close the page.

## Use

- Press "Share with family or friends" and send each person their own invite. They open it, press Join, and send back the reply link it gives them. Open their reply (or paste it in) and they're on the map.
- Everyone sees everyone: names, how far away, when each was last updated, speed when moving, and battery. Tap a person to centre the map on them, or "Directions" to open directions in Google Maps.
- "Stop sharing" stops your location. "Just show where I am" shows your own location without inviting anyone, and you can invite people later.
- Keep the page open. Phones pause location when the screen goes off or you switch apps; the page keeps the screen on while sharing where it can, and picks up again when you come back.

## How it works

- Location comes from the browser's geolocation, with high accuracy. A new position is sent only when you've moved, or every 15 seconds, so a phone sitting still doesn't keep sending.
- It uses LinkPlay for the connection, the same as the games on this site. Every guest connects to the host, and the host passes each person's position on to everyone else, tagged with who it's from. Someone who joins late gets everyone's last position straight away. The connection is encrypted browser to browser.
- The map is drawn on a canvas from Esri's street map images, which only learn which part of the world is on screen.

## Tests

`tests/live-location.test.js` connects a host and two guests and checks that everyone sees everyone's position and when someone stops, that a late joiner gets the latest positions, that bad positions are ignored, and that a phone sitting still doesn't keep sending.
