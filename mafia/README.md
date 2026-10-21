# Mafia

The party game for 5 to 12 people in the same room, each on their own phone. A few players are secretly mafia. Each night they remove someone, and each day everyone argues and votes on who they think the mafia are.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. It needs the page served over `http://` or `https://`, not opened as a file.

Click "Play with friends" and send each friend their own invite. Each of them sends back a reply link; open it in your browser or paste it in. Press Start when everyone is in, choose the settings, and deal the roles.

Hold the card at the top of your screen to see your role. Let go and it hides again, so people next to you can't read it.

## Roles

| Role | What they do |
| --- | --- |
| Mafia | About one in four players. Each night the mafia pick someone to remove. They know who the other mafia are. |
| Doctor | Each night, picks someone to save. If the mafia picked that person, nobody dies. The doctor can pick themselves. |
| Detective | Each night, picks someone and learns whether they are mafia. Only the detective sees the answer. |
| Villager | No night power. Talks, listens, and votes. |

## Rules

- Night: every living player taps a name and confirms. The mafia's choice is the name most of them picked, and a tie is settled at random. Villagers tap a name too, so everyone's screen looks the same and nobody can tell roles by watching.
- Morning: the town hears who was killed, or that nobody died.
- Day: talk for a set time, then vote. A player needs more than half of the living players' votes to be voted out. Anyone can skip. Without a majority, nobody leaves.
- The town wins when every mafia member is out. The mafia win when there are as many of them as everyone else.

## Settings

- Narrator only: the host doesn't play. Their screen shows the public story, which works well on a TV, and never shows anyone's role.
- Show a player's role when they're out. Turn it off for a harder game.
- Players who are out can see every role. Turn it off if people talk too much after they're out.
- Talking time: 1, 2, 3, or 5 minutes.

People who join after the roles are dealt watch until the next game. If someone leaves in the middle, they're out and their role is shown.

## How it works

It uses [LinkPlay](../linkplay/) to connect the phones directly, with no game server. The host's browser deals the roles and runs the game, and it sends each player only what that player may see: their own role, the mafia team if they're mafia, and the detective's answers if they're the detective. Votes during the day are public.

The host's browser does hold every role, so a host who plays and opens the browser's developer tools could peek. For a game where that matters, use narrator mode.

## Tests

`tests/mafia.test.js` covers how many of each role are dealt, that guests never receive other players' roles, night results with the doctor's save and the detective's private answer, majority and tied votes, both ways to win, narrator mode, a player leaving, a late joiner, and the phase timers.
