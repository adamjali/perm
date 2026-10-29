/**
 * The free path for mail to the site's owner: the mail Worker on Cloudflare
 * (workers/mail/), whose binding can send only to the owner's own verified
 * inboxes. Every email addressed to one of them goes this way first, whatever
 * sent it (alerts, admin notices, the morning report, the contact form, and
 * the site's ordinary mail to the owner's own accounts), so none of it spends
 * Resend's daily allowance. `sendOrQueue` (./email.ts) does the routing and
 * falls back to Resend when the Worker isn't set up or doesn't answer.
 *
 * Plain module, no Convex functions: email.ts and ownerMail.ts both import it.
 */
import { createLogger } from "./logging";

const log = createLogger("ownerMail");

/**
 * How long the Worker gets before Resend takes the message. Cloudflare's send
 * can deliver and still answer late: on Oct 28 2026 at 6:40 PM EDT a notice
 * reached the inbox through the Worker, the answer missed a 10-second wait, and
 * Resend sent it again 10 seconds later (the owner got two, and Resend's
 * allowance paid for one). Mail to the owner can wait half a minute.
 */
export const WORKER_TIMEOUT_MS = 30_000;

export interface WorkerMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

/** Apply a replacement until the text stops changing, so a tag split by another ("<scr<b>ipt>") can't survive one pass. */
function untilStable(text: string, re: RegExp, by: string): string {
  let prev: string;
  let out = text;
  do {
    prev = out;
    out = out.replace(re, by);
  } while (out !== prev);
  return out;
}

const ENTITIES: Record<string, string> = { nbsp: " ", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'", amp: "&" };

/**
 * A readable plain-text copy of an HTML body, for mail clients that show text.
 * Its output is only ever a text/plain part, never HTML. Entities are decoded in
 * one pass, so "&amp;lt;" reads "&lt;" as it should (decoding &amp; first made it "<").
 */
export function textFromHtml(html: string): string {
  let out = untilStable(html, /<(style|script)\b[\s\S]*?<\/\1\s*>/gi, "");
  out = out.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|h[1-6]|li)\s*>/gi, "\n");
  out = untilStable(out, /<[^<>]*>/g, "");
  return out
    .replace(/[<>]/g, "")
    .replace(/&(nbsp|lt|gt|quot|#39|#x27|amp);/g, (_, name: string) => ENTITIES[name] ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const norm = (a: string) => a.trim().toLowerCase();

/**
 * The owner's inboxes the Worker can reach: SECURITY_ALERT_EMAIL (the main
 * one) and OWNER_INBOXES (comma-separated). Add an address to OWNER_INBOXES
 * only once it's verified in Cloudflare Email Routing and allowed by the
 * Worker's OWNER binding and OWNER_ADDRESSES, or the Worker refuses it and
 * Resend carries the message after all.
 */
export function ownerInboxes(): string[] {
  const list = [process.env.SECURITY_ALERT_EMAIL ?? "", ...(process.env.OWNER_INBOXES ?? "").split(",")];
  return [...new Set(list.map(norm).filter(Boolean))];
}

/** Whether the Worker can carry mail to this address: it's set up, and the address is the owner's. */
export function workerCanSend(to: string): boolean {
  return Boolean(process.env.OWNER_MAIL_URL && process.env.OWNER_MAIL_KEY && ownerInboxes().includes(norm(to)));
}

/** Post to the Worker. True when it says it sent the message. */
export async function viaWorker(msg: WorkerMessage): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    const text = msg.text || (msg.html ? textFromHtml(msg.html) : "") || msg.subject;
    const res = await fetch(process.env.OWNER_MAIL_URL!, {
      method: "POST",
      headers: { "content-type": "application/json", "x-owner-mail-key": process.env.OWNER_MAIL_KEY! },
      body: JSON.stringify({
        to: norm(msg.to),
        subject: msg.subject,
        text,
        ...(msg.html ? { html: msg.html } : {}),
        ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      }),
      signal: controller.signal,
    });
    if (res.ok) return true;
    // 403 means the Worker doesn't list this inbox: the owner's address on Convex
    // and the Worker's OWNER_EMAIL / OWNER_ADDRESSES disagree (workers/mail/README.md,
    // "Changing the owner's address"). Resend still carries it, at a cost.
    log.warn(
      res.status === 403
        ? "owner mail Worker doesn't list this inbox (Convex and the Worker disagree on the owner's address); falling back to Resend"
        : "owner mail Worker refused; falling back to Resend",
      { status: res.status },
    );
    return false;
  } catch (e) {
    if (controller.signal.aborted) {
      // The Worker may have sent it already: Cloudflare can deliver and answer late.
      log.warn("owner mail Worker didn't answer in time; falling back to Resend, which can mean the owner gets it twice", {
        waitedMs: WORKER_TIMEOUT_MS,
      });
      return false;
    }
    log.warn("owner mail Worker unreachable; falling back to Resend", { error: e instanceof Error ? e.message : String(e) });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
