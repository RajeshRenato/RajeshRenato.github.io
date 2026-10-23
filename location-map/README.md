# Location Map

See everywhere you've been. Load your Google Maps Timeline export and get a heatmap of your travels, your most visited places, how you got around, and how far you went each year.

## Use

- Android: phone Settings, Location, Location services, Timeline, Export Timeline data.
- iPhone: Google Maps, your profile picture, Your Timeline, the menu, Location and privacy settings, Export Timeline data.
- Older history: takeout.google.com, choose Location History, and download the ZIP.
- Drop the file here. Pick a year, drag and zoom the map, and click a place in the list to fly to it. "Map images" turns the background map off.

## How it works

- Google has used several formats over the years, and all are read: the new Timeline.json from Android (semantic segments and raw signals), the iPhone export (a list of segments with "geo:" positions), the monthly Semantic Location History files, and the old Records.json. Very large Records.json files are scanned in pieces instead of being parsed whole.
- The heatmap counts points into a grid the size of the screen, spreads each into a soft round spot, and colours them on a log scale, so a place you passed once still shows next to home.
- Places are visits grouped by place ID, or by being within about a hundred metres when there is no ID. "Home" and "Work" are Google's own guesses where the export has them; otherwise the place you spend most nights at is taken as home.
- The map is drawn on a canvas from Esri's basemap images. Those requests only say which part of the world is on screen; your location history never leaves your browser.

## Tests

`tests/location-map.test.js` reads all four export formats, checks visits, trips by way of travelling, years and place names, scans a Records.json in pieces, refuses files that aren't location history, and checks the map projection both ways.
