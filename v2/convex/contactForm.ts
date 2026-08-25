import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { FROM_EMAIL, getResend, sendEmailWithRetry } from "./lib/email";
import { recordError } from "./lib/errorRecording";

/**
 * The contact form's write path. Public-endpoint checklist applied:
 *
 * - The mutation is INTERNAL: the only way in is the HTTP route, which owns
 *   field narrowing, length caps and the honeypot. A public mutation would be
 *   a second entry point that skips all three.
 * - The per-IP limit raises the cost of naive abuse; the control that cannot
 *   be rotated around is the GLOBAL daily budget, because the finite thing
 *   being protected is the shared 100/day Resend quota.
 * - Store first, forward second: the message is durable before any email
 *   moves, so a Resend failure costs latency, never the message.
 */

const GLOBAL_PER_DAY = 25;
const PER_IP_PER_HOUR = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Where the form lands. Adam's forwarding picks it up from support@. */
const CONTACT_INBOX = "support@permtracker.app";

export const submit = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    ip: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    throttled: v.optional(v.boolean()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Global budget: bounded read via the index range, newest first.
    let today = 0;
    const dayFloor = now - DAY_MS;
    for await (const row of ctx.db
      .query("contactMessages")
      .withIndex("by_created", (q) => q.gte("createdAt", dayFloor))) {
      today += 1;
      if (today >= GLOBAL_PER_DAY) {
        return {
          ok: false,
          throttled: true,
          message:
            "The contact form has reached its daily limit. Email us directly instead.",
        };
      }
      void row;
    }

    // Per-IP cost raiser.
    let mine = 0;
    for await (const row of ctx.db
      .query("contactMessages")
      .withIndex("by_ip_created", (q) =>
        q.eq("ip", args.ip).gte("createdAt", now - HOUR_MS),
      )) {
      mine += 1;
      if (mine >= PER_IP_PER_HOUR) {
        return {
          ok: false,
          throttled: true,
          message: "That's a few messages in a row. Give it an hour, or email us directly.",
        };
      }
      void row;
    }

    const id = await ctx.db.insert("contactMessages", {
      name: args.name,
      email: args.email,
      message: args.message,
      ip: args.ip,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.contactForm.forward, { id });
    return { ok: true, message: "Sent. We read everything and reply by email." };
  },
});

export const forward = internalAction({
  args: { id: v.id("contactMessages") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await ctx.runQuery(internal.contactForm.getById, { id });
    if (!row || row.notifiedAt) return null;

    const esc = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const result = await sendEmailWithRetry(getResend(), {
      from: FROM_EMAIL,
      to: CONTACT_INBOX,
      replyTo: row.email,
      subject: `Contact form: ${row.name}`,
      html: `<p><b>${esc(row.name)}</b> &lt;${esc(row.email)}&gt;</p><p style="white-space:pre-wrap">${esc(row.message)}</p>`,
    });
    if (result.error) {
      // The message is already stored; log and leave notifiedAt unset so a
      // later manual sweep can see exactly which forwards never went out.
      await recordError(
        ctx,
        "action",
        "contactForm.forward",
        new Error(`contact forward failed: ${JSON.stringify(result.error)}`),
      );
      return null;
    }
    await ctx.runMutation(internal.contactForm.markNotified, { id });
    return null;
  },
});

export const getById = internalQuery({
  args: { id: v.id("contactMessages") },
  returns: v.union(
    v.object({
      email: v.string(),
      name: v.string(),
      message: v.string(),
      notifiedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return null;
    return {
      email: row.email,
      name: row.name,
      message: row.message,
      notifiedAt: row.notifiedAt,
    };
  },
});

export const markNotified = internalMutation({
  args: { id: v.id("contactMessages") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { notifiedAt: Date.now() });
    return null;
  },
});
