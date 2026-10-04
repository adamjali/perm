import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FirmPrograms } from "../FirmPrograms";

const data = {
  spellings: 3,
  lca: {
    filings: 527135,
    certified: 510877,
    firstDecided: "2020-01-02",
    lastDecided: "2026-06-30",
    employers: [
      { name: "Apple Inc.", slug: "apple-inc", filings: 32377 },
      { name: "Some Client LLC", slug: null, filings: 12 },
    ],
  },
  pwd: null,
};

describe("FirmPrograms", () => {
  it("shows the count, the certified share, the decided span and the employers, linking only those with a page", () => {
    render(<FirmPrograms name="Fragomen" data={data} />);
    expect(screen.getByText("527,135")).toBeInTheDocument();
    expect(screen.getByText(/97% certified/)).toBeInTheDocument();
    expect(screen.getByText("Decided from January 2020 to June 2026.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apple Inc." }).getAttribute("href")).toBe("/perm-employers/apple-inc");
    expect(screen.queryByRole("link", { name: "Some Client LLC" })).toBeNull();
    expect(screen.getByText(/under 3 spellings of its name/)).toBeInTheDocument();
  });

  it("is absent when no filing names the firm", () => {
    const { container } = render(<FirmPrograms name="Small" data={null} />);
    expect(container.textContent).toBe("");
  });

  it("keeps a space between adjacent pieces of text", () => {
    const { container } = render(<FirmPrograms name="Fragomen" data={data} />);
    expect(container.textContent).not.toMatch(/Apple Inc\.32,377|527,135LCAs/);
  });
});
