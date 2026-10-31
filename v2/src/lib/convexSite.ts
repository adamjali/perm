/**
 * Where a public form posts to reach one of the Convex deployment's HTTP routes: the site's own `/c/<route>`.
 *
 * Posting to a route keeps public pages free of the Convex React client: the public layout mounts no
 * ConvexProvider, so those pages never open a websocket. The forms posted straight to the deployment's
 * `.convex.site` host until Oct 31 2026, which some work networks block, and six people's sign-ups failed there.
 * nginx relays `/c/` to the backend with the visitor's address (scripts/oracle/nginx/permtracker.conf, "FORMS"),
 * and next.config.ts rewrites it for the dev server.
 *
 * Null when no deployment URL was built in (a test, a build without Convex); a form that needs one renders
 * nothing then.
 */
export function convexSiteUrl(path: `/${string}`): string | null {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return null;
  return `${FORM_RELAY}${path}`;
}

/** The site's own path in front of every form's Convex route. */
export const FORM_RELAY = "/c";
