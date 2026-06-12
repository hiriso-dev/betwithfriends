## 1. Reveal the eye affordance at kickoff

- [x] 1.1 In `components/match-card.tsx`, add a local `betsRevealed` flag: `const betsRevealed = secondsLeft <= 0 || isLive || isFinished;`
- [x] 1.2 Change the score-area render condition (currently `isFinished || isLive ?` at line ~384) to `betsRevealed ?` so the 👁 button shows once kickoff has passed; the `else` branch keeps the `vs` placeholder for not-yet-started matches.
- [x] 1.3 Confirm the 👁 button still navigates to `/matches/${match.id}/bets` with the `group_id` param and renders `primaryScore` (which is `PENDING_SCORE` `–` for a started-without-score match).

## 2. Verify presentation

- [x] 2.1 Verify a `scheduled` match whose kickoff has passed shows the 👁 control instead of `vs`, and tapping it opens the bets page listing predictions with no points/ranking.
- [x] 2.2 Verify a `scheduled` match before kickoff still shows `vs` and exposes no 👁 control.
- [x] 2.3 Verify `live` and `finished` matches are unchanged (eye icon present; finished shows points + ranking on the bets page).
- [x] 2.4 Verify a `postponed` match before its scheduled time does not reveal the 👁 control.

## 3. Checks

- [x] 3.1 Run the frontend lint/build (`npm run lint` / `npm run build`) and confirm no type or lint errors from the change.
