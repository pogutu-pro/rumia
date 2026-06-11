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

serwist.addEventListeners();
