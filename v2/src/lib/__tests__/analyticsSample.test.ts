import { describe, expect, it } from "vitest";

import { VITALS_ONE_IN, droppedForAllowance, keepsVitals } from "../analyticsSample";

describe("what PostHog's free allowance carries", () => {
  it("keeps about one session in four for web vitals, the same answer every time for a session", () => {
    const ids = Array.from({ length: 4000 }, (_, i) => `0192f3a4-${i.toString(16).padStart(4, "0")}-7c3e-9b1a-${(i * 7919).toString(16).padStart(12, "0")}`);
    const kept = ids.filter((id) => keepsVitals(id)).length;
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
  });

  // Nov 5 2026: in cookie-free mode no event carries a session id when before_send runs (PostHog adds it on its
  // server), and keeping every such event kept them all.
  it("samples vitals with no session id by the page load's draw, one load in four", () => {
    expect(droppedForAllowance({ event: "$web_vitals", properties: {} }, 0.1)).toBe(false);
    expect(droppedForAllowance({ event: "$web_vitals", properties: {} }, 0.6)).toBe(true);
    expect(droppedForAllowance({ event: "$web_vitals", properties: { $session_id: "" } }, 0.9)).toBe(true);
    const draws = Array.from({ length: 1000 }, (_, i) => i / 1000);
    const kept = draws.filter((d) => keepsVitals(undefined, d)).length;
    expect(kept).toBe(1000 / VITALS_ONE_IN);
  });

  it("a session id, where there is one, decides it whatever the draw", () => {
    const id = "0192f3a4-0001-7c3e-9b1a-000000001eef";
    expect(keepsVitals(id, 0)).toBe(keepsVitals(id, 0.99));
  });
});
