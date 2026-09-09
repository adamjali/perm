import { beforeEach, describe, expect, it, vi } from "vitest";

const listStageCases = vi.fn();
const getSweepCoverage = vi.fn();

vi.mock("@/lib/turso/rfi", () => ({ listStageCases, LISTABLE_STAGE_MAX: 20_000 }));
vi.mock("@/lib/turso/sweepCoverage", () => ({ getSweepCoverage }));

const { GET } = await import("../route");

function get(qs: string): Request {
  return new Request(`https://permtracker.app/api/stage-cases?${qs}`);
}

const row = (n: number) => ({
  caseNumber: `G-100-26030-${String(100000 + n)}`,
  filingDate: "2026-01-30",
  employer: n % 2 ? 'Acme "Widgets", Inc.' : "Plain Co",
  employerSlug: n % 2 ? "acme-widgets-inc" : null,
  jobTitle: "Software Developer",
});

describe("GET /api/stage-cases", () => {
  beforeEach(() => {
    listStageCases.mockReset();
    getSweepCoverage.mockReset();
    getSweepCoverage.mockResolvedValue({ finishedOn: "2026-09-08", mode: "pending", asked: 1, answered: 1 });
  });

  it("refuses a missing or malformed stage before touching the database", async () => {
    expect((await GET(get(""))).status).toBe(400);
    expect((await GET(get("stage=../etc"))).status).toBe(400);
    expect(listStageCases).not.toHaveBeenCalled();
  });

  it("answers 404 for a slug the stage registry does not know, and analyst review has no slug", async () => {
    expect((await GET(get("stage=not-a-stage"))).status).toBe(404);
    expect((await GET(get("stage=analyst-review"))).status).toBe(404);
    expect(listStageCases).not.toHaveBeenCalled();
  });

  it("returns the whole cohort as JSON with the sweep's date and an edge cache header", async () => {
    listStageCases.mockResolvedValue([row(1), row(2)]);
    const res = await GET(get("stage=application-on-hold"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=21600");
    const body = await res.json();
    expect(body.status).toBe("APPLICATION ON HOLD");
    expect(body.label).toBe("Application on hold");
    expect(body.asOf).toBe("2026-09-08");
    expect(body.count).toBe(2);
    expect(body.rows[0].caseNumber).toBe("G-100-26030-100001");
    // The read asks for the whole cohort, not a page of it.
    expect(listStageCases).toHaveBeenCalledWith("APPLICATION ON HOLD", 25_000, 0);
  });

  it("renders CSV with quoting for commas and quotes, as an attachment named by stage and date", async () => {
    listStageCases.mockResolvedValue([row(1)]);
    const res = await GET(get("stage=rfi-issued&format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain('perm-rfi-issued-2026-09-08.csv');
    const text = await res.text();
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe("case_number,filing_date,employer,job_title,status,as_of");
    expect(lines[1]).toBe('G-100-26030-100001,2026-01-30,"Acme ""Widgets"", Inc.",Software Developer,RFI ISSUED,2026-09-08');
  });

  it("refuses a cohort above the listable ceiling instead of serving it", async () => {
    listStageCases.mockResolvedValue(Array.from({ length: 20_001 }, (_, i) => row(i)));
    const res = await GET(get("stage=rfi-issued"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/perm-queue/);
  });

  it("rejects an unknown format", async () => {
    expect((await GET(get("stage=rfi-issued&format=xml"))).status).toBe(400);
  });
});
