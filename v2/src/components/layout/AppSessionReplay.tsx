"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

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
 * This replaces Sentry's session replay, removed with the Sentry client SDK:
 * two replay products recording the same authenticated sessions was pure
 * duplication. Masking (maskAllInputs + maskTextSelector "*") is set at init
 * and applies here; this component only flips recording on. GPC opt-out is
 * honoured by the init-time opt_out_capturing_by_default, which suppresses
 * replay along with everything else, so no extra check is needed here.
 */
export function AppSessionReplay(): null {
  useEffect(() => {
    // No-op if PostHog never initialised (missing key, privacy-mode throw).
    if (!posthog.__loaded) return;
    posthog.startSessionRecording();
    return () => posthog.stopSessionRecording();
  }, []);

  return null;
}
