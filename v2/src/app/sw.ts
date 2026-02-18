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
