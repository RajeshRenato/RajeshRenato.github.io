# Bank Statement Insights

Drop in your bank statement and see where the money really goes: spending by category, the places and people you pay most, food delivery and shopping, subscriptions and EMIs that repeat every month, and how each month compares. Your statement is read in your browser and never uploaded.

## Use

- Download a statement from your bank's app or net banking as PDF, CSV or Excel (.xlsx). CSV and Excel give the most accurate results. Drop in several months, or several accounts, at once; the same transaction in two overlapping statements is only counted once.
- Locked PDF? Type the password when asked (often your date of birth or customer ID).
- Pick a month or see everything. Click a category to see only that.
- Change any transaction's category and every payment to that merchant follows, now and next time.
- Download the categorised CSV to keep or open in a spreadsheet.

## How it works

- Spreadsheets and CSV files are read by finding the heading row (date, narration, debit, credit, balance and their many bank-specific names). PDFs are read with Mozilla's pdf.js; each line becomes cells, and amounts are matched to columns by where the headings sit on the page.
- Where a statement has one amount column with no Dr or Cr, the running balance decides whether money went in or out. Statements listed newest first are put in date order.
- The payee comes from the narration: the name in a UPI, NEFT or IMPS entry, or the merchant on a card payment, with bank codes, reference numbers and IFSC codes left out.
- Categories come from a list of common Indian merchants and words (Swiggy, Zomato, Blinkit, Uber, IRCTC, electricity boards, SIPs, EMIs and so on). UPI payments to a person's name are counted as money sent to people.
- Repeats every month: the same payee in three or more months, for nearly the same amount each time.
- Your category changes are saved in this browser by merchant. The page is blocked from sending anything over the network.

## Tests

`tests/bank-insights.test.js` reads statements with separate debit and credit columns, one amount column with Dr/Cr, signed amounts listed newest first, month-first dates, an Excel file and PDF lines; checks payees and categories for common narrations, that a chosen category sticks to its merchant, and which payments count as monthly repeats.
