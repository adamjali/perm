/**
 * The visitor's country, from Cloudflare's edge.
 *
 * Cookie-free mode has PostHog drop the IP address BEFORE its GeoIP step, so
 * without this every anonymous event arrives with no country (signed-in events
 * keep theirs).
 * Cloudflare already knows the country of every request and prints it at
 * /cdn-cgi/trace as `loc=XX`. Same origin, no cookie, nothing stored, and only
 * the two-letter code is kept: never a city, never the IP.
 *
 * @module lib/edgeCountry
 */

/** How long PostHog waits for the country before starting without one. */
export const COUNTRY_WAIT_MS = 800;

/**
 * The two-letter country in a /cdn-cgi/trace body, or null. XX means unknown
 * and T1 means Tor, so neither is a country.
 */
export function parseTraceCountry(body: string): string | null {
  const code = /^loc=([A-Z]{2})$/m.exec(body)?.[1];
  return code && code !== "XX" && code !== "T1" ? code : null;
}

/**
 * Ask the edge for the country. Anything going wrong (local dev has no edge,
 * an ad blocker, a slow network) means no country, never a wait past
 * `waitMs`.
 */
export async function edgeCountry(
  waitMs: number = COUNTRY_WAIT_MS,
  secure: boolean = typeof window !== "undefined" && window.location.protocol === "https:",
): Promise<string | null> {
  if (!secure) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), waitMs);
  try {
    const res = await fetch("/cdn-cgi/trace", {
      signal: ctrl.signal,
      credentials: "omit",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseTraceCountry(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
