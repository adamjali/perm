/**
 * One short line naming what failed: the message as the browser saw it, and
 * Next's digest for a server error (a server error's message is masked in
 * production, so the digest is what finds it in the logs). Shown on the
 * last-resort error page so a screenshot of it says what to fix.
 */
export function failedLine(error: Error & { digest?: string }): string {
  const message = (error.message || error.name || "unknown error").replace(/\s+/g, " ").trim();
  const short = message.length > 160 ? `${message.slice(0, 157)}...` : message;
  return error.digest ? `${short} (ref ${error.digest})` : short;
}
