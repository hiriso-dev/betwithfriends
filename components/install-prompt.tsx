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

// ---- Banner (global, auto-shown) ----

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    const dismissed = localStorage.getItem("bwf-install-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400000) return;

    // Capture beforeinstallprompt first, then detect
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setMode(detectMode());
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Detect immediately (handles iOS cases which never fire beforeinstallprompt)
    const initial = detectMode();
    if (initial) setMode(initial);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem("bwf-install-dismissed", String(Date.now()));
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
    <div className="fixed bottom-[72px] left-4 right-4 z-[70] rounded-2xl border border-accent/40 bg-surface shadow-2xl p-4">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-muted text-lg leading-none p-1"
      >
        ✕
      </button>
      <div className="flex items-start gap-3">
        <img src="/favicon_bwf.png" alt="" className="h-12 w-12 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Install as an app</p>
          <p className="text-[10px] text-muted">Add to Home Screen</p>
          {mode === "ios-safari" && (
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Tap <strong className="text-foreground">Share ⬆</strong> then{" "}
              <strong className="text-foreground">"Add to Home Screen"</strong>
            </p>
          )}
          {mode === "ios-other" && (
            <div className="mt-1">
              <p className="text-xs text-muted leading-relaxed mb-2">
                Your browser can't install apps. Open this page in{" "}
                <strong className="text-foreground">Safari</strong> to install.
              </p>
              <a
                href={safariUrl()}
                className="block w-full rounded-xl bg-accent py-2.5 text-center text-sm font-bold text-[#0f0f23] transition active:scale-95"
              >
                Open in Safari →
              </a>
            </div>
          )}
          {mode === "prompt" && (
            <button
              onClick={install}
              className="mt-2 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-[#0f0f23] transition active:scale-95"
            >
              Install app
            </button>
          )}
          {mode === "android-other" && (
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Tap <strong className="text-foreground">⋮ Menu</strong> →{" "}
              <strong className="text-foreground">"Add to Home Screen"</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Hook for Profile page ----

export type InstallInfo = {
  mode: Mode;
  isStandalone: boolean;
  triggerInstall: () => Promise<void>;
};

export function useInstallable(): InstallInfo {
  const [mode, setMode] = useState<Mode>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        !!(navigator as { standalone?: boolean }).standalone
    );

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setMode(detectMode());
    };
    window.addEventListener("beforeinstallprompt", handler);

    const initial = detectMode();
    setMode(initial);

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
