/**
 * One place to see and stop everything we send to an address.
 *
 * The subscription systems grew up separately - queue-month alerts, per-case
 * status alerts, visa-bulletin alerts, the weekly digest, product news - each
 * with its own rows and its own unsubscribe. They stay separate underneath
 * (their sweep state is per-subscription and merging it would be wrong; see
 * the schema docstrings), and this module puts ONE surface over them: a
 * magic-link preference page that lists everything for an address and can
 * turn any of it off.
 *
 * ## The consent asymmetry, on purpose
 *
 * The prefs token proves the bearer can read mail at the address. That is
 * enough to STOP mail (idempotent, self-harming at worst - same reasoning as
 * every unsubscribe token in this codebase) and it is NOT treated as consent
 * to START mail. Turning anything on goes through the flow that owns it: the
 * alert forms (double opt-in) or the signed-in settings page (login). A page
 * that could re-enable sending off a replayable, never-expiring link would be
 * exactly the resurrection path the staged-pending discipline exists to
 * block.
 *
 * ## Product news for anonymous subscribers
 *
 * `newsSubscribers` rows are created UNCONFIRMED by a checkbox on an alert
 * form and confirmed by the same double-opt-in click that confirms the alert
 * (the confirmation email names both). Signed-in users' marketing consent
 * stays in Resend, untouched by any of this except "unsubscribe from
 * everything", which removes the Resend contact through the same path
 * account deletion uses.
 *
 * @module convex/emailPrefs
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { FROM_EMAIL, getResend, sendEmailWithRetry } from "./lib/email";
import { getUserByEmail } from "./lib/auth";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./lib/unsubscribeToken";
import { recordError } from "./lib/errorRecording";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { createLogger } from "./lib/logging";

const log = createLogger("EmailPrefs");

const SITE_URL = "https://permtracker.app";

/**
 * Global daily budget for preference-link emails. Part of the documented
 * Resend 100/day arithmetic in convex/caseAlerts.ts - every list-mail budget
 * is enumerated there and the total leaves 30/day for auth mail.
 */
const PREFS_LINK_GLOBAL_BUDGET = { limit: 6, windowMs: 24 * 60 * 60 * 1000 };
const PREFS_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
const PREFS_COOLDOWN_MS = 10 * 60 * 1000;

const NEUTRAL_REPLY =
  "If we send anything to that address, a preferences link is on its way.";
const THROTTLED_REPLY = "Too many requests. Try again in a little while.";

function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return secret;
}

// ============================================================================
// Product-news consent (rides the alert double-opt-in)
// ============================================================================

/** Stage a news opt-in for an address. Inert until an alert confirm lands. */
export const stageNews = internalMutation({
  args: { email: v.string(), source: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!isPlausibleEmail(email)) return null;
    const existing = await ctx.db
      .query("newsSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      // An opted-out row stays opted out until a fresh confirm click: the
      // stage is recorded by clearing nothing. A new checkbox tick on a form
      // is a request, and the confirm click is what honours it.
      if (existing.unsubscribedAt !== undefined) {
        await ctx.db.patch(existing._id, { createdAt: Date.now() });
      }
      return null;
    }
    await ctx.db.insert("newsSubscribers", {
      email,
      createdAt: Date.now(),
      source: args.source,
    });
    return null;
  },
});

/**
 * Confirm a staged news opt-in, called from the alert confirm handlers.
 *
 * A confirm click proves the inbox, and the confirmation email that carried
 * the link names the news opt-in whenever one was staged. An address with no
 * staged row is a no-op. An address that opted out earlier is re-confirmed
 * ONLY if a fresh stage happened after the opt-out (createdAt > unsubscribedAt),
 * which is the same only-a-new-request-can-resurrect rule the alert rows use.
 */
export const confirmNewsForEmail = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const row = await ctx.db
      .query("newsSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!row) return null;
    if (row.unsubscribedAt !== undefined && row.createdAt <= row.unsubscribedAt) {
      return null;
    }
    if (row.confirmedAt === undefined || row.unsubscribedAt !== undefined) {
      await ctx.db.patch(row._id, {
        confirmedAt: row.confirmedAt ?? Date.now(),
        unsubscribedAt: undefined,
      });
    }
    return null;
  },
});

// ============================================================================
// The magic link
// ============================================================================

/**
 * Request a preferences link. Neutral reply regardless of whether the address
 * is known - answering differently would make this endpoint an oracle for
 * "does this address subscribe to anything here".
 */
