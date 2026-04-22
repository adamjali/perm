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
import { isEmailBlocked } from "./lib/emailBlocklist";

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
 *
 * Returns null for:
 *   - Unauthenticated callers
 *   - 404 (contact not yet in Resend — expected for new users)
 *   - Any upstream error (logged, but UI degrades to null rather than throwing)
 *
 * Non-404 errors are logged so a revoked API key doesn't silently appear as
 * "not subscribed" forever.
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
      if (res.status === 404) return null; // expected: new user, no contact yet
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(
          `[MarketingEmail] getMarketingSubscriptionStatus: Resend ${res.status} ${text.slice(0, 200)}`
        );
        return null;
      }
      const data = await res.json();
      return data.unsubscribed === false;
    } catch (error) {
      console.warn(
        "[MarketingEmail] getMarketingSubscriptionStatus threw:",
        error instanceof Error ? error.message : String(error)
      );
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
          paginationOpts: { numItems: 500, cursor },
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
    let failed = 0;

    async function runWrite(
      label: string,
      email: string,
      doRequest: () => Promise<Response>,
    ): Promise<boolean> {
      try {
        const res = await doRequest();
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.warn(
            `[MarketingEmail] ${label} failed for ${email}: ${res.status} ${text.slice(0, 200)}`,
          );
          failed++;
          return false;
        }
        return true;
      } catch (error) {
        console.warn(
          `[MarketingEmail] ${label} threw for ${email}:`,
          error instanceof Error ? error.message : String(error),
        );
        failed++;
        return false;
      }
    }

    // 4. Sync users → Resend
    for (const user of allUsers) {
      if (!user.email) continue;
      const emailLower = user.email.toLowerCase();
      const firstName = extractFirstName(user.name);

      // Skip deleted users AND blocklisted emails — remove from Resend if present
      if (user.deletedAt || isEmailBlocked(emailLower)) {
        const existing = resendByEmail.get(emailLower);
        if (existing) {
          const ok = await runWrite("DELETE (deleted/blocked)", emailLower, () =>
            resendFetch(`/contacts/${existing.id}`, apiKey, { method: "DELETE" }),
          );
          if (ok) removed++;
          await sleep(RATE_LIMIT_DELAY_MS);
        }
        continue;
      }

      activeUserEmails.add(emailLower);
      const existing = resendByEmail.get(emailLower);

      if (!existing) {
        // Create new contact (Resend REST API uses snake_case)
        const ok = await runWrite("POST (create)", emailLower, () =>
          resendFetch("/contacts", apiKey, {
            method: "POST",
            body: {
              email: user.email,
              first_name: firstName || undefined,
              segment_ids: [SEGMENT_ID],
            },
          }),
        );
        if (ok) created++;
        await sleep(RATE_LIMIT_DELAY_MS);
      } else if (firstName && (existing.first_name || "") !== firstName) {
        // Update name if changed (Resend REST API uses snake_case)
        const ok = await runWrite("PATCH (rename)", emailLower, () =>
          resendFetch(`/contacts/${existing.id}`, apiKey, {
            method: "PATCH",
            body: { first_name: firstName },
          }),
        );
        if (ok) updated++;
        await sleep(RATE_LIMIT_DELAY_MS);
      } else {
        skipped++;
      }
    }

    // 5. Remove orphan Resend contacts (not in users table)
    for (const [email, contact] of resendByEmail) {
      if (!activeUserEmails.has(email)) {
        const ok = await runWrite("DELETE (orphan)", email, () =>
          resendFetch(`/contacts/${contact.id}`, apiKey, { method: "DELETE" }),
        );
        if (ok) removed++;
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    const summary = `Sync complete: ${created} created, ${updated} updated, ${removed} removed, ${skipped} unchanged, ${failed} failed`;
    console.log("[MarketingEmail]", summary);
    return summary;
  },
});

// ============================================================================
// BACKFILL (one-off: snapshot current Resend state into marketingEvents)
// ============================================================================

/**
 * Backfill marketingEvents with a synthetic `contact.backfill` event for
 * every existing Resend contact. Used to capture subscription state that
 * predates the webhook being enabled (e.g., Umar's April 15 unsubscribe).
 *
 * Idempotent: svixId = `backfill_<contactId>` is stable per contact, so
 * re-running is a pure no-op (all skipped via the existing by_svix_id dedup
 * index in recordContactEvent).
 *
 * Live webhook events continue to fire normally for future changes — this
 * only fills the gap for historical state.
 *
 * Run: npx convex run marketingEmail:backfillMarketingEvents '{}' --prod
 */
export const backfillMarketingEvents = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const apiKey = getApiKey();

    // Paginate all contacts (same pattern as syncContacts)
    const contacts: ResendContact[] = [];
    let after: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const url = `/contacts?limit=100${after ? `&after=${after}` : ""}`;
      const res = await resendFetch(url, apiKey);
      if (!res.ok) {
        throw new Error(`Failed to list contacts: ${res.status}`);
      }
      const data = await res.json();
      const page: ResendContact[] = data.data || [];
      contacts.push(...page);
      if (page.length < 100) {
        hasMore = false;
      } else {
        after = page[page.length - 1]!.id;
      }
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    const occurredAt = Date.now();
    let inserted = 0;
    let skipped = 0;

    for (const c of contacts) {
      if (!c.email || !c.id) continue;

      // Skip blocklisted emails — never audit them
      if (isEmailBlocked(c.email)) {
        skipped++;
        continue;
      }

      const result = await ctx.runMutation(
        internal.marketingWebhook.recordContactEvent,
        {
          svixId: `backfill_${c.id}`,
          email: c.email,
          contactId: c.id,
          eventType: "contact.backfill",
          unsubscribed: Boolean(c.unsubscribed),
          occurredAt,
          firstName: c.first_name ?? undefined,
          rawPayload: JSON.stringify(c),
        },
      );

      if (result.inserted) {
        inserted++;
      } else {
        skipped++;
      }
    }

    const summary = `Backfill complete: ${inserted} inserted, ${skipped} already present, ${contacts.length} contacts total`;
    console.log("[MarketingBackfill]", summary);
    return summary;
  },
});
