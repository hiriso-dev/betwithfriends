"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !pseudo.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ id: string; invite_code: string }>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), pseudo: pseudo.trim() }),
      });
      router.push(`/groups/${data.id}?new=1`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-sm text-muted transition active:text-accent"
      >
        ← Back
      </button>

      <h1 className="mb-6 text-2xl font-bold">Create group</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted">
            Group name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Office predictions"
            maxLength={50}
            required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none transition"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted">
            Your nickname in this group
          </label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="e.g. PredictionKing"
            maxLength={30}
            required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none transition"
          />
          <p className="mt-1.5 text-xs text-muted">
            Nicknames are unique within each group
          </p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading || !name.trim() || !pseudo.trim()}
          className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#0f0f23] transition active:scale-95 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create group"}
        </button>
      </form>
    </div>
  );
}
