"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useInstallable } from "@/components/install-prompt";

const nav = [
  { href: "/home",     icon: "🏠", label: "Home" },
  { href: "/fixtures", icon: "⚽", label: "Games" },
  { href: "/rankings", icon: "🏆", label: "Rankings" },
  { href: "/special",  icon: "🌟", label: "Special" },
  { href: "/profile",  icon: "👤", label: "Profile" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode: installMode, isStandalone } = useInstallable();
  const showInstallBadge = !isStandalone && installMode !== null;

  return (
    <div className="flex h-full flex-col">
      <main id="scroll-main" className="relative flex-1 overflow-y-auto pb-nav">
        <PullToRefresh scrollId="scroll-main" />
        {children}
      </main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto flex max-w-lg">
          {nav.map((item) => {
            const active =
              item.href === "/fixtures"
                ? pathname === "/fixtures" || pathname.startsWith("/fixtures/") || pathname.startsWith("/teams/")
                : item.href === "/profile"
                ? pathname.startsWith("/profile") || pathname.startsWith("/groups")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 transition active:scale-90"
              >
                <span className={`relative text-2xl transition ${active ? "scale-110" : "opacity-60"}`}>
                  {item.icon}
                  {item.href === "/profile" && showInstallBadge && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-[#0f0f23] ring-2 ring-surface">
                      1
                    </span>
                  )}
                </span>
                <span className={`text-[10px] font-medium tracking-wide ${active ? "text-accent" : "text-muted"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
