import { describe, expect, it } from "vitest";

import { FEATURED, WAIT_COLUMNS, monthSlots, waitBarDays, waitWords } from "../visaWaits";

const cell = (over: Partial<Parameters<typeof waitWords>[0]>) => ({
  kind: "value" as const,
  amount: 2,
  unit: "month" as const,
  bound: null,
  days: 60,
  waitText: "2 Months",
  ...over,
});

describe("a wait in plain words", () => {
  it("says State's figure as State counts it", () => {
    expect(waitWords(cell({}))).toBe("2 months");
    expect(waitWords(cell({ amount: 1, days: 30 }))).toBe("1 month");
    expect(waitWords(cell({ amount: 6.5, days: 195 }))).toBe("6.5 months");
    expect(waitWords(cell({ amount: 0.5, bound: "under", days: 15 }))).toBe("Under 15 days");
    expect(waitWords(cell({ unit: "day", amount: 4, days: 4 }))).toBe("4 days");
  });

  it("never turns State's NA or a blank into a number", () => {
    expect(waitWords(cell({ kind: "na", amount: null, days: null }))).toBe("No figure");
    expect(waitBarDays(cell({ kind: "na", amount: null, days: null }))).toBeNull();
    expect(waitWords(cell({ kind: "blank", amount: null, days: null }))).toBe("No figure");
    expect(waitBarDays(cell({ kind: "blank", amount: null, days: null }))).toBeNull();
  });

  it("draws an under-half-a-month wait shorter than a full half month, and same day as nothing", () => {
    expect(waitBarDays(cell({ amount: 0.5, bound: "under", days: 15 }))).toBe(7.5);
    expect(waitBarDays(cell({ kind: "same_day", amount: 0, days: 0 }))).toBe(0);
    expect(waitWords(cell({ kind: "same_day", amount: 0, days: 0 }))).toBe("Same day");
  });

  it("keeps a cell it couldn't read as State printed it", () => {
    expect(waitWords(cell({ kind: "unread", waitText: "Closed", amount: null, days: null }))).toBe("Closed");
  });
});

describe("months, missing ones included", () => {
  it("runs every month from the first reading to the last, a month with none marked", () => {
    const slots = monthSlots(["2026-06-18", "2025-11-20", "2026-10-21"]);
    expect(slots[0]).toEqual({ month: "2025-11", reading: "2025-11-20" });
    expect(slots).toHaveLength(12);
    expect(slots.filter((s) => s.reading === null).map((s) => s.month)).toEqual([
      "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-07", "2026-08", "2026-09",
    ]);
  });
});

describe("the page's lists", () => {
  it("leads with the work-visa column and never names a consulate twice", () => {
    expect(WAIT_COLUMNS[0]!.visaClass).toBe("H,L,O,P,Q");
    const posts = FEATURED.flatMap((g) => g.posts);
    expect(new Set(posts).size).toBe(posts.length);
    expect(FEATURED[0]!.country).toBe("India");
  });
});
