"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Upload, History, Heart, UserRound } from "lucide-react";

const TABS = [
  { href: "/workspace", label: "Yükle!", icon: Upload },
  { href: "/history", label: "Geçmiş", icon: History },
  { href: "/favorites", label: "Beğendiklerin", icon: Heart },
  { href: "/profile", label: "Profil", icon: UserRound },
] as const;

export default function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(15,61,46,0.06)]"
      aria-label="Ana menü"
    >
      <div className="flex h-16 max-w-lg mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 min-h-[44px] rounded-xl mx-0.5 transition-colors ${
                active
                  ? "text-secondary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`flex size-9 items-center justify-center rounded-xl transition-all ${
                  active ? "bg-secondary/15 ring-2 ring-secondary/15" : ""
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 2} aria-hidden />
              </span>
              <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
