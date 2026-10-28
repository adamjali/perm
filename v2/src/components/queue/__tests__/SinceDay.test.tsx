import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { statusShift } from "@/lib/backlogMonths";

import { SINCE_SHOWN, SinceDay, signed, sinceLead } from "../SinceDay";

const s = (status: string, count: number, isFinal = false) => ({ status, count, isFinal });

describe("SinceDay", () => {
  it("names the day, leads with what DOL decided and the filings found, and signs every change", () => {
    const shift = statusShift([s("ANALYST REVIEW", 9710), s("CERTIFIED", 4290, true)], [s("ANALYST REVIEW", 10000), s("CERTIFIED", 4000, true)]);
    expect(sinceLead(shift)).toBe("290 decided");
    render(<SinceDay shift={shift} since="2026-10-27" hrefFor={(st) => (st === "ANALYST REVIEW" ? "/case-search?stage=analyst-review" : null)} />);
    expect(screen.getByText(/^Since the end of Tuesday, Oct 27/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Analyst Review\s+\u2212290/ }).getAttribute("href")).toBe("/case-search?stage=analyst-review");
    // A decided status has no single list to open, so its tile is not a link.
    expect(screen.queryByRole("link", { name: /Certified/ })).toBeNull();
    expect(screen.getByText("+290")).toBeTruthy();
  });

  it("says nothing moved on a quiet day", () => {
    render(<SinceDay shift={statusShift([s("ANALYST REVIEW", 5)], [s("ANALYST REVIEW", 5)])} since="2026-10-27" />);
    expect(screen.getByText(/no status moved/)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("counts reopened cases and new filings in words", () => {
    expect(sinceLead(statusShift([s("RECONSIDERATION APPEALS", 3), s("ANALYST REVIEW", 12)], [s("DENIED", 3, true)]))).toBe("3 reopened, 12 more filings on record");
    expect(signed(-1200)).toBe("−1,200");
  });

  it("shows the largest moves and counts the rest instead of dropping them", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H"].map((l, i) => s(`STATUS ${l}`, i + 1));
    render(<SinceDay shift={statusShift(names, [])} since="2026-10-27" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(SINCE_SHOWN);
    expect(screen.getByText(`${names.length - SINCE_SHOWN} more statuses moved by fewer.`)).toBeTruthy();
  });
});
