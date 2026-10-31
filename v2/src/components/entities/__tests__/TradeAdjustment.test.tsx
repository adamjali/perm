import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TradeAdjustment, isCertified, outcomeWords } from "@/components/entities/TradeAdjustment";

const p = (petition: string, code: string | null, decided: string, workers: number | null) => ({
  petition, name: "Oracle America Inc.", city: "Hillsboro", state: "OR", code, decided, workers, product: "Software",
});

describe("TradeAdjustment", () => {
  it("counts certified and denied petitions in DOL's words, with the workers DOL estimated", () => {
    render(<TradeAdjustment rows={[p("1", "C2", "2022-06-16", 92), p("2", "D", "2019-03-01", 40), p("3", "C1", "2015-01-05", 10)]} pageName="Oracle America" />);
    expect(screen.getByRole("heading", { name: "Jobs lost to imports or work moved abroad" })).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).toContain("petitioned DOL for Trade Adjustment Assistance 3 times (2015 to 2022).");
    expect(text).toContain("DOL certified 2, covering an estimated 102 workers and denied 1.");
    expect(text).toContain("Certified: work moved abroad or bought from abroad");
    expect(text).toContain("stopped taking petitions on July 1 2022");
  });

  it("renders nothing for a page with none", () => {
    const { container } = render(<TradeAdjustment rows={[]} pageName="X" />);
    expect(container.innerHTML).toBe("");
  });

  it("never gives a meaning to a code DOL's dictionary doesn't list", () => {
    expect(outcomeWords("ZZ")).toBe("DOL's code ZZ");
    expect(isCertified("ZZ")).toBe(false);
    expect(isCertified("P")).toBe(true);
    expect(isCertified("T")).toBe(false);
  });
});
