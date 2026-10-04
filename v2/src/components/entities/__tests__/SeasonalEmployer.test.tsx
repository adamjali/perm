/**
 * The page for an employer whose only filings are H-2A, H-2B or CW-1.
 *
 * It must show the record we hold and nothing from the PERM page's model: no
 * approval rate, no rank, no median days, not even as a dash. Every figure it
 * prints has to come from a case it can link.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  SeasonalEmployerCase,
  SeasonalEmployerFigures,
  SeasonalEmployerRecord,
} from "@/lib/turso/seasonalEmployers";

// An async server component; its own test covers it.
vi.mock("@/components/data/DataProvenance", () => ({ DataProvenance: () => null }));

const { SeasonalEmployer } = await import("../SeasonalEmployer");

const record: SeasonalEmployerRecord = {
  slug: "shore-crabs",
  name: "Shore Crabs LLC",
  cases: 3,
  h2a: 0,
  h2b: 2,
  cw1: 1,
  firstFiled: "2025-07-19",
  lastChanged: "2026-04-10",
};

const figures: SeasonalEmployerFigures = {
  published: 2,
  pending: 1,
  workersCertified: 40,
  medianHourlyWage: 16.08,
  hourlyN: 2,
};

function kase(over: Partial<SeasonalEmployerCase>): SeasonalEmployerCase {
  return {
    caseNumber: "H-400-26100-000001",
    form: "H-2B application",
    status: "IN PROCESS",
    isFinal: false,
    source: "live",
    filed: "2026-04-10",
    decided: null,
    jobTitle: "Crab picker",
    workers: null,
    workersCertified: null,
    wage: null,
    wageUnit: null,
    worksiteCity: null,
    worksiteState: null,
    ...over,
  };
}

const cases = [
  kase({}),
  kase({
    caseNumber: "H-400-25300-000002",
    status: "Determination Issued - Certification",
    isFinal: true,
    source: "file",
    filed: "2025-10-27",
    decided: "2025-12-01",
    workers: 40,
    workersCertified: 38,
    wage: 16.08,
    wageUnit: "HOUR",
    worksiteCity: "HOOPERS ISLAND",
    worksiteState: "md",
  }),
];

function page(more = false) {
  return render(<SeasonalEmployer record={record} figures={figures} cases={cases} more={more} asOf="2026-10-03" />);
}

describe("SeasonalEmployer", () => {
  it("leads with the name and counts its filings by visa", () => {
    page();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Shore Crabs LLC");
    expect(screen.getByText(/the first filed July 19, 2025/)).toBeInTheDocument();
    expect(screen.getByText("2 H-2B, 1 CW-1")).toBeInTheDocument();
    expect(screen.getByText(/3 H-2B and CW-1 filings in DOL/)).toBeInTheDocument();
    expect(screen.getByText("$16.08 an hour")).toBeInTheDocument();
  });

  it("prints nothing from the PERM page's model", () => {
    const { container } = page();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/approval rate|approved|rank|median days|#\d/i);
  });

  it("links every case to its lookup and says what the file printed once decided", () => {
    page();
    const link = screen.getByRole("link", { name: "H-400-25300-000002" });
    expect(link.getAttribute("href")).toBe("/perm-case-status?case=H-400-25300-000002");
    expect(screen.getByText("Certification")).toBeInTheDocument();
    expect(screen.getByText(/38 of 40 workers certified/)).toBeInTheDocument();
    expect(screen.getByText(/Hoopers Island, MD/)).toBeInTheDocument();
    // The live status reads in sentence case, not DOL's capitals.
    expect(screen.getByText("In process")).toBeInTheDocument();
  });

  it("says when the list is cut, and where the rest are", () => {
    page(true);
    expect(screen.getByRole("heading", { name: "The newest 2 filings" })).toBeInTheDocument();
    const rest = screen.getByRole("link", { name: "Every filing under this name" });
    expect(rest.getAttribute("href")).toBe("/case-search?q=Shore%20Crabs%20LLC");
  });

  it("names the whole list when nothing is cut", () => {
    page(false);
    expect(screen.getByRole("heading", { name: "All 2 filings" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Every filing under this name" })).toBeNull();
  });

  it("keeps a space between adjacent pieces of text, for anything that reads the DOM", () => {
    const { container } = page();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/[a-z0-9.)][A-Z][a-z]+ [a-z]/);
    expect(text).not.toMatch(/2026Waiting/);
    expect(text).not.toMatch(/Shore Crabs LLC\d/);
    expect(text).not.toMatch(/H-400-26100-000001H-2B/);
    expect(text).not.toMatch(/Filings we hold3/);
  });
});
