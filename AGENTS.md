<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent notes for BetWithFriends

This project has two separate runtimes. Keep them separate.

## Two runtimes, two environments

| | Frontend | API Worker |
|---|---|---|
| Runtime | Cloudflare Workers (via `@opennextjs/cloudflare`) | Cloudflare Workers (Wrangler) |
| Entry | `app/` (Next.js App Router) | `worker/src/index.ts` |
| Dev port | 3000 | 8787 |
| Deploy | `npm run cf:deploy` | `npm run worker:deploy:production` |

The frontend calls the API via `lib/api.ts` → `apiFetch`. All API calls go to `NEXT_PUBLIC_API_URL` (default `http://localhost:8787`). The API worker handles CORS.

## Auth flow

1. Client POSTs to `/api/auth/login` or `/api/auth/register` — receives `{ jwt: string }`
2. JWT is stored as cookie `bwf_token` (30-day, samesite=lax)
3. `apiFetch` in `lib/api.ts` reads the cookie and adds `Authorization: Bearer <token>`
4. Worker verifies JWT, then checks user exists in DB (to handle wiped DBs with stale tokens)
5. On 401, `apiFetch` clears the cookie and redirects to `/login` — no need to handle 401 elsewhere

## Database

Never touch the schema without also updating `worker/src/db/schema.sql`. The `reset-and-seed.sql` contains a full reset + all 72 WC2026 fixtures.

The `bets` table uses `UNIQUE(user_id, group_id, match_id)` — always use `INSERT OR REPLACE` or `ON CONFLICT DO UPDATE` for upserts.

## Scoring — do not change without reading this

See `worker/src/services/scoring.ts`. Rules:
- Base: 10pts correct, +5 exact bonus
- Confidence: additive modifier (cautious ±2, confident ±5, reckless ±10)
- Double Up: ×2 total if total > 0, max 2 per user per group
- Scores from `score.regularTime` (90 min only), not extra time or penalties

`processMatchResult()` is called once when a match transitions to `finished`. It is idempotent via `WHERE points_earned IS NULL`.

## Frontend conventions

- All pages under `app/(app)/` are protected by `middleware.ts`
- Dark-first Tailwind design — CSS vars: `--background`, `--foreground`, `--surface`, `--surface-hover`, `--border`, `--accent`, `--muted`, `--success`, `--warning`, `--danger`
- Bet sheets use `z-[60]`; nav bar uses `z-50`; install prompt uses `z-[70]`
- Match cards support quick-bet mode (inline ±spinners) and full BetSheet modal
- `onSaved` callback on MatchCard refreshes match data after a quick save

## PWA / install

`components/install-prompt.tsx` detects the platform and shows:
- iOS Safari → Share ⬆ instructions
- iOS other browser → "Open in Safari" link using `x-safari-https://` scheme
- Chrome/Edge with `beforeinstallprompt` → Install button
- Android other → manual menu instructions

The `x-safari-https://` URL scheme opens Safari directly at the given URL on iOS — use it to route iOS non-Safari users to Safari for installation.

## Common mistakes to avoid

- Do not use `wrangler.json` — the worker uses `wrangler.toml` / `wrangler.production.toml`
- Do not add odds, côte, or parimutuel logic — the scoring system is flat confidence/double-up
- Do not call `syncOdds` — that service was removed; only `syncScores` and `syncScorers` exist
- The `/special` page handles special bets; the home page just shows a compact CTA linking there
- Bet locking at 5 min is enforced in the UI only; the backend does not re-validate timing (it trusts the client for normal flow)
