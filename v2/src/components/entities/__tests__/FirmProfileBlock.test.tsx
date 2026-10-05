import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FirmProfileBlock, type PublishedFirmProfile } from "../FirmProfileBlock";

const PROFILE: PublishedFirmProfile = {
  website: "https://www.smithlaw.com/",
  description: "A small firm.\n\nWe file PERM cases.",
  languages: ["Spanish", "Mandarin"],
  offices: [{ city: "Tampa", state: "FL" }],
  focus: ["perm", "eb2niw"],
  verifiedBy: "domain",
  updatedAt: Date.UTC(2026, 9, 5, 16),
};

describe("FirmProfileBlock", () => {
  it("renders nothing without a profile", () => {
    const { container } = render(<FirmProfileBlock firmName="Smith Immigration PLLC" profile={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("says whose words these are and how the firm proved it", () => {
    render(<FirmProfileBlock firmName="Smith Immigration PLLC" profile={PROFILE} />);
    expect(screen.getByRole("heading", { name: "From the firm" })).toBeTruthy();
    expect(screen.getByText("In Smith Immigration PLLC's own words")).toBeTruthy();
    expect(screen.getByText(/domain DOL's own filings list/)).toBeTruthy();
    expect(screen.getByText(/We don't check what it says/)).toBeTruthy();
    expect(screen.getByText("EB-2 NIW")).toBeTruthy();
    expect(screen.getByText("Tampa, Florida")).toBeTruthy();
  });

  it("marks the website as the firm's own link and opens it safely", () => {
    render(<FirmProfileBlock firmName="Smith Immigration PLLC" profile={PROFILE} />);
    const link = screen.getByRole("link", { name: /smithlaw\.com/ });
    expect(link.getAttribute("href")).toBe("https://www.smithlaw.com/");
    const rel = link.getAttribute("rel") ?? "";
    for (const r of ["nofollow", "ugc", "noopener"]) expect(rel.split(" ")).toContain(r);
  });

  it("says a person checked a hand-approved claim", () => {
    render(<FirmProfileBlock firmName="Smith Immigration PLLC" profile={{ ...PROFILE, verifiedBy: "admin" }} />);
    expect(screen.getByText(/checked by hand/)).toBeTruthy();
  });
});
