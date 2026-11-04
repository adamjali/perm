/**
 * Shared secrets compared in constant time, for the route handlers that a server job calls with one
 * (the revalidate-* routes with REVALIDATE_SECRET, /api/sentry-check with SENTRY_CHECK_SECRET, the /api/cron routes
 * with `Authorization: Bearer <CRON_SECRET>`).
 *
 * `===` stops at the first character that differs, so the time a refusal takes says how much of a guess was right.
 * Both sides are digested with SHA-256 first and the digests compared byte by byte without stopping, so neither the
 * secret's length nor a matching prefix shows in the timing. Same approach as `sharedSecretOk` in
 * convex/watchedCases.ts. Web Crypto, so it runs in Node and in an edge runtime alike.
 *
 * An unset or empty secret refuses everything, an empty guess included: a missing variable means the route is shut,
 * never open.
 */

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

/** True only when `expected` is set and `given` equals it exactly. */
export async function secretMatches(
  given: string | null | undefined,
  expected: string | null | undefined,
): Promise<boolean> {
  if (!expected || !given) return false;
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** True only when `secret` is set and the Authorization header is exactly `Bearer <secret>`. */
export async function bearerMatches(header: string | null | undefined, secret: string | null | undefined): Promise<boolean> {
  if (!secret) return false;
  return secretMatches(header, `Bearer ${secret}`);
}
