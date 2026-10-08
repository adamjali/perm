import { describe, expect, it } from "vitest";

import { parseGroupTiming, pickGroup } from "../h2bGroups";
import { awaitingFirstDecision, parseSeasonalCheck, timingView } from "../seasonalTiming";

const DOC = JSON.stringify({
  asOf: "2026-10-08",
  peaks: {
    "2027-01": { applications: 11000, groups: { A: { cases: 2300, decided: 0 }, B: { cases: 1200, decided: 0 }, C: { cases: 1100, decided: 0 } } },
  },
  estimates: {
    "2027-01": {
      previous: "2026-01",
      scale: 1.093,
      groups: {
        A: { p10: 30, p25: 35, p50: 41, p75: 49, p90: 55, basis: "last season's groups" },
        C: { p10: 72, p25: 79, p50: 78, p75: 81, p90: 90, basis: "last season's groups" },
        B: { p10: 50, p25: "x", p50: 63, p75: 69, p90: 77, basis: "last season's groups" },
      },
    },
  },
});

describe("pickGroup", () => {
  const doc = parseGroupTiming(DOC);

  it("names the group, how many there are, both seasons and the change in applications", () => {
    expect(pickGroup(doc, "2027-01", "A")).toEqual({
      letter: "A", of: 3, season: "January 2027", previous: "January 2026", morePercent: 9,
      days: { p10: 30, p25: 35, p50: 41, p75: 49, p90: 55, basis: "last season's groups" },
    });
  });

  it("gives nothing for a malformed group, an unknown group or a season with no estimate", () => {
    expect(pickGroup(doc, "2027-01", "B")).toBeNull();
    expect(pickGroup(doc, "2027-01", "Z")).toBeNull();
    expect(pickGroup(doc, "2026-07", "A")).toBeNull();
    expect(parseGroupTiming("{")).toBeNull();
  });
});

describe("timingView with a group", () => {
  const doc = parseGroupTiming(DOC);
  const group = pickGroup(doc, "2027-01", "A");

  it("dates an H-2B application by its group, counted from filing", () => {
    const v = timingView({ caseNumber: "H-400-27001-000001", filingDate: "2027-01-01", firstDay: null, today: "2027-01-08", timing: null, group });
    expect(v?.group?.letter).toBe("A");
    expect([v?.from, v?.typical, v?.to]).toEqual(["2027-02-05", "2027-02-11", "2027-02-19"]);
    expect(v?.basis).toBe("filed");
  });

  it("ignores a group on anything but an H-2B application", () => {
    const v = timingView({ caseNumber: "H-300-27001-000001", filingDate: "2027-01-01", firstDay: null, today: "2027-01-08", timing: null, group });
    expect(v).toBeNull();
  });
});

describe("parseSeasonalCheck reads the group test", () => {
  it("takes the newest finished season", () => {
    const c = parseSeasonalCheck(JSON.stringify({
      visas: {},
      h2bGroups: [
        { season: "2025-07", decided: 900, groups: { middleHalfShare: 0.4, typicalMissDays: 7 } },
        { season: "2026-01", decided: 8198, groups: { middleHalfShare: 0.434, typicalMissDays: 5 } },
      ],
    }));
    expect(c?.groups).toEqual({ share: 0.434, cases: 8198, quarters: 1, typicalMissDays: 5, season: "2026-01" });
  });
});

describe("awaitingFirstDecision", () => {
  it("is false after a first decision: an appeal or a post-certification request", () => {
    expect(["IN PROCESS", "ACCEPTED - PENDING RECRUITMENT", "NOD ISSUED", "NRM ISSUED"].every(awaitingFirstDecision)).toBe(true);
    expect(["PENDING APPEAL", "Post-Cert Request Pending"].some(awaitingFirstDecision)).toBe(false);
  });
});
