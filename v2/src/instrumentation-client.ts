/**
 * Next.js client-side instrumentation, runs once, before the app hydrates.
 *
 * Next.js loads exactly ONE `instrumentation-client` file, and because this app
 * lives under `src/`, it must be THIS file (`src/instrumentation-client.ts`);
 * a root-level `instrumentation-client.ts` is silently ignored. (A second
 * copy is how PostHog analytics once went offline: a bot-check library added
 * its own file and one of the two was dropped. Never add another.)
 *
 * The initializer is wrapped in try/catch so a failure never breaks the
 * client module's side-effect import.
 */

import posthog from "posthog-js";
import { config as zodConfig } from "zod/v4/core";

import {
  holdUntilStarted,
  isAnalyticsOff,
  isGpcEnabled,
  releaseHeld,
} from "@/lib/analytics";
import { edgeCountry } from "@/lib/edgeCountry";
import { fromServiceWorkerRegister } from "@/lib/exceptionNoise";

// The live site's security policy has no 'unsafe-eval', so zod must not
// compile parsers with new Function: its probe would be refused and log a
// policy error on every page with a form. It falls back correctly either way;
// this skips the probe. Schemas read the flag when they are built, and this
// file runs before any app module loads.
zodConfig({ jitless: true });

/**
 * Strip `case=<number>` out of every URL-shaped property on an event.
 *
 * String surgery rather than `new URL()`: these properties are sometimes a
 * bare path ("/perm-case-status?case=X"), which `new URL()` throws on, and a
 * throw inside before_send would drop the event entirely. Anything without
 * the parameter is returned untouched, so the common case costs one
 * `includes` per property.
 */
