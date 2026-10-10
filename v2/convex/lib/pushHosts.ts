/**
 * The browsers' own push services, the only hosts a subscription may name:
 * Chrome, Edge-on-Chromium, Brave and Opera (FCM), Firefox (Mozilla), Edge's
 * Windows push (WNS) and Safari (Apple). Anything else would have Convex POST
 * to whatever https host a caller registered whenever a watched case moved.
 * Measured on production Oct 10 2026: every one of the 25 open subscriptions
 * names one of these.
 */
const PUSH_HOSTS = new Set(["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
const PUSH_HOST_SUFFIXES = [".notify.windows.com", ".push.services.mozilla.com", ".push.apple.com"];

export function isPushServiceUrl(endpoint: string): boolean {
  let host: string;
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:" || u.port !== "") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return PUSH_HOSTS.has(host) || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s));
}
