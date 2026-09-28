import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cookie-free unless signed in (Sep 27 2026). PostHog runs with
 * cookieless_mode "on_reject", so the consent helpers in analytics.ts decide
 * who gets persistence (a signed-in account) and who sends nothing at all
 * (GPC, and staff browsers switched off by optOut). In "on_reject" mode
 * posthog.opt_out_capturing() only falls back to cookie-free counting, which
 * is why the switch-off lives in a flag that before_send reads.
 */

const ph = vi.hoisted(() => ({
  optedIn: false,
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  has_opted_in_capturing: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: ph }));

import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_OFF_KEY,
  analytics,
  isAnalyticsOff,
  isGpcEnabled,
} from "../analytics";

function setGpc(on: boolean) {
  Object.defineProperty(navigator, "globalPrivacyControl", {
    value: on,
    configurable: true,
  });
}

describe("analytics consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ph.optedIn = false;
    ph.has_opted_in_capturing.mockImplementation(() => ph.optedIn);
    ph.opt_in_capturing.mockImplementation(() => {
      ph.optedIn = true;
    });
    window.localStorage.clear();
    setGpc(false);
  });

  it("opts a signed-in account in once, then only re-announces", () => {
    const heard = vi.fn();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, heard);

    analytics.consentForAccount();
    analytics.consentForAccount();

    // opt_in sends an $opt_in event and a pageview, so never twice.
    expect(ph.opt_in_capturing).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledTimes(2);
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, heard);
  });

  it("never opts in a browser that sends Global Privacy Control", () => {
    setGpc(true);
    expect(isGpcEnabled()).toBe(true);
    analytics.consentForAccount();
    expect(ph.opt_in_capturing).not.toHaveBeenCalled();
  });

  it("switches a staff browser off with a flag before_send can read", () => {
    analytics.optOut();
    expect(window.localStorage.getItem(ANALYTICS_OFF_KEY)).toBe("1");
    expect(isAnalyticsOff()).toBe(true);
    expect(analytics.hasOptedOut()).toBe(true);
    expect(ph.opt_out_capturing).toHaveBeenCalledTimes(1);

    // A switched-off browser is never opted back into persistence.
    analytics.consentForAccount();
    expect(ph.opt_in_capturing).not.toHaveBeenCalled();
  });

  it("optIn only clears the switch; consent comes from the next sign-in", () => {
    analytics.optOut();
    analytics.optIn();
    expect(isAnalyticsOff()).toBe(false);
    expect(ph.opt_in_capturing).not.toHaveBeenCalled();
  });

  it("a visitor who never signs in has nothing written to storage", () => {
    analytics.capture("page_seen");
    expect(window.localStorage.length).toBe(0);
  });
});
