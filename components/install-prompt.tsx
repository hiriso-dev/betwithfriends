"use client";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function InstallPrompt() {
  const [mode, setMode] = useState<"chrome" | "ios" | null>(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as { standalone?: boolean }).standalone) return;

    const dismissed = localStorage.getItem("bwf-install-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400000) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
    if (isIos) { setMode("ios"); return; }

    // Chrome desktop/Android: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setMode("chrome");
    };
    window.addEventListener("beforeinstallprompt", handler);
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
      <button onClick={dismiss} className="absolute top-3 right-3 text-muted text-lg leading-none p-1">✕</button>
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Add to Home Screen</p>
          {mode === "ios" ? (
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Tap <strong>Share ⬆️</strong> in Safari then <strong>"Add to Home Screen"</strong>
            </p>
          ) : (
            <button
              onClick={install}
              className="mt-2 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-[#0f0f23] transition active:scale-95"
            >
              Install app
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook for use in Profile page — always available, not dismissable
export function useInstallable() {
  const [canInstall, setCanInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      !!(navigator as { standalone?: boolean }).standalone
    );
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
    setIsIos(ios);
    if (deferredPrompt) setCanInstall(true);
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function triggerInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") { deferredPrompt = null; setCanInstall(false); }
  }

  return { canInstall, isIos, isStandalone, triggerInstall };
}
