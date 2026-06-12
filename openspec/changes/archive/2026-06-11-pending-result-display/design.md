## Context

`getMatchScoreDisplay` in [lib/match-score.ts](lib/match-score.ts) returns `{ primary: null, inline: null, secondary: null }` when either `home_score` or `away_score` is null. Every call site then supplies its own fallback string, and two of them are wrong:

- Game page renders `scoreDisplay.primary ?? \`${match.home_score ?? 0} – ${match.away_score ?? 0}\`` → **"0 – 0"** ([bets/page.tsx:199](app/(app)/matches/[id]/bets/page.tsx#L199)).
- Home recent-results renders `scoreDisplay.inline ?? \`${m.home_score} – ${m.away_score}\`` → **"null – null"** ([home/page.tsx:291](app/(app)/home/page.tsx#L291)).

The null-score window is normal and expected: a match's status flips to `live` (and eventually `finished`) via the football-data.org sync, but the score field can lag the status by one or more sync ticks. During that gap the placeholders read as a genuine 0-0 or a bug.

Match `status` is API-driven (`mapStatus` in [scores-sync.ts](worker/src/services/scores-sync.ts)): `scheduled` → `live` (IN_PLAY/PAUSED/HALFTIME) → `finished` (FINISHED). The home page's recent-results list filters `status === "finished"`, so a finished match whose score sync hasn't landed yet still appears there with null scores.

## Goals / Non-Goals

**Goals:**
- Show an unambiguous "result not in yet" indicator instead of `0 – 0` / `null – null` whenever a match should have a score but doesn't.
- One source of truth for the placeholder so no call site can reintroduce a bad fallback.
- Leave the synced-score rendering (including regular-time + parenthesized final) untouched.

**Non-Goals:**
- No change to how/when scores are synced or how status transitions (worker untouched).
- No change to scheduled (future, not-started) matches — they still show no score line, not "pending".
- No new API fields.

## Decisions

**Decision 1: Centralize the placeholder in `getMatchScoreDisplay`.**
Instead of every call site inventing a fallback, the helper returns a non-null placeholder for the missing-score case. The cleanest shape that doesn't break existing `?? secondary` logic: keep returning `primary`/`inline` as the display string, but when scores are null return a placeholder string (e.g. `"–"`) plus a flag so callers can style/label it.

Chosen shape — extend the return type:
```ts
{ primary: string | null; secondary: string | null; inline: string | null; pending: boolean }
```
- Scores present → unchanged (`pending: false`).
- Scores null → `primary: "–"`, `inline: "–"`, `secondary: null`, `pending: true`.

Call sites drop their `?? \`...\`` fallbacks entirely and just render `scoreDisplay.primary` / `scoreDisplay.inline`; they can use `pending` to add a muted "Pending result" label where space allows (game page status line, which already shows Live/Full time).

*Alternative considered:* fix each call site's fallback string independently. Rejected — three+ call sites, easy to miss one or regress, and no shared definition of the placeholder glyph/text.

**Decision 2: Placeholder glyph `–` for the score, optional "Pending result" text for the larger surfaces.**
The home recent-results row is dense (single line), so `–` in place of the score keeps layout stable. The game page has a dedicated status line under the big score (`● Live` / `Full time` / status); when `pending` is true and the match has started/finished, show the big score as `–` and keep the existing status text (which already communicates Live / Full time). This keeps the change minimal and reuses an existing label slot.

*Alternative considered:* literal "Pending result" as the big score on the game page. Rejected — too wide for the 3xl score slot between the two flags; `–` with the status line reads clearly.

**Decision 3: Scheduled future matches are unaffected.**
`pending` is only meaningful once scores are expected. Because the placeholder is purely a score-null fallback and scheduled matches already don't render a finished/live score block in the recent-results/finished contexts, no extra guarding is needed there. The game page already shows the score block for all statuses (it showed `0 – 0` before for scheduled too); after this change a not-yet-started match shows `–` with the `scheduled`/kickoff status, which is more honest than `0 – 0`.

## Risks / Trade-offs

- [Return-type change to `getMatchScoreDisplay` could miss a consumer] → Grep confirms 4 consumers ([home](app/(app)/home/page.tsx), [bets game page](app/(app)/matches/[id]/bets/page.tsx), [history](app/(app)/history/page.tsx), [match-card](components/match-card.tsx)); the new `pending` field is additive and existing fields keep their types, so untouched consumers keep compiling. Each will be reviewed in tasks.
- [`–` could be mistaken for a 0-each dash] → It is visually distinct from `0 – 0` (no digits) and pairs with the Live/Full time status; acceptable for a transient state that self-resolves on the next sync tick (≤ a couple minutes per the cron cadence).

## Migration Plan

Pure frontend deploy via `npm run cf:deploy`. No data migration, no rollback steps beyond reverting the commit. Self-correcting: once the score syncs, `pending` becomes false and the real score renders.
