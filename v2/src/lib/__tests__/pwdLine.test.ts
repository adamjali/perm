import { describe, expect, it } from "vitest";
import { lineSentence, lineWait, sweepPwdLine, waitPhrase } from "../pwdLine";

// Oct 30 2026's real counts (filed, still waiting): DOL had decided every busy
// day through Jul 24 and was working through Jul 27.
const DOC = JSON.stringify({
  asOf: "2026-10-30",
  byDay: [["2026-07-23", 47], ["2026-07-24", 82], ["2026-07-25", 6], ["2026-07-26", 15], ["2026-07-27", 336], ["2026-07-28", 717]],
  days: [],
  filedByDay: [["2026-07-23", 683], ["2026-07-24", 710], ["2026-07-25", 76], ["2026-07-26", 57], ["2026-07-27", 565], ["2026-07-28", 747]],
});

describe("sweepPwdLine", () => {
  it("names the earliest busy day DOL hasn't decided half of, skipping quiet days", () => {
    const line = sweepPwdLine(DOC)!;
    expect(line.day).toBe("2026-07-27");
    expect(line.filed).toBe(565);
    expect(line.decidedShare).toBeCloseTo(229 / 565, 5);
    expect(line.before).toEqual({ day: "2026-07-24", decidedShare: (710 - 82) / 710 });
    expect(line.waitDays).toBe(95);
  });

  it("says nothing when the record starts inside the waiting part, or is missing its counts", () => {
    expect(sweepPwdLine(JSON.stringify({ asOf: "2026-10-30", byDay: [["2026-08-01", 700]], filedByDay: [["2026-08-01", 710]] }))).toBeNull();
    expect(sweepPwdLine(JSON.stringify({ asOf: "2026-10-30", byDay: [] }))).toBeNull();
    expect(sweepPwdLine("not json")).toBeNull();
    expect(sweepPwdLine(null)).toBeNull();
  });

  it("says nothing when every busy day is decided", () => {
    expect(sweepPwdLine(JSON.stringify({ asOf: "2026-10-30", byDay: [], filedByDay: [["2026-07-01", 500], ["2026-07-02", 500]] }))).toBeNull();
  });
});

describe("waitPhrase", () => {
  it("speaks months from two months on, weeks below", () => {
    expect(waitPhrase(95)).toBe("about 3 months");
    expect(waitPhrase(107)).toBe("about 3.5 months");
    expect(waitPhrase(30)).toBe("about 4 weeks");
    expect(waitPhrase(3)).toBe("about 1 week");
  });
});

describe("lineSentence and lineWait", () => {
  const line = sweepPwdLine(DOC)!;
  it("leads with our check and names DOL's own dated month after it", () => {
    expect(lineSentence(line, { frontier: "June 2026", asOf: "September 30, 2026" })).toBe(
      "By our daily check of DOL's case status on October 30, 2026, DOL is deciding PERM wage requests filed on July 27, 2026, about 3 months after they were filed. DOL's own table, dated September 30, 2026, names June 2026.",
    );
  });
  it("says only our check when DOL's table can't be read", () => {
    expect(lineSentence(line, { frontier: null, asOf: null })).not.toContain("DOL's own table");
  });
  it("gives the wait with the day it was measured", () => {
    expect(lineWait(line)).toBe("about 3 months as of October 30, 2026");
  });
});
