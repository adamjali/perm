// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { CaseListRow } from "../CaseListRow";
import type { CaseCardData } from "@convex/lib/caseListTypes";

function row(overrides?: Partial<CaseCardData>): CaseCardData {
  return {
    _id: "row-id" as any,
    employerName: "Acme Corp",
    positionTitle: "QA Engineer",
    caseStatus: "pwd",
    progressStatus: "working",
    isFavorite: false,
    isProfessionalOccupation: false,
    hasActiveRfi: false,
    hasActiveRfe: false,
    calendarSyncEnabled: false,
    dates: { created: Date.now(), updated: Date.now() },
    ...overrides,
  } as CaseCardData;
}

describe("CaseListRow", () => {
  it("shows an open case's progress chip", () => {
    renderWithProviders(<CaseListRow caseData={row()} />);
    expect(screen.getByText("Working on it")).toBeInTheDocument();
  });

  // Oct 30 2026: closed cases read "Working on it" and "Approved" in the list
  // while their cards said "Closed Jun 3, 2026: Recruitment window missed".
  it("says when and why a closed case closed, never its old progress chip", () => {
    renderWithProviders(
      <CaseListRow
        caseData={row({ caseStatus: "closed", closedAt: "2026-06-03", closedReason: "recruitment_window_missed" } as Partial<CaseCardData>)}
      />,
    );
    expect(screen.queryByText("Working on it")).not.toBeInTheDocument();
    expect(screen.getByText(/^Closed .*2026/)).toBeInTheDocument();
  });
});