export const requestLink = internalMutation({
  args: { email: v.string(), ip: v.optional(v.string()) },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
    throttled: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!isPlausibleEmail(email)) {
      return { ok: false, message: "That email address does not look right." };
    }

    const ip = args.ip?.trim();
    if (ip && ip !== "unknown") {
      const perIp = await checkAndRecordRateLimit(ctx, ip, "prefs_link_ip", PREFS_IP_LIMIT);
      if (!perIp.allowed) {
        return { ok: false, message: THROTTLED_REPLY, throttled: true };
      }
    }

    // Per-address cooldown, tracked on the rateLimits table keyed by the
    // address (no subscriber row is guaranteed to exist to stamp).
    const cooldown = await checkAndRecordRateLimit(ctx, email, "prefs_link_addr", {
      limit: 1,
      windowMs: PREFS_COOLDOWN_MS,
    });
    if (!cooldown.allowed) {
      return { ok: true, message: NEUTRAL_REPLY };
    }

    const budget = await checkAndRecordRateLimit(
      ctx,
      "all",
      "prefs_link_global",
      PREFS_LINK_GLOBAL_BUDGET,
    );
    if (!budget.allowed) {
      log.error("prefs link budget exhausted; refusing to send");
      return { ok: false, message: THROTTLED_REPLY, throttled: true };
    }

    await ctx.scheduler.runAfter(0, internal.emailPrefs.sendLink, { email });
    return { ok: true, message: NEUTRAL_REPLY };
  },
});

/** Send the magic link. */
export const sendLink = internalAction({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const token = await makeUnsubscribeToken(args.email, unsubscribeSecret(), "prefs");
      const base = process.env.CONVEX_SITE_URL;
      if (!base) throw new Error("CONVEX_SITE_URL is not configured");
      const url = `${base}/prefs?token=${encodeURIComponent(token)}`;

      const result = await sendEmailWithRetry(getResend(), {
        from: FROM_EMAIL,
        to: args.email,
        subject: "Your PERM Tracker email preferences",
        text: [
          "Here is the link to see and change everything PERM Tracker sends to this address:",
          "",
          url,
          "",
          "The page lists your alerts and lets you turn any of them off, or stop everything at once.",
          "Turning something new on always happens from the site itself, never from this link.",
          "",
          "If you didn't ask for this, ignore it. Nothing changes unless the link is used.",
          "",
          "PERM Tracker",
          SITE_URL,
        ].join("\n"),
      });
      if (result.error) {
        log.error("prefs link send failed", { error: result.error.message });
        await recordError(
          ctx,
          "action",
          "emailPrefs.sendLink",
          new Error(`Resend: ${result.error.name}: ${result.error.message}`),
        );
      }
    } catch (error) {
      await recordError(ctx, "action", "emailPrefs.sendLink", error);
    }
    return null;
  },
});

// ============================================================================
// State for the page, and the switches (off only)
// ============================================================================

const stateValidator = v.object({
  email: v.string(),
  queueAlerts: v.array(
    v.object({
      id: v.id("dolQueueAlerts"),
      filingMonth: v.string(),
      queue: v.string(),
      confirmed: v.boolean(),
      notified: v.boolean(),
      active: v.boolean(),
    }),
  ),
  caseAlerts: v.array(
    v.object({
      id: v.id("caseStatusAlerts"),
      caseNumber: v.string(),
      confirmed: v.boolean(),
      closed: v.boolean(),
      active: v.boolean(),
    }),
  ),
  bulletinAlerts: v.array(
    v.object({
      id: v.id("bulletinAlerts"),
      category: v.string(),
      country: v.string(),
      confirmed: v.boolean(),
      active: v.boolean(),
    }),
  ),
  news: v.boolean(),
  /** Null when no account exists for the address. */
  weeklyDigest: v.union(v.boolean(), v.null()),
});

