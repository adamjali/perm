/**
 * A page served from this machine during development or a local production
 * run: localhost, 127.0.0.1, [::1] or a *.localhost name. Analytics doesn't
 * start on one (src/instrumentation-client.ts), because local test runs sent
 * about 180 pageviews and 5 errors a week into the live project's counts
 * (measured Oct 24 2026). NEXT_PUBLIC_POSTHOG_LOCAL=1 turns it back on for
 * testing analytics itself.
 */
export function isLocalDevHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1" || h.endsWith(".localhost");
}
