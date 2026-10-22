# Walkie-Talkie

A push-to-talk walkie-talkie for up to 8 people, through links. Hold the button to talk and let go to listen. Like a real radio, one person talks at a time. There's no app, no account, and no server.

## Use

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. The microphone only works on `http://localhost` or `https://`.

Click "Start a channel" and send each person their own invite. They open it, click Join, and get a reply link to send back. Open the reply in your browser or paste it in, and they're on the channel. An invite only works once; "Invite another person" makes a new one.

- Hold the big button, or hold Space, to talk. Let go to listen.
- The first time you talk, the browser asks for the microphone. If you've already allowed it, it's ready right away.
- If someone else is talking when you press, you hear a busy beep. Keep holding and the channel is yours as soon as they let go.
- Nobody can talk for more than a minute at a time.
- You can listen without a microphone.

## How it works

It uses [LinkPlay](../linkplay/): browsers connect directly over WebRTC, and the invite and reply links carry the connection details. Everyone connects to the person who started the channel. Their browser decides who has the channel and passes that person's voice on to everyone else, so the talker doesn't hear an echo of themselves. Your microphone track is muted except while you have the channel.

Voice is encrypted on every connection (DTLS-SRTP). The browser that started the channel does hear everything, since it passes the voices on. Nothing is recorded or stored, and closing the tab leaves the channel. If the person who started it leaves, the channel closes for everyone.

## Tests

`tests/walkie-talkie.test.js` checks that only one person has the channel at a time, the waiting order, the one minute limit, that the channel clears when the talker leaves, who hears whose voice, and that a guest can't take the channel for someone else. It runs on in-memory channels with stand-in microphones. The audio routing was also checked in three real browsers with fake microphones.
