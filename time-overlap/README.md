# Time Overlap

Plan a meeting across time zones. Add the cities people are in and see a grid of everyone's local time for each hour of your day, with the hours that suit everyone outlined in green.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Choose from a list of 30 cities and add up to 8, along with your own time zone.
- Each cell is colored by the local hour there: working (9:00 to 18:00), stretch (7:00 to 9:00 and 18:00 to 22:00), or probably asleep.
- Columns where every city is in working hours get a green outline. The current hour is highlighted.
- Each city shows its current time. The grid refreshes every 30 seconds.
- Your city list is saved in `localStorage`.

## How it works

Times come from the browser's `Intl` time zone data, so daylight saving changes are handled without any time zone tables in the page.
