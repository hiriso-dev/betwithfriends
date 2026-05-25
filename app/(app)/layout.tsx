"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/fixtures", icon: "⚽", label: "Fixtures" },
  { href: "/groups", icon: "👥", label: "Groups" },
  { href: "/special", icon: "🌟", label: "Special" },
  { href: "/profile", icon: "👤", label: "Profile" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto pb-nav">{children}</main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md pb-safe"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto flex max-w-lg">
          {nav.map((item) => {
            const active =
              item.href === "/fixtures"
                ? pathname === "/fixtures" || pathname.startsWith("/fixtures/")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 transition active:scale-90"
              >
                <span className={`text-2xl transition ${active ? "scale-110" : "opacity-60"}`}>
                  {item.icon}
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
