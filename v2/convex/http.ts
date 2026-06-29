import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { recordError } from "./lib/errorRecording";
import { isLiveContactEventType } from "./marketingWebhook";
import { Webhook } from "svix";
import { verifyUnsubscribeToken } from "./lib/unsubscribeToken";

const http = httpRouter();
auth.addHttpRoutes(http);

// ============================================================================
// Resend Inbound Email Webhook
// ============================================================================

http.route({
  path: "/resend-inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const rawBody = await request.text();

      // Verify webhook signature via svix
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        return new Response(JSON.stringify({ error: "Missing signature headers" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("RESEND_WEBHOOK_SECRET not configured");
        return new Response(JSON.stringify({ error: "Webhook not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const wh = new Webhook(webhookSecret);
      try {
        wh.verify(rawBody, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
      } catch {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Signature is verified, but a malformed Resend payload could still fail
      // to parse. Return 400 (not 200) so the bad delivery is visible on
      // Resend's side rather than silently swallowed.
      let body: { type?: unknown; created_at?: unknown; data?: Record<string, unknown> };
      try {
        body = JSON.parse(rawBody);
      } catch (parseError) {
        await recordError(ctx, "webhook", "http.resendInbound.parse", parseError);
        return new Response(JSON.stringify({ error: "Malformed JSON payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Resend contact lifecycle events (subscribe, unsubscribe, delete).
      // Recorded in the marketingEvents table for audit + analytics.
      // Resend remains the source of truth — this is a read-only mirror.
      // The event-type set + guard are single-sourced in marketingWebhook.ts;
      // `isLiveContactEventType` excludes the synthetic `contact.backfill` so it
      // can never arrive from a live delivery.
      if (isLiveContactEventType(body.type)) {
        const data = body.data ?? {};
        // marketingEvents.occurredAt is v.number() which rejects NaN, so an
        // unparseable created_at would otherwise throw inside the mutation.
        // Guard with Number.isFinite and fall back to now.
        const parsedOccurredAt = Date.parse(String(body.created_at ?? data.created_at ?? ""));
        const occurredAt = Number.isFinite(parsedOccurredAt) ? parsedOccurredAt : Date.now();
        try {
          // Size caps on user-supplied fields. Svix verified the signature, but
          // a malformed Resend payload (or Resend bug) could still supply
          // oversized strings. These caps bound storage growth + DB write cost.
          await ctx.runMutation(internal.marketingWebhook.recordContactEvent, {
            svixId,
            email: String(data.email ?? "").slice(0, 254), // RFC 5321 max
            contactId: String(data.id ?? "").slice(0, 200),
            audienceId: data.audience_id
              ? String(data.audience_id).slice(0, 200)
              : undefined,
            eventType: body.type,
            unsubscribed: Boolean(data.unsubscribed),
            occurredAt,
            firstName: data.first_name
              ? String(data.first_name).slice(0, 200)
              : undefined,
            lastName: data.last_name
              ? String(data.last_name).slice(0, 200)
              : undefined,
            rawPayload: rawBody.slice(0, 10_000),
          });
        } catch (error) {
          // The internal write failed (transient DB / scheduler issue), not a
          // bad payload. Return 5xx so svix/Resend redelivers with the same
          // svix-id — the by_svix_id dedup in recordContactEvent makes retry
          // safe (no duplicate rows). Swallowing this as 200 would permanently
          // drop CAN-SPAM unsubscribe audit events when the DB is unhealthy.
          console.error("Failed to record contact event:", error);
          await recordError(
            ctx,
            "webhook",
            "http.resendInbound.recordContact",
            error,
          );
          return new Response(JSON.stringify({ error: "Failed to persist event" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Note: a marketing (Broadcast) unsubscribe is intentionally NOT mirrored
        // into emailWeeklyDigest. The weekly digest is a transactional service
        // notification with its own one-click unsubscribe and stays independent of
        // promotional marketing consent.
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Resend inbound email events — delegated to supportEmail processor below
      if (body.type !== "email.received") {
        return new Response(JSON.stringify({ ignored: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const data = (body.data ?? {}) as {
        email_id?: string;
        from?: string;
        to?: string | string[];
        subject?: string;
        message_id?: string;
      };
      if (!data.email_id) {
        return new Response(JSON.stringify({ error: "Missing email_id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Parse sender — format: "Name <email>" or just "email"
      let fromEmail = data.from || "";
      let fromName: string | undefined;
      const nameMatch = fromEmail.match(/^(.+?)\s*<(.+?)>$/);
      if (nameMatch) {
        fromName = nameMatch[1]!.trim();
        fromEmail = nameMatch[2]!.trim();
      }

      // Schedule async processing (fetch full content, store, notify)
      await ctx.runAction(internal.supportEmail.processInboundEmail, {
        resendEmailId: data.email_id,
        fromEmail,
        fromName,
        toEmails: Array.isArray(data.to) ? data.to : [data.to ?? ""],
        subject: data.subject || "(No subject)",
        messageId: data.message_id || data.email_id,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Resend inbound webhook error:", error);
      await recordError(ctx, "webhook", "http.resendInbound.process", error);
      // Catch-all for unexpected faults in the email.received path. Malformed
      // payloads (400) and contact-write failures (500) are handled inline
      // above; this returns 200 so Resend doesn't retry email.received
      // processing (handled async by supportEmail, which records its own errors).
      return new Response(
        JSON.stringify({
          error: "Processing error",
          message: error instanceof Error ? error.message : "Unknown",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// ============================================================================
// WEEKLY DIGEST — one-click unsubscribe (RFC 8058)
// ============================================================================

async function resolveUnsubscribeEmail(req: Request): Promise<string | null> {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return null;
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return null;
  return verifyUnsubscribeToken(token, secret);
}

function unsubscribePage(title: string, body: string, button?: { action: string }): Response {
  const buttonHtml = button
    ? `<form method="POST" action="${button.action}" style="margin:20px 0 0 0;">
         <button type="submit" style="background:#18181b;color:#fffffe;border:3px solid #000001;box-shadow:4px 4px 0 #22c55e;font-size:14px;font-weight:700;padding:12px 28px;cursor:pointer;">Unsubscribe</button>
       </form>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fffffe;border:4px solid #000001;">
      <tr><td style="background:#000001;padding:18px 24px;"><span style="color:#22c55e;font-weight:700;font-size:18px;">PERM</span><span style="color:#fffffe;font-weight:700;font-size:18px;"> Tracker</span></td></tr>
      <tr><td style="padding:28px 24px;">
        <div style="font-size:18px;font-weight:700;color:#18181b;margin:0 0 8px 0;">${title}</div>
        <div style="font-size:14px;line-height:21px;color:#52525b;">${body}</div>
        ${buttonHtml}
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// POST: one-click. Hit by Gmail/Apple's native Unsubscribe button (List-Unsubscribe-Post)
// and by the confirmation form. Acts immediately.
http.route({
  path: "/unsubscribe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const email = await resolveUnsubscribeEmail(req);
    if (!email) return new Response("Invalid or expired unsubscribe link.", { status: 400 });
    await ctx.runMutation(internal.notifications.unsubscribeWeeklyByEmail, { email });
    return unsubscribePage(
      "You're unsubscribed",
      "You won't receive the weekly summary anymore. Your deadline reminders are unaffected, and you can turn the weekly summary back on anytime in your account settings."
    );
  }),
});

// GET: a human clicked the in-email link. Show a confirmation page with a POST
// button — prefetch-safe (a bare GET, e.g. Apple Mail Privacy prefetch, never unsubscribes).
http.route({
  path: "/unsubscribe",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const email = await resolveUnsubscribeEmail(req);
    if (!email) return new Response("Invalid or expired unsubscribe link.", { status: 400 });
    const token = new URL(req.url).searchParams.get("token") ?? "";
    return unsubscribePage(
      "Unsubscribe from the weekly summary?",
      "This only stops the weekly PERM summary. Your deadline reminders keep coming, and you can turn the summary back on anytime in settings.",
      { action: `/unsubscribe?token=${encodeURIComponent(token)}` }
    );
  }),
});

export default http;
