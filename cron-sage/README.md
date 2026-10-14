# Cron Sage

Type a five-field cron expression and get a plain English description of it, along with the next 6 times it will run and how far away each one is.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Fields are minute, hour, day of month, month, and weekday.
- Supports `*`, steps (`*/n`), ranges (`a-b`, optionally with a step), comma lists, and three-letter month and weekday names. Weekday 7 is treated as Sunday, like 0.
- When both day of month and weekday are restricted, a day matches if either one does. This is how standard cron behaves.
- If the expression is invalid, it names the field that's wrong.
- Run times use your local time zone and look up to two years ahead. The countdowns refresh every 30 seconds.
- Presets cover common schedules such as every 5 minutes, weekdays at 9am, and monthly.
