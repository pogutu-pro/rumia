"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, User, Users } from "lucide-react";

function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/") return pathname === "/";
  if (tabHref === "/hostels") return pathname === "/hostels";
  if (tabHref === "/agents") return pathname.startsWith("/agents");
  if (tabHref === "/auth/login")
    return (
      pathname.startsWith("/auth") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/account") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/saved")
    );
  return false;
}

export function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/hostels/")) return null;

  const tabs = [
    { label: "Home",    href: "/",           icon: Home   },
    { label: "Search",  href: "/hostels",    icon: Search },
    { label: "Agents",  href: "/agents",     icon: Users  },
    { label: "Account", href: "/auth/login", icon: User   },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-gray-200 md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16">
        {tabs.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.label}
              href={tab.href}
              prefetch={true}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[44px]"
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={`h-5 w-5 transition-colors duration-150 ${
                  active ? "text-emerald-600" : "text-gray-400"
                }`}
              />
              <span
                className={`text-[10px] font-semibold transition-colors duration-150 ${
                  active ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
