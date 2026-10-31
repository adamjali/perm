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
 * data request that failed mid-navigation. Chrome words a response cut off
 * mid-read as "network error" (an Android sign-in page, Oct 12 2026).
 */
const RELOAD_CURABLE =
  /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Importing a module script failed|reading 'call'|Failed to fetch|Network ?Error|Load failed|Connection closed|fetch failed|An error occurred in the Server Components render/i;

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
 * Webpack's "a module factory is missing" crash, in Chrome's, Firefox's and
 * Safari's words.
 */
const MISSING_MODULE = /reading 'call'|property "call"|property 'call'|\]\.call'\)/;
export function isMissingModule(message: string): boolean {
  return MISSING_MODULE.test(message);
}

export interface ChunkDiagnostics {
  /** Entries in webpack's chunk lists (`self.webpackChunk_N_E…`), all of them. */
  pushes: number;
  /**
   * Each chunk list on the page and its entries, named by what follows
   * `webpackChunk_N_E`. One build makes one list, so a second list is files
   * from another deployment loaded into this page.
   */
  lists: Record<string, number>;
  /** Chunk ids pushed more than once: one build never does that. */
  duplicateIds: string[];
  /** Scripts that aren't our build files: an origin, or a same-site path. */
  foreignScripts: string[];
  /** Distinct deployment ids on our own build files (first 12 characters). */
  dpl: string[];
}

/**
 * Evidence for the missing-module crash. It came from navigation data a
 * previous build had sent, kept by the browser or Cloudflare: Next loads the
 * chunks such data names before it checks the deployment, and webpack's chunk
 * and module numbers repeat between builds (Oct 10 2026). Each deployment now
 * has its own chunk list (`chunkLoadingGlobal` in next.config.ts), so a second
 * list here is an older build's files on the page, and a duplicate id inside
 * one list is a build loading the same chunk twice.
 */
export function chunkDiagnostics(): ChunkDiagnostics | null {
  try {
    const counts = new Map<string, number>();
    const lists: Record<string, number> = {};
    let pushes = 0;
    for (const name of Object.keys(window)) {
      if (!name.startsWith("webpackChunk_N_E")) continue;
      const list = (window as unknown as Record<string, unknown>)[name];
      if (!Array.isArray(list)) continue;
      let entries = 0;
      for (const entry of list) {
        if (!Array.isArray(entry) || !Array.isArray(entry[0])) continue;
        entries += 1;
        // Ids are counted per list: two lists sharing an id is two builds, not a duplicate.
        for (const id of entry[0] as unknown[]) {
          const key = `${name}:${String(id)}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      pushes += entries;
      lists[name.slice("webpackChunk_N_E".length).replace(/^_/, "").slice(0, 12) || "default"] = entries;
    }
    const duplicateIds = [...counts]
      .filter(([, n]) => n > 1)
      .map(([key]) => key.slice(key.lastIndexOf(":") + 1))
      .slice(0, 10);
    const foreign = new Set<string>();
    const dpl = new Set<string>();
    for (const script of Array.from(document.scripts)) {
      if (!script.src) continue;
      let u: URL;
      try {
        u = new URL(script.src, window.location.href);
      } catch {
        continue;
      }
      if (u.origin === window.location.origin && u.pathname.startsWith("/_next/")) {
        const d = u.searchParams.get("dpl");
        if (d) dpl.add(d.slice(0, 12));
        continue;
      }
      // An extension's origin names the extension; its file paths add nothing.
      const ext = /-extension:$/.test(u.protocol);
      foreign.add(ext || u.origin !== window.location.origin ? `${u.protocol}//${u.host}` : u.pathname.slice(0, 60));
    }
    return { pushes, lists, duplicateIds, foreignScripts: [...foreign].slice(0, 10), dpl: [...dpl] };
  } catch {
    return null;
  }
}

/**
 * Record a caught error in PostHog (always loaded) and, where it is, Sentry.
 * Pass `sentry: false` when the caller already reports to Sentry itself.
 */
/** Errors already sent to /api/client-error by this page, so a re-render doesn't send one twice. */
const sentToServer = new Set<string>();

/**
 * Tell our own server an error screen appeared, before it reloads or redirects
 * (owner, Oct 31 2026: the screen "disappears super quick ... it needs to log").
 * PostHog is off for staff and Sentry isn't loaded on the sign-in pages, so this
 * is the one record that always exists. A beacon still goes out while the page
 * navigates away. Never throws.
 */
export function logClientError(
  boundary: string,
  error: Error & { digest?: string },
  outcome: "shown" | "reload" | "redirect-login" | "reload-stale",
): void {
  try {
    if (typeof window === "undefined") return;
    const message = String(error?.message ?? "");
    const key = `${boundary}|${outcome}|${message}`;
    if (sentToServer.has(key)) return;
    sentToServer.add(key);
    const body = JSON.stringify({
      boundary,
      outcome,
      name: error?.name,
      message,
      digest: error?.digest,
      path: window.location.pathname,
      stack: typeof error?.stack === "string" ? error.stack.slice(0, 1500) : undefined,
    });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/client-error", blob)) {
      void fetch("/api/client-error", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
    }
  } catch {
    // Reporting must never become a second failure.
  }
}

export function reportCaughtError(
  boundary: string,
  error: Error & { digest?: string },
  { sentry = true, autoReloaded = false }: { sentry?: boolean; autoReloaded?: boolean } = {},
): void {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const reloadCurable = isReloadCurable(error);
  logClientError(boundary, error, autoReloaded ? "reload" : "shown");
  analytics.captureException(error, {
    boundary,
    digest: error.digest,
    path,
    reloadCurable,
    autoReloaded,
    ...(reloadCurable && { failedRequests: failedRequests() }),
    ...(isMissingModule(String(error?.message ?? "")) && { chunks: chunkDiagnostics() }),
  });
  if (!sentry) return;
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(error, {
        tags: { component: boundary, ...(error.digest && { digest: error.digest }) },
        // One issue across builds: the minified frame names change with every
        // deploy, and each new name opened a new issue (4Y, then 53).
        ...(isMissingModule(String(error?.message ?? "")) && { fingerprint: ["webpack-missing-module"] }),
      });
    })
    .catch(() => {
      // Reporting must never become a second failure.
    });
}
