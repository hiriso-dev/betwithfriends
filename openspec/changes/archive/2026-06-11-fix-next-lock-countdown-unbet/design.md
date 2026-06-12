## Context

The home dashboard ([app/(app)/home/page.tsx](app/(app)/home/page.tsx)) shows a "🔒 Next bet locks in" countdown above a featured-match card. Two notions of "next match" already exist in the component:

- `upcoming` — scheduled matches with `match_date > now`, sorted ascending by kickoff.
- `nextUnbet = upcoming.find(m => !m.my_bet)` — the first upcoming match the user has **not** bet on.
- `featured = nextUnbet ?? nextMatch` — what the card displays and the countdown button targets.

The countdown deadline, however, is computed from `upcoming[0]` (the next match overall):

```ts
const nextMatchLock = upcoming.length > 0 ? upcoming[0].match_date * 1000 - BET_LOCK_MS : Infinity;
```

When the user has already bet on `upcoming[0]`, the countdown ticks toward a match they no longer need to act on, and disagrees with the featured card. This is a one-line conceptual fix in pure frontend display logic.

## Goals / Non-Goals

**Goals:**
- Drive the match-lock half of the countdown from the next *un-bet* match.
- Keep the countdown, its label, its match reference, and its click target consistent with the featured card.
- Hide the match-lock contribution entirely when there is no un-bet upcoming match (the section then shows only if a specials deadline remains).

**Non-Goals:**
- No change to the special-bets deadline logic (`WC_START` gate).
- No change to bet locking, scoring, or any backend/API behaviour.
- No change to the featured-match card itself (it already uses `nextUnbet ?? nextMatch`).

## Decisions

**Decision: Base `nextMatchLock` on `nextUnbet` rather than `upcoming[0]`.**

Replace the `upcoming[0]` reference with `nextUnbet`. When `nextUnbet` is `undefined` (all upcoming matches bet), `nextMatchLock` becomes `Infinity`, so it drops out of `Math.min(specialsDeadline, nextMatchLock)`. The countdown section is already guarded by `nextDeadlineMs < Infinity && msUntilClose > 0`, so it hides automatically when no actionable deadline remains.

Rationale: This reuses the existing `nextUnbet` value (no new derivation), and `Infinity` already short-circuits both the `Math.min` and the render guard — the smallest, lowest-risk change.

*Alternative considered:* a separate "all bet" empty state for the countdown. Rejected — adds UI for a transient state already handled by hiding the section; the featured card still communicates "Next match" in that case.

**Decision: Keep the button's lock-vs-special branching, but ensure the match branch targets `featured`.**

The countdown button already calls `featured && setBetTarget(featured)` for the non-special branch, and `featured` resolves to `nextUnbet` whenever one exists. With `nextMatchLock` now also keyed off `nextUnbet`, the displayed match name, the countdown value, and the bet target all reference the same match. No additional change needed beyond confirming this alignment.

## Risks / Trade-offs

- [The next un-bet match may be far in the future while a sooner match is already bet] → Intended behaviour: the countdown reflects the user's *next required action*, not the next kickoff. The featured card already follows this convention, so the page stays internally consistent.
- [Section disappears once all upcoming matches are bet] → Acceptable and arguably desirable; the "Next match" card below still shows the upcoming fixture. The specials deadline (pre-tournament) keeps the section visible when relevant.
