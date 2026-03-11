/**
 * Service Worker Registration Component
 *
 * Registers the unified service worker (sw.js) for PWA functionality.
 * Handles caching of static assets (images, fonts) AND push notifications.
 *
 * Previously push was handled by a separate sw-push.js, but only one SW
 * can be active per scope — the unified approach avoids scope conflicts.
 *
 * Also performs one-time migration: if a legacy sw-push.js registration
 * exists, it re-subscribes push against sw.js and persists to DB.
 *
 * Phase: 31 (PWA)
 * Created: 2025-01-11
 */

"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { captureError } from "@/lib/sentry";
import { urlBase64ToUint8Array } from "@/lib/pushSubscription";

/**
 * ServiceWorkerRegistration Component
 *
 * Renders nothing - just handles service worker registration on mount.
 * Should be placed in authenticated layout (inside ConvexProviders).
 *
 * Also cleans up legacy sw-push.js registrations from older versions.
 */
export function ServiceWorkerRegistration(): null {
  const savePushSubscription = useMutation(api.users.savePushSubscription);
  const migrationAttempted = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register unified service worker (caching + push)
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Unified service worker registered:", registration.scope);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log("[SW] New version available");
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error("[SW] Registration failed:", error);
        captureError(error);
      });

    // Migrate legacy sw-push.js -> unified sw.js (one-time)
    if (!migrationAttempted.current) {
      migrationAttempted.current = true;
      migrateLegacyPushSW(savePushSubscription);
    }
  }, [savePushSubscription]);

  return null;
}

/**
 * One-time migration: move push subscription from legacy sw-push.js to sw.js.
 *
 * Push subscriptions are tied to the SW registration. When we unregister
 * sw-push.js, any subscription bound to it becomes invalid. So we must:
 * 1. Read the old subscription (to detect it exists)
 * 2. Unsubscribe it
 * 3. Create a new subscription against sw.js
 * 4. Persist the new subscription to the database
 * 5. Unregister sw-push.js
 */
async function migrateLegacyPushSW(
  savePushSubscription: (args: { subscription: string }) => Promise<unknown>
): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const reg of registrations) {
      const scriptURL = reg.active?.scriptURL || "";
      if (!scriptURL.includes("sw-push.js")) continue;

      // Check for active push subscription on the legacy SW
      const oldSub = await reg.pushManager.getSubscription();

      if (oldSub) {
        // Unsubscribe the old one
        await oldSub.unsubscribe();
        console.log("[SW] Unsubscribed legacy push subscription from sw-push.js");

        // Re-subscribe against the unified sw.js
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (vapidKey && Notification.permission === "granted") {
          const newReg = await navigator.serviceWorker.ready;
          const newSub = await newReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
          });

          // Persist new subscription to database
          await savePushSubscription({ subscription: JSON.stringify(newSub) });
          console.log("[SW] Migrated push subscription to unified sw.js");
        }
      }

      // Now safe to unregister the legacy SW
      await reg.unregister();
      console.log("[SW] Cleaned up legacy sw-push.js registration");
    }
  } catch (err) {
    // Best-effort migration — log but don't block anything.
    // Users can re-enable push in Settings if migration fails.
    console.warn("[SW] Failed to migrate legacy push SW:", err);
  }
}

export default ServiceWorkerRegistration;
