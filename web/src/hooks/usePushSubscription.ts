"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/auth/client";
import { pushSupported } from "@/lib/pwa/push-support";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function canInitializeSync(): boolean {
  return pushSupported() && !!VAPID_PUBLIC_KEY;
}

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  // Always starts as "checking" so the server render and the first client render are identical (reading
  // `window` here made them differ and caused a hydration error). The effect below settles it after mount.
  const [loading, setLoading] = useState(true);
  // Starts true for the same reason; false once we know this browser cannot do web push (e.g. iPhone outside the
  // home-screen app), so callers can explain that instead of offering a button that does nothing.
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!canInitializeSync()) {
      // Push is not available here (no service worker or no VAPID key): nothing to check.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const p = Notification.permission;
        if (!cancelled) setPermission(p);

        if (p !== "granted") {
          if (!cancelled) setLoading(false);
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setIsSubscribed(!!subscription);
      } catch {
        // SW not ready yet
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.warn("VAPID public key not configured");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const sub = subscription.toJSON();
      if (!sub.endpoint || !sub.keys) return false;

      const authClient = createClient();
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (!user) return false;

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        }),
      });

      if (!res.ok) return false;

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return true;
      }

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      return false;
    }
  }, []);

  // Re-subscribe silently if permission is granted but subscription is missing
  useEffect(() => {
    if (loading || permission !== "granted" || isSubscribed || !VAPID_PUBLIC_KEY) return;

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (existing) {
          setIsSubscribed(true);
          return;
        }
        await subscribe();
      } catch {
        // SW not ready
      }
    })();

    return () => { cancelled = true; };
  }, [loading, permission, isSubscribed, subscribe]);

  return { isSubscribed, permission, loading, supported, subscribe, unsubscribe };
}
