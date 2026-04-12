"use node";

/**
 * Marketing Email Subscription Management
 *
 * Convex actions to check/update a user's marketing email subscription
 * status via the Resend Contacts API. Used by the Settings page toggle.
 *
 * Email is passed from the frontend (already known from the user profile)
 * rather than relying on ctx.auth.getUserIdentity().email which may be
 * empty for some Convex Auth providers.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get a user's marketing email subscription status from Resend.
 */
export const getMarketingSubscriptionStatus = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<boolean | null> => {
    // Verify caller is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) return null;

    try {
      const res = await fetch(
        `https://api.resend.com/contacts/${encodeURIComponent(args.email)}`,
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
 * Update a user's marketing email subscription status in Resend.
 */
export const updateMarketingSubscription = action({
  args: { email: v.string(), subscribed: v.boolean() },
  handler: async (ctx, args): Promise<boolean> => {
    // Verify caller is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) throw new Error("AUTH_RESEND_KEY not configured");

    const res = await fetch(
      `https://api.resend.com/contacts/${encodeURIComponent(args.email)}`,
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
