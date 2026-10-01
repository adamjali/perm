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
  it("takes H-300, H-400 and P-400 and nothing else", () => {
    expect(normaliseSeasonalCaseNumber(" h-300-26272-266803 ")).toBe("H-300-26272-266803");
    expect(normaliseSeasonalCaseNumber("H-400-26050-650195")).toBe("H-400-26050-650195");
    expect(normaliseSeasonalCaseNumber("P-400-26272-268643")).toBe("P-400-26272-268643");
    expect(normaliseSeasonalCaseNumber("P-100-26240-200135")).toBeNull();
    expect(normaliseSeasonalCaseNumber("G-100-26240-200246")).toBeNull();
    expect(normaliseSeasonalCaseNumber("H-200-26272-266803")).toBeNull();
  });

  it("is never read as a PERM-queue wage request", () => {
    // Until Oct 1 2026 the PWD rule took any P-###, so an H-2B wage request
    // was looked up, and recorded, under the ETA-9141 queue PERM waits in.
    expect(normalisePwdCaseNumber("P-400-26272-268643")).toBeNull();
    expect(normalisePwdCaseNumber("P-100-26240-200135")).toBe("P-100-26240-200135");
  });

  it("mirrors the Python ingest's final set byte for byte", () => {
    expect(pythonFinalSet("seasonal")).toEqual(new Set(SEASONAL_FINAL_STATUSES));
  });
});
