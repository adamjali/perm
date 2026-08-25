/**
 * Service Worker Lifecycle Component
 *
 * SW registration is handled by Serwist's auto-injected sw-entry.js
 * (via @serwist/next webpack plugin on every page load).
 *
 * This component handles:
 * - One-time migration from legacy sw-push.js
 * - Push subscription repair if browser subscription is missing but user has push enabled
 *
 * Phase: 31 (PWA)
 * Created: 2025-01-11
 */

"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { urlBase64ToUint8Array } from "@/lib/pushSubscription";

export function ServiceWorkerRegistration(): null {
  const savePushSubscription = useMutation(api.users.savePushSubscription);
  const profile = useQuery(api.users.currentUserProfile);
  const migrationAttempted = useRef(false);
  const repairAttempted = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // SW registration is handled by Serwist's auto-injected sw-entry.js
    // (via @serwist/next webpack plugin). No manual register() needed.

    // Migrate legacy sw-push.js -> unified sw.js (one-time)
    if (!migrationAttempted.current) {
      migrationAttempted.current = true;
      cleanupLegacySW();
    }
  }, []);

  // Repair push subscription if user has push enabled but browser has no subscription
  // This handles: migration failures, browser cache clears, SW updates that invalidate subscriptions
  useEffect(() => {
    if (
      !profile ||
      !profile.pushNotificationsEnabled ||
      !profile.pushSubscription ||
      repairAttempted.current
    ) {
      return;
    }

    repairAttempted.current = true;
    repairPushSubscription(savePushSubscription);
  }, [profile, savePushSubscription]);

  return null;
}

/**
 * Clean up legacy sw-push.js registrations.
 * Just unregisters, push re-subscription is handled by repairPushSubscription.
 */
async function cleanupLegacySW(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active?.scriptURL.includes("sw-push.js")) {
        // Unsubscribe any push subscription on the legacy SW
        const oldSub = await reg.pushManager.getSubscription();
        if (oldSub) {
          await oldSub.unsubscribe();
          console.log("[SW] Unsubscribed legacy push from sw-push.js");
        }
        await reg.unregister();
        console.log("[SW] Cleaned up legacy sw-push.js registration");
      }
    }
  } catch {
    // Best-effort — don’t block anything
  }
}

/**
 * Repair push subscription: if the user has push enabled in their profile
 * but the browser has no active push subscription on sw.js, create one.
 *
 * This covers:
 * - Migration from sw-push.js (old subscription invalidated)
 * - Browser cache clears or SW updates
 * - Server cleared stale subscription (410 Gone) but user still has push enabled
 */
async function repairPushSubscription(
  savePushSubscription: (args: { subscription: string }) => Promise<unknown>
): Promise<void> {
  try {
    if (!("PushManager" in window) || Notification.permission !== "granted") {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const existingSub = await registration.pushManager.getSubscription();

    if (existingSub) {
      // Browser already has a subscription — nothing to repair
      return;
    }

    // No browser subscription but user has push enabled — re-subscribe
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    console.log("[SW] Repairing missing push subscription...");
    const newSub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });

    await savePushSubscription({ subscription: JSON.stringify(newSub) });
    console.log("[SW] Push subscription repaired successfully");
  } catch (err) {
    // Best-effort — user can manually re-enable in Settings
    console.warn("[SW] Failed to repair push subscription:", err);
  }
}

export default ServiceWorkerRegistration;
