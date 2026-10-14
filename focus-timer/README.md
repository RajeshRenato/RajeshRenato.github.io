# Focus Timer

A pomodoro timer. Work in focus sessions with short breaks in between, and a long break after every fourth focus session.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder.

## What it does

- Focus, short break, and long break default to 25, 5, and 15 minutes. You can change each one, and your choices are saved.
- When a phase ends, a short chime plays and the next phase is set up. Press start to begin it.
- Skip ends the current phase early and moves on. Reset restarts it.
- While the timer runs, the countdown shows in the tab title.
- The number of focus sessions you finish each day is kept in `localStorage`.

## Shortcuts

| Key | Action |
| --- | --- |
| Space | Start or pause |
