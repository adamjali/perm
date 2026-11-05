import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one, exec: vi.fn() }));

const niv = await import("../nivIssuances");

const summary = {
  json: JSON.stringify({ months: ["2025-03", "2026-02"], newest: "2026-02", totalByMonth: {}, classByMonth: {} }),
};

describe("nonimmigrant issuance reads", () => {
  beforeEach(() => {
    rows.mockReset();
    one.mockReset();
    rows.mockResolvedValue([]);
    one.mockResolvedValue(summary);
  });

  it("reads a post's 12 months to State's newest table, by its key", async () => {
    rows.mockResolvedValueOnce([
      { month: "2026-02", visa_class: "H1B", n: "7" },
      { month: "2026-02", visa_class: "K1", n: "3" },
      { month: "2025-12", visa_class: "H1B", n: "5" },
    ]);
    const got = await niv.postNiv("mumbai");
    expect(rows.mock.calls[0]![1]).toEqual(["mumbai", "2025-03", "2026-02"]);
    expect(got?.months).toHaveLength(12);
    // Only the months whose table is loaded are held; the rest draw as gaps, never as zeros.
    expect(got?.held).toEqual(["2025-03", "2026-02"]);
    expect(got?.byMonth.get("2026-02")).toEqual({ H1B: 7, K1: 3 });
  });

  it("has nothing before the first load", async () => {
    one.mockResolvedValueOnce(null);
    expect(await niv.postNiv("mumbai")).toBeNull();
    expect(rows).not.toHaveBeenCalled();
  });

  it("reads an empty table as empty, and a failed read as a failure", async () => {
    rows.mockRejectedValueOnce(new Error("SQLITE_ERROR: no such table: niv_issuances"));
    expect(await niv.classesByPost("2026-02", ["H1B"])).toEqual([]);
    rows.mockRejectedValueOnce(new Error("fetch failed"));
    await expect(niv.classesByPost("2026-02", ["H1B"])).rejects.toThrow("fetch failed");
    one.mockRejectedValueOnce(new Error("fetch failed"));
    await expect(niv.nivSummary()).rejects.toThrow("fetch failed");
  });

  it("asks for the classes ranked, in one month, as numbers", async () => {
    rows.mockResolvedValueOnce([{ post_key: "manila", post: "Manila", visa_class: "K1", n: "376" }]);
    const got = await niv.classesByPost("2026-02", ["H1B", "L1", "K1"]);
    expect(rows.mock.calls[0]![1]).toEqual(["H1B", "L1", "K1", "2026-02"]);
    expect(got).toEqual([{ post_key: "manila", post: "Manila", visa_class: "K1", n: 376 }]);
  });

  it("refuses an unreadable summary rather than guessing", async () => {
    one.mockResolvedValueOnce({ json: "{" });
    await expect(niv.nivSummary()).rejects.toThrow("unreadable");
  });
});
