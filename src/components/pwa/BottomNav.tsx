"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, User } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/") return pathname === "/";
  if (tabHref === "/hostels") return pathname === "/hostels";
  if (tabHref === "/saved") return pathname.startsWith("/saved");
  if (tabHref === "/auth/login")
    return (
      pathname.startsWith("/auth") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/account")
    );
  return false;
}

export function BottomNav() {
  const pathname = usePathname();
  const [accountHref, setAccountHref] = useState("/auth/login");

  useEffect(() => {
    async function resolveAccountHref() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setAccountHref("/auth/login");
        return;
      }

      const userId = session.user.id;

      const { data: agent } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (agent) {
        setAccountHref("/dashboard");
      } else {
        setAccountHref("/account");
      }
    }
    resolveAccountHref();
  }, []);

  if (pathname.startsWith("/admin")) return null;

  if (pathname.startsWith("/hostels/")) return null;

  const tabs = [
    { label: "Home",    href: "/",           icon: Home   },
    { label: "Search",  href: "/hostels",     icon: Search },
    { label: "Saved",   href: "/saved",       icon: Heart  },
    { label: "Account", href: accountHref,    icon: User   },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t md:hidden"
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
              className="flex flex-1 flex-col items-center justify-center gap-0.5"
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={`h-5 w-5 transition-colors duration-150 ${
                  active ? "text-primary fill-current" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors duration-150 ${
                  active ? "text-primary" : "text-muted-foreground"
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
