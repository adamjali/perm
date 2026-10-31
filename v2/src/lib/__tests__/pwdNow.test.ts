import { describe, expect, it } from "vitest";
import { catchingUp, flowVerdict, monthSeries, outcomeMix, parsePwdQueueDoc, parseWaitTrend, speedVerdict, yearOnYear } from "../pwdNow";

// Shaped like the PWD sweep's document of Oct 31 2026: the newest days, their
// exits split by what DOL did, the filings each day, and the status mix.
const DOC = JSON.stringify({
  asOf: "2026-10-31",
  clock: "dol",
  byDay: [["2026-07-27", 336]],
  days: [
    { date: "2026-10-24", n: 1, issued: 1, withdrawn: 0, other: 0, rfi: 0 },
    { date: "2026-10-25", n: 0, issued: 0, withdrawn: 0, other: 0, rfi: 0 },
    { date: "2026-10-26", n: 730, issued: 723, withdrawn: 5, other: 2, rfi: 104 },
    { date: "2026-10-27", n: 750, issued: 741, withdrawn: 8, other: 1, rfi: 142 },
    { date: "2026-10-28", n: 845, issued: 836, withdrawn: 7, other: 2, rfi: 112 },
    { date: "2026-10-29", n: 423, issued: 418, withdrawn: 4, other: 1, rfi: 85 },
    { date: "2026-10-30", n: 760, issued: 751, withdrawn: 7, other: 2, rfi: 44 },
  ],
  filedByDay: [["2026-10-24", 56], ["2026-10-25", 19], ["2026-10-26", 568], ["2026-10-27", 662], ["2026-10-28", 582], ["2026-10-29", 491], ["2026-10-30", 663]],
  mix: { filedSince: "2026-04-14", byStatus: { "IN PROCESS": 46549, "DETERMINATION ISSUED": 28484, WITHDRAWN: 2188, "RFI ISSUED": 437, "RETURNED UNPROCESSED": 99, "PENDING REDETERMINATION": 31 } },
});

describe("parsePwdQueueDoc", () => {
  it("reads the days, the filings and the mix", () => {
    const d = parsePwdQueueDoc(DOC)!;
    expect(d.days).toHaveLength(7);
    expect(d.filedByDay[0]).toEqual(["2026-10-24", 56]);
    expect(d.mix!.byStatus["IN PROCESS"]).toBe(46549);
  });
  it("says nothing for a missing or broken document", () => {
    expect(parsePwdQueueDoc(null)).toBeNull();
    expect(parsePwdQueueDoc("{")).toBeNull();
    expect(parsePwdQueueDoc(JSON.stringify({ asOf: "2026-10-31", days: [] }))).toBeNull();
  });
});

describe("catchingUp", () => {
  it("takes the newest day DOL worked, and the newest seven days", () => {
    const f = catchingUp(parsePwdQueueDoc(DOC)!)!;
    expect(f.day).toEqual({ from: "2026-10-30", to: "2026-10-30", out: 760, issued: 751, withdrawn: 7, filed: 663 });
    expect(f.week.from).toBe("2026-10-24");
    expect(f.week.out).toBe(1 + 730 + 750 + 845 + 423 + 760);
    expect(f.week.filed).toBe(56 + 19 + 568 + 662 + 582 + 491 + 663);
  });
  it("leaves the split out when the older document didn't carry it", () => {
    const old = JSON.parse(DOC);
    old.days = old.days.map((d: { date: string; n: number }) => ({ date: d.date, n: d.n }));
    const f = catchingUp(parsePwdQueueDoc(JSON.stringify(old))!)!;
    expect(f.day.issued).toBeNull();
    expect(f.day.out).toBe(760);
  });
  it("says which way it's going", () => {
    expect(flowVerdict({ from: "", to: "", out: 760, issued: null, withdrawn: null, filed: 663 })).toEqual({
      tone: "good",
      text: "Gaining ground: 97 more left the line than joined it",
    });
    expect(flowVerdict({ from: "", to: "", out: 100, issued: null, withdrawn: null, filed: 150 }).tone).toBe("bad");
    expect(flowVerdict({ from: "", to: "", out: 5, issued: null, withdrawn: null, filed: 5 }).tone).toBe("flat");
  });
});

