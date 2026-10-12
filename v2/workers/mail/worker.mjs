/**
 * PERM Tracker's mail Worker, on Cloudflare Email Routing.
 *
 * Two jobs, both outside Resend's 100-a-day allowance (Oct 12 2026: received
 * mail and its forwards counted against it, and so did every alert to the owner):
 *
 * 1. `email`: the catch-all rule hands it every message to an @permtracker.app
 *    address. It forwards the message to the owner's inbox (free, the original
 *    sender kept) unless rules.mjs says not to, then posts it to Convex
 *    (/inbound-email) to be stored for a threaded reply, as Resend-received
 *    mail was. A message too big to parse within the free plan's CPU is
 *    stored with its headers only.
 * 2. `fetch` POST /owner: alerts, the morning report and admin notices, to the
 *    owner's own verified address. The OWNER binding can send only to that
 *    address, so the key, if it leaked, could mail no one else.
 *
 * Bindings (set at upload, scripts/mail-worker-deploy.md): OWNER (send_email,
 * destination_address = the owner), OWNER_EMAIL, FROM_EMAIL, CONVEX_SITE, and
 * the secrets OWNER_MAIL_KEY and INBOUND_KEY.
 */
import PostalMime from "postal-mime";
import { keyMatches, ownerMessage, PARSE_MAX_BYTES, shouldForward } from "./rules.mjs";

const json = (body, status) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const worker = {
  async email(message, env, ctx) {
    const to = (message.to || "").toLowerCase();
    const envelopeFrom = message.from || "";

    // Forward first: getting the message to a person matters most.
    let forwarded = false;
    if (shouldForward(to, env.OWNER_EMAIL, envelopeFrom)) {
      try {
        await message.forward(env.OWNER_EMAIL);
        forwarded = true;
      } catch (e) {
        console.error("forward failed", e && e.message);
      }
    }

    let parsed = null;
    if (message.rawSize <= PARSE_MAX_BYTES) {
      try {
        parsed = await PostalMime.parse(message.raw);
      } catch (e) {
        console.error("parse failed", e && e.message);
      }
    }
    const h = (name) => message.headers.get(name) || undefined;
    const record = {
      to,
      from: parsed?.from?.address || envelopeFrom,
      fromName: parsed?.from?.name || undefined,
      subject: parsed?.subject ?? h("subject") ?? "(No subject)",
      messageId: parsed?.messageId ?? h("message-id"),
      inReplyTo: parsed?.inReplyTo ?? h("in-reply-to"),
      references: parsed?.references ?? h("references"),
      text: parsed?.text,
      html: parsed?.html,
      forwarded,
    };

    // The forward doesn't wait on the store: a failed store is logged, and the
    // sender isn't asked to send again (that would forward it twice).
    ctx.waitUntil(
      fetch(`${env.CONVEX_SITE}/inbound-email`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-inbound-key": env.INBOUND_KEY },
        body: JSON.stringify(record),
      })
        .then((r) => {
          if (!r.ok) console.error("store failed", r.status);
        })
        .catch((e) => console.error("store failed", e && e.message)),
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/owner") return json({ ok: false, message: "Not found." }, 404);
    if (!(await keyMatches(request.headers.get("x-owner-mail-key"), env.OWNER_MAIL_KEY))) {
      return json({ ok: false, message: "Not allowed." }, 401);
    }
    if (Number(request.headers.get("content-length") || 0) > 1_000_000) return json({ ok: false, message: "Too large." }, 413);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, message: "Bad JSON." }, 400);
    }
    const msg = ownerMessage(body);
    if (msg.error) return json({ ok: false, message: msg.error }, 400);
    try {
      const sent = await env.OWNER.send({
        to: env.OWNER_EMAIL,
        from: { email: env.FROM_EMAIL, name: "PERM Tracker" },
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      });
      return json({ ok: true, id: sent?.messageId }, 200);
    } catch (e) {
      return json({ ok: false, message: (e && e.message) || "Send failed.", code: e && e.code }, 502);
    }
  },
};

export default worker;
