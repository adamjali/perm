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

/** How long the Worker gets before Resend takes the message. */
const WORKER_TIMEOUT_MS = 10_000;

export interface WorkerMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
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
    log.warn("owner mail Worker refused; falling back to Resend", { status: res.status });
    return false;
  } catch (e) {
    log.warn("owner mail Worker unreachable; falling back to Resend", { error: e instanceof Error ? e.message : String(e) });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
