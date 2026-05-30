## Why

BetWithFriends is fully operational for the WC2026 group stage, but the tournament continues beyond June 27 into a 30-match knockout phase — without enhancements, the app becomes unusable for the second half of the competition. Several social features (viewing peers' bets, personal history) and operational features (group moderation, API protection) are also missing or incomplete, limiting engagement and reliability during peak tournament traffic.

## What Changes

- **New**: Knockout stage fixture support — seed and score R32, QF, SF, 3rd-place, and Final matches dynamically as they are determined by football-data.org
- **New**: Match bets view — a dedicated `/matches/[id]/bets` page showing every group member's prediction for a match, visible after kickoff
- **New**: Bet history page — a personal `/profile/bets` (or `/history`) page listing all past predictions with outcome and points earned
- **New**: Live score ticker — matches in-progress display a live score badge on match cards and the home page, refreshed every 60 seconds without a full page reload
- **New**: Group admin tools — group admins can remove members from their group via the group detail page
- **New**: API rate limiting — per-IP and per-user request throttling on the Cloudflare Worker to prevent abuse and protect D1 quotas

## Capabilities

### New Capabilities

- `knockout-stage-betting`: Seed and display knockout round fixtures (R32 through Final) as they are determined; support betting on these matches including tiebreaker predictions (extra time / penalty shootout winner as tiebreaker, not scored); sync via football-data.org `/competitions/WC/matches`
- `match-bets-view`: Per-match page showing all group members' predictions with their confidence level and double-up flag, visible only after the match has kicked off; links from match cards
- `bet-history`: Personal history page listing all bets placed by the authenticated user across all groups, with match result, outcome (exact/correct/wrong), and points earned; sortable by group and match date
- `live-score-ticker`: Client-side polling (60 s) to refresh scores for in-progress matches without page reload; live score badge on match cards showing current score and elapsed time; home page featured match updates live
- `group-admin-tools`: Admin-only UI on the group detail page to remove a member; worker endpoint `DELETE /api/groups/:id/members/:userId`; removed user loses their bets and leaderboard entry for that group
- `api-rate-limiting`: Cloudflare Worker middleware using the `CF-Connecting-IP` header; 60 req/min per IP for unauthenticated routes, 120 req/min per user for authenticated routes; returns 429 with `Retry-After` header; uses in-memory sliding window (no KV needed at current scale)

### Modified Capabilities

<!-- No existing capability specs exist yet. No modifications. -->

## Impact

- **Worker** (`worker/src/`): New handler for group member removal, new rate-limiting middleware, knockout fixture seed SQL, scoring extension for knockout matches
- **Database** (`worker/src/db/schema.sql`): No schema changes required — `matches` table already supports knockout stage via `stage` column; `bets` UNIQUE constraint already covers knockout bets
- **Fixtures seed** (`worker/src/db/reset-and-seed.sql`): Only group stage seeded today; knockout fixtures must be added dynamically via admin sync or cron
- **Frontend** (`app/(app)/`): New `matches/[id]/bets/` page (directory already exists but page is empty stub), new `history/` page, live ticker on match cards, admin remove-member button on group detail page
- **Push notifications**: No changes needed — existing result notifications already work for knockout matches once they are seeded and scored
- **Dependencies**: No new npm packages (rate limiting via in-memory map; live polling via `setInterval`)
