/**
 * Quick Stats shows each figure at once, never a 0 stand-in.
 *
 * The panel used to count up from 0 when it scrolled into view. When the case
 * data arrived after that, the counter reset to 0 with its observer already
 * disconnected, so a live case could read "0 days left" on a wage
 * determination good for another nine months (Sep 28 2026).
 */
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { addDays, format } from "date-fns";
import { renderWithProviders } from "../../../../../test-utils/render-utils";
import { QuickStatsPanel } from "../QuickStatsPanel";
import type { CaseDetailData } from "../case-detail-types";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

describe("QuickStatsPanel", () => {
  it("shows the days left on the wage determination, not 0", () => {
    const caseData = {
      _id: "case-1",
      createdAt: addDays(new Date(), -40).getTime(),
      pwdFilingDate: iso(addDays(new Date(), -120)),
      pwdDeterminationDate: iso(addDays(new Date(), -45)),
      pwdExpirationDate: iso(addDays(new Date(), 200)),
    } as unknown as CaseDetailData;

    const { container } = renderWithProviders(<QuickStatsPanel caseData={caseData} />);

    const values = [...container.querySelectorAll(".stat-val")].map((el) => Number(el.textContent));
    // PWD expiry (199 or 200 depending on the hour) and case age (40).
    expect(values[0]).toBeGreaterThanOrEqual(199);
    expect(values[1]).toBe(40);
    expect(screen.getByText("PWD Expiry")).toBeInTheDocument();
  });
});
