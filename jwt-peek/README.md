# JWT Peek

Paste a JSON Web Token and see its header and payload decoded. Decoding happens in your browser, so the token is never sent anywhere.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Shows the header and payload as formatted, colored JSON.
- Turns the `iat`, `nbf`, and `exp` claims into local dates. It also says whether the token has expired, how long until it does, and whether it is not valid yet.
- Warns when the header has `alg: "none"` (an unsigned token) or no `alg` at all.
- Explains what's wrong when the input isn't a three-part token or a part isn't valid JSON.
- A button loads a sample token that expires two hours from now.

It does not check the signature. That would need the secret or public key.
