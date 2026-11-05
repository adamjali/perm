import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApprovalBar } from "../ApprovalBar";
import { approvalRate } from "@/lib/approvalRate";

const META = {
  totalCases: 373939,
  firstDecisionDate: "2023-10-01",
  lastDecisionDate: "2026-06-30",
  byStatus: [
    { status: "certified", count: 343773 },
    { status: "denied", count: 11357 },
    { status: "withdrawn", count: 18809 },
  ],
};

describe("ApprovalBar", () => {
  it("draws the three outcomes and one dated line, not the long sentences", () => {
    const { container } = render(<ApprovalBar parts={approvalRate(META, [])!.parts} />);
    const text = container.textContent ?? "";
    expect(text).toContain("91.9% certified");
    expect(text).toContain("3.0% denied");
    expect(text).toContain("5.0% withdrawn");
    expect(text).toContain("Of the 373,939 PERM cases DOL decided from October 2023 to June 2026, by its own files.");
    expect(text).not.toContain("withdrawals included");
    expect(container.querySelectorAll('[aria-hidden="true"] > div')).toHaveLength(3);
  });
});
