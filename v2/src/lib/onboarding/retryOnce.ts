/**
 * Run an idempotent write, and if it fails, wait a moment and run it once
 * more before letting the error through.
 *
 * Onboarding's two writes (the role, the wizard step) failed in production
 * as a masked "Server Error" (Sentry 46, 4B) with the profile in place. The
 * likeliest cause is an auth token that had not refreshed yet: a mutation
 * then runs unauthenticated and throws. Convex refreshes the token on its
 * own within a second or so, so one delayed retry turns that into a success.
 * Both writes only SET values, so running one twice changes nothing.
 */
export async function retryOnce<T>(write: () => Promise<T>, delayMs = 1200): Promise<T> {
  try {
    return await write();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return write();
  }
}
