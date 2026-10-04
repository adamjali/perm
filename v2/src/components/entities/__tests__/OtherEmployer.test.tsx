/**
 * The page for an employer with no PERM record: H-1B LCAs, wage requests, or
 * H-2A, H-2B and CW-1 filings only.
 *
 * It must show the record we hold and nothing from the PERM page's model: no
 * approval rate, no rank, no median days, not even as a dash. Every figure it
 * prints has to come from a filing it can link.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OtherEmployerRecord } from "@/lib/turso/otherEmployers";
import type { SeasonalEmployerCase } from "@/lib/turso/seasonalEmployers";

// An async server component; its own test covers it.
vi.mock("@/components/data/DataProvenance", () => ({ DataProvenance: () => null }));

const { OtherEmployer } = await import("../OtherEmployer");

const record: OtherEmployerRecord = {
  slug: "shore-crabs",
  name: "Shore Crabs LLC",
  cases: 5,
  perm: 0,
  lca: 2,
  pwd: 0,
  h2a: 0,
  h2b: 2,
  cw1: 1,
  firstFiled: "2025-07-19",
  lastChanged: "2026-04-10",
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

function page(over: Partial<OtherEmployerRecord> = {}, more = false, pending: number | null = 1) {
  return render(
    <OtherEmployer
      record={{ ...record, ...over }}
      pending={pending}
      ledger={<div>LEDGER</div>}
      filings={<div>FILINGS</div>}
      seasonalCases={cases}
      seasonalMore={more}
      seasonalAsOf="2026-10-03"
      h1b={<div>H1B</div>}
    />,
  );
}

describe("OtherEmployer", () => {
  it("leads with the name and counts its filings by program", () => {
    page();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Shore Crabs LLC");
    expect(screen.getByText(/the first filed July 19, 2025/)).toBeInTheDocument();
    expect(screen.getAllByText(/2 H-1B LCAs, 2 H-2B filings and 1 CW-1 filing/).length).toBeGreaterThan(0);
    expect(screen.getByText(/No PERM green-card case under this name/)).toBeInTheDocument();
  });

  it("says when its PERM filings are only in DOL's older files", () => {
    page({ perm: 3 });
    expect(screen.getByText(/It also filed 3 PERM cases in DOL's FY2016 to FY2023 files, and none since\./)).toBeInTheDocument();
  });

  it("says the live count is unknown rather than zero when the live record couldn't be read", () => {
    page({}, false, null);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText(/couldn't be read just now/)).toBeInTheDocument();
  });

  it("prints nothing from the PERM page's model", () => {
    const { container } = page();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/approval rate|approved|rank|median days|#\d/i);
  });

  it("renders the ledger, the lists and the H-1B sections it is given", () => {
    page();
    for (const slot of ["LEDGER", "FILINGS", "H1B"]) expect(screen.getByText(slot)).toBeInTheDocument();
  });

  it("links every seasonal case to its lookup and says what the file printed once decided", () => {
    page();
    const link = screen.getByRole("link", { name: "H-400-25300-000002" });
    expect(link.getAttribute("href")).toBe("/perm-case-status?case=H-400-25300-000002");
    expect(screen.getByText("Certification")).toBeInTheDocument();
    expect(screen.getByText(/38 of 40 workers certified/)).toBeInTheDocument();
    expect(screen.getByText(/Hoopers Island, MD/)).toBeInTheDocument();
    expect(screen.getByText("In process")).toBeInTheDocument();
  });

  it("shows no seasonal list for an employer that files none", () => {
    page({ h2b: 0, cw1: 0, cases: 2 });
    expect(screen.queryByRole("link", { name: "H-400-25300-000002" })).toBeNull();
  });

  it("says when the seasonal list is cut, and where the rest are", () => {
    page({}, true);
    expect(screen.getByRole("heading", { name: "Its newest 2 H-2A, H-2B and CW-1 filings" })).toBeInTheDocument();
    const rest = screen.getByRole("link", { name: "Every seasonal filing under this name" });
    expect(rest.getAttribute("href")).toBe("/seasonal-cases?q=Shore%20Crabs%20LLC");
  });

  it("keeps a space between adjacent pieces of text, for anything that reads the DOM", () => {
    const { container } = page();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/2026Waiting/);
    expect(text).not.toMatch(/Shore Crabs LLC\d/);
    expect(text).not.toMatch(/H-400-26100-000001H-2B/);
    expect(text).not.toMatch(/Filings we hold5/);
    expect(text).not.toMatch(/LEDGERFILINGS/);
  });
});
