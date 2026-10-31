import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusHistory } from "../StatusHistory";

const at = (day: string, hourEt: number) => Date.parse(`${day}T${String(hourEt + 4).padStart(2, "0")}:00:00Z`);

describe("StatusHistory", () => {
  it("draws each status with its day, its length and which is now", () => {
    const { container } = render(
      <StatusHistory
        events={[
          { at: at("2026-09-30", 10), from: "ANALYST REVIEW", to: "RFI ISSUED" },
          { at: at("2026-11-03", 15), from: "RFI ISSUED", to: "ANALYST REVIEW" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Every status DOL has shown" })).toBeInTheDocument();
    const text = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(text).toContain("By Aug 29, 2026 Analyst Review");
    expect(text).toContain("Sep 30, 2026 RFI Issued Held for 34 days");
    expect(text).toContain("Nov 3, 2026 Analyst Review (now)");
  });

  it("renders nothing for a case that hasn't changed on our record", () => {
    const { container } = render(<StatusHistory events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
