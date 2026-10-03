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
