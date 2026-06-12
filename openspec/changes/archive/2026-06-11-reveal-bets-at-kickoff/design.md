## Context

Bets lock at kickoff (`BET_LOCK_MINUTES = 0`). In `components/match-card.tsx` the lock is computed as `isLocked = secondsLeft <= 0 || match.status !== "scheduled"`, and the 👁 button that links to `/matches/[id]/bets` is rendered only when `isFinished || isLive` ([match-card.tsx:384](../../../components/match-card.tsx#L384)).

A match's status only flips from `scheduled` to `live` when the worker's score sync runs, and per the cron design score sync first fires ~105 min after kickoff (it never polls during play). So between kickoff and that first sync the match is `scheduled`, the bet is already locked, but the eye icon is absent — the group cannot view predictions for most of the game.

The backend is already correct: `GET /api/matches/:id/bets` returns `423` only when `status === "scheduled" && !kickoffPassed`, i.e. it serves bets the instant kickoff passes ([matches.ts:35-38](../../../worker/src/handlers/matches.ts#L35-L38)). The bets page already renders predictions without points/ranking when the match isn't `finished` ([bets/page.tsx:160-172](../../../app/(app)/matches/[id]/bets/page.tsx#L160-L172)).

## Goals / Non-Goals

**Goals:**
- Reveal the 👁 affordance the moment a match's kickoff passes (bet locked), not only when `live`/`finished`.
- Keep predictions-only presentation for started-but-unfinished matches (no points, no ranking).
- Behave consistently across every surface that renders the match card.

**Non-Goals:**
- No backend, API, DB, or worker changes.
- Not changing when bets *lock* (still at kickoff) or what the bets page shows for finished matches.
- Not changing privacy before kickoff — predictions stay hidden until the game starts.

## Decisions

**Decision: Gate the eye icon on "kickoff has passed", not on match status.**
Change the render condition at [match-card.tsx:384](../../../components/match-card.tsx#L384) from `isFinished || isLive` to a "bets revealed" condition that is true when `secondsLeft <= 0` (kickoff passed) OR `isLive` OR `isFinished`. Introduce a local `const betsRevealed = secondsLeft <= 0 || isLive || isFinished;` for readability and reuse.

- *Why `secondsLeft <= 0` over reusing `isLocked`?* `isLocked` is `secondsLeft <= 0 || status !== "scheduled"`, which also returns true for a `postponed` match before its scheduled time — we don't want to reveal predictions for a match that hasn't actually started. Gating explicitly on kickoff time (plus live/finished) matches the backend's `kickoffPassed` check exactly and keeps the two sides aligned.
- *Alternative considered — flip status to `live` client-side once kickoff passes:* rejected; it would leak a fake status into score-display logic and the header badge. The minimal, truthful change is purely about visibility.

**Decision: Pending score in the revealed button before a real score syncs.**
For a `scheduled` match past kickoff, `getMatchScoreDisplay` already returns `PENDING_SCORE` (`–`). The existing eye-button branch renders `primaryScore`, so the button shows `–` 👁 with no extra code. This replaces the `vs` placeholder for that match.

**Decision: No change to the bets page logic.**
`isFinished` already drives points/ranking; for a started match it is false, so the page lists predictions sorted alphabetically with confidence/×2 only. The 30s auto-refresh keys off `status === "live"`, which is acceptable — a manual revisit refreshes, and the page becomes live-refreshing once status flips.

## Risks / Trade-offs

- [A user could infer match status changed when only the score is pending] → The button shows the neutral pending dash `–`, consistent with how the app already renders started-without-score matches elsewhere; no misleading state is introduced.
- [Eye icon appears at the exact second of kickoff while the card's refresh interval stops on lock] → The lock transition itself re-renders the card with `secondsLeft <= 0`, and any later mount recomputes `now` fresh, so the icon reliably appears at/after kickoff. No additional timer needed.
- [Postponed matches] → Excluded by gating on kickoff time rather than `isLocked`; they keep the `vs` placeholder until they actually start.
