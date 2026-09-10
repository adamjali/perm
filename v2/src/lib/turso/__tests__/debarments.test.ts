import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one, exec: vi.fn() }));

const { debarmentsForSlug, getDebarmentsSummary, isActive, listDebarments, phase } =
  await import("../debarments");

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

describe("phase: a period has three states, and the middle one was missing", () => {
  // The row shape the module returns, not the DB row shape.
  const d = (startDate: string, endDate: string) =>
    ({ startDate, endDate }) as Parameters<typeof phase>[0];

  it("calls a period that has not begun upcoming, never ended", () => {
    // THE REGRESSION THIS FILE EXISTS FOR. Both surfaces rendered `!isActive`
    // as "(ended)", and on 2026-09-10 the live data held exactly this row:
    // an H-2A employer barred 2026-11-01 to 2027-10-31, greyed out and
    // captioned "ended" 52 days BEFORE the bar took effect.
    expect(phase(d("2026-11-01", "2027-10-31"), "2026-09-10")).toBe("upcoming");
    expect(isActive(d("2026-11-01", "2027-10-31"), "2026-09-10")).toBe(false);
  });

  it("separates the two things !isActive used to conflate", () => {
    const future = d("2026-11-01", "2027-10-31");
    const past = d("2020-01-01", "2021-01-01");
    const today = "2026-09-10";
    // Both are "not active", which is why one label for both was wrong.
    expect(isActive(future, today)).toBe(isActive(past, today));
    expect(phase(future, today)).not.toBe(phase(past, today));
  });

  it("is in force on both boundary days, inclusive", () => {
    // A debarment that runs "to" a date is in force ON that date; an
    // exclusive end would clear a sponsor a day early.
    expect(phase(d("2026-09-10", "2027-01-01"), "2026-09-10")).toBe("in-force");
    expect(phase(d("2025-01-01", "2026-09-10"), "2026-09-10")).toBe("in-force");
    expect(phase(d("2025-01-01", "2026-09-09"), "2026-09-10")).toBe("ended");
    expect(phase(d("2026-09-11", "2027-01-01"), "2026-09-10")).toBe("upcoming");
  });

  it("agrees with isActive wherever isActive is true", () => {
    for (const [s, e, t] of [
      ["2025-01-01", "2027-01-01", "2026-09-10"],
      ["2026-09-10", "2026-09-10", "2026-09-10"],
      ["2020-01-01", "2021-01-01", "2026-09-10"],
      ["2026-11-01", "2027-10-31", "2026-09-10"],
    ] as const) {
      expect(phase(d(s, e), t) === "in-force").toBe(isActive(d(s, e), t));
    }
  });
});

