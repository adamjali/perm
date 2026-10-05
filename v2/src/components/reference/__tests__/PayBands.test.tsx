import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PayBands, bandDomain, type PayBand } from "../PayBands";

const sj: PayBand = {
  key: "41940",
  label: "San Jose",
  tipLabel: "San Jose",
  p10: 138420,
  p25: 173650,
  median: 213110,
  p75: 226080,
  p90: 289150,
  levels: [152797, 187075, 221374, 255653],
};

describe("PayBands", () => {
  it("spans every mark on one rounded domain", () => {
    const [lo, hi] = bandDomain([sj, { ...sj, key: "us", p10: 82460, p90: 214670, levels: null, perm: 160000 }])!;
    expect(lo).toBeLessThanOrEqual(82460);
    expect(hi).toBeGreaterThanOrEqual(289150);
    expect(lo % 1000).toBe(0);
    expect(hi % 1000).toBe(0);
  });

  it("has no domain and draws nothing without a figure", () => {
    const empty = { ...sj, p10: null, p25: null, median: null, p75: null, p90: null, levels: null };
    expect(bandDomain([empty])).toBeNull();
    const { container } = render(<PayBands bands={[empty]} label="x" />);
    expect(container.innerHTML).toBe("");
  });

  it("puts every figure in the mark's tooltip, DOL's levels by name", () => {
    const { container } = render(<PayBands bands={[sj]} label="Pay" />);
    const tip = container.querySelector("[data-tip]")?.getAttribute("data-tip") ?? "";
    expect(tip).toContain("Median: $213,110");
    expect(tip).toContain("DOL Level II: $187,075");
    expect(tip).toContain("DOL Level IV: $255,653");
  });

  it("keys the PERM marker only when a PERM median is given", () => {
    const without = render(<PayBands bands={[sj]} label="Pay" />);
    expect(without.container.textContent).not.toContain("median PERM offer");
    const withPerm = render(<PayBands bands={[{ ...sj, perm: 160000 }]} label="Pay" />);
    expect(withPerm.container.textContent).toContain("median PERM offer");
    expect(withPerm.container.textContent).toContain("Levels I to IV");
  });
});
