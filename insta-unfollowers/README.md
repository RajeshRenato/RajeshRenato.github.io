# Instagram Unfollowers

See who doesn't follow you back, who you don't follow back, and who unfollowed you since last time. No login and no password: it reads the data download Instagram gives you, in your browser.

## Use

- In Instagram, go to Settings, Accounts Center, Your information and permissions, Download your information. Choose your account, then Some of your information, then Followers and following. Pick JSON (or HTML) and request it. Instagram emails you when it's ready, usually within minutes.
- Drop the ZIP here, or the files from its "followers_and_following" folder.
- Switch between the lists. Tick people off as you go; ticks are remembered on this device. Download a list as CSV or copy the usernames.
- Next time, drop a new download: the page compares it with the last one and shows exactly who unfollowed you and who's new.

Apps that ask for your Instagram password to do this can get your account blocked, or stolen. This never needs it.

## How it works

- The download holds your followers (in one or more numbered files), the accounts you follow, recent unfollows and pending requests. Both the JSON and the HTML versions are read, including the newer JSON layout where the username is only in the title or link.
- The lists are compared as sets: following but not followers, followers but not following, and both.
- Only usernames and dates from the last download are kept in this browser, to compare against next time. The page is blocked from making network requests.

## Tests

`tests/insta-unfollowers.test.js` checks the three lists from a JSON download, the newer layout without a value field, usernames and dates from the HTML download, and the message for a download without the right files.
