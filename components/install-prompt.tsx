"use client";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

type Mode =
  | "ios-safari"    // Safari on iPhone/iPad — Share → Add to Home Screen
  | "ios-other"     // Chrome/Firefox/Edge on iOS — must open in Safari
  | "prompt"        // Chrome/Edge/Android — beforeinstallprompt available
  | "android-other" // Android browser without prompt — manual instructions
  | null;

let deferredPrompt: BeforeInstallPromptEvent | null = null;

function detectMode(): Mode | null {
  const ua = navigator.userAgent;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(navigator as { standalone?: boolean }).standalone;
  if (isStandalone) return null;

  // iOS detection (iPhone/iPod/iPad, including iPadOS 13+ which reports as Mac)
  const isIos =
    /iphone|ipod/i.test(ua) ||
    /ipad/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

  if (isIos) {
    // Safari on iOS: has "safari" in UA but NOT CriOS/FxiOS/EdgiOS/OPiOS/Chrome
    const isIosSafari =
      /safari/i.test(ua) && !/crios|fxios|edgios|opios|OPT\//i.test(ua);
    return isIosSafari ? "ios-safari" : "ios-other";
  }

  // Android
  if (/android/i.test(ua)) {
    return deferredPrompt ? "prompt" : "android-other";
  }

  // Desktop — only show if prompt available
  return deferredPrompt ? "prompt" : null;
}

function safariUrl(): string {
  return window.location.href.replace(/^https:\/\//, "x-safari-https://").replace(/^http:\/\//, "x-safari-http://");
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(navigator as { standalone?: boolean }).standalone
  );
}

function getInitialInstallMode(): Mode {
  if (typeof window === "undefined") return null;

  const dismissed = localStorage.getItem("bwf-install-dismissed");
  if (dismissed && Date.now() - Number(dismissed) < 7 * 86400000) {
    return null;
  }

  return detectMode();
}

function installTitle(mode: Mode): string {
  if (mode === "ios-other") return "Open in Safari first";
  if (mode === "ios-safari") return "Add to Home Screen";
  if (mode === "android-other") return "Install from browser menu";
  return "Install BetWithFriends";
}

function installDescription(mode: Mode): string {
  if (mode === "ios-other") {
    return "iPhone installation has to start in Safari before push notifications can work.";
  }
  if (mode === "ios-safari") {
    return "Install the app from Safari to unlock the full-screen experience and push notifications on iPhone and iPad.";
  }
  if (mode === "android-other") {
    return "Your browser can still add this app to the home screen even without the install prompt.";
  }
  return "Install the app for faster access, a cleaner mobile layout, and notification-ready behavior.";
}

// ---- Floating CTA + Sheet (global) ----

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(getInitialInstallMode);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setMode(detectMode());
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem("bwf-install-dismissed", String(Date.now()));
    setOpen(false);
    setMode(null);
  }

  async function install() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") deferredPrompt = null;
    }
    dismiss();
  }

  if (!mode) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[84px] z-[70] flex items-center gap-3 rounded-full border border-accent/35 bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur active:scale-95"
        aria-label="Open install app instructions"
      >
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent/18 text-accent">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8" aria-hidden="true">
            <rect x="7" y="2.75" width="10" height="18.5" rx="2.5" />
            <path d="M10 6.25h4" />
            <path d="M11 18.25h2" />
          </svg>
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-black text-[#0f0f23]">
            3
          </span>
        </span>
        <span className="min-w-0 text-left">
          <span className="block text-xs font-black uppercase tracking-[0.2em] text-accent">Install</span>
          <span className="block text-sm font-semibold">Get app benefits</span>
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-4 bottom-4 z-[71] max-h-[80vh] overflow-y-auto rounded-[28px] border border-border bg-surface shadow-2xl md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2">
            <div className="p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Install App</p>
                  <h2 className="mt-1 text-xl font-black">{installTitle(mode)}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{installDescription(mode)}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-border p-2 text-muted transition active:scale-95"
                  aria-label="Close install instructions"
                >
                  ✕
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <BenefitCard
                  title="Notifications"
                  description="Stay closer to reminders and match results, even when you are away from the app."
                />
                <BenefitCard
                  title="One tap"
                  description="Jump straight in from the home screen without reopening the browser every time."
                />
                <BenefitCard
                  title="Cleaner view"
                  description="Use a more app-like full-screen layout on mobile without browser chrome." 
                />
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-accent">How to install</p>

                {mode === "prompt" && (
                  <div className="space-y-3">
                    <Step number="1" text="Tap the install button below." />
                    <Step number="2" text="Confirm the browser install prompt." />
                    <Step number="3" text="Open BetWithFriends from your home screen next time." />
                    <button
                      onClick={install}
                      className="mt-1 w-full rounded-xl bg-accent py-3 font-bold text-[#0f0f23] transition active:scale-95"
                    >
                      Install app
                    </button>
                  </div>
                )}

                {mode === "ios-safari" && (
                  <div className="space-y-3">
                    <Step number="1" text="Tap Share ⬆ at the bottom of Safari." />
                    <Step number="2" text="Choose Add to Home Screen." />
                    <Step number="3" text="Tap Add, then open the app from your home screen." />
                  </div>
                )}

                {mode === "ios-other" && (
                  <div className="space-y-3">
                    <Step number="1" text="Open this page in Safari first." />
                    <Step number="2" text="In Safari, tap Share ⬆." />
                    <Step number="3" text="Choose Add to Home Screen, then tap Add." />
                    <a
                      href={safariUrl()}
                      className="mt-1 block w-full rounded-xl bg-accent py-3 text-center font-bold text-[#0f0f23] transition active:scale-95"
                    >
                      Open in Safari
                    </a>
                  </div>
                )}

                {mode === "android-other" && (
                  <div className="space-y-3">
                    <Step number="1" text="Open your browser menu using ⋮ or the share/menu button." />
                    <Step number="2" text="Tap Add to Home Screen or Install app." />
                    <Step number="3" text="Confirm the shortcut, then launch BetWithFriends from your home screen." />
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={dismiss}
                  className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted transition active:scale-95"
                >
                  Hide for now
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-surface-hover py-3 text-sm font-semibold transition active:scale-95"
                >
                  Keep icon
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ---- Hook for Profile page ----

export type InstallInfo = {
  mode: Mode;
  isStandalone: boolean;
  triggerInstall: () => Promise<void>;
};

export function useInstallable(): InstallInfo {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return null;
    return detectMode();
  });
  const [isStandalone] = useState(isStandaloneMode);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setMode(detectMode());
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function triggerInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      setMode(null);
    }
  }

  return { mode, isStandalone, triggerInstall };
}

function BenefitCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-3">
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
    </div>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/18 text-xs font-black text-accent">
        {number}
      </span>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}
