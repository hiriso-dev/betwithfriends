"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useInstallable, useInstallBadgeAck } from "@/components/install-prompt";

type UserProfile = {
  email: string;
  pseudo_default: string;
};

type NotifPrefs = {
  remind_before_game: boolean;
  result_after_game: boolean;
};

type InstallMode = ReturnType<typeof useInstallable>["mode"];

function getPushSetupMessage(
  installMode: InstallMode,
  standalone: boolean,
  issue: "insecure" | "notifications" | "service-workers" | "push-api"
) {
  const installAction =
    installMode === "ios-other"
      ? "Open this page in Safari, add BetWithFriends to your Home Screen, then enable notifications."
      : installMode === "ios-safari"
        ? "Add BetWithFriends to your Home Screen in Safari, then enable notifications."
        : installMode === "prompt" || installMode === "android-other"
          ? "Install BetWithFriends from your browser, then enable notifications."
          : "Use a browser that supports notifications, then enable them.";

  const alertSummary =
    "That unlocks a reminder before kickoff and a score update with your points after full time.";

  if (issue === "insecure") {
    return standalone
      ? `This app is not running over HTTPS right now. Reopen BetWithFriends securely from Safari and reinstall if needed. ${alertSummary}`
      : `Notifications need HTTPS. ${installAction} ${alertSummary}`;
  }

  if (standalone) {
    return `This installed app still cannot access notifications in this context. Reopen BetWithFriends from Safari and try again. ${alertSummary}`;
  }

  return `${installAction} ${alertSummary}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs>({ remind_before_game: true, result_after_game: true });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [pushBlockedReason, setPushBlockedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const { mode: installMode, isStandalone, triggerInstall } = useInstallable();
  const [installBadgeAck, setInstallBadgeAck] = useInstallBadgeAck();

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiFetch<UserProfile>("/api/auth/me"),
      apiFetch<NotifPrefs>("/api/push/prefs"),
    ]).then(([p, n]) => {
      if (cancelled) return;
      setProfile(p);
      setPrefs(n);
    }).catch(() => router.push("/login"))
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (typeof window === "undefined") return;

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        !!(navigator as { standalone?: boolean }).standalone;

      if (!window.isSecureContext) {
        if (!cancelled) {
          setPushSupported(false);
          setPushEnabled(false);
          setPushBlockedReason(getPushSetupMessage(installMode, standalone, "insecure"));
        }
        return;
      }

      if (!("Notification" in window)) {
        if (!cancelled) {
          setPushSupported(false);
          setPushEnabled(false);
          setPushBlockedReason(getPushSetupMessage(installMode, standalone, "notifications"));
        }
        return;
      }

      if (!("serviceWorker" in navigator)) {
        if (!cancelled) {
          setPushSupported(false);
          setPushEnabled(false);
          setPushBlockedReason(getPushSetupMessage(installMode, standalone, "service-workers"));
        }
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const supported = "pushManager" in registration;

        if (!cancelled) {
          setPushSupported(supported);
        }

        if (!supported) {
          if (!cancelled) {
            setPushEnabled(false);
            setPushBlockedReason(getPushSetupMessage(installMode, standalone, "push-api"));
          }
          return;
        }

        const { getPushSubscription, subscribePush } = await import("@/lib/push");
        const subscription = await getPushSubscription();

        if (Notification.permission === "granted" && subscription !== null) {
          await subscribePush();
        }

        if (!cancelled) {
          setPushBlockedReason(null);
          setPushEnabled(Notification.permission === "granted" && subscription !== null);
        }
      } catch (error) {
        if (!cancelled) {
          setPushSupported(false);
          setPushEnabled(false);
          setPushBlockedReason(
            error instanceof Error
              ? error.message
              : "Service worker registration is not available yet. Reload the app and try again."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [installMode]);

  async function enablePush() {
    if (!pushSupported) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    try {
      const { subscribePush } = await import("@/lib/push");
      await subscribePush();
      setPushBlockedReason(null);
      setPushEnabled(true);
    } catch (error) {
      setPushEnabled(false);
      setPushBlockedReason(
        error instanceof Error ? error.message : "Unable to enable notifications."
      );
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

  async function sendPushTest() {
    setTesting(true);
    setTestMessage(null);

    try {
      const result = await apiFetch<{ ok: true; sent: number }>("/api/push/test", {
        method: "POST",
      });

      setTestMessage(
        result.sent === 1
          ? "Test notification sent."
          : `Test notification sent to ${result.sent} devices.`
      );
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : "Unable to send test notification.");
    } finally {
      setTesting(false);
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
    <div className="mx-auto max-w-lg lg:max-w-2xl px-4 pt-4 pb-8">
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

      {!isStandalone && installMode && (
        <div
          className={`mb-4 rounded-2xl border p-4 ${
            installBadgeAck ? "border-border bg-surface" : "border-accent/40 bg-accent/10"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xl text-accent">
              📲
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Recommended</p>
              <h2 className="mt-1 text-lg font-black">Add BetWithFriends to your Home Screen</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Install the app for one-tap access, a reminder before kickoff, and a score update with your points after full time.
              </p>
              <div className="mt-3">
                <PushBenefitChips />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface/70 p-4">
            {installMode === "prompt" && (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Install it now, then enable notifications for pre-game reminders and full-time score updates.
                </p>
                <button
                  onClick={triggerInstall}
                  className="w-full rounded-xl bg-accent py-3 font-semibold text-[#0f0f23] transition active:scale-95"
                >
                  Install app
                </button>
              </div>
            )}

            {installMode === "ios-safari" && (
              <div className="space-y-2 text-sm text-muted">
                <p>1. Tap <strong className="text-foreground">Share ⬆</strong> at the bottom of Safari</p>
                <p>2. Tap <strong className="text-foreground">Add to Home Screen</strong></p>
                <p>3. Tap <strong className="text-foreground">Add</strong></p>
              </div>
            )}

            {installMode === "ios-other" && (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  On iPhone, notifications start with the installed app. Open this page in Safari, add it to your Home Screen, then enable alerts.
                </p>
                <a
                  href={typeof window !== "undefined"
                    ? window.location.href.replace(/^https:\/\//, "x-safari-https://").replace(/^http:\/\//, "x-safari-http://")
                    : "#"}
                  className="block w-full rounded-xl bg-accent py-3 text-center font-semibold text-[#0f0f23] transition active:scale-95"
                >
                  Open in Safari
                </a>
              </div>
            )}

            {installMode === "android-other" && (
              <div className="space-y-2 text-sm text-muted">
                <p>1. Open your browser menu using <strong className="text-foreground">⋮</strong></p>
                <p>2. Tap <strong className="text-foreground">Add to Home Screen</strong> or <strong className="text-foreground">Install app</strong></p>
              </div>
            )}
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={installBadgeAck}
              onChange={(e) => setInstallBadgeAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span className="text-sm text-muted">
              Don&apos;t remind me — hide the badge on the Profile icon.
            </span>
          </label>
        </div>
      )}

      <div
        className="mb-4 rounded-2xl bg-surface border border-border overflow-hidden cursor-pointer active:bg-surface-hover transition"
        onClick={() => router.push("/history")}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div>
              <p className="font-semibold text-sm">Bet History</p>
              <p className="text-xs text-muted">All your predictions and results</p>
            </div>
          </div>
          <span className="text-muted text-lg">›</span>
        </div>
      </div>

      <div
        className="mb-4 rounded-2xl bg-surface border border-border overflow-hidden cursor-pointer active:bg-surface-hover transition"
        onClick={() => router.push("/groups")}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">👥</span>
            <div>
              <p className="font-semibold text-sm">My Groups</p>
              <p className="text-xs text-muted">Manage your betting groups</p>
            </div>
          </div>
          <span className="text-muted text-lg">›</span>
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-surface border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Notifications</h2>
        </div>

        {!pushSupported ? (
          <div className="p-4">
            <p className="text-sm text-muted">
              {pushBlockedReason ?? "Install BetWithFriends first to get a reminder before kickoff and a score update with your points after full time. On iPhone and iPad, the install has to start in Safari."}
            </p>
            <div className="mt-4 rounded-xl border border-accent/20 bg-accent/10 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-accent">With the installed app</p>
              <div className="mt-2">
                <PushBenefitChips />
              </div>
            </div>
          </div>
        ) : !pushEnabled ? (
          <div className="p-4">
            <p className="mb-3 text-sm text-muted">
              Enable push notifications to get a reminder before kickoff and a score update with your points after full time.
            </p>
            <button
              onClick={enablePush}
              className="w-full rounded-xl bg-accent py-3 font-semibold text-[#0f0f23] transition active:scale-95"
            >
              Enable notifications
            </button>
            {pushBlockedReason && (
              <p className="mt-3 text-sm text-muted">{pushBlockedReason}</p>
            )}
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
            <div className="px-4 py-4">
              <p className="mb-3 text-sm text-muted">
                Send a real push notification now to confirm this device is set up correctly.
              </p>
              <button
                onClick={sendPushTest}
                disabled={testing}
                className="w-full rounded-xl border border-border bg-surface-hover py-3 text-sm font-semibold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? "Sending test..." : "Send test notification"}
              </button>
              {testMessage && (
                <p className="mt-3 text-sm text-muted">{testMessage}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {isStandalone ? (
        <div className="mb-4 rounded-2xl bg-surface border border-border px-4 py-3 flex items-center gap-3">
          <span className="text-success text-xl">✓</span>
          <div>
            <p className="font-medium text-sm">{pushSupported ? "App installed" : "Added to Home Screen"}</p>
            <p className="text-xs text-muted">{pushSupported ? "Running as installed app" : "Running in standalone mode"}</p>
          </div>
        </div>
      ) : null}

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

function PushBenefitChips() {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full border border-accent/20 bg-background/60 px-3 py-1 text-xs text-foreground">
        Reminder before kickoff
      </span>
      <span className="rounded-full border border-accent/20 bg-background/60 px-3 py-1 text-xs text-foreground">
        Final score + points
      </span>
    </div>
  );
}
