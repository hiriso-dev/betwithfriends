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
const INSTALL_SHEET_SEEN_KEY = "bwf-install-sheet-seen";

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
  return detectMode();
}

function shouldAutoOpenInstallSheet(mode: Mode): boolean {
  if (typeof window === "undefined") return false;
  if (!mode) return false;
  return !sessionStorage.getItem(INSTALL_SHEET_SEEN_KEY);
}

function installTitle(mode: Mode): string {
  if (mode === "ios-other") return "Open in Safari first";
  if (mode === "ios-safari") return "Add to Home Screen";
  if (mode === "android-other") return "Install from browser menu";
  return "Install BetWithFriends";
}

function installDescription(mode: Mode): string {
  if (mode === "ios-other") {
    return "Open this page in Safari to install the app and get notification support on iPhone.";
  }
  if (mode === "ios-safari") {
    return "Add the app from Safari for quicker access and notification support on iPhone and iPad.";
  }
  if (mode === "android-other") {
    return "Add the app from your browser menu for quick access and easier notification support.";
  }
  return "Install the app for one-tap access and notification support.";
}

// ---- Floating CTA + Sheet (global) ----

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(getInitialInstallMode);
  const [open, setOpen] = useState<boolean>(() => shouldAutoOpenInstallSheet(getInitialInstallMode()));

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      const nextMode = detectMode();
      setMode(nextMode);
      if (shouldAutoOpenInstallSheet(nextMode)) {
        sessionStorage.setItem(INSTALL_SHEET_SEEN_KEY, "1");
        setOpen(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (open) {
      sessionStorage.setItem(INSTALL_SHEET_SEEN_KEY, "1");
    }
  }, [open]);

  function closeSheet() {
    setOpen(false);
  }

  async function install() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        deferredPrompt = null;
        setMode(null);
      }
    }
    setOpen(false);
  }

  if (!mode) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed inset-x-4 bottom-[84px] z-[70] flex items-center justify-between gap-3 rounded-2xl border border-accent/35 bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur active:scale-95 sm:inset-x-auto sm:right-4 sm:w-auto sm:justify-start sm:rounded-full"
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
          <span className="block text-sm font-semibold">Install app</span>
          <span className="block text-xs text-muted">Notifications + one-tap access</span>
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
                  onClick={closeSheet}
                  className="rounded-full border border-border p-2 text-muted transition active:scale-95"
                  aria-label="Close install instructions"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-accent">Why install</p>
                <div className="space-y-2">
                  <BenefitLine text="Get reminders and result notifications more reliably." />
                  <BenefitLine text="Open BetWithFriends in one tap from your home screen." />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-accent">How to install</p>

                {mode === "prompt" && (
                  <div className="space-y-3">
                    <Step number="1" text="Tap the install button below." />
                    <Step number="2" text="Confirm the browser install prompt." />
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
                    <Step number="2" text="Choose Add to Home Screen, then tap Add." />
                  </div>
                )}

                {mode === "ios-other" && (
                  <div className="space-y-3">
                    <Step number="1" text="Open this page in Safari first." />
                    <Step number="2" text="In Safari, use Share ⬆ then Add to Home Screen." />
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
                  </div>
                )}
              </div>

              <p className="mt-4 text-center text-xs text-muted">
                This install recommendation stays visible until the app is installed.
              </p>

              <div className="mt-4">
                <button
                  onClick={closeSheet}
                  className="w-full rounded-xl border border-border py-3 text-sm font-semibold text-muted transition active:scale-95"
                >
                  Not now
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

function BenefitLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
      <p className="text-sm leading-relaxed text-muted">{text}</p>
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
