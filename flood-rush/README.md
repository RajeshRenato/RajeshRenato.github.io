# FLOOD RUSH

Flood-fill race: you own the top-left corner. Each move you pick a colour and your region swallows every adjacent cell of that colour. Paint the whole grid before the moves run out.

**Every board is beatable by definition.** A greedy bot (always picks the colour that grows the region most) solves each board at generation time; its move count is the par and your budget is par + 2. Finish under par to out-plan the bot.

- Endless levels: grids grow 7×7 → 14×14, colours 4 → 6
- Live "% owned" meter and a highlighted origin cell
- The seed lives in the URL — share a link, race a friend on the identical board

Single HTML file — open `index.html` to play.
