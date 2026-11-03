import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FilingRows } from "../FilingRows";

describe("FilingRows", () => {
  it("keeps a row's wage outside the job's ellipsis on a phone", () => {
    render(
      <FilingRows
        withWage
        rows={[{ caseNumber: "P-100-25246-282507", job: "Senior Production Engineer, Infrastructure", wage: "$161,637 per year", date: "2026-01-08", status: "DETERMINATION ISSUED" }]}
      />,
    );
    const job = screen.getByTitle("Senior Production Engineer, Infrastructure");
    expect(job.className).toContain("truncate");
    const phoneWage = screen.getAllByText("$161,637 per year").find((el) => el.className.includes("sm:hidden"));
    expect(phoneWage).toBeDefined();
    expect(job.contains(phoneWage!)).toBe(false);
    expect(phoneWage!.className).toContain("shrink-0");
  });

  it("links each case number to its live status", () => {
    render(<FilingRows rows={[{ caseNumber: "G-100-26012-553242", job: "Production Engineer", date: "2026-01-12", status: "RFI ISSUED" }]} />);
    expect(screen.getByRole("link", { name: "G-100-26012-553242" }).getAttribute("href")).toBe("/perm-case-status?case=G-100-26012-553242");
  });
});
