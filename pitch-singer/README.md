# Pitch Singer

Sing along and see your voice as a line against the melody, scored like karaoke. It also has an ear trainer that plays a note for you to sing back, and a precise tuner for your voice or an instrument. The microphone stays on your device.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. The microphone needs `https://` or `http://localhost`. Headphones help when you play the tune, so the speaker doesn't sing along with you.

### Sing

Pick a song. Hear the tune plays the melody once. Start singing gives you four clicks to count in, then the notes scroll past a line, with the words on them and the whole line of lyrics underneath. As you sing, your voice draws itself in: gold when you're on the note, white when you're off. Notes turn green, orange, or red behind you, and the score counts up.

Any octave counts, so a deep voice and a high voice score the same for the same tune. The speed can be slow, normal, or fast, and "Tune plays" sets how high Hear the tune plays it. Your best score for each song is kept in this browser, with up to three stars.

The songs are all public domain: Twinkle, Twinkle, Little Star; Mary Had a Little Lamb; Row, Row, Row Your Boat; Are You Sleeping (Frère Jacques); Ode to Joy; Jingle Bells; and Happy Birthday.

### Note Match

A note plays and its name shows. Sing it back and hold it for a moment. A dot shows how far off you are, and a bar fills while you're on it. Ten notes, scored for how close and how fast you got there. Any octave counts here too.

### Tuner

Sing or play a note to see its name, its frequency, and how many cents sharp or flat it is. Within 5 cents, it shows in green. Pick an instrument (guitar, drop D, bass, ukulele, violin, viola, or cello) to tune to its strings, or leave it on any note. The reference A can be set from 432 to 444 Hz. It also keeps track of the lowest and highest notes you've held, to show your vocal range.

## Scoring

Every frame (about 60 a second) is scored against the note you should be singing: within 25 cents (a quarter of a semitone) is full marks, within 60 cents is 60%, within a semitone is 25%, and anything further or silence is 0. A note's score is the average over its length, leaving a little room at the start for reaction time and the microphone's delay. The song's score is the average over its notes. Three stars at 85%, two at 70%, one at 50%.

## How it works

- Pitch is found with the YIN algorithm (de Cheveigné and Kawahara, 2002), written from scratch: the difference between the sound and shifted copies of itself, normalized, then the first dip below a threshold, refined with a parabola between samples. It works from 55 Hz to 1400 Hz, which covers voices and most instruments, and ignores silence and noise.
- Each reading is the median of the last three, which removes one-frame jumps. The microphone is opened with echo cancellation, noise suppression, and automatic gain turned off, since those change the sound in ways that confuse pitch tracking.
- "Any octave counts" works by folding: the distance between your note and the target is wrapped into one octave, from 6 semitones down to 6 up. The line on screen is drawn in the octave nearest the melody, so it lines up with the notes whatever your range.
- The melody, the clicks, and Note Match's notes are played with the Web Audio API.

## Tests

`tests/pitch-singer.test.js` checks that YIN reads sine, sawtooth, and voice-like tones from 82 Hz to 880 Hz within 6 cents, that silence and noise give no pitch, note names and octave folding, that every song is well formed, the scoring (right notes in any octave score 100%, a semitone off 25%, silence 0), and the tuner's string choice. In Chrome, a synthetic singer fed through the same audio path scored 90 to 92% on two songs, Note Match scored 93% on ten notes, and the tuner read a guitar A string tuned 8 cents flat as 8 cents flat.
