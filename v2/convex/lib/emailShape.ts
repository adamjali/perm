/**
 * Conservative address check, shared by every subscribe and link form.
 * Rejects the obvious, defers the rest to Resend.
 *
 * The length cap runs FIRST and the ordering is load-bearing. `[^\s@]` matches
 * `.`, so `[^\s@]+\.[^\s@]{2,}$` backtracks quadratically on a long failing
 * input: measured in V8, `"a@" + ".".repeat(80000) + "@"` took 8.2 seconds,
 * and 0.005 ms with the length check first. `v.string()` accepts about a
 * megabyte, so testing before the length check hands any anonymous caller
 * seconds of server compute per request. One copy, so the rule can't drift:
 * it had been written out in six files.
 */
export function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
