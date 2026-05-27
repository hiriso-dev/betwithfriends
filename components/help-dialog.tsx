"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "bwf-rules-seen";

export function useHelpDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      return;
    }

    apiFetch<{ id: string; my_bet?: unknown }[]>("/api/matches")
      .then((matches) => {
        const hasBets = matches.some((m) => m.my_bet);
        if (!hasBets) {
          setOpen(true);
        }
        localStorage.setItem(STORAGE_KEY, "1");
      })
      .catch(() => {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, "1");
      });
  }, []);

  function close() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  return { open, close, openHelp: () => setOpen(true) };
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-[50%] z-[70] max-h-[80vh] -translate-y-1/2 overflow-y-auto rounded-3xl bg-surface shadow-2xl">
        <div className="relative p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full p-2 text-muted hover:bg-border hover:text-foreground transition"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="mb-5 text-center">
            <div className="mb-2 text-4xl">⚽</div>
            <h2 className="text-xl font-black">How to play</h2>
            <p className="mt-1 text-sm text-muted">Predict every World Cup score, earn points, beat your friends</p>
          </div>

          {/* Betting */}
          <Section title="Placing a bet">
            <p className="text-sm text-muted leading-relaxed">
              On the <strong className="text-foreground">Games</strong> tab, each upcoming match shows score boxes.{" "}
              <strong className="text-foreground">Tap the number</strong> to increase the score.{" "}
              The <strong className="text-foreground">− button</strong> below decreases it.
              Bets lock <strong className="text-foreground">5 minutes before kickoff</strong>.
            </p>
          </Section>

          {/* Scoring */}
          <Section title="Scoring">
            <div className="space-y-2">
              <Row label="Correct result (win/draw)" value="+10 pts" color="text-success" />
              <Row label="Exact score bonus" value="+5 pts" color="text-success" />
              <Row label="Wrong result" value="0 pts" color="text-muted" />
            </div>
          </Section>

          {/* Confidence */}
          <Section title="Confidence boost">
            <p className="mb-3 text-xs text-muted">Choose a level to stake extra points — you win more if right, lose more if wrong.</p>
            <div className="space-y-2">
              <Row label="😬 Cautious" value="±2 pts" />
              <Row label="👍 Confident" value="±5 pts" />
              <Row label="🔥 Reckless" value="±10 pts" />
            </div>
            <p className="mt-2 text-xs text-muted">Example: Confident + correct result = 10 + 5 = <strong className="text-foreground">15 pts</strong>. Wrong = 10 → 0 − 5 = <strong className="text-danger">−5 pts</strong>.</p>
          </Section>

          {/* Double Up */}
          <Section title="×2 Double Up">
            <p className="text-sm text-muted leading-relaxed">
              Toggle <strong className="text-foreground">×2</strong> on a bet to double all points earned — but only if you score more than 0.
              You can use it on up to <strong className="text-foreground">2 matches per group</strong>.
            </p>
          </Section>

          {/* Special bets */}
          <Section title="Special bets" last>
            <p className="text-sm text-muted leading-relaxed">
              Before the tournament starts (June 11), pick the{" "}
              <strong className="text-foreground">World Champion, Runner-up, Third place</strong>, and{" "}
              <strong className="text-foreground">Golden Boot</strong> winner.
              These lock permanently at kick-off and are worth 15–50 pts.
            </p>
          </Section>

          <button
            onClick={onClose}
            className="mt-2 w-full rounded-xl bg-accent py-4 font-bold text-[#0f0f23] transition active:scale-95"
          >
            Got it &mdash; let&apos;s play!
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`py-4 ${!last ? "border-b border-border" : ""}`}>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}
