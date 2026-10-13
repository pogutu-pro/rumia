"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";
import { createClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";
import { useWishlistStore } from "@/stores/wishlist-store";
import { MOBILE_NAV, isBottomNavHidden, isNavActive } from "@/components/shell/nav-config";

function getInitials(nameOrEmail: string | null | undefined): string | null {
  if (!nameOrEmail) return null;
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return trimmed.split("@")[0].slice(0, 2).toUpperCase() || null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The bottom bar is on screen for this path (it is also hidden from `lg` up by CSS). */
export function usesBottomNav(pathname: string): boolean {
  return !isBottomNavHidden(pathname);
}

/**
 * Primary navigation on phones and small tablets (below `lg`): Home, Explore, Videos, Wishlist, Account.
 * While shown it sets `data-bottom-nav` on <html>, which defines `--bottom-nav-h`; <main> and every other fixed
 * layer (compare tray, install and push prompts) use that variable so nothing sits under the bar.
 */
export function BottomNav() {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState<string | null>(null);
  const [imgError, setImgError] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const savedCount = useWishlistStore((s) => (s.fetched ? Object.values(s.saved).filter(Boolean).length : 0));
  const visible = usesBottomNav(pathname);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const authClient = createClient();
    let active = true;
    const sync = async () => {
      try {
        const { data: { user } } = await authClient.auth.getUser();
        if (!active) return;
        if (!user) {
          setAvatarUrl(null);
          setDisplayName(null);
          return;
        }
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        setAvatarUrl(((meta.avatar_url || meta.picture || meta.avatar) as string) || null);
        setDisplayName(((meta.full_name || meta.name || user.email) as string) || null);
        setImgError(false);
      } catch {
        if (active) {
          setAvatarUrl(null);
          setDisplayName(null);
        }
      }
    };
    void sync();
    const { data: sub } = authClient.auth.onAuthStateChange(() => void sync());
    return () => {
      active = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (visible) root.dataset.bottomNav = "on";
    else delete root.dataset.bottomNav;
    return () => {
      delete root.dataset.bottomNav;
    };
  }, [visible]);

  if (!visible) return null;

  const initials = getInitials(displayName);
  const showImage = mounted && avatarUrl && !imgError;
  const signedIn = !!displayName;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex h-14 items-stretch">
        {MOBILE_NAV.map((item) => {
          const isAccount = item.label === "Account";
          const isWishlist = item.label === "Wishlist";
          // Signed-in people keep their saved places in the account page; send them straight there.
          const href = isAccount && mounted && !signedIn ? "/auth/login" : isWishlist && signedIn ? "/account?tab=saved" : item.href;
          const onSavedTab = pathname === "/account" && tab === "saved";
          const active = isWishlist ? isNavActive(pathname, item) || onSavedTab : isNavActive(pathname, item) && !onSavedTab;
          const Icon = item.icon;
          const count = item.label === "Wishlist" ? savedCount : 0;
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full min-w-12 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold leading-none transition-colors",
                  "active:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                  active ? "text-primary" : "text-ink-muted",
                )}
              >
                {isAccount && (showImage || initials) ? (
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold ring-2",
                      active ? "bg-primary text-primary-foreground ring-primary" : "bg-ink text-white ring-transparent",
                    )}
                  >
                    {showImage ? (
                      <Image
                        src={avatarUrl!}
                        alt=""
                        width={24}
                        height={24}
                        className="h-full w-full object-cover"
                        onError={() => setImgError(true)}
                        unoptimized
                      />
                    ) : (
                      initials
                    )}
                  </span>
                ) : (
                  <span className="relative">
                    <Icon className={cn("h-6 w-6", active && "fill-primary/15")} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                    {count > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground">
                        <span aria-hidden>{count > 99 ? "99+" : count}</span>
                        <span className="sr-only">{count} saved</span>
                      </span>
                    )}
                  </span>
                )}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
