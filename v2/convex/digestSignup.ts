/**
 * Signing up for the weekly digest on its own, with no alert attached.
 *
 * Until Oct 29 2026 the digest could only be ticked under an alert form ("Other emails"), so someone who wanted
 * the Tuesday digest and nothing else had to follow a case, a month or a bulletin line first. This is the same
 * double opt-in the alerts use, in the same order (the alert modules' "refusal must not leave the trace of a
 * success" rule, v2/CLAUDE.md):
 *
 * 1. the address's shape, then the per-connection limit;
 * 2. an address already on the list gets the neutral reply and NO email: a second confirmation to a confirmed
 *    reader is mail a stranger could set off, and the reply is the same either way, so it says nothing about
 *    who is signed up;
 * 3. the per-address cooldown (10 minutes), checked before anything is written;
 * 4. the pool, charged BEFORE the write; a full pool queues the request (convex/confirmationQueue.ts);
 * 5. the row is staged with `stageNewsletterFor` (the same helper the alert forms use), stamped, and the
 *    confirmation scheduled.
 *
 * The confirm link is signed for "digest-confirm" only, and confirming goes through
 * `emailPrefs.confirmNewsletterForEmail`, which never resurrects an opt-out from a replayed link.
 */
import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { ReactElement } from "react";
import { FROM_EMAIL, getResend, sendOrQueue } from "./lib/email";
import { CONFIRMATION_COOLDOWN_MS, SUBSCRIBE_IP_LIMIT } from "./lib/alertBudgets";
import { SITE_URL, actionUrl } from "./lib/links";
import { makeUnsubscribeToken, verifyUnsubscribeToken } from "./lib/unsubscribeToken";
import { recordError } from "./lib/errorRecording";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { stageNewsletterFor } from "./lib/newsConsent";
import { createLogger } from "./lib/logging";
import { connectionThrottleReply } from "./lib/throttleReply";
import { admitConfirmation, queueConfirmation, replayArgs } from "./confirmationQueue";
import { isPlausibleEmail } from "./lib/emailShape";

const log = createLogger("DigestSignup");

/** The same sentence every alert form answers with, for every address. */
const NEUTRAL_REPLY = "Check your inbox to confirm.";

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return secret;
}

export const subscribe = internalMutation({
  args: {
    email: v.string(),
    source: v.optional(v.string()),
    ip: v.optional(v.string()),
    /** Set only by the confirmation queue's drain when it replays a request a full pool held back. */
    fromQueue: v.optional(v.boolean()),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
    throttled: v.optional(v.boolean()),
    queued: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!isPlausibleEmail(email)) {
      return { ok: false, message: "That email address does not look right." };
    }

    const ip = args.ip?.trim();
    if (ip && ip !== "unknown" && !args.fromQueue) {
      const perIp = await checkAndRecordRateLimit(ctx, ip, "digest_subscribe_ip", SUBSCRIBE_IP_LIMIT);
      if (!perIp.allowed) {
        return { ok: false, message: connectionThrottleReply(perIp.resetInMs), throttled: true };
      }
    }

    const existing = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    const now = Date.now();

    // Already on the list: nothing to confirm, and nothing is sent.
    if (existing && existing.confirmedAt !== undefined && existing.unsubscribedAt === undefined) {
      return { ok: true, message: NEUTRAL_REPLY };
    }
    if (
      existing?.lastConfirmationSentAt !== undefined &&
      now - existing.lastConfirmationSentAt < CONFIRMATION_COOLDOWN_MS
    ) {
      return { ok: true, message: NEUTRAL_REPLY };
    }

    if (!args.fromQueue) {
      const budget = await admitConfirmation(ctx, "digestConfirm");
      if (!budget.allowed) {
        log.warn("confirmation can't send now (its pool or the day's count); queueing");
        return queueConfirmation(ctx, {
          kind: "digest",
          pool: "digestConfirm",
          email,
          args: replayArgs(args),
          resetInMs: budget.resetInMs,
        });
      }
    }

    await stageNewsletterFor(ctx, email, args.source ?? "digest-form");
    const row = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (row) await ctx.db.patch(row._id, { lastConfirmationSentAt: now });

    await ctx.scheduler.runAfter(0, internal.digestSignup.sendConfirmation, { email });
    return { ok: true, message: NEUTRAL_REPLY };
  },
});

/** A send that failed frees the address to ask again at once. */
export const clearConfirmationCooldown = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (row) await ctx.db.patch(row._id, { lastConfirmationSentAt: undefined });
    return null;
  },
});

async function renderOrTextOnly(
  ctx: Parameters<typeof recordError>[0],
  build: () => Promise<ReactElement>,
): Promise<string | undefined> {
  try {
    const { render } = await import("@react-email/render");
    return await render(await build());
  } catch (error) {
    log.error("email render failed, sending text only");
    await recordError(ctx, "action", "digestSignup.sendConfirmation.render", error);
    return undefined;
  }
}

export const sendConfirmation = internalAction({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const token = await makeUnsubscribeToken(args.email, unsubscribeSecret(), "digest-confirm");
      const confirmUrl = actionUrl("/digest/confirm", token);
      const html = await renderOrTextOnly(ctx, async () => {
        const { DigestConfirm } = await import("../src/emails/DigestConfirm");
        return DigestConfirm({ confirmUrl });
      });
      const result = await sendOrQueue(ctx, "digest-confirmation", getResend(), {
        from: FROM_EMAIL,
        to: args.email,
        subject: "Confirm the weekly PERM Tracker digest",
        html,
        text: [
          "You asked for PERM Tracker's weekly digest: DOL's queue, visa bulletin moves, USCIS times and new rules, on Tuesdays.",
          "",
          "Confirm here and the next issue comes to this address:",
          confirmUrl,
          "",
          "If you didn't ask for this, ignore this message. Nothing further will be sent.",
          "",
          "PERM Tracker",
          SITE_URL,
        ].join("\n"),
      });
      if (result.error) {
        await recordError(
          ctx,
          "action",
          "digestSignup.sendConfirmation",
          new Error(`Resend: ${result.error.name}: ${result.error.message}`),
        );
        await ctx.runMutation(internal.digestSignup.clearConfirmationCooldown, { email: args.email });
      }
    } catch (error) {
      await recordError(ctx, "action", "digestSignup.sendConfirmation", error);
      await ctx.runMutation(internal.digestSignup.clearConfirmationCooldown, { email: args.email });
    }
    return null;
  },
});

/** The confirm click: signed for this purpose only, and it never resurrects an opt-out from a replayed link. */
export const confirmByToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(v.object({ email: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const email = await verifyUnsubscribeToken(args.token, unsubscribeSecret(), "digest-confirm");
    if (!email) return null;
    const row = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!row) return null;
    await ctx.runMutation(internal.emailPrefs.confirmNewsletterForEmail, { email });
    const after = await ctx.db.get(row._id);
    if (!after || after.confirmedAt === undefined || after.unsubscribedAt !== undefined) return null;
    return { email };
  },
});
