"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_COUNT_KEY = "rumia_install_dismiss_count";
const DISMISSED_AT_KEY = "rumia_install_dismissed_at";
const INSTALLED_KEY = "rumia_installed";
const SHOWN_THIS_SESSION_KEY = "rumia_install_shown";
const LISTING_VIEWS_KEY = "rumia_listing_views";
const COOLDOWN_DAYS = 14;
const MAX_DISMISSES = 3;
const MIN_LISTING_VIEWS = 2;
const MIN_TIME_SECONDS = 30;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error — iOS Safari only
    window.navigator.standalone === true
  );
}

function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in window);
}

function getDismissCount(): number {
  try {
    return parseInt(localStorage.getItem(DISMISS_COUNT_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

function getDismissedAt(): number | null {
  try {
    const val = localStorage.getItem(DISMISSED_AT_KEY);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

function getListingViews(): number {
  try {
    return parseInt(sessionStorage.getItem(LISTING_VIEWS_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

function getTimeOnSite(): number {
  try {
    const start = parseInt(sessionStorage.getItem("rumia_session_start") || "0", 10);
    if (!start) return 0;
    return (Date.now() - start) / 1000;
  } catch {
    return 0;
  }
}

function isEligibleByActivity(): boolean {
  return getListingViews() >= MIN_LISTING_VIEWS || getTimeOnSite() >= MIN_TIME_SECONDS;
}

function isEligibleByCooldown(): boolean {
  const dismissedAt = getDismissedAt();
  if (!dismissedAt) return true;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince >= COOLDOWN_DAYS;
}

function canShowBanner(): boolean {
  if (isStandalone()) return false;
  try {
    if (localStorage.getItem(INSTALLED_KEY) === "true") return false;
  } catch { /* ignore */ }
  if (getDismissCount() >= MAX_DISMISSES) return false;
  if (!isEligibleByCooldown()) return false;
  try {
    if (sessionStorage.getItem(SHOWN_THIS_SESSION_KEY) === "true") return false;
  } catch { /* ignore */ }
  return true;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [shouldShow, setShouldShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Track session start
    try {
      if (!sessionStorage.getItem("rumia_session_start")) {
        sessionStorage.setItem("rumia_session_start", Date.now().toString());
      }
    } catch { /* ignore */ }

    // Track listing page views — increment on listing pages
    try {
      const path = window.location.pathname;
      if (path.startsWith("/hostels/") || path.startsWith("/listing/")) {
        const current = getListingViews();
        sessionStorage.setItem(LISTING_VIEWS_KEY, (current + 1).toString());
      }
    } catch { /* ignore */ }

    if (!canShowBanner()) return;

    // iOS: set flag and check activity
    if (isIOSSafari()) {
      queueMicrotask(() => {
        setIsIOS(true);
        if (isEligibleByActivity()) {
          setShouldShow(true);
          sessionStorage.setItem(SHOWN_THIS_SESSION_KEY, "true");
        }
      });
      return;
    }

    // Chrome/Android: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      if (isEligibleByActivity()) {
        queueMicrotask(() => {
          setShouldShow(true);
          sessionStorage.setItem(SHOWN_THIS_SESSION_KEY, "true");
        });
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Poll activity eligibility for delayed showing
  useEffect(() => {
    if (shouldShow || isStandalone() || isIOS) return;

    pollingRef.current = setInterval(() => {
      if (isEligibleByActivity() && canShowBanner()) {
        setShouldShow(true);
        sessionStorage.setItem(SHOWN_THIS_SESSION_KEY, "true");
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [shouldShow, isIOS]);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        try {
          localStorage.setItem(INSTALLED_KEY, "true");
        } catch { /* ignore */ }
        setShouldShow(false);
        setDeferredPrompt(null);
      } else {
        recordDismissal();
      }
      return;
    }
    // iOS or non-Chrome: just dismiss
    recordDismissal();
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    recordDismissal();
    setShouldShow(false);
  }, []);

  return { shouldShow, isIOS, handleInstall, handleDismiss };
}

function recordDismissal() {
  try {
    const count = getDismissCount() + 1;
    localStorage.setItem(DISMISS_COUNT_KEY, count.toString());
    localStorage.setItem(DISMISSED_AT_KEY, Date.now().toString());
  } catch { /* ignore */ }
}
