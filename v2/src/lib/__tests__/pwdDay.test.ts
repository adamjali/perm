import { describe, expect, it } from "vitest";

import { parsePwdDayData } from "../pwdDay";

const days = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 10 + i));
  const dow = d.getUTCDay();
  return { date: d.toISOString().slice(0, 10), n: dow === 0 || dow === 6 ? 20 : 800 };
});
const QUEUE = JSON.stringify({ asOf: "2026-10-08", byDay: [["2026-07-01", 100], ["2026-07-02", "50"]], days, inProcess: 150 });
const BT = JSON.stringify({
  end: "2026-10-07",
  day: {
    rangeModel: [{ fromDays: 0, toDays: 14, earlyDays: -3, lateDays: 0 }, { fromDays: 15, toDays: 30, earlyDays: "x", lateDays: 2 }],
    origins: [
      { t0: "2026-09-16", day: { decided: 2728, typicalMissDays: 2, within7Share: 0.995 } },
      { t0: "2026-09-23", day: { decided: 40, typicalMissDays: 1, within7Share: 1 } },
    ],
  },
});

describe("parsePwdDayData", () => {
  it("reads the count, measures the pace, and takes only well-formed ranges", () => {
    const d = parsePwdDayData(QUEUE, BT);
    expect(d?.queue.byDay).toEqual([["2026-07-01", 100], ["2026-07-02", 50]]);
    expect(d?.queue.pace.pace).toBeGreaterThan(500);
    expect(d?.measuredRange).toEqual([{ fromDays: 0, toDays: 14, earlyDays: -3, lateDays: 0 }]);
  });

  it("quotes the newest start day with enough decided requests, not a thin newer one", () => {
    expect(parsePwdDayData(QUEUE, BT)?.tested).toEqual({ decided: 2728, typicalMissDays: 2, within7Share: 0.995, through: "2026-10-07" });
  });

  it("still dates a request when the backtest is missing or unreadable", () => {
    expect(parsePwdDayData(QUEUE, null)?.measuredRange).toEqual([]);
    expect(parsePwdDayData(QUEUE, "{")?.tested).toBeNull();
  });

  it("gives nothing without a readable count or enough days to measure a pace", () => {
    expect(parsePwdDayData(null, BT)).toBeNull();
    expect(parsePwdDayData("{", BT)).toBeNull();
    expect(parsePwdDayData(JSON.stringify({ asOf: "2026-10-08", byDay: [["2026-07-01", 1]], days: days.slice(0, 3) }), BT)).toBeNull();
  });
});
