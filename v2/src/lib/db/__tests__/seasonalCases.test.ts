import { describe, expect, it, vi } from "vitest";
import { pythonFinalSet } from "./pythonFinalSet";

/**
 * The H-2A and H-2B program: its numbers, and its final set pinned to the
 * Python ingest's, the same way the PWD and LCA programs are.
 */

vi.mock("server-only", () => ({}));
vi.mock("../client", () => ({ rows: vi.fn(), one: vi.fn(), exec: vi.fn() }));

const { SEASONAL_FINAL_STATUSES, normaliseSeasonalCaseNumber } = await import("../seasonalCases");
const { normalisePwdCaseNumber } = await import("../pwdCases");

describe("H-2A and H-2B numbers", () => {
  it("takes H-300, H-400, P-400 and P-500 and nothing else", () => {
    expect(normaliseSeasonalCaseNumber(" h-300-26272-266803 ")).toBe("H-300-26272-266803");
    expect(normaliseSeasonalCaseNumber("H-400-26050-650195")).toBe("H-400-26050-650195");
    expect(normaliseSeasonalCaseNumber("P-400-26272-268643")).toBe("P-400-26272-268643");
    expect(normaliseSeasonalCaseNumber("P-500-26146-946655")).toBe("P-500-26146-946655");
    expect(normaliseSeasonalCaseNumber("P-100-26240-200135")).toBeNull();
    expect(normaliseSeasonalCaseNumber("P-200-26181-067725")).toBeNull();
    expect(normaliseSeasonalCaseNumber("G-100-26240-200246")).toBeNull();
    expect(normaliseSeasonalCaseNumber("H-200-26272-266803")).toBeNull();
  });

  it("takes the H-2A job order and the CW-1 application too", () => {
    // Both on the same counter; DOL answers them as H-2A and CW-1 (Oct 3 2026).
    expect(normaliseSeasonalCaseNumber("jo-a-300-26271-264525")).toBe("JO-A-300-26271-264525");
    expect(normaliseSeasonalCaseNumber("C-500-26271-263466")).toBe("C-500-26271-263466");
    expect(normaliseSeasonalCaseNumber("JO-A-200-26271-264525")).toBeNull();
  });

  it("names each form, the job order's eight-character code included", async () => {
    const { seasonalForm } = await import("@/lib/seasonalForms");
    expect(seasonalForm("JO-A-300-26271-264525")?.label).toBe("H-2A job order");
    expect(seasonalForm("C-500-26271-263466")?.label).toBe("CW-1 application");
    expect(seasonalForm("H-300-26272-266803")?.label).toBe("H-2A application");
    expect(seasonalForm("G-100-26240-200246")).toBeNull();
  });

  it("is never read as a PERM-queue wage request", () => {
    // Until Oct 1 2026 the PWD rule took any P-###, so an H-2B wage request
    // was looked up, and recorded, under the ETA-9141 queue PERM waits in.
    expect(normalisePwdCaseNumber("P-400-26272-268643")).toBeNull();
    expect(normalisePwdCaseNumber("P-500-26146-946655")).toBeNull();
    expect(normalisePwdCaseNumber("P-100-26240-200135")).toBe("P-100-26240-200135");
    // H-1B, H-1B1 and E-3 wage requests share the PERM queue (Oct 3 2026).
    expect(normalisePwdCaseNumber("P-200-26181-067725")).toBe("P-200-26181-067725");
    expect(normalisePwdCaseNumber("P-203-26146-948740")).toBe("P-203-26146-948740");
  });

  it("mirrors the Python ingest's final set byte for byte", () => {
    expect(pythonFinalSet("seasonal")).toEqual(new Set(SEASONAL_FINAL_STATUSES));
  });
});

const { one } = (await import("../client")) as unknown as { one: ReturnType<typeof vi.fn> };
const { lookupSeasonalRecord, lookupSeasonalPosting, getSeasonalPublishedSummary } = await import("../seasonalCases");

describe("the published record and the accepted job", () => {
  it("reads an application's row from seasonal_cases, workers and period included", async () => {
    one.mockReset();
    one.mockResolvedValueOnce({
      case_number: "H-300-25301-000123", case_status: "DETERMINATION ISSUED - PARTIAL CERTIFICATION",
      received_date: "2025-10-28", decision_date: "2025-11-20", employer_name: "MCRP Farms",
      employer_slug: "mcrp-farms", job_title: "Farmworker", soc_title: "Farmworkers", wage: "17.5",
      wage_unit: "Hour", worksite_city: "Danielsville", worksite_state: "GA", attorney_name: null,
      visa_class: "H-2A", source_file: "H-2A_Disclosure_Data_FY2026_Q4.xlsx", workers: "40",
      workers_certified: 35, begin_date: "2026-01-02", end_date: "2026-11-01", worksite_county: "Madison",
    });
    const r = await lookupSeasonalRecord("h-300-25301-000123");
    expect(one.mock.calls[0]?.[0]).toMatch(/FROM seasonal_cases WHERE case_number = \?/);
    expect(one.mock.calls[0]?.[0]).toContain("workers_certified");
    expect(r).toMatchObject({ wage: 17.5, workers: 40, workersCertified: 35, worksiteCounty: "Madison", attorneyName: null });
  });

  it("reads an H-2B or CW-1 wage request from the prevailing wage file, which has no workers", async () => {
    one.mockReset();
    one.mockResolvedValueOnce(null);
    await lookupSeasonalRecord("P-400-26272-268643");
    expect(one.mock.calls[0]?.[0]).toMatch(/FROM pwd_cases WHERE case_number = \?/);
    expect(one.mock.calls[0]?.[0]).not.toContain("workers");
  });

  it("asks nothing for a job order, which has no published file, and degrades to null on a read error", async () => {
    one.mockReset();
    expect(await lookupSeasonalRecord("JO-A-300-26271-264525")).toBeNull();
    expect(one).not.toHaveBeenCalled();
    one.mockRejectedValueOnce(new Error("no such table: seasonal_cases"));
    expect(await lookupSeasonalRecord("H-400-26050-650195")).toBeNull();
  });

  it("reads the accepted job for applications and job orders, never for a wage request", async () => {
    one.mockReset();
    one.mockResolvedValueOnce({ case_number: "JO-A-300-26271-264525", feed: "jo", employer_name: "MCRP Farms",
      workers: 12, wage: 16.08, wage_unit: "Hour", accepted_date: "2026-09-30" });
    const p = await lookupSeasonalPosting("JO-A-300-26271-264525");
    expect(one.mock.calls[0]?.[0]).toMatch(/FROM seasonal_postings WHERE case_number = \?/);
    expect(p).toMatchObject({ feed: "jo", workers: 12, wage: 16.08, acceptedDate: "2026-09-30", pwdNumber: null });
    one.mockReset();
    expect(await lookupSeasonalPosting("P-400-26272-268643")).toBeNull();
    expect(one).not.toHaveBeenCalled();
  });

  it("lists one summary per loaded visa and leaves out a visa with no rows", async () => {
    one.mockReset();
    one.mockImplementation(async (_sql: string, args: unknown[]) => {
      const key = String(args[0]);
      if (key.endsWith("h2a")) return { json: JSON.stringify({ rows: 20638, latestDecision: "2025-09-30", files: { "a.xlsx": 20638 } }), computed_at: 1 };
      if (key.endsWith("h2b")) return { json: JSON.stringify({ rows: 0, files: {} }), computed_at: 1 };
      return null;
    });
    const out = await getSeasonalPublishedSummary();
    expect(out.map((x) => x.visa)).toEqual(["H-2A"]);
    one.mockReset();
  });
});
