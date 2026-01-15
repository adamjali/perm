/**
 * Push Notification Actions
 *
 * Internal actions for sending push notifications via Web Push API.
 * Uses web-push library which requires Node.js runtime.
 *
 * ACTIONS:
 * - sendPushNotification: Send push notification to a user
 *
 * Environment variables required:
 * - NEXT_PUBLIC_VAPID_PUBLIC_KEY: VAPID public key
 * - VAPID_PRIVATE_KEY: VAPID private key
 *
 * NOTE: Since this file uses "use node", only actions can be defined here.
 * Queries and mutations are defined in pushSubscriptions.ts
 *
 * @module
 */

"use node";

import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import * as webpush from "web-push";
import { loggers } from "./lib/logging";

const log = loggers.push;

// ============================================================================
// VAPID CONFIGURATION
// ============================================================================

// Lazy VAPID configuration with error handling
let vapidConfigured = false;
let vapidConfigError: string | null = null;

/**
 * Ensure VAPID is configured before sending push notifications.
 * Uses lazy initialization to handle environment variable availability
 * and provides error handling for misconfigured keys.
 */
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  if (vapidConfigError) return false;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    vapidConfigError = "VAPID keys not configured";
    return false;
  }

  try {
    webpush.setVapidDetails(
      "mailto:support@permtracker.app",
      publicKey,
      privateKey
    );
    vapidConfigured = true;
    return true;
  } catch (error) {
    vapidConfigError = error instanceof Error ? error.message : "Unknown VAPID configuration error";
    log.error('Failed to configure VAPID', { error: vapidConfigError });
    return false;
  }
}

// ============================================================================
// INTERNAL ACTIONS
// ============================================================================

/**
 * Send a push notification to a user.
 *
 * Called from scheduled jobs when push is enabled.
 * Handles subscription validation and automatic cleanup of expired subscriptions.
 *
 * @param userId - User to send notification to
 * @param title - Notification title
 * @param body - Notification body text
 * @param url - Optional URL to open when notification is clicked (defaults to /dashboard)
 * @param tag - Optional tag for notification grouping (defaults to perm-tracker)
 */
export const sendPushNotification = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, { userId, title, body, url, tag }) => {
    // Ensure VAPID is configured (lazy initialization)
    if (!ensureVapidConfigured()) {
      return { sent: false, reason: "vapid_not_configured", error: vapidConfigError };
    }

    // Get user's push subscription from profile
    const userProfile = await ctx.runQuery(internal.pushSubscriptions.getUserProfileById, { userId });

    if (!userProfile?.pushSubscription) {
      return { sent: false, reason: "no_subscription" };
    }

    if (!userProfile.pushNotificationsEnabled) {
      return { sent: false, reason: "push_disabled" };
    }

    // Build push notification payload
    const payload = JSON.stringify({
      title,
      body,
      url: url || "/dashboard",
      tag: tag || "perm-tracker",
      icon: "/icon-192.png",
      badge: "/badge-72.png",
    });

    // Parse stored subscription JSON - handle corruption separately from send failures
    let subscription;
    try {
      subscription = JSON.parse(userProfile.pushSubscription);
    } catch (parseError) {
      // Subscription data is corrupted - clear it and report specific error
      log.error('Corrupted subscription data for user', {
        resourceId: userId,
        error: parseError instanceof Error ? parseError.message : 'JSON parse failed',
      });
      await ctx.runMutation(internal.pushSubscriptions.clearPushSubscription, { userId });
      return { sent: false, reason: "subscription_corrupted", error: "Invalid subscription data" };
    }

    try {
      // Send the push notification
      await webpush.sendNotification(subscription, payload);

      return { sent: true };
    } catch (error: unknown) {
      // Handle expired or invalid subscriptions
      const webPushError = error as { statusCode?: number; message?: string };

      if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
        // Subscription has expired or is no longer valid - remove it
        await ctx.runMutation(internal.pushSubscriptions.clearPushSubscription, { userId });
        return { sent: false, reason: "subscription_expired" };
      } else {
        // Other error - log but don't remove subscription
        log.error('Push notification failed', { error: webPushError.message || 'Unknown error' });
        return {
          sent: false,
          reason: "send_failed",
          error: webPushError.message || "Unknown error",
        };
      }
    }
  },
});

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Send a test push notification to the current user.
 *
 * This action is exposed to the client (not internal) so users can
 * test their push notification setup from the settings page.
 * Requires the user to be authenticated and have push notifications enabled.
 */
export const sendTestPush = action({
  args: {},
  handler: async (ctx) => {
    // Ensure VAPID is configured
    if (!ensureVapidConfigured()) {
      throw new Error("Push notifications are not configured on the server");
    }

    // Get current user's push profile (includes auth check)
    const pushProfile = await ctx.runQuery(api.pushSubscriptions.getCurrentUserPushProfile);

    if (!pushProfile) {
      throw new Error("Not authenticated");
    }

    if (!pushProfile.pushSubscription) {
      throw new Error("No push subscription found. Please enable push notifications first.");
    }

    if (!pushProfile.pushNotificationsEnabled) {
      throw new Error("Push notifications are disabled. Please enable them first.");
    }

    // Build test push notification payload
    const payload = JSON.stringify({
      title: "Test Push Notification",
      body: "Your push notifications are working correctly! You will receive deadline reminders and alerts.",
      url: "/settings",
      tag: "perm-tracker-test",
      icon: "/icon-192.png",
      badge: "/badge-72.png",
    });

    try {
      // Parse stored subscription JSON
      const subscription = JSON.parse(pushProfile.pushSubscription);

      // Send the push notification
      await webpush.sendNotification(subscription, payload);

      return { success: true };
    } catch (error: unknown) {
      // Handle expired or invalid subscriptions
      const webPushError = error as { statusCode?: number; message?: string };

      if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
        // Subscription has expired or is no longer valid - remove it
        await ctx.runMutation(internal.pushSubscriptions.clearPushSubscription, { userId: pushProfile.userId });
        throw new Error("Push subscription expired. Please re-enable push notifications.");
      } else {
        // Other error
        log.error('Test push notification failed', { error: webPushError.message || 'Unknown error' });
        throw new Error(`Failed to send test notification: ${webPushError.message || "Unknown error"}`);
      }
    }
  },
});