async function stateForEmail(ctx: MutationCtx, email: string) {
  const queueRows = await ctx.db
    .query("dolQueueAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
  const caseRows = await ctx.db
    .query("caseStatusAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
  const bulletinRows = await ctx.db
    .query("bulletinAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
  const news = await ctx.db
    .query("newsSubscribers")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  let weeklyDigest: boolean | null = null;
  const user = await getUserByEmail(ctx, email);
  if (user && !user.deletedAt) {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (profile) weeklyDigest = profile.emailWeeklyDigest !== false;
  }

  return {
    email,
    queueAlerts: queueRows.map((r) => ({
      id: r._id,
      filingMonth: r.filingMonth,
      queue: r.queue ?? "perm",
      confirmed: r.confirmedAt !== undefined,
      notified: r.notifiedAt !== undefined,
      active: r.unsubscribedAt === undefined && r.confirmedAt !== undefined,
    })),
    caseAlerts: caseRows.map((r) => ({
      id: r._id,
      caseNumber: r.caseNumber,
      confirmed: r.confirmedAt !== undefined,
      closed: r.caseClosedAt !== undefined,
      active:
        r.unsubscribedAt === undefined &&
        r.confirmedAt !== undefined &&
        r.caseClosedAt === undefined,
    })),
    bulletinAlerts: bulletinRows.map((r) => ({
      id: r._id,
      category: r.category,
      country: r.country,
      confirmed: r.confirmedAt !== undefined,
      active: r.unsubscribedAt === undefined && r.confirmedAt !== undefined,
    })),
    news: news !== null && news.confirmedAt !== undefined && news.unsubscribedAt === undefined,
    weeklyDigest,
  };
}

/**
 * Everything we hold for the address behind a prefs token.
 *
 * A mutation rather than a query ONLY because it shares `stateForEmail` with
 * the switches below; it writes nothing.
 */
export const stateByToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(stateValidator, v.null()),
  handler: async (ctx, args) => {
    const email = await verifyUnsubscribeToken(args.token, unsubscribeSecret(), "prefs");
    if (!email) return null;
    return await stateForEmail(ctx, email);
  },
});

/**
 * Turn ONE thing off. Off only - see the module docstring for why this
 * surface never turns anything on.
 */
export const disableByToken = internalMutation({
  args: {
    token: v.string(),
    kind: v.union(
      v.literal("queue"),
      v.literal("case"),
      v.literal("bulletin"),
      v.literal("news"),
      v.literal("digest"),
    ),
    /** Row id for the row-backed kinds; ignored for news/digest. */
    id: v.optional(v.string()),
  },
  returns: v.union(stateValidator, v.null()),
  handler: async (ctx, args) => {
    const email = await verifyUnsubscribeToken(args.token, unsubscribeSecret(), "prefs");
    if (!email) return null;
    const now = Date.now();

    if (args.kind === "news") {
      const row = await ctx.db
        .query("newsSubscribers")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (row && row.unsubscribedAt === undefined) {
        await ctx.db.patch(row._id, { unsubscribedAt: now });
      }
    } else if (args.kind === "digest") {
      await ctx.runMutation(internal.notifications.unsubscribeWeeklyByEmail, {
        email,
      });
    } else if (args.id) {
      // The id names the row, the TOKEN names the address, and the address
      // wins: a row that does not belong to this email is never touched, so
      // a guessed or leaked id cannot cancel someone else's alert.
      const wanted = ctx.db.normalizeId(
        args.kind === "queue"
          ? "dolQueueAlerts"
          : args.kind === "case"
            ? "caseStatusAlerts"
            : "bulletinAlerts",
        args.id,
      );
      if (wanted) {
        if (args.kind === "queue") {
          const row = await ctx.db.get(wanted as Id<"dolQueueAlerts">);
          if (row && row.email === email && row.unsubscribedAt === undefined) {
            await ctx.db.patch(row._id, {
              unsubscribedAt: now,
              pendingFilingMonth: undefined,
            });
          }
        } else if (args.kind === "case") {
          const row = await ctx.db.get(wanted as Id<"caseStatusAlerts">);
          if (row && row.email === email && row.unsubscribedAt === undefined) {
            await ctx.db.patch(row._id, {
              unsubscribedAt: now,
              pendingCaseNumber: undefined,
            });
          }
        } else {
          const row = await ctx.db.get(wanted as Id<"bulletinAlerts">);
          if (row && row.email === email && row.unsubscribedAt === undefined) {
            await ctx.db.patch(row._id, {
              unsubscribedAt: now,
              pendingSeries: undefined,
            });
          }
        }
      }
    }

    return await stateForEmail(ctx, email);
  },
});

/**
 * Stop everything at once: every alert row tombstoned, news off, weekly
 * digest off, and the Resend marketing contact removed through the same
 * path account deletion uses.
 */
export const unsubscribeAllByToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(stateValidator, v.null()),
  handler: async (ctx, args) => {
    const email = await verifyUnsubscribeToken(args.token, unsubscribeSecret(), "prefs");
    if (!email) return null;
    const now = Date.now();

    for (const row of await ctx.db
      .query("dolQueueAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect()) {
      if (row.unsubscribedAt === undefined || row.pendingFilingMonth !== undefined) {
        await ctx.db.patch(row._id, {
          unsubscribedAt: row.unsubscribedAt ?? now,
          pendingFilingMonth: undefined,
        });
      }
    }
    for (const row of await ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect()) {
      if (row.unsubscribedAt === undefined || row.pendingCaseNumber !== undefined) {
        await ctx.db.patch(row._id, {
          unsubscribedAt: row.unsubscribedAt ?? now,
          pendingCaseNumber: undefined,
        });
      }
    }
    for (const row of await ctx.db
      .query("bulletinAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect()) {
      if (row.unsubscribedAt === undefined || row.pendingSeries !== undefined) {
        await ctx.db.patch(row._id, {
          unsubscribedAt: row.unsubscribedAt ?? now,
          pendingSeries: undefined,
        });
      }
    }
    const news = await ctx.db
      .query("newsSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (news && news.unsubscribedAt === undefined) {
      await ctx.db.patch(news._id, { unsubscribedAt: now });
    }
    await ctx.runMutation(internal.notifications.unsubscribeWeeklyByEmail, { email });
    // Resend contact removal is an action (external API); scheduled, and
    // idempotent on the other end for an address with no contact.
    await ctx.scheduler.runAfter(0, internal.marketingEmail.removeContactByEmail, {
      email,
    });

    return await stateForEmail(ctx, email);
  },
});
