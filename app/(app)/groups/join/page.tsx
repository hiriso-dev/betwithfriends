"use client";
import { useState, useEffect, Suspense } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [step, setStep] = useState<"code" | "pseudo">("code");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
      setStep("pseudo");
    }
  }, [searchParams]);

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setStep("pseudo");
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!pseudo.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ id: string }>("/api/groups/join", {
        method: "POST",
        body: JSON.stringify({ invite_code: code.toUpperCase().trim(), pseudo: pseudo.trim() }),
      });
      router.push(`/groups/${data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to join group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <button
        onClick={() => (step === "pseudo" ? setStep("code") : router.back())}
        className="mb-6 flex items-center gap-2 text-sm text-muted transition active:text-accent"
      >
        ← Back
      </button>

      <h1 className="mb-2 text-2xl font-bold">Join a group</h1>
      <p className="mb-6 text-sm text-muted">Enter the invite code shared by your group admin.</p>

      {step === "code" ? (
        <form onSubmit={checkCode} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={8}
            required
            className="w-full rounded-xl border border-border bg-surface px-4 py-4 text-center text-2xl font-bold tracking-widest text-foreground placeholder:text-muted/40 focus:border-accent focus:outline-none transition"
          />
          <button
            type="submit"
            disabled={code.trim().length < 4}
            className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
          >
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="rounded-xl bg-surface border border-border px-4 py-3 text-center">
            <p className="text-xs text-muted">Code</p>
            <p className="text-xl font-bold tracking-widest">{code}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted">
              Your nickname in this group
            </label>
            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="e.g. GoalMachine"
              maxLength={30}
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none transition"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading || !pseudo.trim()}
            className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
          >
            {loading ? "Joining…" : "Join group"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function JoinGroupPage() {
  return (
    <Suspense>
      <JoinContent />
    </Suspense>
  );
}
