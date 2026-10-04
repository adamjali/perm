import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CityH1b } from "../CityH1b";

const city = {
  key: "BOISE|ID", slug: "boise-id", label: "Boise, ID", total: 1200, certified: 1100, fyFrom: 2020, fyTo: 2026, since: 2024,
  employers: [{ slug: "micron", name: "Micron Technology, Inc.", n: 300 }, { slug: null, name: "Small Shop LLC", n: 5 }],
  occupations: [{ code: "15-1252", title: "Software Developers", slug: "software-developers", n: 400 }],
  hasPermPage: false,
};

describe("CityH1b", () => {
  it("counts the LCAs, the certified share, and links what has a page", () => {
    render(<CityH1b city={city} />);
    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(screen.getByText(/FY2020 to FY2026/)).toBeInTheDocument();
    expect(screen.getByText(/certified 1,100 \(92%\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Micron Technology, Inc." }).getAttribute("href")).toBe("/perm-employers/micron");
    expect(screen.queryByRole("link", { name: "Small Shop LLC" })).toBeNull();
    expect(screen.getByRole("link", { name: "Software Developers" }).getAttribute("href")).toBe("/perm-wages/software-developers");
    expect(screen.getAllByText(/since FY2024/).length).toBe(2);
  });

  it("says an LCA counts positions offered, not people hired", () => {
    render(<CityH1b city={city} />);
    expect(screen.getByText(/counts positions offered, not people hired/)).toBeInTheDocument();
  });

  it("is absent with no record", () => {
    expect(render(<CityH1b city={null} />).container.textContent).toBe("");
  });
});
