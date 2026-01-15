/**
 * Push Notification Subscription Helpers
 *
 * Client-side utilities for managing browser push notification subscriptions.
 * Handles subscription lifecycle: check support, request permission, subscribe/unsubscribe.
 *
 * Usage:
 * ```typescript
 * import {
 *   isPushSupported,
 *   getPushSubscriptionStatus,
 *   subscribeToPush,
 *   unsubscribeFromPush,
 * } from '@/lib/pushSubscription';
 *
 * // Check if push is available
 * if (isPushSupported()) {
 *   const status = await getPushSubscriptionStatus();
 *   if (!status.subscribed && status.permission !== 'denied') {
 *     const subscription = await subscribeToPush();
 *     // Save subscription to database via Convex mutation
 *   }
 * }
 * ```
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

/**
 * Convert VAPID public key from URL-safe base64 to Uint8Array.
 * Required for PushManager.subscribe() applicationServerKey parameter.
 *
 * @param base64String - URL-safe base64 encoded VAPID public key
 * @returns Uint8Array for use with PushManager.subscribe()
 *
 * @example
 * ```typescript
 * const key = urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
 * await registration.pushManager.subscribe({ applicationServerKey: key });
 * ```
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Add padding if needed (base64 strings should be divisible by 4)
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  // Convert URL-safe base64 to standard base64
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  // Decode base64 to binary string
  const rawData = window.atob(base64);
  // Convert to Uint8Array
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported in this browser.
 * Checks for both ServiceWorker and PushManager APIs.
 *
 * @returns true if push notifications can be used
 *
 * @example
 * ```typescript
 * if (!isPushSupported()) {
 *   console.log('Push notifications not available in this browser');
 *   return;
 * }
 * ```
 */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * Push subscription status result
 */
export interface PushSubscriptionStatus {
  /** Whether the browser supports push notifications */
  supported: boolean;
  /** Current notification permission status, or 'unsupported' if not available */
  permission: NotificationPermission | "unsupported";
  /** Whether user is currently subscribed to push notifications */
  subscribed: boolean;
}

/**
 * Get current push subscription status.
 * Checks browser support, permission status, and active subscription.
 *
 * @returns Object with supported, permission, and subscribed status
 *
 * @example
 * ```typescript
 * const status = await getPushSubscriptionStatus();
 * if (status.subscribed) {
 *   console.log('User already subscribed to push');
 * } else if (status.permission === 'denied') {
 *   console.log('User has blocked notifications');
 * } else {
 *   console.log('Can prompt user to enable notifications');
 * }
 * ```
 */
export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  if (!isPushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }

  const permission = Notification.permission;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      supported: true,
      permission,
      subscribed: subscription !== null,
    };
  } catch {
    return { supported: true, permission, subscribed: false };
  }
}

/**
 * Get the current push subscription if one exists.
 * Useful for checking subscription details or unsubscribing.
 *
 * @returns PushSubscription object or null if not subscribed
 *
 * @example
 * ```typescript
 * const subscription = await getCurrentSubscription();
 * if (subscription) {
 *   console.log('Endpoint:', subscription.endpoint);
 * }
 * ```
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Subscribe to push notifications.
 * Registers service worker, requests permission, and creates subscription.
 *
 * @returns JSON stringified PushSubscription to save to database
 * @throws Error if push not supported, permission denied, or VAPID key missing
 *
 * @example
 * ```typescript
 * try {
 *   const subscriptionJson = await subscribeToPush();
 *   // Save to Convex database
 *   await updatePushSubscription({ pushSubscription: subscriptionJson });
 * } catch (error) {
 *   if (error.message.includes('permission denied')) {
 *     showNotificationBlockedMessage();
 *   }
 * }
 * ```
 */
export async function subscribeToPush(): Promise<string> {
  if (!isPushSupported()) {
    throw new Error("Push notifications not supported in this browser");
  }

  // Register service worker if not already registered
  const registration = await navigator.serviceWorker.register("/sw-push.js");
  await navigator.serviceWorker.ready;

  // Request permission from user
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Push notification permission denied");
  }

  // Get VAPID public key from environment
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("VAPID public key not configured");
  }

  // Subscribe to push manager
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
  });

  // Return JSON string for database storage
  return JSON.stringify(subscription);
}

/**
 * Unsubscribe from push notifications.
 * Cleans up the browser subscription. Call database mutation separately to clear stored subscription.
 *
 * @example
 * ```typescript
 * await unsubscribeFromPush();
 * // Also clear from database
 * await updatePushSubscription({ pushSubscription: null });
 * ```
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.error("Failed to unsubscribe from push:", error);
  }
}

/**
 * Check if notification permission can be requested.
 * Returns false if already denied (user must manually enable in browser settings).
 *
 * @returns true if permission can be requested
 *
 * @example
 * ```typescript
 * if (!canRequestPermission()) {
 *   showManualEnableInstructions();
 * }
 * ```
 */
export function canRequestPermission(): boolean {
  if (!isPushSupported()) return false;
  return Notification.permission !== "denied";
}

/**
 * Unregister the push service worker.
 * Useful for complete cleanup or troubleshooting.
 *
 * @returns true if service worker was found and unregistered
 *
 * @example
 * ```typescript
 * const unregistered = await unregisterPushServiceWorker();
 * if (unregistered) {
 *   console.log('Service worker removed');
 * }
 * ```
 */
export async function unregisterPushServiceWorker(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (registration.active?.scriptURL.includes("sw-push.js")) {
        await registration.unregister();
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
