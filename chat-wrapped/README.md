# Chat Wrapped

Your WhatsApp chat, wrapped. Export any chat and see who texts more, who replies faster, who starts the conversations, your longest streak, your favourite emojis, the words you both use most, and when you're busiest. Then play it as a story, or share one picture of the highlights.

## Use

- In WhatsApp, open the chat, tap the name at the top (or the menu), then Export chat, and choose Without media.
- Drop the .zip or .txt here. Group chats work too.
- Scroll the dashboard, or press Play story for the slides. Pick a year to see just that year.
- Share or save the summary picture: a 1080 by 1920 image sized for stories.

## How it works

- Each line of the export starts with a date, time and name. The page recognises both the Android and the iPhone layouts, 12 and 24 hour times, and whether dates are day-first or month-first by looking for a first number over 12 across the whole chat. Lines without a date belong to the message above.
- System notices (encryption, someone was added) are skipped. Media, deleted messages, emojis and laughs ("haha", "lol", 😂) are counted on their own.
- Reply time is the gap when the chat switches from one person to the other within six hours; the median is used so one long silence doesn't skew it. A new conversation starts after a gap of six hours or more.
- The most used words leave out common English and Hinglish filler words.
- Everything is read in your browser. The page is blocked from making network requests, so the chat can't be sent anywhere.

## Tests

`tests/chat-wrapped.test.js` reads Android and iPhone exports, checks that system notices are skipped, multi-line messages are joined, media and deleted messages are counted and that month-first dates are recognised, and that text that isn't a chat is refused.
