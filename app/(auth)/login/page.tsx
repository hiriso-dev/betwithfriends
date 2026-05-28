"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const cameFromInvite = !!next && next.startsWith("/groups/join");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">(cameFromInvite ? "register" : "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await apiFetch<{ jwt: string }>(path, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      document.cookie = `bwf_token=${data.jwt}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      router.replace(next && next.startsWith("/") ? next : "/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <img
            src="/betWithFriendsLogo.png"
            alt="BetWithFriends"
            className="mx-auto mb-5 h-64 w-auto"
          />
          <h1 className="text-xl font-bold leading-snug">
            Bet with your Friends on the<br />Coming World Cup 2026
          </h1>
          <p className="mt-2 text-sm font-medium text-accent">
            Completely free · No ads
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-xl border border-border bg-surface p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg px-3 py-2 transition ${mode === "login" ? "bg-accent text-[#0f0f23] font-semibold" : "text-muted"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-lg px-3 py-2 transition ${mode === "register" ? "bg-accent text-[#0f0f23] font-semibold" : "text-muted"}`}
          >
            Create account
          </button>
        </div>

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
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Minimum 8 characters" : "Your password"}
              minLength={8}
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none transition"
            />
          </div>
          {mode === "login" && (
            <div className="text-right">
              <a href="/forgot-password" className="text-sm text-accent hover:underline">
                Forgot password?
              </a>
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#0f0f23] transition active:scale-95 disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
