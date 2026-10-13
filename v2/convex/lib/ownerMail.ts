/**
 * Mail to the site's owner: alerts, admin notices, the morning report.
 *
 * It goes through the mail Worker on Cloudflare (workers/mail/), whose binding
 * can send only to the owner's verified inboxes (convex/lib/ownerWorker.ts). That's free and outside
 * Resend's 100 a day, which every alert used to spend (Oct 12 2026). Resend
 * stays the fallback: when the Worker isn't configured (OWNER_MAIL_URL and
 * OWNER_MAIL_KEY unset), the message is for someone else, or the Worker
 * doesn't answer, the message goes through sendOrQueue as before, so an alert
 * is never lost to a Worker outage.
 */
import type { Resend } from "resend";
import { FROM_EMAIL, sendOrQueue, type SendCtx, type SendOutcome } from "./email";

export { textFromHtml, workerCanSend } from "./ownerWorker";

export interface OwnerMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Where a reply goes: the contact form sets the person who wrote. */
  replyTo?: string;
  /**
   * The Resend fallback's ceiling: "high" (the whole day) for the site's own
   * notices, "public" for mail a stranger sets off, like the contact form, so
   * it never uses the room kept for alerts (convex/lib/emailLimits.ts).
   */
  priority?: "high" | "public";
}

/**
 * Send a message to the owner. `sendOrQueue` tries the free Worker first for
 * any of the owner's inboxes (convex/lib/ownerWorker.ts) and returns
 * `{ data: { id: "worker" } }` when it carried the message; Resend otherwise.
 */
export async function sendOwnerMail(ctx: SendCtx, kind: string, resend: Resend, msg: OwnerMessage): Promise<SendOutcome> {
  return await sendOrQueue(
    ctx,
    kind,
    resend,
    {
      from: FROM_EMAIL,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      ...(msg.text ? { text: msg.text } : {}),
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    },
    { priority: msg.priority ?? "high" },
  );
}
