# BetWithFriends

World Cup 2026 group betting PWA. Friends bet on match scores, earn points, compete on a leaderboard.

## Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS 4, dark-first design, deployed as Cloudflare Worker via `@opennextjs/cloudflare`
- **Backend**: Cloudflare Worker (`worker/`) — API on port 8787 in dev
- **DB**: Cloudflare D1 (SQLite), binding name `DB`
- **Auth**: Email + password, JWT HS256, stored as cookie `bwf_token`, sent as `Authorization: Bearer <token>`

## Dev setup

```bash
npm run db:create       # creates D1 locally, paste the database_id into worker/wrangler.toml
npm run db:init         # apply schema to local D1
npm run db:seed         # reset + seed all WC2026 fixtures
npm run worker:dev      # start API worker on :8787 (separate terminal)
npm run dev             # start Next.js on :3000
```

> **Important**: always use the scripts from the root `package.json` — they all pass `--config worker/wrangler.toml` explicitly. Wrangler v4 traverses parent directories and would otherwise pick up the root `wrangler.jsonc` (the frontend worker) instead of the API worker config.

## Env vars (Next.js / frontend)

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8787` | Worker URL |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | — | Generate with `npm run vapid:generate` |

## Worker secrets (`wrangler secret put` inside `worker/`)

| Secret | Notes |
|---|---|
| `JWT_SECRET` | Random string ≥32 chars |
| `FOOTBALL_DATA_API_KEY` | From football-data.org (free tier) |
| `VAPID_PUBLIC_KEY` | Generated with `npm run vapid:generate` |
| `VAPID_PRIVATE_KEY` | Same generation step |
| `VAPID_SUBJECT` | `mailto:your@email.com` |

Worker vars (set in `wrangler.toml` / `wrangler.production.toml`):
- `APP_URL` — frontend URL (used in push notification links)

## Scoring system

All scores are based on **regular time only** (90 min) — extra time and penalties are ignored.

Bet locks **at kickoff** (`BET_LOCK_MINUTES = 0`).

Points per bet (see `worker/src/services/scoring.ts`):

| Outcome | Base pts |
|---|---|
| Correct result (win/draw) | +10 |
| Exact score bonus | +5 (total 15 if exact) |
| Wrong | 0 |

Confidence modifier (additive, applied after base):

| Confidence | Correct | Wrong |
|---|---|---|
| None | 0 | 0 |
| Cautious 😬 | +2 | −2 |
| Confident 👍 | +5 | −5 |
| Reckless 🔥 | +10 | −10 |

**Double Up** (×2 multiplier on total, max 2 per group): only applies if total > 0.

## Special bets (tournament-level)

Lock at WC2026 kick-off (June 11 2026):

| Type | Points |
|---|---|
| World Champion | 50 |
| Runner-up | 20 |
| Third place | 15 |
| Golden Boot (top scorer) | 30 |

## Score sync

Cron every 5 min → `worker/src/services/scores-sync.ts` → football-data.org API → update D1 → `scoring.ts` computes points → push notifications via Web Push.

Uses `score.regularTime` when available (knockout rounds with ET), falls back to `score.fullTime`.

## App pages (`app/(app)/`)

| Route | Description |
|---|---|
| `/home` | Dashboard: countdown to next bet close, specials CTA, featured match, groups, recent results |
| `/fixtures` | Schedule (by day) + Groups view (A–L tabs + standings). Quick inline bet + full BetSheet |
| `/special` | Place/edit the 4 tournament special bets |
| `/profile` | User info, push notifications, install PWA, link to groups |
| `/groups` | List user's groups |
| `/groups/new` | Create a group |
| `/groups/join` | Join via invite code |
| `/groups/[id]` | Group leaderboard + members |
| `/teams/[code]` | Team detail page (past/upcoming matches) |
| `/rankings` | Global rankings / top scorers |

Auth pages: `app/(auth)/login/` — email+password, toggle between sign-in and register.

## Worker API routes (`worker/src/handlers/`)

| Handler | Routes |
|---|---|
| `auth.ts` | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| `groups.ts` | `GET/POST /api/groups`, `GET /api/groups/:id`, `POST /api/groups/:id/join`, `GET /api/groups/:id/members` |
| `matches.ts` | `GET /api/matches?group_id=` — returns matches with `my_bet` hydrated |
| `bets.ts` | `POST /api/bets` — upsert a bet (home/away prediction, confidence, double_up) |
| `special-bets.ts` | `GET/POST /api/special-bets?group_id=` |
| `notifications.ts` | `POST /api/push/subscribe`, `DELETE /api/push/unsubscribe`, `GET/PUT /api/push/prefs` |
| `standings.ts` | `GET /api/standings?group_id=`, `GET /api/scorers` |

Dev-only (no `FOOTBALL_DATA_API_KEY`): `POST /api/dev/score-match` — manually trigger scoring for a match.

## Key components

| File | Description |
|---|---|
| `components/match-card.tsx` | Match card with inline quick-bet (±spinners + ✓/⚙) and full BetSheet |
| `components/install-prompt.tsx` | PWA install banner — detects iOS Safari / iOS other / Chrome / Android and shows the right CTA. `x-safari-https://` scheme used to open Safari from iOS Chrome. |
| `components/group-invite.tsx` | Invite link copy/share for group members |
| `components/sw-registrar.tsx` | Service worker registration |

## Database schema (`worker/src/db/schema.sql`)

Tables: `users`, `groups`, `group_members`, `matches`, `bets`, `special_bets`, `push_subscriptions`, `notification_prefs`, `top_scorers`.

`bets` columns: `id, user_id, group_id, match_id, home_score_pred, away_score_pred, confidence (TEXT nullable), double_up (INTEGER 0/1), points_earned (REAL nullable)`.

## Deploy

```bash
npm run worker:deploy:production   # deploy API worker to Cloudflare
npm run cf:deploy                  # build Next.js + deploy frontend worker
```

CI/CD: GitHub Actions on push to `main` — see `.github/workflows/deploy-cloudflare.yml`.
Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
Required variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## Important constraints

- Bet locking is enforced on the frontend (5 min) and the backend validates match status
- Double Up is capped at 2 per user per group; backend tracks usage
- The 401 handler in `lib/api.ts` clears the cookie and redirects to `/login` globally
- Worker checks user existence in DB after JWT verify (handles wiped DB with stale JWTs)
- Push notifications use Web Push (VAPID); SW is registered in `components/sw-registrar.tsx`
- Tournament special bets are locked at `WC_START = 2026-06-11T21:00:00Z`
