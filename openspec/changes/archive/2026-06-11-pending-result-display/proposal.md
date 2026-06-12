## Why

When a match has kicked off (or has finished in real life) but the football-data.org sync hasn't populated the score yet, the UI shows misleading placeholder scores: the match detail ("game") page renders **"0 – 0"** and the home page recent-results row renders **"null – null"**. Both read as a real 0-0 (or a broken value) rather than "we don't have the result yet," which confuses users during the live-sync gap.

## What Changes

- Replace the confusing score fallbacks with an explicit **pending-result** state whenever a match has started/ended but its score is still missing.
- Game page ([app/(app)/matches/[id]/bets/page.tsx](app/(app)/matches/[id]/bets/page.tsx)): stop falling back to `0 – 0`; show a "Pending result" placeholder (e.g. `–`) when scores are null on an in-progress/over match.
- Home page recent-results row ([app/(app)/home/page.tsx](app/(app)/home/page.tsx)): stop falling back to `null – null`; show the same pending-result placeholder.
- Match card ([components/match-card.tsx](components/match-card.tsx)): apply the same fallback fix for consistency.
- Centralize the placeholder text/logic in [lib/match-score.ts](lib/match-score.ts) (`getMatchScoreDisplay`) so all call sites share one source of truth and no call site reintroduces a raw `?? 0` / `?? null` fallback.
- Not-yet-started (scheduled, future) matches keep showing no score line (kickoff time), unchanged — the pending state applies only to matches that should have a score but don't yet.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `match-score-display`: add a requirement that matches which have started or ended but lack a synced score render an explicit pending-result placeholder instead of `0 – 0` or `null – null`.

## Impact

- Frontend only; no API, schema, or worker changes.
- Affected files: [lib/match-score.ts](lib/match-score.ts), [app/(app)/matches/[id]/bets/page.tsx](app/(app)/matches/[id]/bets/page.tsx), [app/(app)/home/page.tsx](app/(app)/home/page.tsx), [components/match-card.tsx](components/match-card.tsx).
- No behavior change once scores are synced; only the transient "score missing" window is affected.
