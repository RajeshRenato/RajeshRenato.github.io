# CSV Viewer

Paste CSV or TSV, or open a file, and see it as a table you can sort, filter, and export as JSON. The file is read in your browser and never uploaded.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- The parser handles quoted fields, doubled quotes inside them, and commas or line breaks inside quotes.
- The delimiter is picked from the first line: comma, semicolon, tab, or pipe.
- A checkbox controls whether the first row is the header. Without a header, columns are named `col1`, `col2`, and so on.
- Click a column header to sort, and click again to reverse. A column where every value is a number sorts numerically.
- The filter box keeps rows where any cell contains the text, ignoring case.
- Copy or download the current view (filtered and sorted) as JSON, with one object per row.
- The table shows the first 2,000 rows. Filtering, sorting, and export still use all of them.
