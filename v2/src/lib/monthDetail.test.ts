import { describe, expect, it } from "vitest";

import { dolDecisions, parseMonthDetail, weekOnWeek } from "./monthDetail";

const doc = JSON.stringify({
  asOf: "2026-10-07",
  frontDays: 5,
  months: {
    "2025-12": {
      days: [
        { date: "2026-09-25", certified: 300, denied: 2, withdrawn: 1 },
        { date: "2026-09-30", certified: 500, denied: 3, withdrawn: 0 },
        { date: "2026-10-07", certified: 703, denied: 3, withdrawn: 0 },
        { date: "bad", certified: 9 },
      ],
      frontDay: 10, frontFrom: 1952,
      letters: { A: [1000, 600], Z: [400, 100], "#": [3, 1], ab: [1, 1] },
    },
  },
});

describe("parseMonthDetail", () => {
  it("reads a month's days, front day and letters, dropping anything malformed", () => {
    const m = parseMonthDetail(doc, "2025-12")!;
    expect(m.days.map((d) => d.date)).toEqual(["2026-09-25", "2026-09-30", "2026-10-07"]);
    expect(m.frontDay).toBe(10);
    expect(m.letters).toEqual({ A: [1000, 600], Z: [400, 100], "#": [3, 1] });
  });

  it("is null for a month it doesn't carry, or a broken document", () => {
    expect(parseMonthDetail(doc, "2024-01")).toBeNull();
    expect(parseMonthDetail("{", "2025-12")).toBeNull();
  });
});

describe("weekOnWeek and dolDecisions", () => {
  const m = parseMonthDetail(doc, "2025-12")!;
  it("sets the last seven days against the seven before", () => {
    // Oct 1-7 against Sep 24-30: Sep 30 is seven days back, so it is the week before.
    expect(weekOnWeek(m.days, m.asOf)).toEqual({ thisWeek: 706, weekBefore: 503 + 303 });
  });
  it("counts DOL's own decisions, not withdrawals", () => {
    expect(dolDecisions(m.days)).toBe(302 + 503 + 706);
  });
});
