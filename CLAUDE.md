# BetWithFriends

World Cup 2026 group betting PWA.

## Stack
- Frontend: Next.js 16 (App Router) + Tailwind CSS 4, dark-first design
- Backend: Cloudflare Worker (`worker/`) — runs on localhost:8787 in dev
- DB: Cloudflare D1 (SQLite)
- Auth: Magic link via Resend, JWT Bearer cookie `bwf_token`

## Dev setup
1. `npm run db:create` — create D1 database, paste ID into `worker/wrangler.toml`
2. Set worker secrets: `wrangler secret put JWT_SECRET` (and others)
3. `npm run db:init` — apply schema locally
4. `npm run worker:dev` — start API on port 8787
5. `npm run dev` — start Next.js on port 3000

## Env vars
- `NEXT_PUBLIC_API_URL` — Worker URL (default: http://localhost:8787)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — generate with `npm run vapid:generate`

## Worker secrets (wrangler secret put)
- `JWT_SECRET` — random string ≥32 chars
- `RESEND_API_KEY`
- `FOOTBALL_DATA_API_KEY` — from football-data.org (free)
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` — mailto:your@email.com

## Scoring system
- côte = group bet distribution inverse (capped 1.1–6.0)
- Exact score: 10 × côte pts
- Correct result + goal diff: 6 × côte pts
- Correct result only: 3 × côte pts
- Wrong: 0 pts

## Score sync
Cron every 5 min → `scores-sync.ts` → football-data.org → update D1 → `scoring.ts` → push notifications
