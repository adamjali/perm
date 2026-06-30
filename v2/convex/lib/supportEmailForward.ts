/**
 * Whether an inbound message addressed to `toEmail` should be forwarded to the
 * human catch-all inbox.
 *
 * Excludes:
 *  - machine-generated DMARC aggregate reports (the rua target, `dmarc@`) — they're
 *    XML noise, and each forward is also an outbound send against the Resend cap;
 *  - the forward target itself (loop guard).
 *
 * Pure + side-effect-free so the forwarding decision is unit-testable.
 *
 * @module
 */
export function shouldForwardInbound(toEmail: string, forwardTo: string): boolean {
  const to = toEmail.toLowerCase();
  if (to.startsWith("dmarc@")) return false; // DMARC machine report
  if (to === forwardTo.toLowerCase()) return false; // loop guard
  return true;
}
