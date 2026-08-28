"use client";

import { useState, useEffect, useCallback } from "react";

const DISMISSED_AT_KEY = "rumia_push_prompt_dismissed_at";
const COOLDOWN_HOURS = 72;

function getDismissedAt(): number | null {
  try {
    const val = localStorage.getItem(DISMISSED_AT_KEY);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

function isInCooldown(): boolean {
  const dismissedAt = getDismissedAt();
  if (!dismissedAt) return false;
  const hoursSince = (Date.now() - dismissedAt) / (1000 * 60 * 60);
  return hoursSince < COOLDOWN_HOURS;
}

export function useNotificationPrompt() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already granted or denied — never show
    if (Notification.permission !== "default") return;

    // In cooldown period after dismissal
    if (isInCooldown()) return;

    queueMicrotask(() => setShouldShow(true));
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_AT_KEY, Date.now().toString());
    } catch { /* ignore */ }
    setShouldShow(false);
  }, []);

  return { shouldShow, dismiss };
}
