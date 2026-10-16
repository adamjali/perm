/**
 * Run an idempotent write, and if it fails, wait and run it again, up to twice
 * more, before letting the error through.
 *
 * Onboarding's two writes (the role, the wizard step) failed in production
 * as a masked "Server Error" (Sentry 46, 4B, and 57 on Oct 15 2026, a minute
 * after sign-up) with the profile in place. The likeliest cause is an auth
 * token that had not refreshed yet: a mutation then runs unauthenticated and
 * throws. Convex refreshes the token on its own, usually within a second or
 * so; issue 57 failed a retry 1.2 seconds later and the person's own click a
 * little after that went through, so a second wait of 3 seconds covers the
 * slow refreshes too. Both writes only SET values, so running one again
 * changes nothing.
 */
export const RETRY_DELAYS_MS: readonly number[] = [1200, 3000];

export async function retryBriefly<T>(write: () => Promise<T>, delaysMs: readonly number[] = RETRY_DELAYS_MS): Promise<T> {
  for (const delay of delaysMs) {
    try {
      return await write();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return write();
}
