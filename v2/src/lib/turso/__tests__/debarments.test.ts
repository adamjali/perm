import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one, exec: vi.fn() }));

const { debarmentsForSlug, getDebarmentsSummary, isActive, listDebarments } = await import("../debarments");

const db = (over: Record<string, unknown> = {}) => ({
  program: "perm",
  entity: "Hercules Staffing, LLC",
  entity_slug: "hercules-staffing-llc",
  entity_type: "Employer",
  location: "Orem, Utah",
  start_date: "2025-05-29",
  end_date: "2027-05-29",
  violation: "Failure to respond to an audit",
  citation: "20 C.F.R. § 656.31(f)(1)(ii)",
  source_url: "https://www.dol.gov/agencies/eta/foreign-labor/program-debarments",
  ...over,
});

describe("debarments", () => {
  beforeEach(() => {
    rows.mockReset();
    one.mockReset();
    rows.mockResolvedValue([]);
  });

  it("isActive is inclusive of both ends", () => {
    const d = { startDate: "2025-05-29", endDate: "2027-05-29" } as Parameters<typeof isActive>[0];
    expect(isActive(d, "2025-05-29")).toBe(true);
    expect(isActive(d, "2027-05-29")).toBe(true);
    expect(isActive(d, "2027-05-30")).toBe(false);
    expect(isActive(d, "2025-05-28")).toBe(false);
  });

  it("drops a row whose program is not one of the four, and maps the rest", async () => {
    rows.mockResolvedValue([db(), db({ program: "h3" })]);
    const out = await listDebarments();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ program: "perm", entity: "Hercules Staffing, LLC", startDate: "2025-05-29", endDate: "2027-05-29" });
  });

  it("matches a page slug on the normalised-name prefix with the corporate suffix dropped, and refuses short stems", async () => {
    await debarmentsForSlug("hercules-staffing-llc");
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toContain("INDEXED BY debarments_slug");
    expect(args).toEqual(["hercules-staffing", "hercules-staffinh", "hercules-staffing-llc"]);
    rows.mockClear();
    expect(await debarmentsForSlug("acme-inc")).toEqual([]);
    expect(rows).not.toHaveBeenCalled();
  });

  it("reads the summary document and refuses a malformed one", async () => {
    one.mockResolvedValue({ json: JSON.stringify({ asOf: "2026-09-08", pdfDate: "2026-08-07", h1bEffective: "2026-09-01", counts: { perm: 2, h1b: 5, h2a: 49, h2b: 49 } }) });
    expect(await getDebarmentsSummary()).toEqual({ asOf: "2026-09-08", pdfDate: "2026-08-07", h1bEffective: "2026-09-01", counts: { perm: 2, h1b: 5, h2a: 49, h2b: 49 } });
    one.mockResolvedValue({ json: "{" });
    expect(await getDebarmentsSummary()).toBeNull();
  });
});