function redactCaseParam(props: Record<string, unknown> | undefined): void {
  if (!props) return;
  for (const key of ["$current_url", "$referrer", "$pathname", "url"]) {
    const v = props[key];
    if (typeof v !== "string" || !v.includes("case=")) continue;
    props[key] = v.replace(/([?&]case=)[^&#]*/gi, "$1redacted");
  }
}

// ---------------------------------------------------------------------------
// PostHog — product analytics + client exception capture.
// Events are sent via the /ingest reverse proxy (next.config.ts rewrites) to
// reduce ad-blocker interference.
// ---------------------------------------------------------------------------
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

function startPostHog(key: string, country: string | null): void {
  try {
    // Honor Global Privacy Control (GPC). When the browser advertises a GPC
    // signal, nothing is sent to PostHog at all: analytics, exceptions and
    // replay. Enforced in before_send below, because in "on_reject" mode an
    // opt-out only falls back to cookie-free counting. Disclosed in the
    // Privacy Policy (§7, §15).
    const gpcEnabled = isGpcEnabled();

    posthog.init(key, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      // Pin PostHog SDK defaults to this date to prevent behavior changes from SDK updates
      defaults: "2026-01-30",
      capture_exceptions: true,
      // Field Core Web Vitals (LCP/CLS/FCP/INP), kept with the rest of the
      // analytics and loaded with no extra script.
      capture_performance: { web_vitals: true },
      // COOKIE-FREE UNLESS SIGNED IN. Consent starts pending and
      // pending counts as a rejection, so everyone is counted with PostHog's
      // daily-salted server hash and nothing is written to the browser. A
      // signed-in account switches to persistence through
      // analytics.consentForAccount() (LoginTracker); sign-out's reset()
      // clears it again. Requires the project's cookieless_server_hash_mode
      // set to 2 (stateful), or PostHog drops these events.
      cookieless_mode: "on_reject",
      opt_out_capturing_by_default: true,
      // SESSION REPLAY IS OFF BY DEFAULT AND TURNED ON ONLY IN THE AUTHENTICATED
      // APP (see (authenticated)/layout.tsx), for two measured reasons:
      //   1. PERF. The public layout renders AmbientMurmuration, a full-viewport
      //      requestAnimationFrame canvas, and this project's PostHog project has
      //      recordCanvas enabled (verified in the live remote config: fps 3,
      //      100% of sessions). Canvas capture is a GPU readback on the main
      //      thread every frame and cannot be disabled from client init (it reads
      //      only from remote config). Not loading the recorder on public pages
      //      removes that cost for 100% of public visitors — the "everything is
      //      laggy" report.
      //   2. PRIVACY. /perm-case-status renders a real case number, employer and
      //      job title as on-screen TEXT. We already strip `case=` from every
      //      event URL (redactCaseParam below) precisely so a person is never
      //      linked to an application — and an unmasked replay of that page puts
      //      it straight back. Not recording public pages closes that entirely;
      //      maskAllInputs + maskTextSelector below defend the app recording too.
      disable_session_recording: true,
      session_recording: { maskAllInputs: true, maskTextSelector: "*" },
      // SURVEYS OFF. The Surveys product is not enabled on this project, yet
      // without this posthog-js fetches /ingest/static/<version>/surveys.js
      // (34 KB, 83% unused) on every page load. `disable_surveys` is the
      // SDK's own switch for the whole module
      // (@posthog/types: "disable all surveys functionality", default false).
      // Turn it back on here if a survey is ever built.
      disable_surveys: true,
      debug: process.env.NODE_ENV === "development",
      before_send: (event) => {
        if (!event) return event;

        // GPC, and staff browsers switched off by analytics.optOut(): send
        // nothing. Read on every event, so an opt-out mid-session applies at
        // once.
        if (gpcEnabled || isAnalyticsOff()) return null;

        // Case numbers never leave for a third party, on ANY event.
        //
        // /perm-case-status carries the looked-up case in `?case=` so a
        // result is shareable and bookmarkable, which means posthog-js would
        // otherwise put a real government case number in $current_url on
        // every autocaptured pageview, pageleave and click. That number
        // resolves to an employer and a job title, so joined to a PostHog
        // person it links an identified visitor to a specific application.
        //
        // Redacted here rather than on the page because $current_url is read
        // from window.location by the SDK: there is no page-local hook. The
        // event still carries the path, so the page is still measurable.
        redactCaseParam(event.properties);
        redactCaseParam(event.$set);

        // The country Cloudflare reported (see edgeCountry). Signed-in events
        // also get PostHog's own lookup, which agrees with it.
        if (country && event.properties && !event.properties.$geoip_country_code) {
          event.properties.$geoip_country_code = country;
        }

        if (event.event === "$exception") {
          // Build a single string from all exception message sources for filtering.
          // PostHog stores messages in $exception_message AND/OR $exception_list[].value
          const exList = event.properties?.$exception_list as
            | Array<{ value?: string }>
            | undefined;
          const msg = [
            event.properties?.$exception_message || "",
            ...(exList || []).map((e) => e.value || ""),
          ].join(" ");

          // Stale deployment — normal during deploys, error boundaries reload the page
          if (
            msg.includes("Server Action") &&
            msg.includes("was not found on the server")
          ) {
            return null;
          }
          // Browser extension parsing JSON-LD structured data (not app code)
          if (msg.includes("@context") && msg.includes("toLowerCase")) {
            return null;
          }
          // Browser extension mutating DOM → React reconciler fails (not app code)
          if (
            (msg.includes("insertBefore") || msg.includes("removeChild")) &&
            msg.includes("not a child")
          ) {
            return null;
          }
          // Network/deploy: chunk load failures, timeouts, stale hashes
          if (/ChunkLoadError|Loading chunk.*failed/i.test(msg)) {
            return null;
          }
          if (/^(Load failed|Failed to fetch)$/i.test(msg.trim())) {
            return null;
          }
          // PostHog session recorder internal bugs (not our code)
          if (msg.includes("bufferBelongsToIframe")) {
            return null;
          }
          if (msg.includes("Called on script loaded before session recording is available")) {
            return null;
          }
          // Transient ServiceWorker registration failures (network, page navigation aborts)
          if (/Failed to register a ServiceWorker/i.test(msg)) {
            return null;
          }
          if (/AbortError.*ServiceWorker|ServiceWorker.*aborted|Operation has been aborted/i.test(msg)) {
            return null;
          }
          // PostHog's exception capture keeps ONE noise filter list, here,
          // not two hand-synced copies.
          // Layout thrash the browser recovers from on its own.
          if (/ResizeObserver loop/i.test(msg)) return null;
          // Network flake, including iOS auth-token refresh on suspend/resume.
          if (/NetworkError|Network request failed/i.test(msg)) return null;
          // A browser extension's own script, not app code.
          if (/chrome-extension:\/\/|moz-extension:\/\//i.test(msg)) return null;
          // Auth transients during token refresh — expected, not a defect.
          if (/not authenticated|User profile not found/i.test(msg)) return null;
          // Stale-deployment Server Action hashes (StaleDeploymentReload
          // handles the UX; the error itself is noise).
          if (msg.includes("UnrecognizedActionError")) return null;
          // React reconciler errors from extensions mutating the DOM.
          if (/Minified React error #(418|423|425)\b/.test(msg)) return null;
          // Measured, none of it ours: Zalo's in-app browser calling its own
          // bridge (the largest share), Android WebView
          // bridges, Safari failing to fetch sw.js, opaque cross-origin
          // "Script error.", and a browser refusing service-worker
          // registration ("Rejected", thrown inside register()).
          if (/zaloJSV2/.test(msg)) return null;
          // Microsoft's link scanner (Outlook Safe Links) opening a page in its
          // own browser; its bridge rejects with this. Seen Oct 2 2026 on three
          // pages within two seconds, the shape of a scan, not a visitor.
          if (/Object Not Found Matching Id:\d+, MethodName:/.test(msg)) return null;
          if (/Java exception was raised during method invocation/.test(msg)) return null;
          if (/Script \S*sw\.js load failed/.test(msg)) return null;
          if (/^\s*Script error\.?\s*$/.test(msg)) return null;
          if (fromServiceWorkerRegister(event.properties, msg)) return null;
        }
        return event;
      },
    });
  } catch (error) {
    // Privacy-mode browsers (storage blocked) or strict CSP can throw on init.
    // Swallow so analytics failure never breaks the client module import.
    console.warn(
      "[instrumentation-client] PostHog init failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

if (posthogKey) {
  // Calls the app makes before PostHog is up are held, then replayed.
  holdUntilStarted();
  void edgeCountry()
    .then((country) => startPostHog(posthogKey, country))
    .finally(releaseHeld);
} else if (process.env.NODE_ENV === "development") {
  console.warn(
    "[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set. Analytics disabled."
  );
}
