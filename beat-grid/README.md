# Beat Grid

A 16-step drum machine with six tracks: kick, snare, closed hat, open hat, clap, and bass. Click cells to build a pattern, set the tempo anywhere from 60 to 180 BPM, and share the beat as a link. Every sound is synthesized with Web Audio, so there are no sample files.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## Controls

| Input | Action |
| --- | --- |
| Click a cell | turn that step on or off |
| Space | play or stop |
| Tempo slider | set BPM (60 to 180) |
| clear | empty the grid |
| random | make a new pattern |
| copy share link | copy the URL, which holds the whole beat |

## How it works

- The kick is a sine sweep from 150 Hz down to 42 Hz. The snare, hats, and clap are filtered white noise, and the clap is three noise bursts 18 ms apart. The bass is a 55 Hz square wave through a low-pass filter.
- A timer runs every 25 ms and schedules any notes that fall in the next 120 ms on the audio clock, so timing doesn't depend on the timer itself being exact.
- The pattern is saved in the URL hash as 26 hex characters: two for the tempo, then four per track with one bit per step. Opening a link loads that beat.
- Random puts the kick on every beat (plus the odd extra hit), the snare on beats 2 and 4, and scatters hats and the other tracks at random. A fresh page with no beat in the URL starts with a random pattern.
