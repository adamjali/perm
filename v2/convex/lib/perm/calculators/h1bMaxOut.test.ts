import { describe, expect, it } from "vitest";

import { calculateH1bMaxOut } from "./h1bMaxOut";

describe("calculateH1bMaxOut", () => {
  it("puts max-out on the day before the sixth anniversary and the PERM file-by date 365 days earlier", () => {
    const r = calculateH1bMaxOut({ h1bStart: "2021-10-01" });
    expect(r.maxOutDate).toBe("2027-09-30");
    expect(r.permFileBy).toBe("2026-09-30");
    expect(r.perm).toBeNull();
    expect(r.daysOfMargin).toBeNull();
  });

  it("adds recaptured days spent outside the United States to the max-out date", () => {
    const r = calculateH1bMaxOut({ h1bStart: "2021-10-01", daysOutside: 40 });
    expect(r.maxOutDate).toBe("2027-11-09");
    expect(r.permFileBy).toBe("2026-11-09");
  });

  it("judges a PERM filing date against the 365-day rule, inclusive at exactly 365", () => {
    const yes = calculateH1bMaxOut({ h1bStart: "2021-10-01", permFiled: "2026-09-30" });
    expect(yes.perm).toEqual({ filed: "2026-09-30", qualifies: true, daysBeforeMaxOut: 365 });
    const no = calculateH1bMaxOut({ h1bStart: "2021-10-01", permFiled: "2026-10-01" });
    expect(no.perm?.qualifies).toBe(false);
    expect(no.perm?.daysBeforeMaxOut).toBe(364);
  });

  it("measures the margin from a supplied reference date", () => {
    expect(calculateH1bMaxOut({ h1bStart: "2021-10-01" }, "2026-09-08").daysOfMargin).toBe(22);
    expect(calculateH1bMaxOut({ h1bStart: "2020-01-01" }, "2026-09-08").daysOfMargin).toBeLessThan(0);
  });

  it("handles a leap-day start without drifting", () => {
    expect(calculateH1bMaxOut({ h1bStart: "2024-02-29" }).maxOutDate).toBe("2030-02-27");
  });

  it("refuses a malformed date rather than computing from garbage", () => {
    expect(() => calculateH1bMaxOut({ h1bStart: "10/01/2021" })).toThrow();
    expect(() => calculateH1bMaxOut({ h1bStart: "2021-10-01", permFiled: "next year" })).toThrow();
  });
});
