import { describe, expect, it } from "vitest";
import { mergeHalves, unifiedRows } from "../flagMerge";
import type { FlagCaseRow, FlagDisclosedRow } from "@/lib/turso/flagCases";

const live = (caseNumber: string, filingDate: string, status = "IN PROCESS"): FlagCaseRow => ({
  caseNumber,
  filingDate,
  status,
  isFinal: status !== "IN PROCESS",
  employerName: "Acme",
  employerSlug: "acme",
  jobTitle: "Engineer",
  visaType: "PERM",
  submittedDate: null,
  firstSeenAt: null,
  lastCheckedAt: null,
});
const file = (caseNumber: string, receivedDate: string, wage: number | null = 100000): FlagDisclosedRow => ({
  caseNumber,
  status: "DETERMINATION ISSUED",
  receivedDate,
  decisionDate: "2026-06-30",
  employerName: "Acme",
  employerSlug: "acme",
  jobTitle: "Engineer",
  socCode: null,
  socTitle: null,
  wage,
  wageUnit: "YEAR",
  worksiteState: "CA",
  visaClass: "PERM",
  fiscalYear: 2026,
});

describe("mergeHalves", () => {
  it("a case in both halves is one row with the file's wage; a file-only case is listed apart", () => {
    const { wages, fileOnly } = mergeHalves([live("P-1", "2026-03-01")], [file("P-1", "2026-03-01"), file("P-0", "2025-12-01")]);
    expect([...wages.keys()]).toEqual(["P-1"]);
    expect(fileOnly.map((r) => r.caseNumber)).toEqual(["P-0"]);
  });
});

describe("unifiedRows", () => {
  it("is newest first across both halves, live before file on a tie, and capped", () => {
    const rows = unifiedRows(
      [live("P-3", "2026-03-01"), live("P-1", "2026-01-01")],
      [file("P-3", "2026-03-01", 150000), file("P-2", "2026-02-01"), file("P-3b", "2026-03-01")],
      3,
    );
    expect(rows.map((r) => `${r.caseNumber}:${r.source}`)).toEqual(["P-3:live", "P-3b:file", "P-2:file"]);
    expect(rows[0]).toMatchObject({ wage: 150000, wageUnit: "YEAR", status: "IN PROCESS" });
  });

  it("a live row without a file match carries no wage rather than a guessed one", () => {
    const [r] = unifiedRows([live("P-9", "2026-08-01")], [], 5);
    expect(r).toMatchObject({ wage: null, wageUnit: null, source: "live" });
  });
});
