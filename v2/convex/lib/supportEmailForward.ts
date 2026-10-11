/**
 * Whether an inbound message addressed to `toEmail` should be forwarded to the
 * human catch-all inbox.
 *
 * Excludes:
 *  - machine-generated DMARC aggregate reports (the rua target, `dmarc@`) — they're
 *    XML noise, and each forward is also an outbound send against the Resend cap;
 *  - the forward target itself (loop guard);
 *  - this site's own outbound mail landing in one of its own inboxes. The
 *    demo account (demo@) gets the real deadline reminders, and each was
 *    forwarded to the owner's inbox daily, two sends of the day's 100 for
 *    mail nobody needed (Oct 9 to 11 2026). It is still stored.
 *
 * Pure + side-effect-free so the forwarding decision is unit-testable.
 *
 * @module
 */
/** The addresses this site sends from. */
const OWN_SENDERS = ["notifications@permtracker.app"];
/**
 * Where the site sends to itself on purpose: the contact form posts each
 * message to support@ (convex/contactForm.ts), which is how it reaches the
 * owner and is stored for a threaded reply. That one still forwards.
 */
const SELF_ADDRESSED_ON_PURPOSE = ["support@permtracker.app"];

/** The bare address out of "Name <addr>" or "addr". */
const bare = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();

export function shouldForwardInbound(toEmail: string, forwardTo: string, fromEmail = ""): boolean {
  const to = toEmail.toLowerCase();
  if (to.startsWith("dmarc@")) return false; // DMARC machine report
  if (to === forwardTo.toLowerCase()) return false; // loop guard
  if (OWN_SENDERS.includes(bare(fromEmail)) && !SELF_ADDRESSED_ON_PURPOSE.includes(to)) return false; // our own mail to an account inbox
  return true;
}
