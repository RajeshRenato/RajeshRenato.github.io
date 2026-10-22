# Invoice Maker

Make invoices, receipts and quotes as a PDF, with GST, HSN codes, the amount in words and a UPI payment QR built in. Your business details, clients and past invoices are saved in your browser for next time.

## Use

- Fill in your business once: name, address, GSTIN or tax ID, contact, bank details, an optional logo and accent colour, and your UPI ID if you want a "scan to pay" code on rupee invoices.
- Pick the document (tax invoice, invoice, receipt, quotation, proforma, bill of supply), the currency, the dates, and the tax: GST, VAT, sales tax, or none.
- Add the client, or pick a saved one. Save client keeps them for next time.
- Add items with a description, quantity, rate and tax rate (and an HSN or SAC code with GST). Add a discount, shipping, and any amount already paid.
- The invoice on the right updates as you type. Download PDF saves it as a PDF. Print prints it, or saves it as a PDF from the print dialog; use that if your text has letters outside the Latin alphabet, such as Hindi.
- Invoices are numbered in order from your prefix (INV-0001, INV-0002 and so on). Saved invoices are listed at the bottom; open one to edit it, duplicate it with New invoice, or mark it paid.

## How it works

- Each line is quantity times rate, less the discount; tax is worked out per rate on what's left. For GST within a state, each rate splits into equal CGST and SGST; for a customer in another state it's IGST. Amounts are rounded to the paisa at each step, and the total can be rounded to the nearest rupee with the difference shown as round-off.
- The amount in words uses lakh and crore for rupees, and thousand, million and billion for other currencies, with paise, cents or pence.
- The PDF is written from scratch with real text in the built-in Helvetica fonts, so it's small and sharp and the text can be searched and copied. Text is measured with the font's character widths to wrap descriptions and right-align amounts. Long invoices continue onto more pages, repeating the table header and numbering the pages.
- Those built-in fonts have no rupee sign, so the PDF writes "Rs." while the page and printed copy show ₹. The UPI code is the standard `upi://pay` link with the balance due and the invoice number.

## Tests

`tests/invoice-maker.test.js` checks GST with CGST and SGST or IGST, discounts, shipping, payments, VAT and round-off; the amount in words for rupees and other currencies; that the PDF is a valid A4 file with the invoice text in it and long invoices run onto more pages; and invoice numbering.
