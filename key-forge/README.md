# Key Forge

Password and passphrase generator, entirely client-side using `crypto.getRandomValues` with rejection sampling (no modulo bias).

- **Password mode:** 8–64 chars, per-charset toggles, guaranteed one char from each selected set, optional ambiguous-character exclusion
- **Passphrase mode:** 3–10 random words, custom separator, capitalization, optional number
- Live entropy estimate in bits with a strength meter

Nothing is stored or transmitted — refresh and it's gone. Single HTML file. Open `index.html` to use.
