import { describe, expect, it } from "vitest";

import { calculateCspa, type CspaInput } from "./cspa";
import type { BulletinMonth } from "./priorityDate";

/**
 * Every expectation here is one of the USCIS Policy Manual's own examples (Volume 7, Part A, Chapter 7, read
 * Oct 31 2026, "Current as of October 27, 2026") or follows from INA 203(h)(1) arithmetic on dates chosen so the
 * answer can be checked by hand.
 */

/** A run of bulletins for one line: `cells` maps `YYYY-MM` to the Final Action cell, everything else is `U`. */
function series(from: string, to: string, cells: Record<string, string>, dff: Record<string, string> = {}): BulletinMonth[] {
  const out: BulletinMonth[] = [];
  let [y, m] = from.split("-").map(Number) as [number, number];
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({
      bulletinMonth: key,
      finalAction: { EB2: { india: cells[key] ?? "U" } },
      datesForFiling: { EB2: { india: dff[key] ?? "U" } },
    });
    if (key === to) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Every month from `from` to `to` (inclusive) current. */
function current(from: string, to: string): Record<string, string> {
  return Object.fromEntries(series(from, to, {}).map((b) => [b.bulletinMonth, "C"]));
}

const base: Omit<CspaInput, "bulletins"> = {
  birthDate: "2005-03-10",
  petitionFiled: "2020-02-01",
  petitionApproved: "2020-08-01",
  priorityDate: "2019-06-01",
  category: "EB2",
  country: "india",
  today: "2026-10-31",
};

describe("pending time and the CSPA age (INA 203(h)(1))", () => {
  it("counts pending time from the filing date to the approval date, as the manual's example does", () => {
    // The manual: filed February 1, 2016, approved August 1, 2016 = 6 months (or 182 days).
    const r = calculateCspa({ ...base, petitionFiled: "2016-02-01", petitionApproved: "2016-08-01", bulletins: series("2016-01", "2016-12", {}) });
    expect(r.pendingDays).toBe(182);
  });

  it("takes the pending days off the age on the day the visa became available", () => {
    // Born 2000-01-01, visa available 2021-05-01 (21 years, 4 months), petition pending 182 days.
    const r = calculateCspa({
      ...base,
      birthDate: "2000-01-01",
      petitionFiled: "2016-02-01",
      petitionApproved: "2016-08-01",
      bulletins: series("2021-01", "2021-12", current("2021-05", "2021-12")),
      today: "2021-06-15",
    });
    expect(r.counted?.availableFrom).toBe("2021-05-01");
    // 2021-05-01 less 182 days is 2020-10-31: 20 years, 9 months, 30 days.
    expect(r.counted?.cspaAge).toEqual({ years: 20, months: 9, days: 30 });
    expect(r.counted?.underTwentyOne).toBe(true);
  });

  it("names the last day a visa can become available with the child still under 21", () => {
    const r = calculateCspa({ ...base, bulletins: series("2020-01", "2020-03", {}) });
    // Turns 21 on 2026-03-10; pending 182 days; the last qualifying day is 2026-03-10 + 182 - 1.
    expect(r.turns21).toBe("2026-03-10");
    expect(r.lastQualifyingDay).toBe("2026-09-07");
  });

  it("on the last qualifying day the child is under 21, and on the day after, 21", () => {
    // Pending 182 days, so a visa on 2026-09-07 leaves the age at 20; on 2026-09-08 it is 21.
    const on = calculateCspa({ ...base, bulletins: series("2026-09", "2026-09", { "2026-09": "C" }), petitionApproved: "2026-09-07", petitionFiled: "2026-03-09" });
    expect(on.pendingDays).toBe(182);
    expect(on.counted?.availableFrom).toBe("2026-09-07");
    expect(on.counted?.underTwentyOne).toBe(true);
    const after = calculateCspa({ ...base, bulletins: series("2026-09", "2026-09", { "2026-09": "C" }), petitionApproved: "2026-09-08", petitionFiled: "2026-03-10" });
    expect(after.pendingDays).toBe(182);
    expect(after.counted?.underTwentyOne).toBe(false);
  });
});

describe("when the visa counts as available (the later of approval and the first of the bulletin month)", () => {
  it("uses the first day of the bulletin month when the petition was approved earlier", () => {
    const r = calculateCspa({ ...base, bulletins: series("2020-01", "2022-12", current("2022-04", "2022-12")) });
    expect(r.counted?.availableFrom).toBe("2022-04-01");
  });

  it("uses the approval date when the date was already current", () => {
    const r = calculateCspa({ ...base, bulletins: series("2020-01", "2020-12", current("2020-05", "2020-12")) });
    expect(r.counted?.availableFrom).toBe("2020-08-01");
    // Approved while current: the CSPA age is the age on the filing date (2020-02-01), 14 years, 10 months, 22 days.
    expect(r.counted?.cspaAge).toEqual({ years: 14, months: 10, days: 22 });
  });

  it("ignores a run of current months that ended before the approval", () => {
    const r = calculateCspa({ ...base, bulletins: series("2020-01", "2021-06", { ...current("2020-02", "2020-05"), ...current("2021-03", "2021-06") }) });
    expect(r.windows.map((w) => w.availableFrom)).toEqual(["2021-03-01"]);
  });

  it("reads 'earlier than the final action date': the cutoff day itself isn't current", () => {
    const on = calculateCspa({ ...base, priorityDate: "2019-06-01", bulletins: series("2021-01", "2021-03", { "2021-02": "01JUN19", "2021-03": "02JUN19" }) });
    expect(on.windows.map((w) => w.availableFrom)).toEqual(["2021-03-01"]);
  });

  it("uses the Final Action chart even when the Dates for Filing chart was current first", () => {
    const r = calculateCspa({
      ...base,
      bulletins: series("2021-01", "2021-12", current("2021-09", "2021-12"), current("2021-02", "2021-12")),
    });
    expect(r.counted?.availableFrom).toBe("2021-09-01");
  });
});

describe("retrogression (the manual's section F.5 examples)", () => {
  // May 1 available by Final Action, July 1 unavailable again.
  const may = series("2021-01", "2021-09", { "2021-05": "C", "2021-06": "C" }, current("2021-03", "2021-09"));

  it("filed in March under Dates for Filing: the age is fixed on May 1", () => {
    const r = calculateCspa({ ...base, bulletins: may, soughtToAcquire: "2021-03-15", today: "2021-09-15" });
    expect(r.status).toBe("locked");
    expect(r.counted?.availableFrom).toBe("2021-05-01");
  });

  it("filed in June under Final Action: the age is fixed on May 1", () => {
    const r = calculateCspa({ ...base, bulletins: may, soughtToAcquire: "2021-06-10", today: "2021-09-15" });
    expect(r.status).toBe("locked");
    expect(r.counted?.availableFrom).toBe("2021-05-01");
  });

  it("not filed before it became unavailable: nothing is fixed, and the next availability counts", () => {
    const later = series("2021-01", "2022-03", { "2021-05": "C", "2021-06": "C", ...current("2022-02", "2022-03") });
    const r = calculateCspa({ ...base, bulletins: later, today: "2022-03-15" });
    expect(r.status).toBe("open");
    expect(r.counted?.availableFrom).toBe("2022-02-01");
    expect(r.windows.map((w) => w.availableFrom)).toEqual(["2021-05-01", "2022-02-01"]);
  });
});

describe("the one-year sought-to-acquire rule (section G examples)", () => {
  // Approved before the examples' first availability, so each window opens on the first of its month.
  const early = { ...base, petitionFiled: "2019-06-01", petitionApproved: "2019-12-01" };
  it("Example 1: four months of availability, then a gap, gives a new full year from the next availability", () => {
    const b = series("2020-09", "2021-12", { ...current("2020-10", "2021-01"), ...current("2021-10", "2021-12") });
    const r = calculateCspa({ ...early, bulletins: b, today: "2021-12-15" });
    expect(r.windows[0]!.fullYear).toBe(false);
    expect(r.status).toBe("open");
    expect(r.counted?.availableFrom).toBe("2021-10-01");
    expect(r.counted?.seekBy).toBe("2022-09-30");
  });

  it("Example 2: a continuous year with no filing loses the protection, even when the visa comes back", () => {
    const b = series("2020-02", "2021-07", { ...current("2020-03", "2021-03"), ...current("2021-06", "2021-07") });
    const r = calculateCspa({ ...early, bulletins: b, today: "2021-07-15" });
    expect(r.windows[0]!.fullYear).toBe(true);
    expect(r.status).toBe("lost");
    expect(r.counted?.availableFrom).toBe("2020-03-01");
  });

  it("filing inside the year keeps it, filing after the year doesn't", () => {
    const b = series("2020-02", "2021-07", current("2020-03", "2021-07"));
    expect(calculateCspa({ ...early, bulletins: b, soughtToAcquire: "2021-02-27", today: "2021-07-15" }).status).toBe("locked");
    expect(calculateCspa({ ...early, bulletins: b, soughtToAcquire: "2021-03-02", today: "2021-07-15" }).status).toBe("lost");
  });

  it("while the visa is available and nothing is filed, says the last day to file", () => {
    const b = series("2026-06", "2026-11", current("2026-07", "2026-11"));
    const r = calculateCspa({ ...early, bulletins: b });
    expect(r.status).toBe("open");
    expect(r.counted?.seekBy).toBe("2027-06-30");
  });
});

describe("what it can't know yet", () => {
  it("a petition still pending: counts the days so far and gives no window", () => {
    const { petitionApproved: _drop, ...rest } = base;
    void _drop;
    const r = calculateCspa({ ...rest, bulletins: series("2026-01", "2026-11", current("2026-01", "2026-11")) });
    expect(r.status).toBe("pending-petition");
    expect(r.pendingDays).toBeNull();
    // 2020-02-01 to 2026-10-31.
    expect(r.pendingSoFar).toBe(2464);
    expect(r.windows).toEqual([]);
  });

  it("approved, never current: says so, with the line still to reach", () => {
    const r = calculateCspa({ ...base, bulletins: series("2020-01", "2026-11", {}) });
    expect(r.status).toBe("not-yet-available");
    expect(r.counted).toBeNull();
  });

  it("filed under Dates for Filing, Final Action not there yet: waiting, sought to acquire done", () => {
    const r = calculateCspa({ ...base, bulletins: series("2025-01", "2026-11", {}, current("2025-03", "2026-11")), soughtToAcquire: "2025-09-02" });
    expect(r.status).toBe("filed-waiting");
  });

  it("names a missing bulletin month inside the line's record, and doesn't run a window through it", () => {
    const b = series("2021-01", "2021-08", current("2021-02", "2021-08")).filter((m) => m.bulletinMonth !== "2021-05");
    const r = calculateCspa({ ...base, bulletins: b, today: "2021-08-15" });
    expect(r.missingMonths).toEqual(["2021-05"]);
    expect(r.windows.map((w) => w.availableFrom)).toEqual(["2021-02-01", "2021-06-01"]);
    expect(r.caveats.join(" ")).toMatch(/May 2021/);
  });

  it("flags an I-485 filed before August 15, 2025, which USCIS reads under the former policy", () => {
    const r = calculateCspa({ ...base, bulletins: series("2023-01", "2024-12", current("2023-06", "2024-12")), soughtToAcquire: "2023-10-02", today: "2024-12-15" });
    expect(r.formerPolicy).toBe(true);
    const now = calculateCspa({ ...base, bulletins: series("2025-06", "2026-11", current("2025-07", "2026-11")), soughtToAcquire: "2025-08-15" });
    expect(now.formerPolicy).toBe(false);
  });

  it("can read the Dates for Filing chart instead, for those former-policy months", () => {
    const r = calculateCspa({
      ...base,
      chart: "datesForFiling",
      bulletins: series("2023-01", "2024-12", current("2024-06", "2024-12"), current("2023-10", "2024-12")),
      soughtToAcquire: "2023-10-02",
      today: "2024-12-15",
    });
    expect(r.counted?.availableFrom).toBe("2023-10-01");
  });

  it("refuses a date that isn't a date", () => {
    expect(() => calculateCspa({ ...base, birthDate: "2005-13-01", bulletins: [] })).toThrow(/birthDate/);
    expect(() => calculateCspa({ ...base, petitionApproved: "2019-01-01", bulletins: [] })).toThrow(/approved before/);
  });
});
