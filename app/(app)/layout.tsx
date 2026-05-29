"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useInstallable, useInstallBadgeAck } from "@/components/install-prompt";

const nav = [
  { href: "/home",     label: "Home" },
  { href: "/fixtures", label: "Games" },
  { href: "/rankings", label: "Rankings" },
  { href: "/special",  label: "Special" },
  { href: "/profile",  label: "Profile" },
];

function SidebarIcon({ label, size = 20, className = "" }: { label: string; size?: number; className?: string }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (label) {
    case "Home":
      return (
        <svg {...props}>
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "Games":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
          <circle cx="8" cy="15" r="0.5" fill="currentColor" />
          <circle cx="12" cy="15" r="0.5" fill="currentColor" />
          <circle cx="16" cy="15" r="0.5" fill="currentColor" />
        </svg>
      );
    case "Rankings":
      return (
        <svg {...props}>
          <path d="M6 4h12v6a6 6 0 0 1-12 0z" />
          <path d="M6 6H4a2 2 0 0 0-2 2v1a3 3 0 0 0 3 3h1" />
          <path d="M18 6h2a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3h-1" />
          <path d="M9 21h6M12 16v5" />
        </svg>
      );
    case "Special":
      return (
        <svg {...props}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      );
    case "Profile":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode: installMode, isStandalone } = useInstallable();
  const [installBadgeAck] = useInstallBadgeAck();
  const showInstallBadge = !isStandalone && installMode !== null && !installBadgeAck;

  function isActive(href: string) {
    if (href === "/fixtures") {
      return pathname === "/fixtures" || pathname.startsWith("/fixtures/") || pathname.startsWith("/teams/");
    }
    if (href === "/profile") {
      return pathname.startsWith("/profile") || pathname.startsWith("/groups");
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-full lg:flex-row">
      {/* DESKTOP SIDEBAR — hidden on mobile */}
      <aside className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-surface/30">
        <Link href="/home" className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/betWithFriendsLogo.png" alt="" width={32} height={32} className="rounded-md" />
          <div className="leading-tight">
            <p className="font-bold text-sm">BetWithFriends</p>
            <p className="text-[10px] uppercase tracking-widest text-muted">World Cup 2026</p>
          </div>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <SidebarIcon label={item.label} />
                <span>{item.label}</span>
                {item.href === "/profile" && showInstallBadge && (
                  <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-black text-[#0f0f23]">
                    1
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* MAIN CONTENT + mobile bottom nav */}
      <div className="flex flex-1 flex-col min-w-0">
        <main id="scroll-main" className="relative flex-1 overflow-y-auto pb-nav lg:pb-0">
          <PullToRefresh scrollId="scroll-main" />
          {children}
        </main>

        {/* MOBILE BOTTOM NAV — floating pill, hidden on desktop */}
        <nav
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 lg:hidden pointer-events-none"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-[26px] border border-white/10 bg-surface/80 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            {nav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] py-2.5 transition active:scale-90 ${
                    active ? "bg-accent/15" : ""
                  }`}
                >
                  <span className={`relative transition ${active ? "text-accent" : "text-muted"}`}>
                    <SidebarIcon label={item.label} size={23} />
                    {item.href === "/profile" && showInstallBadge && (
                      <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-[#0f0f23] ring-2 ring-surface">
                        1
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] font-semibold tracking-wide ${active ? "text-accent" : "text-muted"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
