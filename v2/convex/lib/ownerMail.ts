/**
 * Mail to the site's owner: alerts, admin notices, the morning report.
 *
 * It goes through the mail Worker on Cloudflare (workers/mail/), whose binding
 * can send only to the owner's verified address. That's free and outside
 * Resend's 100 a day, which every alert used to spend (Oct 12 2026). Resend
 * stays the fallback: when the Worker isn't configured (OWNER_MAIL_URL and
 * OWNER_MAIL_KEY unset), the message is for someone else, or the Worker
 * doesn't answer, the message goes through sendOrQueue as before, so an alert
 * is never lost to a Worker outage.
 */
import type { Resend } from "resend";
import { createLogger } from "./logging";
import { FROM_EMAIL, sendOrQueue, type SendCtx, type SendOutcome } from "./email";

const log = createLogger("ownerMail");

/** How long the Worker gets before Resend takes the message. */
const WORKER_TIMEOUT_MS = 10_000;

export interface OwnerMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** A readable plain-text copy of an HTML body, for mail clients that show text. */
export function textFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether the Worker can carry this message: configured, and for the owner. */
export function workerCanSend(to: string): boolean {
  const owner = process.env.SECURITY_ALERT_EMAIL;
  return Boolean(
    process.env.OWNER_MAIL_URL &&
      process.env.OWNER_MAIL_KEY &&
      owner &&
      to.trim().toLowerCase() === owner.trim().toLowerCase(),
  );
}

/** Post to the Worker. True when it says it sent the message. */
async function viaWorker(msg: OwnerMessage): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    const res = await fetch(process.env.OWNER_MAIL_URL!, {
      method: "POST",
      headers: { "content-type": "application/json", "x-owner-mail-key": process.env.OWNER_MAIL_KEY! },
      body: JSON.stringify({ subject: msg.subject, html: msg.html, text: msg.text || textFromHtml(msg.html) || msg.subject }),
      signal: controller.signal,
    });
    if (res.ok) return true;
    log.warn("owner mail Worker refused; falling back to Resend", { status: res.status });
    return false;
  } catch (e) {
    log.warn("owner mail Worker unreachable; falling back to Resend", { error: e instanceof Error ? e.message : String(e) });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a message to the owner. Returns the Resend outcome when Resend carried
 * it, or `{ data: { id: "worker" } }` when the Worker did.
 */
export async function sendOwnerMail(ctx: SendCtx, kind: string, resend: Resend, msg: OwnerMessage): Promise<SendOutcome> {
  if (workerCanSend(msg.to) && (await viaWorker(msg))) {
    return { data: { id: "worker" } };
  }
  return await sendOrQueue(
    ctx,
    kind,
    resend,
    { from: FROM_EMAIL, to: [msg.to], subject: msg.subject, html: msg.html, ...(msg.text ? { text: msg.text } : {}) },
    { priority: "high" },
  );
}
