import { describe, expect, it } from "vitest";

import { approvalFacet, sizeFacet } from "../entityColumns";
import type { EntityRow } from "@/lib/entityPayload";

const e = (certified: number, denied: number, total = certified + denied) =>
  ({ certified, denied, total }) as unknown as EntityRow;

describe("entity index facets", () => {
  it("bands the approval rate above the rating floor, and names the rest as too few", () => {
    expect(approvalFacet.value(e(99, 1))).toBe("99");
    expect(approvalFacet.value(e(96, 4))).toBe("95");
    expect(approvalFacet.value(e(91, 9))).toBe("90");
    expect(approvalFacet.value(e(80, 20))).toBe("under");
    expect(approvalFacet.value(e(10, 0))).toBe("few");
    expect(approvalFacet.format?.("few")).toMatch(/Too few decided/);
  });

  it("bands size by filings, with no dash in the labels", () => {
    expect(sizeFacet.value(e(0, 0, 3))).toBe("1");
    expect(sizeFacet.value(e(0, 0, 49))).toBe("5");
    expect(sizeFacet.value(e(0, 0, 500))).toBe("500");
    for (const v of ["1", "5", "50", "500"]) expect(sizeFacet.format?.(v)).not.toMatch(/[–—]/);
  });
});
