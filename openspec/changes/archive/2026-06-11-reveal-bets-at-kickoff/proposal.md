## Why

Other members' predictions are meant to stay private until a match kicks off, then become visible to the group via the 👁 icon on the match card. Today that icon only appears once a match is `live` or `finished`. But a match stays `scheduled` from kickoff until ~105 min later (score sync is the first thing to flip it to `live`), so for the entire first part of a game the bet is already locked yet the group can't see anyone's predictions. The backend already permits viewing once kickoff has passed — only the frontend gate is too strict.

## What Changes

- Show the 👁 "see everyone's bets" affordance on the match card as soon as **kickoff has passed** (the moment betting locks), instead of waiting for the match status to become `live` or `finished`.
- Replace the `vs` placeholder with the eye affordance for a `scheduled` match whose kickoff has passed, displaying the pending-score dash (`–`) until a real score syncs.
- The revealed bets list for a started-but-not-finished match shows each member's prediction (score, confidence, ×2) **without** points or ranking — points/ranking remain reserved for finished matches (existing behavior).
- No backend change: `GET /api/matches/:id/bets` already serves bets once kickoff has passed.

## Capabilities

### New Capabilities
- `bet-visibility`: When other group members' predictions become visible, and what is shown (predictions always once a match has started; points and ranking only once finished).

### Modified Capabilities
<!-- None — no existing spec governs bet visibility. -->

## Impact

- `components/match-card.tsx` — eye-icon render condition (currently `isFinished || isLive`).
- Affects every surface that renders the match card (home featured match, fixtures, groups) consistently.
- No API, DB, or worker changes. `worker/src/handlers/matches.ts` already gates on `kickoffPassed`.
