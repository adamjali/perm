import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { parseCaseNumber } from "@/lib/permCaseNumber";
import { CaseNumberPlate } from "../CaseNumberPlate";

const parsed = parseCaseNumber("G-100-26125-868956")!;

describe("CaseNumberPlate", () => {
  it("reads the middle digits as a date, in English", () => {
    const { container } = render(<CaseNumberPlate parsed={parsed} />);
    expect(screen.getByText("Day of year")).toBeInTheDocument();
    expect(container.textContent).toContain("The middle five digits are a date: day 125 of 2026, which is May 5, 2026.");
    expect(container.textContent).toContain("The G is PERM");
  });

  it("states a disagreement with DOL's record instead of hiding it", () => {
    const { container } = render(<CaseNumberPlate parsed={parsed} recordedFilingDate="2026-05-06" />);
    expect(container.textContent).toContain("one or two days off that, at May 6, 2026, and the record");
  });

  it("speaks a translated page's language, dates in its own form", () => {
    const { container } = render(<CaseNumberPlate parsed={parsed} recordedFilingDate="2026-05-06" lang="es" />);
    expect(screen.getByText("Día del año")).toBeInTheDocument();
    expect(container.textContent).toContain("el día 125 de 2026, es decir, el 5 de mayo de 2026.");
    expect(container.textContent).toContain("el 6 de mayo de 2026, y ese registro");
  });

  it("keeps the case number's segments as printed in any language", () => {
    render(<CaseNumberPlate parsed={parsed} lang="ko" />);
    expect(screen.getByText("일련번호")).toBeInTheDocument();
    expect(screen.getByText("868956")).toBeInTheDocument();
    expect(screen.getByText("G-100")).toBeInTheDocument();
  });
});
