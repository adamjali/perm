/**
 * Marketing Email Subscription Management
 *
 * Convex actions to check/update a user's marketing email subscription
 * status via the Resend Contacts API. Used by the Settings page toggle.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current user's marketing email subscription status from Resend.
 * Returns true if subscribed (not unsubscribed), false if unsubscribed.
 * Returns null if the contact doesn't exist in Resend.
 */
export const getMarketingSubscriptionStatus = action({
  args: {},
  handler: async (ctx): Promise<boolean | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) return null;

    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) return null;

    try {
      const res = await fetch(
        `https://api.resend.com/contacts/${encodeURIComponent(identity.email)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      if (res.status === 404) return null;
      if (!res.ok) return null;

      const data = await res.json();
      return data.unsubscribed === false;
    } catch {
      return null;
    }
  },
});

/**
 * Update the current user's marketing email subscription status in Resend.
 */
export const updateMarketingSubscription = action({
  args: { subscribed: v.boolean() },
  handler: async (ctx, args): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      throw new Error("No email found for current user");
    }

    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      throw new Error("AUTH_RESEND_KEY not configured");
    }

    const res = await fetch(
      `https://api.resend.com/contacts/${encodeURIComponent(identity.email)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ unsubscribed: !args.subscribed }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update subscription: ${res.status} ${text}`);
    }

    return args.subscribed;
  },
});
