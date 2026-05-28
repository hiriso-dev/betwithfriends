"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold">Reset your password</h1>
          <p className="mt-2 text-sm text-muted">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground">
              If an account exists for <span className="font-medium">{email}</span>, a reset
              link is on its way. Check your inbox (and spam folder).
            </p>
            <a
              href="/login"
              className="inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-[#0f0f23] transition active:scale-95"
            >
              Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Email address</label>
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
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <div className="text-center">
              <a href="/login" className="text-sm text-muted hover:underline">
                Back to sign in
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
