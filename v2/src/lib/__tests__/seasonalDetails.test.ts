import { describe, expect, it } from "vitest";

import {
  h2aDecideBy,
  publishedGranted,
  publishedStatusLabel,
  wagePhrase,
  worksitePhrase,
} from "../seasonalDetails";

describe("seasonal details", () => {
  it("says a wage with its unit, cents only when there are any", () => {
    expect(wagePhrase(15.51, "HOUR")).toBe("$15.51 an hour");
    expect(wagePhrase(2058.31, "MONTH")).toBe("$2,058.31 a month");
    expect(wagePhrase(18, "Hour")).toBe("$18 an hour");
    expect(wagePhrase(3.5, "PIECE RATE")).toBe("$3.50 a piece");
    expect(wagePhrase(900, "BI-WEEKLY")).toBe("$900 every two weeks");
  });

  it("refuses a wage that isn't one, and leaves an unknown unit unsaid", () => {
    expect(wagePhrase(null, "HOUR")).toBeNull();
    expect(wagePhrase(0, "HOUR")).toBeNull();
    expect(wagePhrase(12, "FORTNIGHT")).toBe("$12");
  });

  it("drops DOL's 'Determination Issued' prefix from a published status", () => {
    expect(publishedStatusLabel("DETERMINATION ISSUED - CERTIFICATION (EXPIRED)")).toBe("Certification (expired)");
    expect(publishedStatusLabel("DETERMINATION ISSUED - DENIED")).toBe("Denied");
    expect(publishedStatusLabel("WITHDRAWN")).toBe("Withdrawn");
  });

  it("calls a certification, partial or returned, a grant, and a withdrawn one not", () => {
    expect(publishedGranted("DETERMINATION ISSUED - PARTIAL CERTIFICATION")).toBe(true);
    expect(publishedGranted("DETERMINATION ISSUED - CERTIFICATION (RETURNED)")).toBe(true);
    expect(publishedGranted("DETERMINATION ISSUED - DENIED")).toBe(false);
    expect(publishedGranted("FULL CERTIFICATION - WITHDRAWN")).toBe(false);
  });

  it("names the worksite from what the record has", () => {
    expect(worksitePhrase("DANIELSVILLE", "Madison", "ga")).toBe("Danielsville, Madison County, GA");
    expect(worksitePhrase("Saipan", null, "MP")).toBe("Saipan, MP");
    expect(worksitePhrase(null, null, null)).toBeNull();
  });

  it("never doubles the division word DOL already printed", () => {
    expect(worksitePhrase("SANDBORN", "KNOX COUNTY", "IN")).toBe("Sandborn, Knox County, IN");
    expect(worksitePhrase("Crowley", "ACADIA PARISH", "LA")).toBe("Crowley, Acadia Parish, LA");
    expect(worksitePhrase(null, "CAPITOL PLANNING REGION", "CT")).toBe("Capitol Planning Region, CT");
    expect(worksitePhrase(null, "Kenai Peninsula Borough", "AK")).toBe("Kenai Peninsula Borough, AK");
  });

  it("puts the H-2A decision 30 days before the first date of need (20 CFR 655.160)", () => {
    expect(h2aDecideBy("2026-11-27")).toBe("2026-10-28");
    expect(h2aDecideBy("2027-03-01")).toBe("2027-01-30");
    expect(h2aDecideBy("not a date")).toBeNull();
    expect(h2aDecideBy(null)).toBeNull();
  });
});

describe("a decision DOL's file holds on a case its live service calls in process", () => {
  it("is decided only for the rule's statuses, and only with a published decision", async () => {
    const { decidedInFileOnly } = await import("../seasonalDetails");
    expect(decidedInFileOnly("IN PROCESS", "2025-12-09")).toBe(true);
    expect(decidedInFileOnly(" in process ", "2025-12-09")).toBe(true);
    expect(decidedInFileOnly("IN PROCESS", null)).toBe(false);
    // An appeal re-opens a decided case for real: the file's old decision is not the answer.
    expect(decidedInFileOnly("PENDING APPEAL", "2025-12-09")).toBe(false);
  });

  it("uses the same statuses as the sweep that marks such a case finished", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { SETTLED_BY_FILE_STATUSES } = await import("../seasonalDetails");
    const src = readFileSync(join(process.cwd(), "scripts/ingest_pwd_status_direct.py"), "utf8");
    const m = /"settled_by_file": \{"statuses": \(([^)]*)\)/.exec(src);
    expect(m, "settled_by_file rule not found in the sweep").not.toBeNull();
    const py = new Set([...m![1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!));
    expect(py).toEqual(new Set(SETTLED_BY_FILE_STATUSES));
  });
});
