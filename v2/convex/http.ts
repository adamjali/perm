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

function unsubscribePage(
  title: string,
  body: string,
  button?: { action: string; label?: string },
): Response {
  const buttonHtml = button
    ? `<form method="POST" action="${button.action}" style="margin:20px 0 0 0;">
         <button type="submit" style="background:#18181b;color:#fffffe;border:3px solid #000001;box-shadow:4px 4px 0 #22c55e;font-size:14px;font-weight:700;padding:12px 28px;cursor:pointer;">${button.label ?? "Unsubscribe"}</button>
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

// ============================================================================
// Queue-reached alerts
//
// Double opt-in confirm, and a one-click opt-out. Both are keyed on the same
// HMAC token scheme as the weekly digest, so a link cannot be guessed and an
// address cannot be signed up by someone else without access to its inbox.
// ============================================================================

/**
 * Signup endpoint.
 *
 * An HTTP action rather than a Convex React mutation on purpose: the public
 * marketing layout deliberately mounts no ConvexProvider, so those pages never
 * ship the Convex client or open a websocket. A plain POST keeps that promise
 * and keeps the SEO pages light.
 */
const ALLOWED_ORIGINS = new Set([
  "https://permtracker.app",
  "https://www.permtracker.app",
  "http://localhost:3000",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://permtracker.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

http.route({
  path: "/queue-alert/subscribe",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, req) => {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("Origin")) });
  }),
});

http.route({
  path: "/queue-alert/subscribe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const cors = corsHeaders(req.headers.get("Origin"));
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    // Treat the body as unknown and narrow every field before use.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, message: "Malformed request." }, 400);
    }
    if (typeof body !== "object" || body === null) {
      return json({ ok: false, message: "Malformed request." }, 400);
    }

    const { email, filingMonth, role, source } = body as Record<string, unknown>;
    if (typeof email !== "string" || typeof filingMonth !== "string") {
      return json({ ok: false, message: "Email and filing month are both required." }, 400);
    }

    const validRole =
      role === "attorney" || role === "applicant" || role === "employer" ? role : undefined;

    // Best-effort caller identity for the per-IP limit. Convex populates
    // `x-forwarded-for`; the leftmost hop is client-supplied and therefore
    // spoofable, so this raises the cost of naive abuse rather than preventing
    // it. The control that actually bounds damage to the shared Resend quota
    // is the global confirmation budget inside `subscribe`, which no amount of
    // IP or address rotation can get around.
    const forwarded = req.headers.get("x-forwarded-for") ?? "";
    const ip = forwarded.split(",")[0]?.trim() || "unknown";

    const result = await ctx.runMutation(internal.queueAlerts.subscribe, {
      email,
      filingMonth,
      role: validRole,
      source: typeof source === "string" ? source.slice(0, 64) : undefined,
      ip,
    });

    // 200 on success, 429 when a limit refused it, 400 when the caller sent a
    // field we could not use. Collapsing the last two would report every typo
    // as rate-limiting in monitoring.
    return json(result, result.ok ? 200 : result.throttled ? 429 : 400);
  }),
});

// GET shows a button and changes nothing. Outlook Safe Links, Mimecast,
// Proofpoint and Barracuda all fetch URLs in inbound mail, so a GET that
// mutated would let a recipient's own mail gateway complete the double opt-in
// on their behalf — which is exactly the thing double opt-in exists to prevent,
// and it would break this module's promise that a wrong address costs one email
// and nothing more. The sibling unsubscribe route has always worked this way;
// confirm now matches it.
http.route({
  path: "/queue-alert/confirm",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return new Response("Invalid confirmation link.", { status: 400 });
    return unsubscribePage(
      "Confirm your queue alert",
      "We'll email you once, on the day the Department of Labor's PERM analyst-review queue reaches your filing month. That's the only message you'll get.",
      {
        action: `/queue-alert/confirm?token=${encodeURIComponent(token)}`,
        label: "Confirm",
      },
    );
  }),
});

http.route({
  path: "/queue-alert/confirm",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return new Response("Invalid confirmation link.", { status: 400 });

    const result = await ctx.runMutation(internal.queueAlerts.confirmByToken, { token });
    if (!result) {
      // Also the answer for a valid token belonging to someone who has since
      // unsubscribed. Deliberately not distinguished: re-subscribing is a
      // fresh signup, not a link click.
      return new Response("This confirmation link is no longer valid.", { status: 400 });
    }

    return unsubscribePage(
      "You're on the list",
      result.alreadyReached
        ? `DOL's PERM analyst-review queue has already reached ${result.filingMonth}. Your alert is on its way now, and that's the only message you'll get. Current figures are always on permtracker.app/perm-processing-times.`
        : `We'll email you once, when the Department of Labor's PERM analyst-review queue reaches ${result.filingMonth}. That's the only message you'll get, and DOL's current figures are always on permtracker.app/perm-processing-times.`,
    );
  }),
});

