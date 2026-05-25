"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mb-3 text-6xl">⚽</div>
          <h1 className="text-2xl font-bold">BetWithFriends</h1>
          <p className="mt-1 text-sm text-muted">World Cup 2026 · bet with your crew</p>
        </div>

        {sent ? (
          <div className="rounded-2xl bg-surface border border-border p-6 text-center">
            <div className="mb-3 text-4xl">📬</div>
            <h2 className="mb-2 text-lg font-semibold">Check your email</h2>
            <p className="text-sm text-muted">
              We sent a magic link to{" "}
              <strong className="text-foreground">{email}</strong>.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-accent underline-offset-2 underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none transition"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#0f0f23] transition active:scale-95 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Continue with email"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
