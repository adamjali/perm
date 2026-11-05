/**
 * A read a page can live without: its failure returns the page's fallback, as `.catch(() => null)` did, and is
 * recorded, which `.catch(() => null)` never was (audit, Nov 4 2026: 287 such reads on the server, a failure in any
 * of them silent, and the degraded page then cached for its whole window). The line goes to the server's journal
 * and, through Sentry's console capture, to Sentry's logs. One line per read per ten minutes per process, so a read
 * failing on every render can't flood either.
 *
 *   getPermLine().catch(softFail("getPermLine", null))
 */
const QUIET_MS = 10 * 60_000;
const lastLogged = new Map<string, number>();

export function softFail<T>(label: string, fallback: T): (error: unknown) => T {
  return (error: unknown) => {
    try {
      const now = Date.now();
      if (now - (lastLogged.get(label) ?? 0) >= QUIET_MS) {
        if (lastLogged.size > 500) lastLogged.clear();
        lastLogged.set(label, now);
        const why = error instanceof Error ? error.message : String(error);
        console.warn(`[soft-read] ${label} failed, so the page shows its fallback: ${why.slice(0, 300)}`);
      }
    } catch {
      // Recording must never become a second failure.
    }
    return fallback;
  };
}
