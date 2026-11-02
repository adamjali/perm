import { describe, expect, it } from "vitest";

import {
  lookaheadEnd,
  lookbackStart,
  mergePermCases,
  mergeWageRequests,
  permWindowStart,
  WAGE_REQUESTS_SHOWN,
  wageIssued,
} from "../employerWageRequests";

describe("lookbackStart", () => {
  it("goes back 30 months to the first of that month, across years", () => {
    expect(lookbackStart("2026-01-15")).toBe("2023-07-01");
    expect(lookbackStart("2026-07-31")).toBe("2024-01-01");
    expect(lookbackStart("2026-07-31", 1)).toBe("2026-06-01");
  });

  it("has no start for a date it can't read", () => {
    expect(lookbackStart("January 2026")).toBeNull();
  });
});

describe("mergeWageRequests", () => {
  it("joins one request's two records: today's status from the live one, the wage and decision from the file", () => {
    const out = mergeWageRequests(
      [{ caseNumber: "P-100-25100-000001", status: "DETERMINATION ISSUED", filed: "2025-04-10", jobTitle: "Software Engineer" }],
      [{
        caseNumber: "P-100-25100-000001",
        status: "Determination Issued",
        received: "2025-04-10",
        decided: "2025-08-02",
        jobTitle: "Software Engineer",
        wage: 152_000,
        wageUnit: "Year",
      }],
    );
    expect(out.more).toBe(false);
    expect(out.rows).toEqual([{
      caseNumber: "P-100-25100-000001",
      status: "DETERMINATION ISSUED",
      filed: "2025-04-10",
      decided: "2025-08-02",
      jobTitle: "Software Engineer",
      wage: 152_000,
      wageUnit: "Year",
    }]);
  });

  it("keeps a request only one record holds, newest filed first, and caps the list", () => {
    const live = Array.from({ length: 4 }, (_, i) => ({
      caseNumber: `P-100-25${100 + i}-00000${i}`,
      status: "DETERMINATION ISSUED",
      filed: `2025-0${i + 1}-10`,
      jobTitle: "Analyst",
    }));
    const file = Array.from({ length: 4 }, (_, i) => ({
      caseNumber: `P-100-24${100 + i}-00000${i}`,
      status: "Determination Issued",
      received: `2024-0${i + 1}-10`,
      decided: `2024-0${i + 5}-01`,
      jobTitle: "Analyst",
      wage: 90_000,
      wageUnit: "Year",
    }));
    const out = mergeWageRequests(live, file);
    expect(out.rows).toHaveLength(WAGE_REQUESTS_SHOWN);
    expect(out.more).toBe(true);
    expect(out.rows.map((r) => r.filed)).toEqual(["2025-04-10", "2025-03-10", "2025-02-10", "2025-01-10", "2024-04-10"]);
  });

  it("drops what can't be the case's: no wage issued, or decided after the case was filed", () => {
    const out = mergeWageRequests(
      [
        { caseNumber: "P-100-26002-000001", status: "IN PROCESS", filed: "2026-01-02", jobTitle: "Engineer" },
        { caseNumber: "P-100-26002-000002", status: "WITHDRAWN", filed: "2026-01-02", jobTitle: "Engineer" },
        { caseNumber: "P-100-26002-000003", status: "PENDING REDETERMINATION", filed: "2026-01-02", jobTitle: "Engineer" },
        { caseNumber: "P-100-25300-000004", status: "DETERMINATION ISSUED", filed: "2025-10-27", jobTitle: "Engineer", decided: "2026-02-01" },
        { caseNumber: "P-100-25200-000005", status: "REDETERMINATION MODIFIED", filed: "2025-07-19", jobTitle: "Engineer" },
      ],
      [{
        caseNumber: "P-100-26005-000006",
        status: "Determination Issued",
        received: "2026-01-05",
        decided: "2026-03-24",
        jobTitle: "Engineer",
        wage: 180_710,
        wageUnit: "Year",
      }],
      "2026-01-12",
    );
    // The file's request was decided in March, after the January filing; the live one's decided day (our
    // sweep's) is February. Only the redetermination, with no decision day held, could still be it.
    expect(out.rows.map((r) => r.caseNumber)).toEqual(["P-100-25200-000005"]);
  });

  it("keeps a request decided on the day the case was filed", () => {
    const out = mergeWageRequests(
      [{ caseNumber: "P-100-25300-000001", status: "DETERMINATION ISSUED", filed: "2025-10-27", jobTitle: "Engineer", decided: "2026-01-12" }],
      [],
      "2026-01-12",
    );
    expect(out.rows.map((r) => r.decided)).toEqual(["2026-01-12"]);
  });

  it("reads an issued wage the way DOL prints it, in either record's case", () => {
    expect(["Determination Issued", "REDETERMINATION AFFIRMED", "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION"].every(wageIssued)).toBe(true);
    expect(["IN PROCESS", "WITHDRAWN", "PENDING REDETERMINATION", "PENDING CENTER DIRECTOR REVIEW", "RFI ISSUED", null].some(wageIssued)).toBe(false);
  });
});

describe("the reverse: a wage request's likely PERM cases", () => {
  it("starts on the day DOL issued the wage, the request's own day when that isn't held, and never before a wage", () => {
    expect(permWindowStart({ status: "DETERMINATION ISSUED", decided: "2026-03-24", filed: "2026-01-05" })).toBe("2026-03-24");
    expect(permWindowStart({ status: "DETERMINATION ISSUED", decided: null, filed: "2026-01-05" })).toBe("2026-01-05");
    expect(permWindowStart({ status: "IN PROCESS", decided: null, filed: "2026-01-05" })).toBeNull();
    expect(permWindowStart({ status: "WITHDRAWN", decided: "2026-02-01", filed: "2026-01-05" })).toBeNull();
  });

  it("looks ahead 30 months to the start of the month after", () => {
    expect(lookaheadEnd("2025-04-10")).toBe("2027-11-01");
    expect(lookaheadEnd("bad")).toBeNull();
  });

  it("keeps the live status, adds the file's decision day, newest first", () => {
    const out = mergePermCases(
      [{ caseNumber: "G-100-26012-000002", status: "ANALYST REVIEW", filed: "2026-01-12" }],
      [
        { caseNumber: "G-100-25300-000001", status: "Certified", filed: "2025-10-27", decided: "2026-06-30" },
        { caseNumber: "G-100-26012-000002", status: "Certified", filed: "2026-01-12", decided: null },
      ],
    );
    expect(out.more).toBe(false);
    expect(out.rows.map((r) => [r.caseNumber, r.status, r.decided])).toEqual([
      ["G-100-26012-000002", "ANALYST REVIEW", null],
      ["G-100-25300-000001", "Certified", "2026-06-30"],
    ]);
  });
});
