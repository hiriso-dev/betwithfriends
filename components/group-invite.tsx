"use client";
import { useState, useEffect } from "react";

export default function GroupInvite({
  groupName,
  inviteCode,
  onClose,
}: {
  groupName: string;
  inviteCode: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/groups/join?code=${inviteCode}`
    : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({
        title: `Join ${groupName} on BetWithFriends`,
        text: `I'm predicting World Cup 2026 results. Join my group "${groupName}"!`,
        url: inviteUrl,
      });
    } else {
      copyLink();
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-surface p-6 shadow-2xl">
        <div className="mb-1 h-1 w-12 rounded-full bg-border mx-auto" />
        <div className="mt-4 mb-6 text-center">
          <h3 className="text-lg font-bold">Invite friends</h3>
          <p className="text-sm text-muted mt-1">Share this code or link</p>
        </div>

        {/* Invite code */}
        <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/5 p-4 text-center">
          <p className="text-xs text-muted mb-1 uppercase tracking-widest">Invite code</p>
          <p className="text-4xl font-black tracking-widest text-accent">{inviteCode}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copyLink}
            className="flex-1 rounded-xl border border-border py-3.5 font-semibold text-sm transition active:border-accent active:text-accent"
          >
            {copied ? "✓ Copied!" : "Copy link"}
          </button>
          <button
            onClick={share}
            className="flex-1 rounded-xl bg-accent py-3.5 font-semibold text-sm text-[#0f0f23] transition active:scale-95"
          >
            Share
          </button>
        </div>
      </div>
    </>
  );
}
