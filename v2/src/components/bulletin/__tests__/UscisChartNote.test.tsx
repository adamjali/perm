import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { UscisChartNote } from "../UscisChartNote";

const charts = { month: "2026-11", employment: "Final Action Dates" as const, family: "Dates for Filing" as const };

describe("UscisChartNote", () => {
  it("names the chart USCIS accepts for each kind of filing, and links USCIS's notice", () => {
    render(<UscisChartNote charts={charts} />);
    expect(screen.getByRole("heading", { name: "Filing an I-485 in November 2026" })).toBeTruthy();
    expect(screen.getByText("Final Action Dates chart")).toBeTruthy();
    expect(screen.getByText("Dates for Filing chart")).toBeTruthy();
    expect(screen.getByRole("link", { name: "USCIS's notice for November 2026" }).getAttribute("href")).toContain("uscis.gov");
    expect(screen.getByText(/Applying through a consulate abroad\?/)).toBeTruthy();
  });

  it("shows one kind alone when asked", () => {
    render(<UscisChartNote charts={charts} only="family" />);
    expect(screen.queryByText("Final Action Dates chart")).toBeNull();
    expect(screen.getByText("Dates for Filing chart")).toBeTruthy();
  });

  it("draws nothing for a month USCIS's notice doesn't name, or without the notice", () => {
    const { container } = render(<UscisChartNote charts={charts} month="2026-10" />);
    expect(container.innerHTML).toBe("");
    const { container: none } = render(<UscisChartNote charts={null} />);
    expect(none.innerHTML).toBe("");
  });

  it("draws nothing when the notice gave no chart for the kind asked", () => {
    const { container } = render(<UscisChartNote charts={{ ...charts, employment: null }} only="employment" />);
    expect(container.innerHTML).toBe("");
  });
});
