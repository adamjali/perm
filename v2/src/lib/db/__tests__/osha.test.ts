import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn(), exec: vi.fn() }));

const { oshaForSlug } = await import("../osha");

/** A sponsor's OSHA inspections: OSHA's sums, the newest inspections, and nothing invented when a read fails. */

const totals = {
  inspections: 4, with_v: 2, v: 9, serious: 5, willful: 1, repeat: 0, pen: 82000, init_pen: 151000,
  open_n: 1, harm: 1, first_open: "2017-02-06", last_open: "2025-11-03",
};
const newest = [
  { activity_nr: "1700000", estab_name: "NORTHWIND TRADERS INC.", city: "Austin", state: "TX", insp_type: "M",
    open_date: "2025-11-03", close_date: null, violations: 3, serious: 2, willful: 1, repeat: 0, current_penalty: 70000 },
];

describe("oshaForSlug", () => {
  beforeEach(() => {
    rows.mockReset();
  });

  it("sums every inspection and lists the newest, newest opened first", async () => {
    rows.mockImplementation(async (sql) => (sql.startsWith("SELECT COUNT(*)") ? [totals] : newest));
    const s = await oshaForSlug("northwind-traders-inc");
    expect(rows.mock.calls[1]![0]).toContain("ORDER BY open_date DESC");
    expect(s).toMatchObject({ inspections: 4, withViolations: 2, serious: 5, willful: 1, penalty: 82000, initialPenalty: 151000, open: 1 });
    expect(s?.newest[0]).toMatchObject({ activityNr: "1700000", type: "M", closeDate: null, penalty: 70000 });
  });

  it("answers nothing for a sponsor with no inspections, and before the table exists", async () => {
    rows.mockImplementation(async (sql) => (sql.startsWith("SELECT COUNT(*)") ? [{ inspections: 0 }] : []));
    expect(await oshaForSlug("no-inspections-llc")).toBeNull();
    rows.mockRejectedValue(new Error("SQLITE_ERROR: no such table: osha_inspections"));
    expect(await oshaForSlug("before-the-load-llc")).toBeNull();
  });

  it("throws on any other failed read, so the page keeps its last render", async () => {
    rows.mockRejectedValue(new Error("database query deadline"));
    await expect(oshaForSlug("contoso-llc")).rejects.toThrow("deadline");
  });
});
