/**
 * What every error screen does with the error it caught: record it, and get
 * the visitor out of it.
 *
 * Oct 2 2026: a visitor clicked into /perm-cases, the page crashed in the
 * browser, and the error screen's "Try again" re-rendered the same broken
 * state seven times. Nothing was recorded anywhere: React handles an error a
 * boundary catches, so PostHog's automatic capture never saw it, and Sentry is
 * not loaded on public pages. A fresh page load would have fixed it.
 */

import { analytics } from "@/lib/analytics";

/**
 * Errors a fresh page load cures: code from a previous deploy meeting the new
 * one (a chunk that no longer loads, webpack's "reading 'call'"), or a code or
 * data request that failed mid-navigation.
 */
const RELOAD_CURABLE =
  /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Importing a module script failed|reading 'call'|Failed to fetch|NetworkError|Load failed|Connection closed|fetch failed|An error occurred in the Server Components render/i;

export function isReloadCurable(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: unknown; message?: unknown };
  return RELOAD_CURABLE.test(`${String(e.name ?? "")} ${String(e.message ?? error)}`);
}

const RELOAD_KEY = "pt-boundary-reload";
const RELOAD_WINDOW_MS = 60_000;

/**
 * May this screen reload the page by itself? At most once a minute per tab, so
 * a page that fails on every load shows its error screen instead of reloading
 * forever. A true answer is recorded, so the caller must then reload (after
 * reporting, so the report is queued before the page goes away).
 */
export function claimAutoReload(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    // Storage blocked: without a record the guard cannot work, so stay put.
    return false;
  }
}

/**
 * Record a caught error in PostHog (always loaded) and, where it is, Sentry.
 * Pass `sentry: false` when the caller already reports to Sentry itself.
 */
export function reportCaughtError(
  boundary: string,
  error: Error & { digest?: string },
  { sentry = true, autoReloaded = false }: { sentry?: boolean; autoReloaded?: boolean } = {},
): void {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  analytics.captureException(error, {
    boundary,
    digest: error.digest,
    path,
    reloadCurable: isReloadCurable(error),
    autoReloaded,
  });
  if (!sentry) return;
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(error, {
        tags: { component: boundary, ...(error.digest && { digest: error.digest }) },
      });
    })
    .catch(() => {
      // Reporting must never become a second failure.
    });
}
