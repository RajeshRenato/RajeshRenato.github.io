# PDF Unlock

Remove the password from PDFs you already know the password for: bank statements, e-Aadhaar, salary slips, Form 16, credit card bills. Type the password once here and the saved copy opens without it from then on. Files and passwords never leave your browser.

## Use

- Drop one or more PDFs. Files that only have restrictions (no printing or copying) and open without a password are unlocked straight away.
- For files that need a password, type it and press Unlock. Not sure which one it is? Put a few guesses on separate lines, and each file is tried with all of them.
- Download each unlocked copy. It's saved as the original name with "-unlocked" added.
- "Common passwords for Indian documents" lists the usual patterns, such as the first four letters of your name in capitals plus your year of birth for e-Aadhaar.

This removes a password you know. It does not guess or crack unknown passwords.

## How it works

- PDF encryption keeps each string and stream in the file encrypted with a key worked out from the password. The page reads the file's security settings, works out the key the way the PDF standard describes, and checks it against the file's own check values.
- All the standard kinds are handled: 40-bit and 128-bit RC4 (MD5 and RC4 written here in plain JavaScript), 128-bit AES, and 256-bit AES from both the older Acrobat 9 scheme and the current PDF 2.0 one. AES uses the browser's built-in Web Crypto.
- Passwords are tried as UTF-8 and as Latin-1, since PDF makers differ on how they turn non-English letters into bytes.
- Once the key is right, every object is decrypted and the whole file is written out again without its encryption settings. Text, images, fonts, bookmarks and the document title are kept.
- The page is blocked from making any network requests, so neither the files nor the passwords can be sent anywhere.

## Tests

`tests/pdf-unlock.test.js` unlocks files made with 40-bit RC4, 128-bit RC4, 128-bit AES and both 256-bit AES schemes (including a non-English password), checks that wrong passwords are refused and that the owner password also works, opens a restrictions-only file, and checks MD5 and RC4 against known answers.
