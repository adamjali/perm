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
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { isEmailBlocked } from "./lib/emailBlocklist";
import { extractUserIdFromAction } from "./lib/auth";
import { recordError } from "./lib/errorRecording";

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

interface ResendContact {
  id: string;
  email: string;
  first_name: string | null;
  unsubscribed: boolean;
}

/** Resend `GET /contacts/:email` response (fields we consume). */
interface ResendContactResponse {
  unsubscribed?: boolean;
}

/** Resend `GET /contacts` (list) response (fields we consume). */
interface ResendContactListResponse {
  data?: ResendContact[];
}

/**
 * Fetch every Resend contact across all pages, throttled to RATE_LIMIT_DELAY_MS.
 * Throws on any non-2xx — callers can't safely operate on a partial mirror.
 */
async function listAllResendContacts(apiKey: string): Promise<ResendContact[]> {
  const contacts: ResendContact[] = [];
  let after: string | undefined;
  while (true) {
    const url = `/contacts?limit=100${after ? `&after=${after}` : ""}`;
    const res = await resendFetch(url, apiKey);
    if (!res.ok) throw new Error(`Failed to list contacts: ${res.status}`);
    const data: ResendContactListResponse = await res.json();
    const page: ResendContact[] = data.data || [];
    contacts.push(...page);
    if (page.length < 100) break;
    after = page[page.length - 1]!.id;
    await sleep(RATE_LIMIT_DELAY_MS);
  }
  return contacts;
}

/**
 * Resolve the authenticated caller's own email from their user record.
 *
 * The subscription actions accept an `email` arg for the frontend's
 * convenience, but the server NEVER trusts it — operating on a client-supplied
 * email would be an IDOR (any authed user could read/unsubscribe any contact).
 * We derive the email from the caller's identity instead. Returns null if
 * unauthenticated or the user has no resolvable email.
 */
async function resolveCallerEmail(ctx: ActionCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const userId = extractUserIdFromAction(identity.subject);
  return await ctx.runQuery(internal.marketingEmailHelpers.getUserEmailById, {
    userId,
  });
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
 * Get the CALLER's own marketing email subscription status from Resend.
 *
 * The `email` arg exists only for frontend convenience and is IGNORED — the
 * server resolves the authenticated caller's own email from their user record
 * (preventing IDOR: a user must not be able to read another contact's status).
 *
 * Returns null for:
 *   - Unauthenticated callers / callers with no resolvable email
 *   - 404 (contact not yet in Resend — expected for new users)
 *   - Any upstream error (UI degrades to null rather than throwing)
 *
 * Non-404 errors are recorded via recordError so a revoked AUTH_RESEND_KEY
 * (which would make every user appear unsubscribed) surfaces to admins instead
 * of vanishing into console-only logs.
 */
export const getMarketingSubscriptionStatus = action({
  args: { email: v.string() },
  handler: async (ctx, _args): Promise<boolean | null> => {
    const email = await resolveCallerEmail(ctx);
    if (!email) return null;

    try {
      const apiKey = getApiKey();
      const res = await resendFetch(
        `/contacts/${encodeURIComponent(email)}`,
        apiKey
      );
      if (res.status === 404) return null; // expected: new user, no contact yet
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        await recordError(
          ctx,
          "action",
          "marketingEmail.getStatus",
          new Error(`Resend ${res.status} ${text.slice(0, 200)}`),
        );
        return null;
      }
      const data: ResendContactResponse = await res.json();
      return data.unsubscribed === false;
    } catch (error) {
      await recordError(ctx, "action", "marketingEmail.getStatus", error);
      return null;
    }
  },
});

/**
 * Update the CALLER's own marketing email subscription status in Resend.
 *
 * The `email` arg exists only for frontend convenience and is IGNORED — the
 * server resolves the authenticated caller's own email (preventing IDOR: a
 * user must not be able to unsubscribe/resubscribe another contact).
 */
export const updateMarketingSubscription = action({
  args: { email: v.string(), subscribed: v.boolean() },
  handler: async (ctx, args): Promise<boolean> => {
    const email = await resolveCallerEmail(ctx);
    if (!email) throw new Error("Not authenticated");

    const apiKey = getApiKey();
    const res = await resendFetch(
      `/contacts/${encodeURIComponent(email)}`,
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

/**
 * Remove a user's Resend marketing contact by email. Scheduled from the
 * account-deletion cleanup so a deleted user doesn't linger in Resend until the
 * next manual syncContacts run. Idempotent — a missing contact (404) is success.
 */
export const removeContactByEmail = internalAction({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const apiKey = getApiKey();
    const res = await resendFetch(
      `/contacts/${encodeURIComponent(args.email)}`,
      apiKey,
      { method: "DELETE" }
    );
    // 404 = already gone; treat as success. Other failures are recorded, not
    // thrown — the DB deletion already happened; this is best-effort cleanup.
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      await recordError(
        ctx,
        "action",
        "marketingEmail.removeContactByEmail",
        new Error(`Resend DELETE /contacts failed: ${res.status} ${text}`),
        { extra: `email: ${args.email}` }
      );
    }
  },
});

// ============================================================================
// FULL SYNC (called via CLI or scheduled)
// ============================================================================

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
    const resendContacts = await listAllResendContacts(apiKey);

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
    const contacts = await listAllResendContacts(apiKey);
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
