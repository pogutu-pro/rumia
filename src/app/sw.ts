import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, type SerwistGlobalConfig, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.hostname === "maps.googleapis.com",
      handler: {
        handle: async ({ request }) => {
          try {
            const response = await fetch(request);
            return response;
          } catch {
            return new Response(null, { status: 204 });
          }
        },
      },
    },
    ...defaultCache,
  ],
});

// Offline fallback for navigation requests — must be registered before Serwist's
// event listeners so it can catch network failures and serve the cached offline page.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        return response;
      } catch {
        const cache = await caches.open("offline-fallback");
        const cached = await cache.match("/offline");
        return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/html" } });
      }
    })()
  );
});

serwist.addEventListeners();

// --- Push Notifications ---

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { title, body, url, icon, tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/images/icons/icon-192x192.png",
      badge: "/images/icons/icon-96x96.png",
      data: { url: url || "/" },
      tag: tag || "rumia-push",
      renotify: true,
    } as NotificationOptions)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus existing Rumia tab if open
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      }

      // Otherwise open a new window
      await self.clients.openWindow(targetUrl);
    })()
  );
});
