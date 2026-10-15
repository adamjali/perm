import { describe, expect, it } from "vitest";

import { parsePwdDayData } from "../pwdDay";

// Four weeks of DOL's days to Wed Oct 7 2026: 700 to 900 a working day, a few on weekends.
const days = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 10 + i));
  const dow = d.getUTCDay();
  return { date: d.toISOString().slice(0, 10), n: dow === 0 || dow === 6 ? 20 : 700 + ((i * 53) % 200) };
});
const total = days.reduce((a, d) => a + d.n, 0);
const QUEUE = JSON.stringify({ asOf: "2026-10-08", clock: "dol", byDay: [["2026-07-01", 100], ["2026-07-02", "50"]], days, inProcess: 150 });
const BT = JSON.stringify({
  end: "2026-10-07",
  day: {
    unit: "workday",
    rangeModel: [{ fromDays: 0, toDays: 10, earlyDays: -1, lateDays: 1 }, { fromDays: 11, toDays: 20, earlyDays: "x", lateDays: 2 }],
    origins: [
      { t0: "2026-09-16", day: { decided: 2728, typicalMissDays: 0, within7Share: 0.995 } },
      { t0: "2026-09-23", day: { decided: 40, typicalMissDays: 1, within7Share: 1 } },
    ],
  },
});

describe("parsePwdDayData", () => {
  it("reads the count, measures the pace a working day, and takes only well-formed ranges", () => {
    const d = parsePwdDayData(QUEUE, BT);
    expect(d?.queue.byDay).toEqual([["2026-07-01", 100], ["2026-07-02", 50]]);
    // Labor Day (Sep 7) falls before the window: 20 working days, and every exit counts.
    expect(d?.queue.pace.workdaysUsed).toBe(20);
    expect(d?.queue.pace.perWorkday).toBeCloseTo(total / 20, 6);
    expect(d?.measuredRange).toEqual([{ fromDays: 0, toDays: 10, earlyDays: -1, lateDays: 1 }]);
  });

  it("moves a count written before DOL's clock back a day: its mornings read the day before", () => {
    const old = JSON.parse(QUEUE) as { clock?: string; days: { date: string; n: number }[] };
    delete old.clock;
    // The same days as the sweep saw them, the morning after DOL's.
    old.days = old.days.map((d) => ({ ...d, date: new Date(Date.parse(`${d.date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) }));
    expect(parsePwdDayData(JSON.stringify(old), BT)?.queue.pace).toEqual(parsePwdDayData(QUEUE, BT)?.queue.pace);
  });

  it("quotes the newest start day with enough decided requests, not a thin newer one", () => {
    expect(parsePwdDayData(QUEUE, BT)?.tested).toEqual({ decided: 2728, typicalMissDays: 0, within7Share: 0.995, through: "2026-10-07" });
  });

  it("uses no range or test line from a backtest of the retired calendar-day method", () => {
    const old = JSON.parse(BT) as { day: { unit?: string } };
    delete old.day.unit;
    const d = parsePwdDayData(QUEUE, JSON.stringify(old));
    expect(d?.measuredRange).toEqual([]);
    expect(d?.tested).toBeNull();
  });

  it("still dates a request when the backtest is missing or unreadable", () => {
    expect(parsePwdDayData(QUEUE, null)?.measuredRange).toEqual([]);
    expect(parsePwdDayData(QUEUE, "{")?.tested).toBeNull();
  });

  it("gives nothing without a readable count or enough days to measure a pace", () => {
    expect(parsePwdDayData(null, BT)).toBeNull();
    expect(parsePwdDayData("{", BT)).toBeNull();
    expect(parsePwdDayData(JSON.stringify({ asOf: "2026-10-08", clock: "dol", byDay: [["2026-07-01", 1]], days: days.slice(0, 3) }), BT)).toBeNull();
  });
});
