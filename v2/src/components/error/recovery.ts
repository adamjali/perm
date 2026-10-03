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
 * The build-file and page-data requests this page made that came back wrong:
 * a status outside 2xx, or a script answered with something that isn't
 * JavaScript (Chrome 129+ reports the type). "reading 'call'" means webpack
 * asked for a module no loaded file defined, about 20 times a day from Oct 2
 * 2026 on the live build itself, not a stale one, and it would not reproduce
 * in 14 clicks. This is what the next one records, so its cause can be read.
 */
export function failedRequests(): string[] {
  try {
    const entries = performance.getEntriesByType("resource") as Array<
      PerformanceResourceTiming & { responseStatus?: number; contentType?: string }
    >;
    return entries
      .filter((e) => /\/_next\/static\/|[?&]_rsc=/.test(e.name))
      .filter((e) => {
        const status = e.responseStatus;
        const badStatus = typeof status === "number" && status !== 0 && (status < 200 || status > 299);
        const type = e.contentType;
        const badType = /\/_next\/static\/.*\.js/.test(e.name) && !!type && !/javascript/.test(type);
        return badStatus || badType;
      })
      .slice(-10)
      .map((e) => `${e.responseStatus ?? "?"} ${e.contentType || "-"} ${new URL(e.name, "https://x").pathname.slice(-80)}`);
  } catch {
    return [];
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
  const reloadCurable = isReloadCurable(error);
  analytics.captureException(error, {
    boundary,
    digest: error.digest,
    path,
    reloadCurable,
    autoReloaded,
    ...(reloadCurable && { failedRequests: failedRequests() }),
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
