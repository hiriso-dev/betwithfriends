"use client";
import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70;
const MAX_PULL = 110;

export function PullToRefresh({ scrollId }: { scrollId: string }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const currentPull = useRef(0);

  useEffect(() => {
    const el = document.getElementById(scrollId);
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (el!.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
        currentPull.current = 0;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current) return;
      if (el!.scrollTop > 0) { pulling.current = false; setPullY(0); return; }
      const diff = e.touches[0].clientY - startY.current;
      if (diff <= 0) { pulling.current = false; setPullY(0); return; }
      const d = Math.min(diff * 0.45, MAX_PULL);
      currentPull.current = d;
      setPullY(d);
    }

    function onTouchEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      const d = currentPull.current;
      setPullY(0);
      if (d >= THRESHOLD) {
        setRefreshing(true);
        setTimeout(() => window.location.reload(), 350);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [scrollId]);

  if (pullY === 0 && !refreshing) return null;

  const progress = Math.min(pullY / THRESHOLD, 1);
  const ready = pullY >= THRESHOLD;
  const indicatorH = refreshing ? 52 : Math.round(pullY * 0.65);

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-end justify-center"
      style={{ height: indicatorH }}
    >
      <div
        className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full border bg-surface shadow-md transition-colors ${ready || refreshing ? "border-accent" : "border-border"}`}
        style={{ opacity: Math.max(progress, refreshing ? 1 : 0) }}
      >
        {refreshing ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        ) : (
          <span
            className={`text-xs leading-none ${ready ? "text-accent" : "text-muted"}`}
            style={{ display: "inline-block", transform: `rotate(${Math.min(pullY * 1.8, 180)}deg)` }}
          >
            ↓
          </span>
        )}
      </div>
    </div>
  );
}
