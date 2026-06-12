## Context

The home dashboard (`app/(app)/home/page.tsx`) already fetches all matches for the selected group via `GET /api/matches?group_id=` and keeps them in `matches` state. It already runs a **30s live-score poller** (re-fetching matches while any `m.status === "live"`). Match status (`scheduled | live | finished | postponed`) is set by the score-sync cron; `live` means the game is in progress.

The 👁 "see everyone's bets" pattern is established in `components/match-card.tsx`: a button that calls `router.push('/matches/${id}/bets?group_id=${groupId}')`. Score rendering is centralised in `getMatchScoreDisplay` (`lib/match-score.ts`), returning `{ primary, secondary, pending }` and used by both the match card and the bets page.

This change is a presentation-only addition: a new "Live now" section on the home page. No backend, schema, or new data fetching is required.

## Goals / Non-Goals

**Goals:**
- Surface currently-live matches at the top of the home dashboard's main column.
- Let users jump from a live game straight to the group's bets for that match via the existing 👁 control.
- Keep scores fresh using the existing live poller; no new network calls.

**Non-Goals:**
- No new API endpoint, DB column, or worker logic.
- No inline betting from the live section (bets lock at kickoff, so live matches are not bettable anyway).
- No change to the 👁 affordance behaviour or the bets page (governed by `bet-visibility`, reused as-is).
- No change to how/when `status` becomes `live` (owned by score-sync).

## Decisions

### Derive the live list from existing state, render inline
Compute `const live = matches.filter(m => m.status === "live")` in the existing `HomePage` component and render a section when `live.length > 0`. 

- **Why:** `matches` is already loaded and already refreshed by the 30s poller, so the section updates for free and stays consistent with the rest of the page. No new fetch, no new loading state.
- **Alternative considered:** a separate `/api/matches?status=live` fetch or a dedicated component with its own poller — rejected as redundant; it would duplicate polling already happening and risk divergent state.

### Reuse the match-card eye pattern, not the whole match card
Render a compact custom row (teams + score + `● Live` + 👁 button) rather than dropping in `<MatchCard>`.

- **Why:** the full match card includes quick-bet/edit UI that is irrelevant for a locked, in-progress match and would add visual noise to the dashboard. A compact row matches the density of the existing "Recent Results" list. The 👁 navigation (`/matches/[id]/bets?group_id=`) and score rendering (`getMatchScoreDisplay`) are copied as the small, stable pieces they are.
- **Alternative considered:** reuse `<MatchCard>` directly — rejected; heavier UI, and its locked-state still foregrounds the user's own bet rather than the live score.

### Placement: top of the main column
Insert the section in the `lg:col-span-2` main column, above the "🔒 Next bet locks in" countdown / "Next bet" CTA.

- **Why:** live games are the most time-sensitive, attention-grabbing content; they belong first. During play there is no bet to place for those matches, so they should sit ahead of the next-bet CTA.

### Score rendering and pending state
Use `getMatchScoreDisplay(m)` and show its pending indicator when a live match has no synced score yet, consistent with the bets page and `match-score-display` capability.

- **Why:** avoids showing a misleading `0 – 0` before the first sync and keeps score formatting consistent app-wide.

## Risks / Trade-offs

- **Brief window where `live` lags reality** (score sync floor is ~105 min after kickoff; a just-kicked-off match is still `scheduled`) → Acceptable: those matches still show the 👁 affordance on their match cards via `bet-visibility`. The "Live now" section is explicitly scoped to `status === "live"`; surfacing kicked-off-but-not-synced matches here is out of scope.
- **Duplicated eye/score snippet** between match card and the new row → Minor; both are a few lines. Extracting a shared component is unnecessary for two call sites and out of scope.
- **Empty section flash on first load** → Avoided by rendering only when `live.length > 0`, and the page already shows skeletons while `loading`.