// POST is what Gmail and Apple Mail hit for one-click List-Unsubscribe.
http.route({
  path: "/queue-alert/unsubscribe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return new Response("Invalid unsubscribe link.", { status: 400 });
    const ok = await ctx.runMutation(internal.queueAlerts.unsubscribeByToken, { token });
    if (!ok) return new Response("Invalid or expired unsubscribe link.", { status: 400 });
    return unsubscribePage("You're unsubscribed", "You won't receive a queue alert from us.");
  }),
});

// GET shows a confirmation button rather than acting, so an inbox prefetch
// (Apple Mail Privacy Protection and friends) cannot silently unsubscribe.
http.route({
  path: "/queue-alert/unsubscribe",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return new Response("Invalid unsubscribe link.", { status: 400 });
    return unsubscribePage(
      "Cancel your queue alert?",
      "You'll stop receiving the one-time alert about the PERM queue reaching your filing month.",
      { action: `/queue-alert/unsubscribe?token=${encodeURIComponent(token)}` },
    );
  }),
});

/**
 * The contact form. Same posture as the queue-alert routes: the internal
 * mutation owns the budgets, the route owns the shape - cheap guards first,
 * the length caps BEFORE the email regex, and the honeypot answers success
 * without writing anything.
 */
http.route({
  path: "/contact",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, req) => {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("Origin")) });
  }),
});

http.route({
  path: "/contact",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const cors = corsHeaders(req.headers.get("Origin"));
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, message: "Malformed request." }, 400);
    }
    if (typeof body !== "object" || body === null) {
      return json({ ok: false, message: "Malformed request." }, 400);
    }
    const { name, email, message, website } = body as Record<string, unknown>;

    // Honeypot: a filled "website" field is a bot. Pretend success, write
    // nothing, send nothing.
    if (typeof website === "string" && website.trim() !== "") {
      return json({ ok: true, message: "Sent. We read everything and reply by email." });
    }

    if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
      return json({ ok: false, message: "Name, email and message are all required." }, 400);
    }
    // Length caps BEFORE the regex: an unbounded string into a backtracking
    // pattern is a compute-exhaustion primitive.
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();
    if (cleanName.length === 0 || cleanName.length > 120) {
      return json({ ok: false, message: "Give us a name up to 120 characters." }, 400);
    }
    if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      return json({ ok: false, message: "That email address doesn't look right." }, 400);
    }
    if (cleanMessage.length < 10 || cleanMessage.length > 4000) {
      return json({ ok: false, message: "The message needs 10 to 4,000 characters." }, 400);
    }

    const forwarded = req.headers.get("x-forwarded-for") ?? "";
    const ip = forwarded.split(",")[0]?.trim() || "unknown";

    const result = await ctx.runMutation(internal.contactForm.submit, {
      name: cleanName,
      email: cleanEmail,
      message: cleanMessage,
      ip,
    });
    return json(result, result.ok ? 200 : result.throttled ? 429 : 400);
  }),
});

export default http;
