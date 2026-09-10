/**
 * Every link this codebase puts in an email.
 *
 * ## Why these are on permtracker.app and not on the Convex domain
 *
 * They used to be built on `CONVEX_SITE_URL`, so a subscriber asking to change
 * their email preferences received a plain-text message whose only link was
 * `https://giant-dragon-464.convex.site/prefs?token=<long opaque string>`.
 *
 * That is not a leak - a deployment name is an endpoint, not a credential -
 * and the route genuinely lives there. It is a TRUST problem, and a bad one.
 * Line the pieces up as a recipient sees them: unstyled text, an unfamiliar
 * domain with a random-looking name, a long opaque token, and an instruction
 * to click in order to change your email settings. That is the anatomy of a
 * phishing email, and it was the shape of the one message whose entire job is
 * to be trusted enough to click. A reader who refused was behaving correctly.
 *
 * So emailed links are built on the public site, and `next.config.ts` rewrites
 * those paths to the Convex HTTP routes that still serve them.
 *
 * ## The Convex origin still answers, forever
 *
 * Every link already sitting in somebody's inbox points at `*.convex.site`,
 * and those tokens never expire. The Convex routes are unchanged and unmoved;
 * this only changes the domain NEW mail is addressed to. Removing a route
 * because its links look nicer elsewhere would break mail this project already
 * sent, which it does not control and cannot recall.
 *
 * ## Why one module
 *
 * `SITE_URL` was hardcoded in four modules and `actionUrl` was copy-pasted
 * into three, which is how five sending paths end up disagreeing about their
 * own domain one edit at a time.
 *
 * @module convex/lib/links
 */

/** The public site. One definition; it was four. */
export const SITE_URL = "https://permtracker.app";

/**
 * A token-bearing link for an email, on the public site.
 *
 * `path` is the Convex HTTP route's own path (`/prefs`,
 * `/queue-alert/confirm`), because the rewrite preserves it exactly. Keeping
 * them identical means a stale link and a fresh one differ only in host, so
 * either can be pasted into the other's domain and still work.
 */
export function actionUrl(path: string, token: string): string {
  return `${SITE_URL}${path}?token=${encodeURIComponent(token)}`;
}

/**
 * The Convex origin, for anything that is NOT an emailed link.
 *
 * Kept available because the rewrite is a convenience for humans reading mail,
 * not a dependency: if it is ever removed, this is what the routes are still
 * reachable on.
 */
export function convexOrigin(): string {
  const base = process.env.CONVEX_SITE_URL;
  if (!base) throw new Error("CONVEX_SITE_URL is not configured");
  return base;
}
