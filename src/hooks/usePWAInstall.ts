"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed — never show the button
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Show the button regardless of browser
    // (beforeinstallprompt only fires in Chrome, but we want
    //  Safari/Firefox users to see the install option too)
    setIsInstallable(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    // Chrome — triggers the native install dialog
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
      return;
    }

    // Other browsers — the button is a visual prompt;
    // the browser's own install flow (e.g. Safari Share menu,
    // Firefox "Install" in menu) handles the actual install
  }, [deferredPrompt]);

  return { isInstallable, handleInstall };
}
