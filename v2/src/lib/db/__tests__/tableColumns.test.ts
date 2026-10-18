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

  it("reads the columns from the schema, so an empty table still names them", async () => {
    rows.mockResolvedValue([{ name: "page_slug" }, { name: "source_slug" }]);
    expect([...(await tableColumns("employer_page_map"))].sort()).toEqual(["page_slug", "source_slug"]);
    expect(rows.mock.calls[0]?.[0]).toBe("PRAGMA table_info(employer_page_map)");
  });

  it("answers an empty set for a table that doesn't exist yet", async () => {
    // SQLite answers no rows, not an error, for a missing table.
    rows.mockResolvedValue([]);
    expect((await tableColumns("employer_page_map")).size).toBe(0);
  });

  it("throws on any other error, so a failed read is never taken for a missing table", async () => {
    rows.mockRejectedValue(new Error("database query deadline"));
    await expect(tableColumns("employer_page_map")).rejects.toThrow("database query deadline");
    // And isn't cached: the next ask reads again.
    rows.mockResolvedValue([{ name: "page_slug" }]);
    expect((await tableColumns("employer_page_map")).has("page_slug")).toBe(true);
  });
});
