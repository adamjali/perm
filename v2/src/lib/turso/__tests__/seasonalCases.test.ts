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
