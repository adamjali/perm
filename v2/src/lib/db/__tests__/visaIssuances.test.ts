import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one, exec: vi.fn() }));

const iv = await import("../visaIssuances");

const summary = { json: JSON.stringify({ months: ["2025-03", "2026-02"], newest: "2026-02", byMonth: {} }) };

describe("visa issuance reads", () => {
  beforeEach(() => {
    rows.mockReset();
    one.mockReset();
    rows.mockResolvedValue([]);
    one.mockResolvedValue(summary);
  });

  it("counts months back across a year boundary", () => {
    expect(iv.monthsBefore("2026-02", 11)).toBe("2025-03");
    expect(iv.monthsBefore("2026-01", 1)).toBe("2025-12");
    expect(iv.monthsBefore("2026-12", 0)).toBe("2026-12");
  });

  it("names a month in words", () => {
    expect(iv.monthName("2026-02")).toBe("February 2026");
  });

  it("sums one country's line over the 12 months to the newest table", async () => {
    rows.mockResolvedValueOnce([
      { group_key: "india", month: "2026-02", n: "17" },
      { group_key: "india", month: "2025-11", n: "100" },
      { group_key: "china - mainland born", month: "2026-02", n: "5" },
    ]);
    const got = await iv.lineIssuance("EB2", "india");
    const [, args] = rows.mock.calls[0]!;
    expect(args).toEqual(["EB-2", "2025-03", "2026-02"]);
    expect(got).toMatchObject({ category: "EB-2", total: 117, newest: 17, wholeCategory: false });
  });

  it("counts rest of world as everyone outside the four listed countries", async () => {
    rows.mockResolvedValueOnce([
      { group_key: "india", month: "2026-02", n: "17" },
      { group_key: "china - mainland born", month: "2026-02", n: "5" },
      { group_key: "brazil", month: "2026-02", n: "200" },
      { group_key: "korea, south", month: "2025-06", n: "50" },
    ]);
    const got = await iv.lineIssuance("EB2", "worldwide");
    expect(got).toMatchObject({ total: 250, newest: 200 });
  });

  it("says an EB-5 set-aside line counts the whole category", async () => {
    rows.mockResolvedValueOnce([{ group_key: "india", month: "2026-02", n: "3" }]);
    expect(await iv.lineIssuance("EB5R", "india")).toMatchObject({ category: "EB-5", wholeCategory: true });
  });

  it("has nothing for a category State doesn't publish, or before any load", async () => {
    expect(await iv.lineIssuance("FX", "india")).toBeNull();
    one.mockResolvedValueOnce(null);
    expect(await iv.lineIssuance("EB2", "india")).toBeNull();
  });
});
