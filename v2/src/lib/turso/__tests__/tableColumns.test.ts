import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn(), exec: vi.fn() }));

const { forgetTableColumns, tableColumns } = await import("../tableColumns");

describe("tableColumns", () => {
  beforeEach(() => {
    rows.mockReset();
    forgetTableColumns();
  });

  it("reads the columns off one row", async () => {
    rows.mockResolvedValue([{ page_slug: "x", source_slug: "y" }]);
    expect([...(await tableColumns("employer_page_map"))].sort()).toEqual(["page_slug", "source_slug"]);
  });

  it("answers an empty set for a table that doesn't exist yet", async () => {
    rows.mockRejectedValue(new Error("SQLite error: no such table: employer_page_map"));
    expect((await tableColumns("employer_page_map")).size).toBe(0);
  });

  it("throws on any other error, so a failed read is never taken for a missing table", async () => {
    rows.mockRejectedValue(new Error("turso query deadline"));
    await expect(tableColumns("employer_page_map")).rejects.toThrow("turso query deadline");
    // And isn't cached: the next ask reads again.
    rows.mockResolvedValue([{ page_slug: "x" }]);
    expect((await tableColumns("employer_page_map")).has("page_slug")).toBe(true);
  });
});
