import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaycheckProtection, drawWords } from "@/components/entities/PaycheckProtection";

const loan = (id: string, amount: number, forgiven: number | null, jobs: number | null, draw: string) => ({
  loan: id, name: "SUMTER COATINGS, INC.", city: "Sumter", state: "SC", approved: "2020-05-01", amount, forgiven, jobs, draw,
});

describe("PaycheckProtection", () => {
  it("totals SBA's loans and names the most jobs the borrower reported", () => {
    render(<PaycheckProtection rows={[loan("1", 769359, 773553, 62, "PPP"), loan("2", 500000, null, 58, "PPS")]} pageName="Sumter Coatings" />);
    expect(screen.getByRole("heading", { name: "Paycheck Protection Program loans" })).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).toContain("SBA approved 2 loans to Sumter Coatings in 2020 and 2021, $1,269,359 in all, $773,553 of it forgiven.");
    expect(text).toContain("The borrower reported 62 jobs at the time, at most.");
    expect(text).toContain("not a count SBA checked");
  });

  it("renders nothing for a page with none, and names each draw", () => {
    const { container } = render(<PaycheckProtection rows={[]} pageName="X" />);
    expect(container.innerHTML).toBe("");
    expect(drawWords("PPP")).toBe("first-draw loan");
    expect(drawWords("PPS")).toBe("second-draw loan");
    expect(drawWords(null)).toBe("loan");
  });
});
