"use node";

/**
 * Marketing Email Subscription Management
 *
 * - Settings toggle: get/update subscription status for a single user
 * - Full sync: reconcile all Convex users ↔ Resend contacts
 *
 * Resend contacts are keyed by email (unique). The `users` table is the
 * source of truth — users with `deletedAt` are excluded, everyone else
 * should be a Resend contact in the General segment.
 */

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Resend rate limit: 2 req/s free, 10 req/s paid. Stay safe at 2/s.
const RATE_LIMIT_DELAY_MS = 600;
const SEGMENT_ID = "260e591b-971e-4e2e-b52e-edba5b369dbb"; // General

function getApiKey(): string {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) throw new Error("AUTH_RESEND_KEY not configured");
  return key;
}

async function resendFetch(
  path: string,
  apiKey: string,
  opts?: { method?: string; body?: unknown }
): Promise<Response> {
  return fetch(`https://api.resend.com${path}`, {
    method: opts?.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(opts?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract and normalize first name from a full name string.
 * - Takes first word (split on space)
 * - Capitalizes first letter, lowercases rest (title case)
 * - Handles empty, whitespace-only, unicode names
 * - Returns empty string if no usable name
 */
function extractFirstName(fullName: string | undefined | null): string {
  if (!fullName) return "";
  const first = fullName.trim().split(/\s+/)[0] || "";
  if (!first) return "";
  // Don't title-case non-Latin scripts (CJK, Arabic, etc.)
  if (/^[a-zA-Z]/.test(first)) {
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  return first; // Return as-is for non-Latin names
}

// ============================================================================
// SETTINGS TOGGLE (called from frontend)
// ============================================================================

/**
 * Get a user's marketing email subscription status from Resend.
 */
export const getMarketingSubscriptionStatus = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<boolean | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    try {
      const apiKey = getApiKey();
      const res = await resendFetch(
        `/contacts/${encodeURIComponent(args.email)}`,
        apiKey
      );
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const apiKey = getApiKey();
    const res = await resendFetch(
      `/contacts/${encodeURIComponent(args.email)}`,
      apiKey,
      { method: "PATCH", body: { unsubscribed: !args.subscribed } }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update subscription: ${res.status} ${text}`);
    }

    return args.subscribed;
  },
});

// ============================================================================
// FULL SYNC (called via CLI or scheduled)
// ============================================================================

interface ResendContact {
  id: string;
  email: string;
  first_name: string | null;
  unsubscribed: boolean;
}

/**
 * Sync all Convex users ↔ Resend contacts.
 *
 * Idempotent. Safe to run anytime. Handles:
 * - New users → create Resend contact
 * - Name changes → update Resend contact
 * - Soft/hard deleted users → remove from Resend
 * - Orphan Resend contacts (no matching user) → remove
 *
 * Run: npx convex run marketingEmail:syncContacts '{}' --prod
 */
export const syncContacts = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const apiKey = getApiKey();

    // 1. Load all users from Convex
    const allUsers: Array<{
      email: string;
      name: string;
      deletedAt?: number;
    }> = [];
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const result: { page: Array<Record<string, unknown>>; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.marketingEmailHelpers.listAllUsers, {
          cursor: cursor || undefined,
        });
      for (const user of result.page) {
        allUsers.push({
          email: (user.email as string) || "",
          name: (user.name as string) || "",
          deletedAt: user.deletedAt as number | undefined,
        });
      }
      done = result.isDone;
      cursor = result.continueCursor;
    }

    // 2. Load all contacts from Resend (paginated)
    const resendContacts: ResendContact[] = [];
    let after: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const url = `/contacts?limit=100${after ? `&after=${after}` : ""}`;
      const res = await resendFetch(url, apiKey);
      if (!res.ok) throw new Error(`Failed to list contacts: ${res.status}`);
      const data = await res.json();
      const contacts = data.data || [];
      resendContacts.push(...contacts);
      if (contacts.length < 100) {
        hasMore = false;
      } else {
        after = contacts[contacts.length - 1].id;
      }
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    // 3. Build lookup maps
    const resendByEmail = new Map<string, ResendContact>();
    for (const c of resendContacts) {
      resendByEmail.set(c.email.toLowerCase(), c);
    }

    const activeUserEmails = new Set<string>();

    let created = 0;
    let updated = 0;
    let removed = 0;
    let skipped = 0;

    // 4. Sync users → Resend
    for (const user of allUsers) {
      if (!user.email) continue;
      const emailLower = user.email.toLowerCase();
      const firstName = extractFirstName(user.name);

      // Skip deleted users — remove from Resend if present
      if (user.deletedAt) {
        const existing = resendByEmail.get(emailLower);
        if (existing) {
          await resendFetch(`/contacts/${existing.id}`, apiKey, { method: "DELETE" });
          removed++;
          await sleep(RATE_LIMIT_DELAY_MS);
        }
        continue;
      }

      activeUserEmails.add(emailLower);
      const existing = resendByEmail.get(emailLower);

      if (!existing) {
        // Create new contact (Resend REST API uses snake_case)
        await resendFetch("/contacts", apiKey, {
          method: "POST",
          body: {
            email: user.email,
            first_name: firstName || undefined,
            segment_ids: [SEGMENT_ID],
          },
        });
        created++;
        await sleep(RATE_LIMIT_DELAY_MS);
      } else if (firstName && (existing.first_name || "") !== firstName) {
        // Update name if changed (Resend REST API uses snake_case)
        await resendFetch(`/contacts/${existing.id}`, apiKey, {
          method: "PATCH",
          body: { first_name: firstName },
        });
        updated++;
        await sleep(RATE_LIMIT_DELAY_MS);
      } else {
        skipped++;
      }
    }

    // 5. Remove orphan Resend contacts (not in users table)
    for (const [email, contact] of resendByEmail) {
      if (!activeUserEmails.has(email)) {
        await resendFetch(`/contacts/${contact.id}`, apiKey, { method: "DELETE" });
        removed++;
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    const summary = `Sync complete: ${created} created, ${updated} updated, ${removed} removed, ${skipped} unchanged`;
    console.log("[MarketingEmail]", summary);
    return summary;
  },
});

