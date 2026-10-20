import { defaultCache } from "@serwist/next/worker";
import { CacheFirst, ExpirationPlugin, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

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
  navigationPreload: false,
  runtimeCaching: [
    {
      // Editor images: CacheFirst, 60 days, max 300 entries (also readable offline).
      matcher: ({ url }) => url.pathname.startsWith("/uploads/"),
      handler: new CacheFirst({
        cacheName: "dayflow-uploads",
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 24 * 60 * 60 })],
      }),
    },
    {
      // Never cache API traffic; the app reads from IndexedDB and syncs on its own.
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: ({ request }) => fetch(request),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