describe("outcomeMix", () => {
  it("groups the statuses and gives the shares of the requests that ended", () => {
    const m = outcomeMix(parsePwdQueueDoc(DOC)!)!;
    expect(m.waiting).toBe(46549 + 31);
    expect(m.rfi).toBe(437);
    expect(m.issued).toBe(28484);
    expect(m.withdrawn).toBe(2188);
    expect(m.other).toBe(99);
    expect(m.closed).toBe(28484 + 2188 + 99);
    expect(m.issuedShare).toBeCloseTo(28484 / 30771, 6);
  });
  it("is null without the mix", () => {
    const d = JSON.parse(DOC);
    delete d.mix;
    expect(outcomeMix(parsePwdQueueDoc(JSON.stringify(d))!)).toBeNull();
  });
});

describe("wait trends", () => {
  const TREND = JSON.stringify({
    asOf: "2026-10-31",
    filesThrough: "2026-06-30",
    months: [
      { m: "2025-06", n: 17707, p25: 100, p50: 118, p75: 140, from: "files" },
      { m: "2026-05", n: 11675, p25: 70, p50: 78, p75: 92, from: "files" },
      { m: "2026-06", n: 11996, p25: 72, p50: 84, p75: 99, from: "files" },
      { m: "bad", n: 1, p25: 1, p50: 1, p75: 1 },
      { m: "2026-10", n: 600, p25: 90, p50: 95, p75: 101, from: "sweep", partial: true },
    ],
  });
  it("reads the months in order and drops a malformed one", () => {
    const t = parseWaitTrend(TREND)!;
    expect(t.months.map((m) => m.m)).toEqual(["2025-06", "2026-05", "2026-06", "2026-10"]);
    expect(t.months[3]).toMatchObject({ from: "sweep", partial: true });
  });
  it("compares the newest whole month with the same month a year before", () => {
    const y = yearOnYear(parseWaitTrend(TREND)!)!;
    expect(y.now.m).toBe("2026-06");
    expect(y.then.m).toBe("2025-06");
  });
  it("answers whether it's getting faster, within 5% reading as the same", () => {
    const at = (p50: number, m: string) => ({ m, n: 1, p25: p50, p50, p75: p50, from: "files" as const });
    expect(speedVerdict(yearOnYear(parseWaitTrend(TREND)!)!)).toMatchObject({
      tone: "good",
      answer: "Yes: 34 days faster than a year ago.",
      short: "34 days faster than a year ago",
    });
    expect(speedVerdict({ now: at(130, "2026-06"), then: at(118, "2025-06") })).toMatchObject({
      tone: "bad",
      short: "12 days slower than a year ago",
    });
    expect(speedVerdict({ now: at(122, "2026-06"), then: at(118, "2025-06") }).tone).toBe("flat");
    expect(speedVerdict({ now: at(113, "2026-06"), then: at(118, "2025-06") }).tone).toBe("flat");
    expect(speedVerdict({ now: at(112, "2026-06"), then: at(118, "2025-06") }).tone).toBe("good");
  });
  it("needs two months", () => {
    expect(parseWaitTrend(JSON.stringify({ asOf: "x", filesThrough: "y", months: [{ m: "2026-01", n: 1, p25: 1, p50: 1, p75: 1 }] }))).toBeNull();
  });
  it("draws a month with no reading as a gap, never a zero", () => {
    const s = monthSeries(parseWaitTrend(TREND)!);
    expect(s.map((m) => m.m)).toEqual([
      "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]);
    expect(s.filter((m) => m.gap).length).toBe(17 - 4);
    expect(s[0]).toMatchObject({ m: "2025-06", p50: 118 });
  });
});
