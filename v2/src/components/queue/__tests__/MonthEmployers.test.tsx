import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { MonthEmployers } from "../MonthEmployers";

const top = Array.from({ length: 12 }, (_, i) => ({
  name: `Employer ${i + 1}`,
  slug: i === 2 ? null : `employer-${i + 1}`,
  filed: 1200 - i * 50,
  decided: i === 0 ? 0 : i === 1 ? 1150 : 300,
}));

describe("MonthEmployers", () => {
  it("names the month and how many employers filed in it", () => {
    render(<MonthEmployers label="January 2026" top={top} total={4105} />);
    expect(screen.getByRole("heading", { name: "Who filed the most in January 2026" })).toBeTruthy();
    expect(screen.getByText(/The 12 busiest of the 4,105 employers/)).toBeTruthy();
  });

  it("links an employer to its page only when it has one", () => {
    render(<MonthEmployers label="January 2026" top={top} total={4105} />);
    expect(screen.getByRole("link", { name: "Employer 1" }).getAttribute("href")).toBe("/perm-employers/employer-1");
    expect(screen.queryByRole("link", { name: "Employer 3" })).toBeNull();
    expect(screen.getByText("Employer 3")).toBeTruthy();
  });

  it("says what's decided in words", () => {
    render(<MonthEmployers label="January 2026" top={top} total={4105} />);
    expect(screen.getByText("None decided yet")).toBeTruthy();
    expect(screen.getByText("All decided")).toBeTruthy();
    expect(screen.getAllByText("300 decided, 750 waiting").length).toBe(1);
  });

  it("shows ten and folds the rest", () => {
    const { container } = render(<MonthEmployers label="January 2026" top={top} total={4105} />);
    const details = container.querySelector("details")!;
    expect(details.querySelector("summary")!.textContent).toBe("2 more");
    expect(details.querySelectorAll("li").length).toBe(2);
    expect(container.querySelectorAll("li").length).toBe(12);
  });

  it("draws nothing without employers", () => {
    const { container } = render(<MonthEmployers label="January 2026" top={[]} total={0} />);
    expect(container.innerHTML).toBe("");
  });
});
