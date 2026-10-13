# JWT PEEK

Paste a JWT and see its decoded header and payload with syntax coloring — **entirely client-side, the token never leaves the page**. Time claims (`iat`/`nbf`/`exp`) are rendered as human dates with live expiry status, and `alg:"none"` tokens get a loud warning. Signatures are *not* verified (that needs the secret/key) and the UI says so. Includes a sample-token generator.

Single HTML file — open `index.html` to use.
