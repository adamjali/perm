import { afterEach, describe, expect, it } from "vitest";

import { TIMEOUT_CONFIG } from "@/hooks/useInactivityTimeout";

import { isLikelySessionTimeout } from "../auth-error";

const KEY = "perm-tracker-last-activity";

describe("isLikelySessionTimeout", () => {
  afterEach(() => localStorage.removeItem(KEY));

  it("is false 20 minutes into an idle session, which the 30-minute sign-out hasn't ended", () => {
    localStorage.setItem(KEY, String(Date.now() - 20 * 60_000));
    expect(isLikelySessionTimeout()).toBe(false);
  });

  it("is true once the idle sign-out's own time has passed", () => {
    localStorage.setItem(KEY, String(Date.now() - TIMEOUT_CONFIG.INACTIVITY_TIMEOUT - 1000));
    expect(isLikelySessionTimeout()).toBe(true);
  });

  it("is false with no recorded activity", () => {
    expect(isLikelySessionTimeout()).toBe(false);
  });
});
