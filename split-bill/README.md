# Split Bill

Split trip, flat and dinner expenses with friends, like Splitwise but with no account and no server. See who owes whom, settle up in the fewest payments, and share the whole group as a link.

## Use

- Start a group, pick the currency, and add the people.
- Add each expense: what it was, how much, who paid, and how to split it. Split it equally among some or all of the group, by exact amounts, by shares (one person has two portions, say), or by percent.
- Pick who you are on this device and every expense shows what you lent or borrowed, and the top shows what you owe or get back overall.
- Balances shows everyone's total. Settle up lists the fewest payments that clear every debt. Mark one paid when it's done, or record any other payment between two people.
- Add someone's UPI ID and, for groups in rupees, Settle up shows a "Pay with UPI" button that opens a payment app with the amount filled in, and a QR code to scan from another phone.
- Share sends the group as a link (or a QR code). When a friend opens it, they get their own copy. If they add expenses and share it back, opening their link merges the two: everything from both copies is kept, and where the same expense was edited in both, the newer edit wins. Deletions carry over too.
- Export CSV gives a spreadsheet with every expense, each person's share, and the balances.

## How it works

- Amounts are kept as whole numbers of paise or cents, never fractions, so totals can't drift. Splits use the largest remainder method: everyone gets their exact share rounded down, and the leftover paise go to the shares that were rounded down the most. The pieces always add up to the amount.
- Settling up repeatedly matches the person who owes the most with the person owed the most and has one pay the other as much as possible. That clears everything in at most one payment fewer than the number of people.
- Groups are saved in this browser. A shared link holds the group in its address, after the `#`, compressed with deflate and encoded in base64url. Browsers never send that part to any server.
- A link could come from anyone, so before a shared group is used, every field is checked: known currency, whole positive amounts, payers and shares that belong to people in the group, and size limits. Names and descriptions are always shown as text, never as page markup.

## Tests

`tests/split-bill.test.js` checks that splits add up exactly in every mode, that balances net to zero and the settle-up plan clears every debt in the fewest payments, sharing and merging (newer edits and deletions win), that hostile links are refused and markup in names stays text, and the UPI link format.
