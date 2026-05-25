"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

type UserProfile = {
  email: string;
  pseudo_default: string;
};

type NotifPrefs = {
  remind_before_game: boolean;
  result_after_game: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs>({ remind_before_game: true, result_after_game: true });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<UserProfile>("/api/auth/me"),
      apiFetch<NotifPrefs>("/api/push/prefs"),
    ]).then(([p, n]) => {
      setProfile(p);
      setPrefs(n);
    }).catch(() => router.push("/login"))
      .finally(() => setLoading(false));

    if (typeof window !== "undefined" && "Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
  }, [router]);

  async function enablePush() {
    if (!("serviceWorker" in navigator)) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    try {
      const { subscribePush } = await import("@/lib/push");
      await subscribePush();
      setPushEnabled(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function savePrefs(next: Partial<NotifPrefs>) {
    const updated = { ...prefs, ...next };
    setPrefs(updated);
    setSaving(true);
    try {
      await apiFetch("/api/push/prefs", {
        method: "POST",
        body: JSON.stringify(updated),
      });
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    document.cookie = "bwf_token=; path=/; max-age=0";
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-24 rounded-2xl bg-surface animate-pulse" />
        <div className="h-40 rounded-2xl bg-surface animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-8">
      <h1 className="mb-6 text-xl font-bold">Profile</h1>

      {profile && (
        <div className="mb-4 rounded-2xl bg-surface border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center text-xl">
              {profile.email[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{profile.email}</p>
              <p className="text-sm text-muted">World Cup 2026 predictor</p>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      <div className="mb-4 rounded-2xl bg-surface border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Notifications</h2>
        </div>

        {!pushEnabled ? (
          <div className="p-4">
            <p className="mb-3 text-sm text-muted">
              Enable push notifications to get reminders before games and results after.
            </p>
            <button
              onClick={enablePush}
              className="w-full rounded-xl bg-accent py-3 font-semibold text-[#0f0f23] transition active:scale-95"
            >
              Enable notifications
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <Toggle
              label="Remind me before games"
              description="1 hour before kickoff if you haven't bet"
              checked={prefs.remind_before_game}
              onChange={(v) => savePrefs({ remind_before_game: v })}
              disabled={saving}
            />
            <Toggle
              label="Results & points"
              description="After each game ends"
              checked={prefs.result_after_game}
              onChange={(v) => savePrefs({ result_after_game: v })}
              disabled={saving}
            />
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={logout}
        className="w-full rounded-xl border border-danger/30 py-3.5 text-danger font-medium transition active:bg-danger/10"
      >
        Sign out
      </button>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-accent" : "bg-surface-hover border border-border"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
