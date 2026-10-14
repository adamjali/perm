/**
 * The address of one of the Convex deployment's HTTP routes.
 *
 * Convex serves HTTP actions from the `.convex.site` twin of the `.convex.cloud`
 * URL the client already carries, so no second variable names it. Posting to a
 * route keeps public pages free of the Convex React client: the public layout
 * mounts no ConvexProvider, so those pages never open a websocket.
 *
 * Null when no deployment URL was built in (a test, a build without Convex);
 * a form that needs one renders nothing then.
 */
export function convexSiteUrl(path: `/${string}`): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}${path}`;
}
