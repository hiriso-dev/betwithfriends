## 1. Centralize the pending-result placeholder

- [x] 1.1 In [lib/match-score.ts](lib/match-score.ts), extend `getMatchScoreDisplay`'s return type with `pending: boolean`.
- [x] 1.2 When `home_score` or `away_score` is null, return `{ primary: "–", secondary: null, inline: "–", pending: true }` instead of all-null.
- [x] 1.3 When scores are present, return `pending: false` and keep the existing primary/secondary/inline logic unchanged (including the parenthesized extra-time/penalty final score).

## 2. Update call sites to use the shared placeholder

- [x] 2.1 Game page [app/(app)/matches/[id]/bets/page.tsx:199](app/(app)/matches/[id]/bets/page.tsx#L199): remove the `?? \`${match.home_score ?? 0} – ${match.away_score ?? 0}\`` fallback and render `scoreDisplay.primary` directly; rely on the existing status line (`● Live` / `Full time` / status) to convey state.
- [x] 2.2 Home recent-results [app/(app)/home/page.tsx:291](app/(app)/home/page.tsx#L291): remove the `?? \`${m.home_score} – ${m.away_score}\`` fallback and render `scoreDisplay.inline` directly.
- [x] 2.3 Match card [components/match-card.tsx:220](components/match-card.tsx#L220): remove the `?? \`${match.home_score ?? 0} – ${match.away_score ?? 0}\`` fallback and render `scoreDisplay.primary` directly.
- [x] 2.4 (Optional) On the game page, when `scoreDisplay.pending` is true, add a muted "Pending result" hint near the status line for extra clarity.
- [x] 2.5 Audit the remaining `getMatchScoreDisplay` consumer [app/(app)/history/page.tsx](app/(app)/history/page.tsx) to confirm it still compiles and renders correctly with the new `pending` field (no numeric fallback reintroduced).

## 3. Verify

- [x] 3.1 Run `npm run lint` / type-check to confirm the return-type change compiles across all consumers. (`tsc --noEmit` exits 0; no new lint issues in edited files.)
- [x] 3.2 Manually verify: a live/over match with null scores shows `–` (not `0 – 0`) on the game page and `–` (not `null – null`) in home recent results; a finished match with a synced score still shows the real score (and parenthesized final for ET/penalties). (Verified via functional check of `getMatchScoreDisplay` across pending / regular / penalty cases.)
