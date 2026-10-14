# Unit Converter

Convert between units in eight categories: length, mass, temperature, data, speed, time, area, and volume. Type on either side and the other side updates, and a table shows the value in every unit of the category.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Data covers both decimal units (KB, MB, GB, TB) and binary units (KiB, MiB, GiB, TiB).
- Volume uses US gallons, quarts, pints, cups, and fluid ounces. In time, a month is 30.4375 days and a year is 365.25 days.
- The swap button exchanges the two units.
- Results are rounded to 10 significant digits. Values of a billion or more, or below 0.000001, are shown in scientific notation.
