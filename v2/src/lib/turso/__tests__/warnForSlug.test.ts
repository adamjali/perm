import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn(), exec: vi.fn() }));

const { warnForSlug } = await import("../warn");

describe("warnForSlug", () => {
  beforeEach(() => {
    rows.mockReset();
  });

  it("reads the sponsor's notices newest first", async () => {
    rows.mockResolvedValue([]);
    await warnForSlug("northwind-traders-inc");
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toContain("WHERE employer_slug = ? ORDER BY notice_date DESC");
    expect(args).toEqual(["northwind-traders-inc", 10]);
  });

  it("throws on a failed read instead of answering that the sponsor has no notices", async () => {
    rows.mockRejectedValue(new Error("turso query deadline"));
    await expect(warnForSlug("contoso-logistics-llc")).rejects.toThrow("turso query deadline");
  });
});
