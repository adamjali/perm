import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one, exec: vi.fn() }));

const r = await import("../visaRefusals");

const doc = { years: [2022, 2023, 2024], newest: 2024, totals: { "2024": { iv_found: 273845 } }, changedOn: "2026-11-05" };

describe("visa refusal reads", () => {
  beforeEach(() => {
    rows.mockReset();
    one.mockReset();
    rows.mockResolvedValue([]);
    one.mockResolvedValue({ json: JSON.stringify(doc) });
  });

  it("reads State's not applicable as null, never 0, and keeps State's order", async () => {
    rows.mockResolvedValueOnce([
      { fy: "2024", line: "63", ground_code: "214(b)", ground: "Failure to establish", iv_found: null, iv_overcome: null, niv_found: "3010544", niv_overcome: "11910" },
    ]);
    const got = await r.refusalsYear(2024);
    expect(rows.mock.calls[0]![0]).toMatch(/ORDER BY line/);
    expect(got).toEqual([
      { fy: 2024, line: 63, code: "214(b)", ground: "Failure to establish", ivFound: null, ivOvercome: null, nivFound: 3010544, nivOvercome: 11910 },
    ]);
  });

  it("asks for the grounds followed across the years by code", async () => {
    await r.refusalsByCode(["212(a)(4)", "221(g)"]);
    expect(rows.mock.calls[0]![1]).toEqual(["212(a)(4)", "221(g)"]);
  });

  it("fills a summary written before it named gaps", async () => {
    expect((await r.refusalSummary())?.knownGaps).toEqual({});
  });

  it("is null before the first load, empty for a missing table, and a failure for a failed read", async () => {
    one.mockResolvedValueOnce(null);
    expect(await r.refusalSummary()).toBeNull();
    rows.mockRejectedValueOnce(new Error("no such table: visa_refusals"));
    expect(await r.refusalsYear(2024)).toEqual([]);
    rows.mockRejectedValueOnce(new Error("fetch failed"));
    await expect(r.refusalsByCode(["212(a)(4)"])).rejects.toThrow("fetch failed");
    one.mockResolvedValueOnce({ json: "nope" });
    await expect(r.refusalSummary()).rejects.toThrow("unreadable");
  });
});
