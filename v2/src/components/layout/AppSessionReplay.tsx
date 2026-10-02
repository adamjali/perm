"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { ANALYTICS_CONSENT_EVENT, whenAnalyticsReady } from "@/lib/analytics";

/**
 * Turns PostHog session replay ON, masked, for the authenticated app only.
 *
 * Replay is disabled at init (src/instrumentation-client.ts) so public pages —
 * which render a full-viewport animated canvas and, on /perm-case-status, real
 * case data as text — never load the recorder. The app is the one place a
 * replay is actually watched to debug a UX complaint, it is behind auth, and it
 * has no decorative canvas, so recording it costs nothing the public pages were
 * paying and leaks nothing the public pages risked.
 *
 * Sentry's session replay is not used: two replay products recording the
 * same authenticated sessions would be pure duplication. Masking
 * (maskAllInputs + maskTextSelector "*") is set at init
 * and applies here; this component only flips recording on.
 *
 * Recording needs the account's consent first: PostHog runs cookie-free until
 * analytics.consentForAccount() opts the signed-in account in, and
 * cookie-free mode has no session to record. So it starts at once when the
 * browser already consented, or on the consent event otherwise. GPC and staff
 * browsers never consent, and before_send drops anything they send.
 *
 * Also note the project-level switch: while session_recording_opt_in is
 * false, PostHog records nothing even when this runs.
 */
export function AppSessionReplay(): null {
  useEffect(() => {
    let mounted = true;
    let stop = () => {};
    // PostHog may still be starting (it waits briefly for the country), so
    // this runs once it is up.
    whenAnalyticsReady(() => {
      // No-op if PostHog never initialised (missing key, privacy-mode throw),
      // or if the page left before it started.
      if (!mounted || !posthog.__loaded) return;
      const start = () => {
        if (posthog.has_opted_in_capturing()) posthog.startSessionRecording();
      };
      start();
      window.addEventListener(ANALYTICS_CONSENT_EVENT, start);
      stop = () => {
        window.removeEventListener(ANALYTICS_CONSENT_EVENT, start);
        posthog.stopSessionRecording();
      };
    });
    return () => {
      mounted = false;
      stop();
    };
  }, []);

  return null;
}
