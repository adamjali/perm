import { describe, expect, it } from "vitest";

import { likelyCapExempt } from "../capExempt";

/** The cap-exempt inference fires only when most coded filings name a college or university. */
describe("likelyCapExempt", () => {
  const uni = { key: "611310", label: "Colleges, Universities, and Professional Schools", n: 60 };

  it("fires at a majority of filings under 611310", () => {
    expect(likelyCapExempt([uni, { key: "541511", label: "Custom Computer Programming Services", n: 40 }])).toMatchObject({ n: 60, share: 0.6 });
  });

  it("stays quiet under half, or with another education code", () => {
    expect(likelyCapExempt([{ ...uni, n: 40 }, { key: "541511", label: "x", n: 60 }])).toBeNull();
    expect(likelyCapExempt([{ key: "611710", label: "Educational Support Services", n: 90 }])).toBeNull();
    expect(likelyCapExempt([])).toBeNull();
    expect(likelyCapExempt(null)).toBeNull();
  });
});
