import { describe, expect, it } from "vitest";

import { cardDay } from "../cardDay";

describe("cardDay", () => {
  it("is the Eastern day for a written review", () => {
    expect(cardDay("2026-10-28T13:59:11.000Z")).toBe("October 28, 2026");
  });

  it("is the month alone for a rating from an alert email", () => {
    expect(cardDay("2026-10-28T13:59:11.000Z", true)).toBe("October 2026");
  });

  it("goes by the Eastern day at a month's edge", () => {
    // 1 AM UTC on Nov 1 is still Oct 31 in New York.
    expect(cardDay("2026-11-01T01:00:00.000Z", true)).toBe("October 2026");
  });

  it("is null for a date it can't read", () => {
    expect(cardDay("not a date", true)).toBeNull();
  });
});
