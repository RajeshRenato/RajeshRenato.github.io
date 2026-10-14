# Trivia Night

A multiple-choice trivia quiz for friends, played online with links and no server. Everyone gets the same question at the same time, with 15 seconds to answer. You can also play alone.

## Play

Open `index.html` in a browser, or run `python3 -m http.server` from the repo root and open this folder. Playing with friends needs the page served over `http://` or `https://`, not opened as a file.

Click "Play with friends" and send each friend their own invite. Each of them sends back a reply link; open it in your browser or paste it in, then press Start. The host picks a category (or Mixed) and 10, 15, or 20 questions.

Answer by clicking, or press 1 to 4 (or A to D).

## Scoring

- A right answer scores 500 to 1000 points: the full 1000 for answering at once, down to 500 at the last moment.
- Getting several right in a row adds 50 for each one after the first, up to 200 extra.
- A wrong answer or no answer scores nothing and ends your streak.
- The question moves on when everyone has answered or time runs out.
- Playing alone, your best score for each category and length is saved in `localStorage`.

## Questions

`questions.js` has 320 questions, 40 in each of 8 categories: General, Science, Geography, History, Sports, Food, Tech, and Arts. They were written for this game and stick to facts that don't change. Questions you've had recently are skipped while there are enough others left. If you spot a wrong answer, please open an issue.

## How it works

It uses [LinkPlay](../linkplay/). The host's browser runs the quiz: it picks the questions, shuffles the answers, and sends each question out without saying which answer is right. Players send back their choice and how long they took, measured on their own device so a slow connection doesn't cost points. When the time is up, the host sends the right answer, how many people picked each option, and the new scores.

## Tests

`tests/trivia-night.test.js` checks the question bank, plays a solo quiz through to the end (scoring, streaks, timeouts, the saved best), and a three-player game over in-memory channels.
