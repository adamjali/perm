/**
 * Support Email Functions
 *
 * Handles inbound support emails received via Resend webhook.
 * - Stores emails in supportEmails table
 * - Forwards non-support emails to admin (replaces ImprovMX catch-all)
 * - Sends threaded replies with In-Reply-To/References headers
 * - Notifies admin of new support emails
 *
 * @module
 */

import { v } from "convex/values";
import { internalMutation, internalAction, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getResend, FROM_EMAIL } from "./lib/email";
import { requireAdmin } from "./lib/admin";
import { loggers } from "./lib/logging";
import { recordError } from "./lib/errorRecording";

const log = loggers.email;

/** Email address to forward non-support emails to (replaces ImprovMX catch-all) */
const CATCH_ALL_FORWARD_TO = process.env.SUPPORT_FORWARD_EMAIL || "support@permtracker.app";

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Store an inbound support email in the database.
 */
export const storeSupportEmail = internalMutation({
  args: {
    fromEmail: v.string(),
    fromName: v.optional(v.string()),
    toEmail: v.string(),
    subject: v.string(),
    bodyHtml: v.optional(v.string()),
    bodyText: v.optional(v.string()),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.string()),
    resendEmailId: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("forwarded")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("supportEmails", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ============================================================================
// INTERNAL ACTIONS
// ============================================================================

/**
 * Process an inbound email from the Resend webhook.
 *
 * 1. Fetches full email content from Resend API (webhook only has metadata)
 * 2. If to support@: stores email + notifies admin
 * 3. If to anything else: forwards to catch-all address (replaces ImprovMX)
 */
export const processInboundEmail = internalAction({
  args: {
    resendEmailId: v.string(),
    fromEmail: v.string(),
    fromName: v.optional(v.string()),
    toEmails: v.array(v.string()),
    subject: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const resend = getResend();

    // Fetch full email content (webhook only contains metadata)
    let bodyHtml: string | undefined;
    let bodyText: string | undefined;
    let inReplyTo: string | undefined;
    let references: string | undefined;

    try {
      const fullEmail = await resend.emails.receiving.get(args.resendEmailId);
      if (fullEmail?.data) {
        bodyHtml = fullEmail.data.html ?? undefined;
        bodyText = fullEmail.data.text ?? undefined;
        // Extract threading headers if available
        const headers = fullEmail.data.headers;
        if (headers) {
          inReplyTo = headers["in-reply-to"] || headers["In-Reply-To"];
          references = headers["references"] || headers["References"];
        }
      }
    } catch (err) {
      log.error("Failed to fetch full email content from Resend", {
        resendEmailId: args.resendEmailId,
        error: err instanceof Error ? err.message : "Unknown",
      });
      await recordError(ctx, "action", "supportEmail.processInbound.fetchContent", err, { resourceId: args.resendEmailId });
      // Continue with metadata only — still store the email
    }

    const toEmail = args.toEmails[0] || "";
    const isSupport = toEmail.toLowerCase().startsWith("support@");

    // Store ALL emails in database
    await ctx.runMutation(internal.supportEmail.storeSupportEmail, {
      fromEmail: args.fromEmail,
      fromName: args.fromName,
      toEmail,
      subject: args.subject,
      bodyHtml,
      bodyText,
      messageId: args.messageId,
      inReplyTo,
      references,
      resendEmailId: args.resendEmailId,
      status: "received",
    });

    log.info("Email stored", {
      from: args.fromEmail,
      to: toEmail,
      subject: args.subject,
    });

    // Non-support emails also get forwarded to catch-all
    if (!isSupport) {
      try {
        const { error } = await resend.emails.send({
          from: FROM_EMAIL,
          to: [CATCH_ALL_FORWARD_TO],
          subject: `[Fwd] ${args.subject}`,
          replyTo: args.fromEmail,
          text: `---------- Forwarded Email ----------\nFrom: ${args.fromName ? `${args.fromName} <${args.fromEmail}>` : args.fromEmail}\nTo: ${toEmail}\nSubject: ${args.subject}\n-------------------------------------\n\n${bodyText || "(No text content)"}`,
          html: bodyHtml
            ? `<div style="padding:12px;background:#f4f4f5;border-radius:8px;margin-bottom:16px;font-size:13px;color:#71717a"><strong>Forwarded Email</strong><br/>From: ${args.fromName ? `${args.fromName} &lt;${args.fromEmail}&gt;` : args.fromEmail}<br/>To: ${toEmail}<br/>Subject: ${args.subject}</div>${bodyHtml}`
            : undefined,
        });

        if (error) {
          log.error("Failed to forward email", {
            error: error.message,
            to: toEmail,
          });
        } else {
          log.info("Email also forwarded to catch-all", {
            from: args.fromEmail,
            originalTo: toEmail,
            forwardedTo: CATCH_ALL_FORWARD_TO,
          });
        }
      } catch (err) {
        log.error("Error forwarding email", {
          error: err instanceof Error ? err.message : "Unknown",
        });
        await recordError(ctx, "action", "supportEmail.processInbound.forward", err, { resourceId: args.resendEmailId });
      }

    }
  },
});

/**
 * Reply to any inbound email with proper threading headers.
 *
 * Usage via CLI:
 *   npx convex run supportEmail:replyToEmail '{"supportEmailId":"<id>","replyBody":"Your reply text"}' --prod
 *
 * To find the ID, check the supportEmails table in the Convex dashboard,
 * or run: npx convex run supportEmail:listSupportEmails '{}' --prod
 */
export const replyToEmail = internalAction({
  args: {
    supportEmailId: v.id("supportEmails"),
    replyBody: v.string(),
    fromName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; to: string; subject: string }> => {
    // Get the original email
    const original = await ctx.runQuery(
      internal.supportEmail.getEmailById,
      { id: args.supportEmailId }
    ) as { fromEmail: string; toEmail: string; subject: string; messageId: string; references?: string } | null;

    if (!original) {
      throw new Error("Email not found");
    }

    const resend = getResend();

    // Reply from the address they emailed (support@, notifications@, etc.)
    // Default to support@ if the original toEmail isn't a permtracker address
    const replyFromAddress = original.toEmail.includes("permtracker.app")
      ? original.toEmail
      : "support@permtracker.app";
    const fromDisplay = args.fromName || "PERM Tracker";
    const fromHeader = `${fromDisplay} <${replyFromAddress}>`;

    // Build References header: original references + original messageId
    const refsArray = original.references
      ? [original.references, original.messageId]
      : [original.messageId];
    const referencesHeader = refsArray.join(" ");

    // Render branded HTML using AdminEmail template
    const { render } = await import("@react-email/render");
    const { AdminEmail } = await import("../src/emails/AdminEmail");

    // Extract recipient first name for greeting
    const recipientName = original.fromEmail.split("@")[0] || "there";

    const html = await render(
      AdminEmail({
        recipientName,
        subject: `Re: ${original.subject}`,
        body: args.replyBody,
        appUrl: "https://permtracker.app",
      })
    );

    const { data, error } = await resend.emails.send({
      from: fromHeader,
      to: [original.fromEmail],
      subject: `Re: ${original.subject}`,
      text: args.replyBody,
      html,
      headers: {
        "In-Reply-To": original.messageId,
        References: referencesHeader,
      },
    });

    if (error) {
      log.error("Failed to send reply", {
        error: error.message,
        supportEmailId: args.supportEmailId,
      });
      throw new Error(`Failed to send reply: ${error.message}`);
    }

    // Update the email with reply info
    await ctx.runMutation(internal.supportEmail.markReplied, {
      id: args.supportEmailId,
      replyBody: args.replyBody,
      replyMessageId: data?.id || "",
    });

    log.info("Reply sent", {
      from: fromHeader,
      to: original.fromEmail,
      subject: original.subject,
    });

    return { success: true, to: original.fromEmail, subject: `Re: ${original.subject}` };
  },
});

// ============================================================================
// INTERNAL QUERIES (for use by actions)
// ============================================================================

/**
 * Get a support email by ID (internal use).
 */
export const getEmailById = internalQuery({
  args: { id: v.id("supportEmails") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================================================
// INTERNAL MUTATIONS (status updates)
// ============================================================================

/**
 * Mark a support email as replied.
 */
export const markReplied = internalMutation({
  args: {
    id: v.id("supportEmails"),
    replyBody: v.string(),
    replyMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "replied",
      replyBody: args.replyBody,
      replyMessageId: args.replyMessageId,
      repliedAt: Date.now(),
    });
  },
});

// ============================================================================
// ADMIN QUERIES
// ============================================================================

/**
 * List support emails (admin only, for future admin UI).
 */
export const listSupportEmails = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("received"),
        v.literal("replied"),
        v.literal("forwarded"),
        v.literal("archived")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Admin only
    await requireAdmin(ctx);

    let q = ctx.db.query("supportEmails").order("desc");

    if (args.status) {
      q = ctx.db
        .query("supportEmails")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc");
    }

    const emails = await q.take(args.limit || 50);
    return emails;
  },
});
