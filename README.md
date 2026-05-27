# BetWithFriends

A PWA for betting on World Cup 2026 matches with your friends. Create groups, predict every score, earn points, and track who knows football best.

## Features

- **Match betting** — predict home/away score for all 72 group stage matches
- **Confidence levels** — Cautious 😬 / Confident 👍 / Reckless 🔥 to multiply (or tank) your points
- **Double Up** — stake ×2 on up to 2 bets per group
- **Special bets** — pick World Champion, Runner-up, 3rd Place, and Golden Boot before the tournament starts
- **Quick bet** — tap a match card to enter scores inline, or open the full sheet for advanced options
- **Live schedule** — chronological view grouped by day, or A–L group tabs with standings
- **Leaderboard** — per-group rankings and global standings
- **Push notifications** — pre-game reminders and result alerts
- **PWA** — installable on iOS (via Safari) and Android (via Chrome)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), Tailwind CSS 4 |
| Backend | Cloudflare Worker (Hono-less, raw fetch handler) |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Workers (frontend via `@opennextjs/cloudflare`) |
| Auth | Email + password, JWT HS256 cookie |
| Push | Web Push (VAPID) |
| Score data | football-data.org API (free tier) |

## Local development

### Prerequisites

- Node.js 20+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

### Setup

```bash
# 1. Install dependencies
npm install
cd worker && npm install && cd ..

# 2. Create the D1 database
npm run db:create
# Copy the database_id into worker/wrangler.toml

# 3. Apply the schema
npm run db:init

# 4. Seed WC2026 fixtures
cd worker && wrangler d1 execute betwithfriends --local \
  --file=src/db/reset-and-seed.sql --config=wrangler.toml && cd ..

# 5. Set worker secrets (in worker/)
cd worker
wrangler secret put JWT_SECRET          # random 32+ char string
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT       # mailto:you@example.com
# FOOTBALL_DATA_API_KEY is optional in dev — omit to skip score sync
cd ..

# 6. Copy env template
cp .env.example .env.local              # then fill in values

# 7. Start both servers
npm run worker:dev    # API on http://localhost:8787
npm run dev           # Next.js on http://localhost:3000
```

### Environment variables

`.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your public VAPID key>
```

Generate VAPID keys: `npm run vapid:generate`

### Dev utilities

```bash
# Manually trigger scoring for a match (no API key needed in dev)
curl -X POST http://localhost:8787/api/dev/score-match \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"match_id":"<id>","home_score":2,"away_score":1}'

# Send a reminder notification right now to your own subscribed devices
curl -X POST http://localhost:8787/api/dev/send-reminder \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"match_id":"<id>"}'

# Send a result notification right now to your own subscribed devices
curl -X POST http://localhost:8787/api/dev/send-result \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"match_id":"<id>","home_score":2,"away_score":1}'

# Reset local DB to clean state + all fixtures
cd worker && wrangler d1 execute betwithfriends --local \
  --file=src/db/reset-and-seed.sql --config=wrangler.toml
```

## Scoring rules

Scoring is based on the **90-minute result only** (extra time and penalties are excluded).

Bets lock **5 minutes before kickoff**.

| Outcome | Points |
|---|---|
| Correct result (winner or draw) | +10 |
| Exact score (bonus) | +5 |
| Wrong | 0 |

**Confidence modifier** (additive):

| Level | Correct | Wrong |
|---|---|---|
| None | +0 | 0 |
| Cautious 😬 | +2 | −2 |
| Confident 👍 | +5 | −5 |
| Reckless 🔥 | +10 | −10 |

**Double Up**: multiplies total × 2 (only if positive). Max 2 Double Ups per user per group.

## Deploy to Cloudflare

### One-time setup

1. Create the production D1 database and note its ID
2. Update `worker/wrangler.production.toml` with the production `database_id` and `APP_URL`
3. Set worker secrets for production:
   ```bash
   cd worker
   wrangler secret put JWT_SECRET --config wrangler.production.toml
   wrangler secret put FOOTBALL_DATA_API_KEY --config wrangler.production.toml
   wrangler secret put VAPID_PUBLIC_KEY --config wrangler.production.toml
   wrangler secret put VAPID_PRIVATE_KEY --config wrangler.production.toml
   wrangler secret put VAPID_SUBJECT --config wrangler.production.toml
   ```
4. Apply schema to production DB:
   ```bash
   cd worker && wrangler d1 execute betwithfriends --remote \
     --file=src/db/schema.sql --config=wrangler.production.toml
   ```
5. Seed WC2026 fixtures on production:
   ```bash
   cd worker && wrangler d1 execute betwithfriends --remote \
     --file=src/db/reset-and-seed.sql --config=wrangler.production.toml
   ```

### Manual deploy

```bash
npm run worker:deploy:production   # deploy API worker
npm run cf:deploy                  # build + deploy frontend
```

### CI/CD (GitHub Actions)

The workflow in `.github/workflows/deploy-cloudflare.yml` deploys both workers on push to `main`.

**GitHub Secrets** (Settings → Secrets → Actions):
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

**GitHub Variables** (Settings → Variables → Actions):
- `NEXT_PUBLIC_API_URL` — deployed API worker URL
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — must match the VAPID key on the worker

## Project structure

```
.
├── app/                    Next.js App Router
│   ├── (app)/              Authenticated pages (home, fixtures, special, profile, groups, teams, rankings)
│   ├── (auth)/             Unauthenticated pages (login)
│   └── layout.tsx          Root layout (manifest, service worker, install prompt)
├── components/
│   ├── match-card.tsx      Match card with quick-bet + full BetSheet
│   ├── install-prompt.tsx  Platform-aware PWA install banner + hook
│   ├── group-invite.tsx    Invite link component
│   └── sw-registrar.tsx    Service worker registration
├── lib/
│   ├── api.ts              apiFetch — adds auth header, handles 401 globally
│   └── push.ts             Web Push subscription helper
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js               Service worker
│   └── icons/              PWA icons (192, 512, apple-touch-icon)
└── worker/                 Cloudflare API Worker
    ├── src/
    │   ├── index.ts        Router, JWT verify, CORS
    │   ├── handlers/       Route handlers (auth, groups, matches, bets, ...)
    │   ├── services/       scores-sync.ts, scoring.ts, push-service.ts
    │   ├── db/
    │   │   ├── schema.sql
    │   │   └── reset-and-seed.sql   Full reset + WC2026 fixtures
    │   └── types.ts
    ├── wrangler.toml               Local dev config
    └── wrangler.production.toml    Production config
```
