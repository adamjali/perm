import { describe, expect, it } from "vitest";

import { connectionThrottleReply, siteThrottleReply, waitPhrase } from "./throttleReply";

describe("throttle replies name the limit and the wait", () => {
  it.each([
    [0, "a minute"],
    [45_000, "a minute"],
    [12 * 60_000, "about 12 minutes"],
    [89 * 60_000, "about 89 minutes"],
    [3 * 3_600_000, "about 3 hours"],
  ])("%i ms reads as %s", (ms, phrase) => {
    expect(waitPhrase(ms)).toBe(phrase);
  });

  it("says which limit fired, never the old one-size line", () => {
    expect(connectionThrottleReply(20 * 60_000)).toMatch(/one connection.*about 20 minutes/);
    expect(siteThrottleReply(5 * 3_600_000)).toMatch(/confirmation emails.*daily limit.*about 5 hours/);
    expect(siteThrottleReply(60_000, "preference links")).toMatch(/preference links/);
    for (const s of [connectionThrottleReply(1), siteThrottleReply(1)]) {
      expect(s).not.toMatch(/little while|—/);
    }
  });
});
