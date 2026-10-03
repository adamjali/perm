import { beforeEach, describe, expect, it, vi } from "vitest";

// The entity answers carry two dates: the last decision in DOL's published
// files (meta.asOf) and the sweep that read DOL's live status (pendingNow.asOf).
// Both were null before Oct 3 2026, so an assistant quoting the counts had no
// date to give.
const getEntityBySlug = vi.fn();
const getFreshness = vi.fn();
const entityPending = vi.fn();
const searchByName = vi.fn();

vi.mock("@/lib/turso/publicData", () => ({
  getEntityBySlug: (...a: unknown[]) => getEntityBySlug(...a),
  getFreshness: (...a: unknown[]) => getFreshness(...a),
  getLiveBacklog: vi.fn(),
}));
vi.mock("@/lib/turso/entityDetail", () => ({ entityPending: (...a: unknown[]) => entityPending(...a) }));
vi.mock("@/lib/turso/entities", () => ({ searchByName: (...a: unknown[]) => searchByName(...a) }));
vi.mock("@/lib/turso/caseLookup", () => ({ lookupCase: vi.fn() }));
vi.mock("@/lib/turso/client", () => ({ one: vi.fn() }));
vi.mock("@/lib/turso/processingTimes", () => ({ getProcessingTimes: vi.fn() }));
vi.mock("@/lib/turso/pwdCases", () => ({ pwd: {} }));
vi.mock("@/lib/turso/lcaCases", () => ({ lca: {} }));
const seasonalLookup = vi.fn();
const seasonalDisclosed = vi.fn();
const seasonalRecord = vi.fn();
const seasonalPosting = vi.fn();
vi.mock("@/lib/turso/seasonalCases", () => ({
  seasonal: {
    lookup: (...a: unknown[]) => seasonalLookup(...a),
    lookupDisclosed: (...a: unknown[]) => seasonalDisclosed(...a),
  },
  lookupSeasonalRecord: (...a: unknown[]) => seasonalRecord(...a),
  lookupSeasonalPosting: (...a: unknown[]) => seasonalPosting(...a),
}));
vi.mock("@/lib/turso/permEstimate", () => ({ estimatePermCase: vi.fn(), loadPermEstimateContext: vi.fn() }));

import { readCase, readEntity, searchEntities } from "../reads";

const adobe = {
  slug: "adobe-inc",
  name: "Adobe Inc.",
  rank: 40,
  total: 1200,
  certified: 1100,
  denied: 20,
  medianDays: 480,
  medianAnnualWage: 180000,
  state: "CA",
  code: null,
  recent12m: 300,
};

beforeEach(() => {
  getEntityBySlug.mockReset().mockResolvedValue(adobe);
  getFreshness.mockReset().mockResolvedValue({
    "perm-cases": { asOf: "2026-06-30T00:00:00Z" },
    "perm-case-status": { asOf: "2026-10-02T09:14:00Z" },
  });
  entityPending.mockReset().mockResolvedValue({
    tracked: 230,
    pending: 224,
    stages: [
      { status: "APPLICATION ON HOLD", n: 216 },
      { status: "ANALYST REVIEW", n: 8 },
    ],
    oldest: "2025-02-11T00:00:00Z",
  });
  searchByName.mockReset().mockResolvedValue([adobe]);
});

describe("readEntity", () => {
  it("dates the published counts and the live pending count separately", async () => {
    const r = await readEntity("employer", "adobe-inc");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meta.asOf).toBe("2026-06-30");
    expect(r.data.pendingNow).toEqual({
      pending: 224,
      casesTracked: 230,
      byStatus: [
        { status: "APPLICATION ON HOLD", cases: 216 },
        { status: "ANALYST REVIEW", cases: 8 },
      ],
      oldestPendingFiled: "2025-02-11",
      asOf: "2026-10-02",
    });
  });

  it("answers without the pending block when the live read fails", async () => {
    entityPending.mockRejectedValue(new Error("db down"));
    const r = await readEntity("employer", "adobe-inc");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.pendingNow).toBeNull();
  });

  it("answers with null dates when the freshness read fails", async () => {
    getFreshness.mockRejectedValue(new Error("db down"));
    const r = await readEntity("employer", "adobe-inc");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meta.asOf).toBeNull();
    expect((r.data.pendingNow as { asOf: string | null }).asOf).toBeNull();
  });

  it("still 404s a name with no page", async () => {
    getEntityBySlug.mockResolvedValue(null);
    const r = await readEntity("employer", "nobody-here");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });
});

