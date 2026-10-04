import { describe, expect, it } from "vitest";

import { addDaysIso, eadExtension } from "../eadExtension";

const base = { cardExpires: "2025-12-15", renewalReceived: "2025-09-01", category: "C09", sameCategory: true };

describe("automatic EAD extension (8 CFR 274a.13(d) and (e))", () => {
  it("extends up to 540 days, counted from the day after the card's date", () => {
    expect(eadExtension(base)).toEqual({ kind: "extended", through: "2027-06-08", byI94: false });
    expect(addDaysIso("2025-12-15", 540)).toBe("2027-06-08");
  });

  it("extends nothing for a renewal received on or after October 30, 2025", () => {
    expect(eadExtension({ ...base, renewalReceived: "2025-10-30" })).toEqual({ kind: "after-cutoff" });
    expect(eadExtension({ ...base, renewalReceived: "2025-10-29" }).kind).toBe("extended");
  });

  it("requires the renewal to be received before the card expired", () => {
    expect(eadExtension({ ...base, cardExpires: "2025-08-01" })).toEqual({ kind: "filed-late" });
    expect(eadExtension({ ...base, cardExpires: "2025-09-01" })).toEqual({ kind: "filed-late" });
  });

  it("needs a listed category, and the same one as the card", () => {
    expect(eadExtension({ ...base, category: "C03" })).toEqual({ kind: "not-eligible" });
    expect(eadExtension({ ...base, sameCategory: false })).toEqual({ kind: "different-category" });
  });

  it("ends an H-4, L-2 or E spouse's extension on the I-94's date when that's sooner", () => {
    expect(eadExtension({ ...base, category: "C26", i94Until: "2026-03-01" })).toEqual({
      kind: "extended", through: "2026-03-01", byI94: true,
    });
    expect(eadExtension({ ...base, category: "C26", i94Until: "2028-01-01" })).toEqual({
      kind: "extended", through: "2027-06-08", byI94: false,
    });
  });

  it("leaves TPS to its Federal Register notice, and says when nothing was filed", () => {
    expect(eadExtension({ ...base, category: "A12" })).toEqual({ kind: "tps" });
    expect(eadExtension({ ...base, renewalReceived: null })).toEqual({ kind: "no-renewal" });
  });
});
