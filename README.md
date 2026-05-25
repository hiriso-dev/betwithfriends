This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Deploy To Cloudflare With GitHub

This repo deploys two separate Cloudflare Workers from GitHub:

- `betwithfriends-api` from [worker/wrangler.production.toml](worker/wrangler.production.toml)
- `betwithfriends` from [wrangler.jsonc](wrangler.jsonc)

The workflow is in [.github/workflows/deploy-cloudflare.yml](.github/workflows/deploy-cloudflare.yml). It runs on pushes to `main` and on manual dispatch.

### One-time Cloudflare setup

1. Create the D1 database for the API worker.
2. Apply the schema from [worker/src/db/schema.sql](worker/src/db/schema.sql).
3. Create the R2 bucket referenced by [wrangler.jsonc](wrangler.jsonc).
4. Replace `APP_URL` in [worker/wrangler.production.toml](worker/wrangler.production.toml) with your real frontend URL.
5. Set the API worker secrets in Cloudflare once:
   `JWT_SECRET`, `FOOTBALL_DATA_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

### GitHub configuration

Add these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Add these GitHub Actions repository variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

`NEXT_PUBLIC_API_URL` should point to the deployed API worker URL. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must match the public VAPID key configured on the API worker.

### Manual deploy commands

```bash
npm run worker:deploy:production
npm run cf:deploy
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