describe("searchEntities", () => {
  it("dates the results by the published files", async () => {
    const r = await searchEntities("employer", "adobe");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.meta.asOf).toBe("2026-06-30");
  });
});

describe("fields by kind", () => {
  it("gives an employer no wage, state or occupation code", async () => {
    const r = await readEntity("employer", "adobe-inc");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).not.toHaveProperty("medianAnnualWage");
    expect(r.data).not.toHaveProperty("state");
    expect(r.data).not.toHaveProperty("occupationCode");
  });

  it("gives an occupation its code and median wage", async () => {
    getEntityBySlug.mockResolvedValue({ ...adobe, slug: "software-developers", code: "15-1252", medianAnnualWage: 150000 });
    const r = await readEntity("occupation", "software-developers");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.occupationCode).toBe("15-1252");
    expect(r.data.medianAnnualWage).toBe(150000);
    expect(r.data).not.toHaveProperty("state");
  });

  it("gives a law firm its state", async () => {
    getEntityBySlug.mockResolvedValue({ ...adobe, slug: "fragomen", state: "NY" });
    const r = await readEntity("attorney", "fragomen");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.state).toBe("NY");
    expect(r.data).not.toHaveProperty("medianAnnualWage");
  });
});

describe("readCase, H-2A, H-2B and CW-1", () => {
  beforeEach(() => {
    for (const f of [seasonalLookup, seasonalDisclosed, seasonalRecord, seasonalPosting]) f.mockReset().mockResolvedValue(null);
  });

  it("answers a live H-2A case with the job DOL accepted, before any decision", async () => {
    seasonalLookup.mockResolvedValue({
      caseNumber: "H-300-26272-266803", status: "IN PROCESS", isFinal: false, filingDate: "2026-09-29",
      employerName: "MCRP Farms", jobTitle: "Farmworker", lastCheckedAt: "2026-10-03T12:00:00Z",
    });
    seasonalPosting.mockResolvedValue({
      caseNumber: "H-300-26272-266803", feed: "h2a", employerName: "MCRP Farms", jobTitle: "Farmworker",
      workers: 40, workersForeign: 40, beginDate: "2026-11-27", endDate: "2027-06-30", wage: 16.08, wageUnit: "HOUR",
      worksiteCity: "Danielsville", worksiteCounty: "Madison", worksiteState: "GA", jobOrderNumber: "JO-A-300-26271-264525",
      pwdNumber: null, submittedDate: "2026-09-29", acceptedDate: "2026-10-01",
    });
    const out = await readCase("H-300-26272-266803");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.data).toMatchObject({ program: "seasonal", status: "IN PROCESS", isFinal: false, decision: null });
    expect(out.data.accepted).toMatchObject({ wage: 16.08, wageUnit: "HOUR", workBegins: "2026-11-27", jobOrderNumber: "JO-A-300-26271-264525" });
  });

  it("answers an H-2B wage request from DOL's prevailing wage file when no live row exists", async () => {
    seasonalRecord.mockResolvedValue({
      caseNumber: "P-400-25100-000001", status: "DETERMINATION ISSUED", receivedDate: "2025-04-10",
      decisionDate: "2025-06-02", employerName: "Shore Crabs LLC", employerSlug: "shore-crabs-llc",
      jobTitle: "Crab Picker", socTitle: "Meat, Poultry, and Fish Cutters", wage: 15.2, wageUnit: "HOUR",
      workers: null, workersCertified: null, beginDate: null, endDate: null, worksiteCity: "Hoopers Island",
      worksiteCounty: null, worksiteState: "MD", attorneyName: null, visaClass: "H-2B", sourceFile: "PW.xlsx",
    });
    const out = await readCase("P-400-25100-000001");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.data).toMatchObject({ status: "DETERMINATION ISSUED", isFinal: true, employer: "Shore Crabs LLC", accepted: null });
    expect(out.data.decision).toMatchObject({ decisionDate: "2025-06-02", wage: 15.2, visaClass: "H-2B" });
  });

  it("is not found only when no source holds the case", async () => {
    const out = await readCase("C-500-26271-263466");
    expect(out.ok).toBe(false);
  });
});
