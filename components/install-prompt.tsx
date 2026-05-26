"use client";
import { useEffect, useState } from "react";

export function InstallPrompt() {
  const [show, setShow] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as { standalone?: boolean }).standalone) return;

    // Don't show if user dismissed recently (7 days)
    const dismissed = localStorage.getItem("bwf-install-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400000) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
    const isAndroid = /android/i.test(ua);

    if (isIos) setShow("ios");
    else if (isAndroid) setShow("android");
  }, []);

  function dismiss() {
    localStorage.setItem("bwf-install-dismissed", String(Date.now()));
    setShow(null);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-[72px] left-4 right-4 z-[70] rounded-2xl border border-accent/40 bg-surface shadow-2xl p-4"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <button onClick={dismiss} className="absolute top-3 right-3 text-muted text-lg leading-none p-1">✕</button>
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="BetWithFriends" className="h-12 w-12 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Add to Home Screen</p>
          {show === "ios" ? (
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Tap <span className="inline-block align-middle text-base">⬆️</span> <strong>Share</strong> then <strong>"Add to Home Screen"</strong> to install BetWithFriends as an app.
            </p>
          ) : (
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Tap <strong>⋮ Menu</strong> then <strong>"Add to Home Screen"</strong> or <strong>"Install app"</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
