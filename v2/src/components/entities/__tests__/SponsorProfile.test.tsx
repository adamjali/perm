import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SponsorProfile } from "../SponsorProfile";

describe("SponsorProfile", () => {
  it("shows each part with its count and its rank, and the facts as sentences", () => {
    render(
      <SponsorProfile
        parts={[{ id: "uscis_rate", label: "USCIS H-1B approval rate, last 3 fiscal years", value: 0.9867, n: 15987, pct: 0.5093, of: 5742 }]}
        facts={[{ id: "willful", lcas: 4 }]}
      />,
    );
    expect(screen.getByText("98.7%")).toBeInTheDocument();
    expect(screen.getByText("of 15,987 USCIS decisions")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Higher than 51% of the 5,742 sponsors with 20 or more USCIS decisions." })).toBeInTheDocument();
    expect(screen.getByText("It declared itself a willful violator on 4 LCAs.")).toBeInTheDocument();
  });

  it("is absent with nothing to show", () => {
    const { container } = render(<SponsorProfile parts={[]} facts={[]} />);
    expect(container.textContent).toBe("");
  });

  it("names no single score anywhere", () => {
    const { container } = render(
      <SponsorProfile parts={[{ id: "lca_24m", label: "H-1B LCAs certified in the last 24 months", value: 2191, n: 2191, pct: 0.9989, of: 27859 }]} facts={[]} />,
    );
    expect(container.textContent).not.toMatch(/\bgrade\b|\brating\b|out of 10/i);
  });
});
