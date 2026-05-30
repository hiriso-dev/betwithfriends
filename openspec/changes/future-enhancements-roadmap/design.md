## Context

BetWithFriends is a WC2026 betting PWA built on Next.js 16 + Cloudflare Worker + D1 SQLite. It fully supports all 72 group stage matches with betting, scoring, push notifications, and group leaderboards. The group stage ends June 26-27, 2026; the knockout phase (30 matches) starts July 1.

Six capabilities are being introduced: knockout stage betting, per-match bet views, personal bet history, live score ticker, group admin moderation tools, and API rate limiting. They span both the frontend and the worker, and each has distinct architectural considerations documented here.

## Goals / Non-Goals

**Goals:**

- Support betting on all 30 knockout stage matches (R32 → Final)
- Allow users to view group peers' bets for a specific match after kickoff
- Provide a personal bet history page across all groups
- Show live scores on match cards during in-progress matches without a full page reload
- Allow group admins to remove members from their group
- Protect the API worker with basic per-IP / per-user rate limiting

**Non-Goals:**

- Custom scoring rules for knockout matches (same rules as group stage apply)
- Real-time WebSocket live scores (polling is sufficient at this scale)
- Global site-wide admin dashboard
- Push notification on every goal during a live match
- OAuth / social login
- KV-backed or globally-exact rate limiting (out of scope for current user scale)

## Decisions

### D1: Knockout fixtures — dynamic auto-discovery via cron

Knockout fixtures cannot be pre-seeded because teams are unknown until group stage ends. Two options were considered:

- **Option A**: Admin manually triggers `/api/admin/sync` before each knockout round
- **Option B**: Extend the existing `syncScores()` cron to upsert any new matches returned by football-data.org `/competitions/WC/matches`

**Decision: Option B.** The endpoint already returns the full fixture list including future knockout rounds (with TBD team names). The existing `api_match_id` unique constraint prevents duplicates. Extending `syncScores()` to upsert new rows (not just update existing ones) requires ~10 lines of code and requires zero admin action between rounds.

Rationale: zero ongoing maintenance; knockout fixtures appear in the app as soon as football-data.org publishes them, typically days before the round.

### D2: Live score ticker — client-side polling

Three options were considered:

- **Option A**: Client-side `setInterval` polling every 60 s to the existing `/api/matches` endpoint
- **Option B**: Server-Sent Events streamed from the worker
- **Option C**: WebSocket via Cloudflare Durable Objects

**Decision: Option A.** The existing `/api/matches` endpoint returns all match data including live scores. Match cards already render the current score. Adding a `useInterval` hook that calls `mutate()` (SWR or a manual refetch) every 60 s during active matches is enough. At WC2026 peak there are at most 4 simultaneous matches, so polling cost is low.

Rationale: minimal code change, no new infrastructure, sufficient UX for a betting app (score precision to the minute is not needed). Option B/C would require stateful streaming, which complicates the Cloudflare Worker architecture.

### D3: Rate limiting — per-isolate in-memory sliding window

Three options were considered:

- **Option A**: Cloudflare Workers Rate Limiting API (managed, paid plan required)
- **Option B**: Cloudflare KV counter with 1-minute TTL (globally exact, ~1 ms latency per request)
- **Option C**: In-memory sliding window per isolate (`Map<string, number[]>`)

**Decision: Option C.** The app currently has O(hundreds) of users. In-memory limits are per-isolate, not globally exact, but this is acceptable for DoS protection at this scale. Option A requires a paid plan. Option B adds 1 KV read/write per request — a ~$0.50/million cost that's not justified yet. Clear upgrade path exists to Option B/A when scale warrants.

Limits: 60 req/min per IP (unauthenticated), 120 req/min per user-id (authenticated). Response: HTTP 429 with `Retry-After: 60` header.

### D4: Match bets view — use existing backend endpoint

The `/api/matches/:id/bets?group_id=` endpoint already exists in `handlers/matches.ts`. The frontend directory `app/(app)/matches/[id]/bets/` exists but `page.tsx` is a stub. No backend changes needed; only the frontend page must be implemented.

### D5: Bet history — new paginated worker endpoint

A new `GET /api/bets/history?group_id=&limit=50&offset=0` endpoint will join `bets` with `matches` and `groups` to return a paginated, sorted list of the authenticated user's bets. Client-side aggregation across groups would require N calls for N groups and complex merging — a single server-side query with JOIN is cleaner.

### D6: Group member removal — hard delete with cascade

When an admin removes a member, the bet records for that user in that group should also be deleted (bets are group-scoped, so they have no meaning outside the group context). D1's existing `ON DELETE CASCADE` on `bets.group_id` covers the cascade automatically if the `group_members` row is deleted. Total points on remaining members are unaffected. The leaderboard simply excludes the removed user.

## Risks / Trade-offs

- **[Knockout fixture gaps]** football-data.org may not expose knockout fixtures until a day or two before kick-off. The app may show no upcoming knockout matches briefly. → Mitigation: admin sync endpoint remains available as fallback.

- **[In-memory rate limiting bypass]** A determined attacker can issue requests to many different Cloudflare edge nodes (isolates) to bypass per-isolate limits. → Mitigation: acceptable at current user scale; upgrade to KV counters documented as next step.

- **[Live polling D1 load]** Concurrent users polling every 60 s during simultaneous matches multiplies D1 reads. → Mitigation: D1 supports high read concurrency; 60 s interval keeps load manageable. Interval can be increased to 90 s if needed.

- **[Member removal is irreversible]** Hard-deleting a member removes their bets permanently. → Mitigation: admin UI will require a confirmation step. No soft-delete complexity.

## Migration Plan

All changes are backward-compatible. No D1 schema changes are required.

1. **Deploy worker first** — new endpoints (`/api/bets/history`, `DELETE /api/groups/:id/members/:userId`), `syncScores()` upsert extension, rate limiting middleware. Existing endpoints continue working.
2. **Deploy frontend** — match bets page, bet history page, live ticker, admin remove-member button.
3. **Knockout fixtures** appear automatically after group stage ends via the extended `syncScores()` cron.
4. **Rollback**: removing rate-limiting middleware or new endpoints is a one-line revert with no data migration.

## Open Questions

- Should live ticker also update the home page featured match, or only the fixtures list? (Proposal: yes, both)
- Should the bet history page be at `/history` (top-level) or `/profile/bets` (sub-page under profile)? (Proposal: `/history`, accessible from nav or profile)
- Page size for bet history: 50 bets per page is the default — should this be configurable? (Proposal: fixed at 50 for simplicity)
