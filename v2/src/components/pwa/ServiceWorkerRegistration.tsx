/**
 * Service Worker Registration Component
 *
 * Registers the main service worker (sw.js) for PWA functionality.
 * Handles caching of static assets (images, fonts).
 *
 * Note: Push notifications use a separate service worker (sw-push.js)
 * which is registered by the pushSubscription lib when push is enabled.
 *
 * Phase: 31 (PWA)
 * Created: 2025-01-11
 */

"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegistration Component
 *
 * Renders nothing - just handles service worker registration on mount.
 * Should be placed in authenticated layout to register SW for logged-in users.
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * import { ServiceWorkerRegistration } from '@/components/pwa';
 *
 * export default function Layout({ children }) {
 *   return (
 *     <>
 *       <ServiceWorkerRegistration />
 *       {children}
 *     </>
 *   );
 * }
 * ```
 */
export function ServiceWorkerRegistration(): null {
  useEffect(() => {
    // Only run in browser context with service worker support
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register main service worker for caching
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Main service worker registered:", registration.scope);

        // Handle updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New SW installed while old one is still active
                console.log("[SW] New version available");
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error("[SW] Registration failed:", error);
      });
  }, []);

  return null;
}

export default ServiceWorkerRegistration;
