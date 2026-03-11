/**
 * Service Worker Configuration
 *
 * CRITICAL PWA RULES (per project requirements):
 * - NEVER cache HTML documents (causes stale deployments)
 * - NEVER cache JavaScript files (causes stale code)
 * - NEVER cache stylesheets (causes stale CSS)
 * - SAFE to cache: images, fonts, icons
 *
 * This strict NetworkOnly policy for HTML/JS/CSS ensures users
 * always get the latest deployment without cache-busting issues.
 */

import {
  CacheFirst,
  NetworkOnly,
  Serwist,
  ExpirationPlugin,
} from "serwist";

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // CRITICAL: Never cache HTML documents
    // This prevents stale deployment bugs
    {
      matcher: ({ request }) => request.destination === "document",
      handler: new NetworkOnly(),
    },

    // CRITICAL: Never cache JavaScript
    // Ensures users always get the latest code
    {
      matcher: ({ request }) => request.destination === "script",
      handler: new NetworkOnly(),
    },

    // CRITICAL: Never cache stylesheets
    // Prevents stale CSS issues
    {
      matcher: ({ request }) => request.destination === "style",
      handler: new NetworkOnly(),
    },

    // Safe: Cache same-origin images with long expiration
    // ONLY same-origin — cross-origin images (Senja avatars from Gravatar,
    // ImageKit, ui-avatars) must bypass the SW because the SW's fetch()
    // is governed by connect-src CSP, not img-src. Letting them through
    // causes CSP violations and broken images.
    {
      matcher: ({ request, sameOrigin }) =>
        request.destination === "image" && sameOrigin,
      handler: new CacheFirst({
        cacheName: "images-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },

    // Safe: Cache same-origin fonts with long expiration
    // next/font/google self-hosts fonts at build time so all app fonts
    // are same-origin in production. Cross-origin font requests (e.g.
    // from third-party widgets like Senja) must bypass the SW.
    {
      matcher: ({ request, sameOrigin }) =>
        request.destination === "font" && sameOrigin,
      handler: new CacheFirst({
        cacheName: "fonts-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 20,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();

// ---------------------------------------------------------------------------
// Push Notification Handlers
// Merged here so a single SW handles both caching and push (one SW per scope).
// Previously in public/sw-push.js (separate SW), which caused scope conflicts.
// ---------------------------------------------------------------------------

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  let data: { title: string; body: string; tag?: string; url?: string };
  try {
    data = event.data.json();
  } catch (error) {
    console.error("[SW] Failed to parse push data:", error);
    return;
  }

  // actions + vibrate are valid SW notification options but missing from some TS typings
  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.tag || "perm-tracker",
    data: { url: data.url || "/dashboard" },
    vibrate: [100, 50, 100],
    actions: [
      { action: "view", title: "View Case" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url: string = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return (client as WindowClient).focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("notificationclose", (event: NotificationEvent) => {
  console.log("[SW] Notification closed:", event.notification.tag);
});

// Clean up stale caches from previous SW versions.
// Old SW cached cross-origin images (Gravatar, ImageKit, ui-avatars) which
// caused CSP violations. Delete any cached entries for non-same-origin URLs.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.open("images-cache").then(async (cache) => {
      const keys = await cache.keys();
      const origin = self.location.origin;
      const deletions = keys
        .filter((req) => !req.url.startsWith(origin))
        .map((req) => cache.delete(req));
      if (deletions.length > 0) {
        console.log(`[SW] Cleaning ${deletions.length} stale cross-origin image cache entries`);
      }
      return Promise.all(deletions);
    }).catch((err) => {
      // Cache cleanup is best-effort; don't block SW activation
      console.warn('[SW] Failed to clean stale cache entries:', err);
    })
  );
});
