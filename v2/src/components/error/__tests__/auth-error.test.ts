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

  it("counts a sign-in as activity: an old session's stamp right after signing in isn't a timeout", () => {
    localStorage.setItem(KEY, String(Date.now() - 5 * 60 * 60_000));
    localStorage.setItem("perm_last_login_at", String(Date.now() - 10_000));
    try {
      expect(isLikelySessionTimeout()).toBe(false);
    } finally {
      localStorage.removeItem("perm_last_login_at");
    }
  });

  it("is false with no recorded activity", () => {
    expect(isLikelySessionTimeout()).toBe(false);
  });
});
