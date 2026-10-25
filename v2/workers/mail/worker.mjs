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
 *    mail was (mime.mjs reads its text). A message too big to read within the
 *    free plan's CPU is stored with its headers only.
 *    Since Oct 25 2026 a message up to CHECK_MAX_BYTES is read first and
 *    checked for spam (Cloudflare's AI model, then Convex's verdict at
 *    /inbound-email/verdict, convex/inboundFilter.ts). A held message is
 *    stored and listed on the admin page, never forwarded or bounced. Any
 *    fault or delay in the check forwards the message as before.
 * 2. `fetch` POST /owner: alerts, the morning report, admin notices, the
 *    contact form and the site's own mail to the owner's accounts, to the
 *    owner's own verified inboxes. The OWNER binding can send only to those,
 *    so the key, if it leaked, could mail no one else.
 *
 * Bindings: OWNER (send_email, restricted to the owner's verified inboxes),
 * OWNER_EMAIL (the main inbox), OWNER_ADDRESSES (optional, the others allowed),
 * FROM_EMAIL, CONVEX_SITE, KEYS (a KV namespace holding the two keys), AI
 * (Workers AI, for the spam check's second opinion; optional) and AI_MODEL
 * (optional, the model it runs; rules.mjs names the default).
 *
 * `fetch` POST /classify (the owner key): the AI's opinion of one message, for
 * the contact form, which Convex checks itself.
 *
 * The keys live in KV, not in Worker secrets, so they never pass through the
 * Cloudflare API in plain text from anyone's terminal: POST /provision sets
 * both, once, from a machine that reads them from its own files, and answers
 * with their SHA-256 tags so the caller can confirm. The route answers 404
 * unless the upload set PROVISION_UNTIL (a rotation window of at most an
 * hour, rules.mjs), and refuses once keys are set (README, "Keys").
 */
import { AI_SYSTEM_PROMPT, aiUserPrompt, readAiAnswer } from "../../convex/lib/spamCheck.ts";
import { readMessage } from "./mime.mjs";
import {
  AI_MODEL,
  CHECK_MAX_BYTES,
  CHECK_TIMEOUT_MS,
  checkText,
  holdsIt,
  KEY_PATTERN,
  keyMatches,
  keyTag,
  ownerMessage,
  ownerRecipient,
  PARSE_MAX_BYTES,
  provisionOpen,
  shouldForward,
} from "./rules.mjs";

/** The two keys, from KV (see above). */
async function keys(env) {
  const [owner, inbound] = await Promise.all([env.KEYS.get("owner_mail_key"), env.KEYS.get("inbound_key")]);
  return { owner, inbound };
}

const json = (body, status) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** A promise, or undefined once `ms` pass; a rejection is logged and read as undefined. */
const within = (promise, ms, onError) =>
  Promise.race([
    promise.catch((e) => {
      console.error("check step failed", e && e.message);
      onError?.(e);
      return undefined;
    }),
    new Promise((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);

/**
 * The AI model's opinion of a message: "spam", "not_spam" or "unsure";
 * undefined without the binding, on a failure or past the time limit.
 * `onError` hears why it failed, for /classify's answer.
 */
async function aiOpinion(env, mail, onError) {
  if (!env.AI) {
    onError?.(new Error("no AI binding"));
    return undefined;
  }
  const out = await within(
    env.AI.run(env.AI_MODEL || AI_MODEL, {
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        { role: "user", content: aiUserPrompt(mail) },
      ],
      max_tokens: 24,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          type: "object",
          properties: { verdict: { type: "string", enum: ["spam", "not_spam", "unsure"] } },
          required: ["verdict"],
        },
      },
    }),
    CHECK_TIMEOUT_MS,
    onError,
  );
  return out === undefined ? undefined : readAiAnswer(out?.response ?? out);
}

/** Convex's verdict on a message, or undefined when it doesn't answer in time. */
async function verdictFor(env, inboundKey, mail) {
  const res = await within(
    fetch(`${env.CONVEX_SITE}/inbound-email/verdict`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-inbound-key": inboundKey || "" },
      body: JSON.stringify(mail),
    }),
    CHECK_TIMEOUT_MS,
  );
  if (!res || !res.ok) return undefined;
  return within(res.json(), 1_000);
}

const worker = {
  async email(message, env, ctx) {
    const to = (message.to || "").toLowerCase();
    const envelopeFrom = message.from || "";
    const forwardable = shouldForward(to, env.OWNER_EMAIL, envelopeFrom);
    const { inbound } = await keys(env);
    const h = (name) => message.headers.get(name) || undefined;

    // Read it first when it's small enough to read and check before the forward.
    let parsed = null;
    const readNow = forwardable ? message.rawSize <= CHECK_MAX_BYTES : message.rawSize <= PARSE_MAX_BYTES;
    if (readNow) {
      try {
        parsed = readMessage(new Uint8Array(await new Response(message.raw).arrayBuffer()));
      } catch (e) {
        console.error("read failed", e && e.message);
      }
    }
    const from = parsed?.from?.address || envelopeFrom;
    const subject = parsed?.subject ?? h("subject") ?? "(No subject)";

    // The check. Only a clear "hold" keeps it out of the inbox; anything else forwards.
    let verdict;
    if (forwardable && parsed) {
      try {
        const mail = {
          from,
          fromName: parsed.from?.name || undefined,
          subject,
          text: checkText(parsed),
          listUnsubscribe: h("list-unsubscribe"),
          replyTo: h("reply-to"),
          spamFlag: h("x-spam-flag"),
          thread: [parsed.inReplyTo, parsed.references].filter(Boolean).join(" ") || undefined,
        };
        mail.ai = await aiOpinion(env, mail);
        verdict = await verdictFor(env, inbound, mail);
      } catch (e) {
        console.error("check failed", e && e.message);
      }
    }
    const held = holdsIt(verdict);

    // Forward unless held: getting a person's message to the owner matters most.
    let forwarded = false;
    if (forwardable && !held) {
      try {
        await message.forward(env.OWNER_EMAIL);
        forwarded = true;
      } catch (e) {
        console.error("forward failed", e && e.message);
      }
    }

    // A big message is read after the forward, for the stored copy, as before.
    if (!parsed && !readNow && message.rawSize <= PARSE_MAX_BYTES) {
      try {
        parsed = readMessage(new Uint8Array(await new Response(message.raw).arrayBuffer()));
      } catch (e) {
        console.error("read failed", e && e.message);
      }
    }
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
      held,
      notice: verdict?.action === "notice",
      spamScore: typeof verdict?.score === "number" ? verdict.score : undefined,
      spamReasons: Array.isArray(verdict?.reasons) ? verdict.reasons : undefined,
    };

    // The forward doesn't wait on the store: a failed store is logged, and the
    // sender isn't asked to send again (that would forward it twice). A held
    // message lives only in the store, so a failed store of one is logged loudly.
    ctx.waitUntil(
      fetch(`${env.CONVEX_SITE}/inbound-email`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-inbound-key": inbound || "" },
        body: JSON.stringify(record),
      })
        .then((r) => {
          if (!r.ok) console.error(held ? "STORE OF HELD MAIL FAILED" : "store failed", r.status);
        })
        .catch((e) => console.error(held ? "STORE OF HELD MAIL FAILED" : "store failed", e && e.message)),
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/provision" && provisionOpen(env.PROVISION_UNTIL)) {
      const current = await keys(env);
      if (current.owner || current.inbound) return json({ ok: false, message: "Keys are already set." }, 409);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, message: "Bad JSON." }, 400);
      }
      if (!KEY_PATTERN.test(body?.owner ?? "") || !KEY_PATTERN.test(body?.inbound ?? "")) {
        return json({ ok: false, message: "Two 64-hex keys: { owner, inbound }." }, 400);
      }
      await env.KEYS.put("owner_mail_key", body.owner);
      await env.KEYS.put("inbound_key", body.inbound);
      return json({ ok: true, owner: await keyTag(body.owner), inbound: await keyTag(body.inbound) }, 200);
    }
    if (request.method === "POST" && url.pathname === "/classify") {
      if (!(await keyMatches(request.headers.get("x-owner-mail-key"), (await keys(env)).owner))) {
        return json({ ok: false, message: "Not allowed." }, 401);
      }
      if (Number(request.headers.get("content-length") || 0) > 100_000) return json({ ok: false, message: "Too large." }, 413);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, message: "Bad JSON." }, 400);
      }
      if (typeof body?.subject !== "string" || typeof body?.from !== "string") {
        return json({ ok: false, message: "Send JSON: { from, subject, text? }." }, 400);
      }
      let failure;
      const verdict = await aiOpinion(
        env,
        {
          from: body.from.slice(0, 254),
          subject: body.subject.slice(0, 300),
          text: typeof body.text === "string" ? body.text.slice(0, 4_000) : "",
        },
        (e) => {
          failure = String((e && e.message) || e).slice(0, 300);
        },
      );
      return json({ ok: true, verdict: verdict ?? null, ...(failure ? { error: failure } : {}) }, 200);
    }
    if (request.method !== "POST" || url.pathname !== "/owner") return json({ ok: false, message: "Not found." }, 404);
    if (!(await keyMatches(request.headers.get("x-owner-mail-key"), (await keys(env)).owner))) {
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
    const to = ownerRecipient(msg.to, env.OWNER_EMAIL, env.OWNER_ADDRESSES);
    if (!to) return json({ ok: false, message: "Not one of the owner's inboxes." }, 403);
    try {
      const sent = await env.OWNER.send({
        to,
        from: { email: env.FROM_EMAIL, name: "PERM Tracker" },
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
        ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      });
      return json({ ok: true, id: sent?.messageId }, 200);
    } catch (e) {
      return json({ ok: false, message: (e && e.message) || "Send failed.", code: e && e.code }, 502);
    }
  },
};

export default worker;
