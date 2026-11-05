import { describe, expect, it } from "vitest";

import { VITALS_ONE_IN, droppedForAllowance, keepsVitals } from "../analyticsSample";

describe("what PostHog's free allowance carries", () => {
  it("keeps about one session in four for web vitals, the same answer every time for a session", () => {
    const ids = Array.from({ length: 4000 }, (_, i) => `0192f3a4-${i.toString(16).padStart(4, "0")}-7c3e-9b1a-${(i * 7919).toString(16).padStart(12, "0")}`);
    const kept = ids.filter(keepsVitals).length;
    expect(kept / ids.length).toBeGreaterThan(1 / VITALS_ONE_IN - 0.04);
    expect(kept / ids.length).toBeLessThan(1 / VITALS_ONE_IN + 0.04);
    for (const id of ids.slice(0, 50)) expect(keepsVitals(id)).toBe(keepsVitals(id));
  });

  it("drops page leaves, samples web vitals and leaves every other event alone", () => {
    expect(droppedForAllowance({ event: "$pageleave" })).toBe(true);
    expect(droppedForAllowance({ event: "$pageview" })).toBe(false);
    expect(droppedForAllowance({ event: "$autocapture" })).toBe(false);
    expect(droppedForAllowance({ event: "alert_signup" })).toBe(false);
    expect(droppedForAllowance({ event: "$exception" })).toBe(false);
    // A vitals event with no session id is kept.
    expect(droppedForAllowance({ event: "$web_vitals", properties: {} })).toBe(false);
  });
});
