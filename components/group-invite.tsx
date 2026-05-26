"use client";
import { useState } from "react";

export default function GroupInvite({
  groupName,
  inviteCode,
  onClose,
}: {
  groupName: string;
  inviteCode: string;
  onClose: () => void;
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/groups/join?code=${inviteCode}`
    : `https://betwithfriends.com/groups/join?code=${inviteCode}`;

  async function copy(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "code") { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }
      else                  { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
    } catch {
      // fallback: select text manually (already visible)
    }
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({
        title: `Join ${groupName} on BetWithFriends`,
        text: `Join my World Cup 2026 prediction group "${groupName}"!`,
        url: inviteUrl,
      }).catch(() => {});
    } else {
      copy(inviteUrl, "link");
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl bg-surface shadow-2xl pb-safe">
        <div className="px-6 pt-3 pb-6">
          {/* Handle */}
          <div className="mb-5 h-1 w-12 rounded-full bg-border mx-auto" />

          <h3 className="text-lg font-bold text-center mb-1">Invite friends</h3>
          <p className="text-sm text-muted text-center mb-5">Share the code or the link below</p>

          {/* Invite code */}
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-5 py-4">
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Invite code</p>
              <p className="text-4xl font-black tracking-widest text-accent">{inviteCode}</p>
            </div>
            <button
              onClick={() => copy(inviteCode, "code")}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                copiedCode ? "bg-success/20 text-success" : "bg-surface-hover border border-border text-muted active:text-foreground"
              }`}
            >
              {copiedCode ? "✓" : "Copy"}
            </button>
          </div>

          {/* Invite link */}
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface-hover px-4 py-3">
            <p className="flex-1 truncate text-sm text-muted font-mono">{inviteUrl}</p>
            <button
              onClick={() => copy(inviteUrl, "link")}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                copiedLink ? "bg-success/20 text-success" : "border border-border bg-surface text-muted active:text-foreground"
              }`}
            >
              {copiedLink ? "✓" : "Copy"}
            </button>
          </div>

          {/* Share button */}
          <button
            onClick={share}
            className="w-full rounded-xl bg-accent py-4 font-bold text-[#0f0f23] transition active:scale-95"
          >
            Share →
          </button>
        </div>
      </div>
    </>
  );
}
