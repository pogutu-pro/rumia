"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Search, User, ShieldCheck } from "lucide-react";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";

function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/") return pathname === "/";
  if (tabHref === "/hostels") return pathname === "/hostels" || pathname.startsWith("/hostels");
  if (tabHref === "/verify") return pathname.startsWith("/verify");
  if (tabHref.startsWith("/account") || tabHref.startsWith("/auth"))
    return (
      pathname.startsWith("/auth") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/account") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/saved")
    );
  return pathname === tabHref;
}

function getInitials(nameOrEmail: string | null | undefined): string | null {
  if (!nameOrEmail) return null;
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) {
    const local = trimmed.split("@")[0];
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
    if (local.length === 1) return local.toUpperCase();
    return null;
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function BottomNav() {
  const pathname = usePathname();
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState<string | null>(null);
  const [imgError, setImgError] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const supabase = createClient();
    let active = true;
    const sync = async () => {
      try {
        const { data: { user } } = await (supabase as any).auth.getUser();
        if (!active) return;
        if (!user) {
          setAvatarUrl(null);
          setDisplayName(null);
          return;
        }
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const avatar =
          (meta.avatar_url as string) ||
          (meta.picture as string) ||
          (meta.avatar as string) ||
          null;
        const name =
          (meta.full_name as string) ||
          (meta.name as string) ||
          (user.email as string) ||
          null;
        setAvatarUrl(avatar || null);
        setDisplayName(name);
        setImgError(false);
      } catch {
        if (active) {
          setAvatarUrl(null);
          setDisplayName(null);
        }
      }
    };
    sync();
    const { data: sub } = (supabase as any).auth.onAuthStateChange(() => sync());
    return () => {
      active = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (/^\/hostels\/[^/]+\/[^/]+\/[^/]+/.test(pathname)) return null;

  const initials = getInitials(displayName);
  const showImage = mounted && avatarUrl && !imgError;
  const accountHref = displayName ? "/account" : "/auth/login";

  const tabs = [
    { label: "Home", href: "/", icon: Home },
    { label: "Search", href: "/hostels", icon: Search },
    { label: "Verify", href: "/verify", icon: ShieldCheck },
    { label: "Account", href: accountHref, icon: User, isAccount: true },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-[64px] items-stretch">
        {tabs.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          const Icon = tab.icon;
          const isAccountTab = (tab as any).isAccount;

          return (
            <Link
              key={tab.label}
              href={tab.href}
              prefetch
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-1"
            >
              {isAccountTab ? (
                <span
                  className={[
                    "flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold ring-1 transition-colors",
                    active
                      ? "bg-emerald-600 text-white ring-emerald-600"
                      : showImage || initials
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-slate-100 text-slate-500 ring-slate-200",
                  ].join(" ")}
                >
                  {showImage ? (
                    <Image
                      src={avatarUrl!}
                      alt={displayName ?? "Account"}
                      width={24}
                      height={24}
                      className="h-full w-full object-cover"
                      onError={() => setImgError(true)}
                      unoptimized
                    />
                  ) : initials ? (
                    initials
                  ) : (
                    <User className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                </span>
              ) : (
                <Icon
                  className={[
                    "h-[22px] w-[22px] transition-colors",
                    active ? "text-emerald-600" : "text-slate-400",
                  ].join(" ")}
                  strokeWidth={active ? 2.2 : 1.9}
                />
              )}
              <span
                className={[
                  "text-[10px] font-semibold leading-none tracking-wide transition-colors",
                  active ? "text-emerald-700" : "text-slate-500",
                ].join(" ")}
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
