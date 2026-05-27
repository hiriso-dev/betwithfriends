"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useInstallable } from "@/components/install-prompt";

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
  const [pushSupported, setPushSupported] = useState(true);
  const [pushBlockedReason, setPushBlockedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const { mode: installMode, isStandalone, triggerInstall } = useInstallable();

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

    void (async () => {
      if (typeof window === "undefined") return;

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        !!(navigator as { standalone?: boolean }).standalone;

      if (!window.isSecureContext) {
        if (!cancelled) {
          setPushSupported(false);
          setPushEnabled(false);
          setPushBlockedReason(
            standalone
              ? "This home-screen app is running over HTTP. On iPhone and iPad, notifications only work when the app is opened from Safari over HTTPS."
              : "Push notifications require HTTPS."
          );
        }
        return;
      }

      if (!("Notification" in window)) {
        if (!cancelled) {
          setPushSupported(false);
          setPushEnabled(false);
          setPushBlockedReason("This browser does not expose the Notifications API in this context.");
        }
        return;
      }

      if (!("serviceWorker" in navigator)) {
        if (!cancelled) {
          setPushSupported(false);
          setPushEnabled(false);
          setPushBlockedReason("This browser does not expose service workers in this context.");
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
            setPushBlockedReason(
              standalone
                ? "This standalone app still does not expose the Push API. On iPhone and iPad, use Safari 16.4+ and install from Safari over HTTPS."
                : "This browser does not expose the Push API in this context."
            );
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
  }, [router]);

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
              {pushBlockedReason ?? "Push notifications need a browser with Push API support. On iPhone and iPad, install the app to the home screen in Safari first."}
            </p>
          </div>
        ) : !pushEnabled ? (
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
      ) : (
        <div className="mb-4 rounded-2xl bg-surface border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold">Install App</h2>
            <p className="text-xs text-muted mt-0.5">Add BetWithFriends to your home screen</p>
          </div>
          <div className="p-4">
            {installMode === "prompt" && (
              <button
                onClick={triggerInstall}
                className="w-full rounded-xl bg-accent py-3 font-semibold text-[#0f0f23] transition active:scale-95"
              >
                📲 Install app
              </button>
            )}
            {installMode === "ios-safari" && (
              <div className="text-sm text-muted space-y-2">
                <p>1. Tap <strong className="text-foreground">Share ⬆</strong> at the bottom of Safari</p>
                <p>2. Scroll down and tap <strong className="text-foreground">&quot;Add to Home Screen&quot;</strong></p>
                <p>3. Tap <strong className="text-foreground">Add</strong></p>
              </div>
            )}
            {installMode === "ios-other" && (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Safari is required to install on iPhone. Open this page in Safari first.
                </p>
                <a
                  href={typeof window !== "undefined"
                    ? window.location.href.replace(/^https:\/\//, "x-safari-https://").replace(/^http:\/\//, "x-safari-http://")
                    : "#"}
                  className="block w-full rounded-xl bg-accent py-3 text-center font-semibold text-[#0f0f23] transition active:scale-95"
                >
                  Open in Safari →
                </a>
                <p className="text-center text-xs text-muted">Then tap Share ⬆ → &quot;Add to Home Screen&quot;</p>
              </div>
            )}
            {installMode === "android-other" && (
              <div className="text-sm text-muted space-y-2">
                <p>Tap <strong className="text-foreground">⋮ Menu</strong> in your browser</p>
                <p>Then tap <strong className="text-foreground">&quot;Add to Home Screen&quot;</strong> or{" "}
                  <strong className="text-foreground">&quot;Install app&quot;</strong></p>
              </div>
            )}
            {!installMode && (
              <p className="text-sm text-muted text-center">
                Use Chrome or Safari to install this app.
              </p>
            )}
          </div>
        </div>
      )}

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
