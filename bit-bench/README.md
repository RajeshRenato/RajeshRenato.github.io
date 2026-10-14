# Bit Bench

A 32-bit number playground. Type a value in decimal, hex, binary, or octal and the other fields update as you type. Click any of the 32 bits to flip it.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Shows the value as unsigned and as a signed 32-bit integer (two's complement).
- Accepts `0x`, `0b`, and `0o` prefixes, and ignores spaces and underscores. A field turns red when its input isn't valid for that base.
- Applies AND, OR, and XOR against an operand B, plus NOT, and shows each result in decimal and hex.
- Shifts by 0 to 31 bits with `<<`, `>>` (arithmetic, keeps the sign), and `>>>` (logical, fills with zeros).
