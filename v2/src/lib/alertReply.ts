/**
 * The heading a subscribe form shows once the server has answered.
 *
 * Since Sep 29 2026 a full confirmation pool queues the request instead of
 * refusing it (convex/confirmationQueue.ts) and says so with `queued: true`.
 * A form that always headed its reply "Check your inbox" would tell someone
 * the email was there while it waited. The flag depends on how busy the site
 * is, never on the address, so it reveals nothing about what one holds.
 */
export function replyHeading(queued: boolean): string {
  return queued ? "Your email is in a short queue" : "Check your inbox";
}

/** Reads the flag off a subscribe reply, whatever else it carries. */
export function isQueued(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as { queued?: unknown }).queued === true;
}
