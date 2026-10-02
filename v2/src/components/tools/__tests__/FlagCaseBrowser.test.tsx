// @vitest-environment jsdom
/**
 * The wage-request and LCA search: its filters narrow the loaded rows across
 * both halves, a filter on a file-only field drops a filing still in process,
 * and the wage-request search can widen past PERM requests on the API's own
 * `visa=all`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { FlagCaseRow, FlagDisclosedRow } from "@/lib/turso/flagCases";

const usePublicQuery = vi.fn();
vi.mock("@/hooks/usePublicQuery", () => ({ usePublicQuery }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("q=acme"),
  useRouter: () => ({ push: vi.fn() }),
}));

const { FlagCaseBrowser, LCA_PROGRAM, PWD_PROGRAM } = await import("../FlagCaseBrowser");

function live(caseNumber: string, status: string): FlagCaseRow {
  return {
    caseNumber, filingDate: "2026-08-01", status, isFinal: status !== "IN PROCESS",
    employerName: "ACME", employerSlug: "acme", jobTitle: "Engineer", lastCheckedAt: null,
  } as FlagCaseRow;
}

function file(caseNumber: string, state: string, visa: string): FlagDisclosedRow {
  return {
    caseNumber, status: "Certified", receivedDate: "2025-01-01", decisionDate: "2025-01-08",
    employerName: "ACME", employerSlug: "acme", jobTitle: "Engineer", socCode: "15-1252.00",
    socTitle: "Software Developers", wage: 120000, wageUnit: "Year", worksiteState: state,
    visaClass: visa, fiscalYear: 2025, attorneyName: null, attorneySlug: null,
  };
}

const SEARCH = {
  cases: [live("I-200-26213-000001", "IN PROCESS")],
  disclosed: [file("I-200-25001-000002", "WA", "H-1B"), file("I-200-25001-000003", "CA", "E-3")],
};

beforeEach(() => {
  usePublicQuery.mockReset();
  usePublicQuery.mockImplementation((url: string) =>
    typeof url === "string" && url.includes("action=search")
      ? { data: SEARCH, failed: false }
      : { data: { rows: [], isDone: true, continueCursor: "0" }, failed: false },
  );
});

describe("FlagCaseBrowser search filters", () => {
  it("narrows both halves, and a file-only filter drops a filing still in process", () => {
    render(<FlagCaseBrowser summary={null} program={LCA_PROGRAM} />);
    expect(screen.getByText("I-200-26213-000001")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Worksite state"), { target: { value: "CA" } });
    expect(screen.getByText("I-200-25001-000003")).toBeInTheDocument();
    expect(screen.queryByText("I-200-25001-000002")).not.toBeInTheDocument();
    expect(screen.queryByText("I-200-26213-000001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear these filters" }));
    expect(screen.getByText("I-200-26213-000001")).toBeInTheDocument();
  });

  it("offers visa class only when the loaded rows carry more than one", () => {
    render(<FlagCaseBrowser summary={null} program={LCA_PROGRAM} />);
    fireEvent.change(screen.getByLabelText("Visa class"), { target: { value: "E-3" } });
    expect(screen.getByText("I-200-25001-000003")).toBeInTheDocument();
    expect(screen.queryByText("I-200-25001-000002")).not.toBeInTheDocument();
  });

  it("widens a wage-request search past PERM requests, and the LCA search has no such box", () => {
    const { unmount } = render(<FlagCaseBrowser summary={null} program={LCA_PROGRAM} />);
    expect(screen.queryByLabelText(/other visas/)).not.toBeInTheDocument();
    unmount();
    render(<FlagCaseBrowser summary={null} program={PWD_PROGRAM} />);
    fireEvent.click(screen.getByLabelText(/other visas/));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const urls = usePublicQuery.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("action=search") && u.includes("visa=all"))).toBe(true);
  });

  it("asks the list for the oldest filings first when chosen", () => {
    render(<FlagCaseBrowser summary={null} program={PWD_PROGRAM} />);
    fireEvent.change(screen.getByLabelText("Order"), { target: { value: "oldest" } });
    const urls = usePublicQuery.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("action=list") && u.includes("order=oldest"))).toBe(true);
  });
});
