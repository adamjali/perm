import { beforeEach, describe, expect, it, vi } from "vitest";

// The browser extension's lookup: a printed employer name to the employer page
// it belongs to. The order is the contract: an exact published PERM employer,
// then any page the nightly map ties the name's key to, then a POSSIBLE match
// labelled as one, then "no record". Every read is mocked; the SQL each step
// sends is asserted where the step's safety lives in it.

const one = vi.fn();
const getEntityBySlug = vi.fn();
const getFreshness = vi.fn();
const entityPending = vi.fn();
const searchByName = vi.fn();
const employerMatch = vi.fn();
const otherEmployerRecord = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/turso/client", () => ({ one: (...a: unknown[]) => one(...a) }));
vi.mock("@/lib/turso/publicData", () => ({
  getEntityBySlug: (...a: unknown[]) => getEntityBySlug(...a),
  getFreshness: (...a: unknown[]) => getFreshness(...a),
}));
vi.mock("@/lib/turso/entityDetail", () => ({ entityPending: (...a: unknown[]) => entityPending(...a) }));
vi.mock("@/lib/turso/entities", () => ({ searchByName: (...a: unknown[]) => searchByName(...a) }));
vi.mock("@/lib/turso/employerSlugs", () => ({ employerMatch: (...a: unknown[]) => employerMatch(...a) }));
vi.mock("@/lib/turso/otherEmployers", () => ({ otherEmployerRecord: (...a: unknown[]) => otherEmployerRecord(...a) }));

import { forgetLookupsForTests, lookupEmployer } from "../employerLookup";

const google = { slug: "google-llc", name: "GOOGLE LLC", total: 9000, certified: 8800, denied: 100, recent12m: 2100 };
const meta = { slug: "meta-platforms-inc", name: "META PLATFORMS, INC.", total: 25, certified: 20, denied: 2, recent12m: 3 };

/** Route each SQL statement to an answer by what it reads. */
function db(answers: { perm?: string | null; mapIndexed?: boolean; mapped?: { page_slug: string; page_kind: string } | null; other?: unknown }) {
  one.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM perm_entities")) return answers.perm ? { slug: answers.perm } : null;
    if (sql.includes("sqlite_master")) return { n: answers.mapIndexed ? 1 : 0 };
    if (sql.includes("FROM employer_page_map")) return answers.mapped ?? null;
    if (sql.includes("FROM lca_cases")) return { n: 4321 };
    if (sql.includes("FROM perm_live_recent")) return { newest: "2026-10-01T00:00:00", pending: 12 };
    if (sql.includes("FROM perm_live_only_index")) return { name: "Shore Crabs LLC", cases: 3 };
    return null;
  });
}

beforeEach(() => {
  forgetLookupsForTests();
  one.mockReset();
  getEntityBySlug.mockReset();
  searchByName.mockReset();
  entityPending.mockReset();
  otherEmployerRecord.mockReset();
  employerMatch.mockReset();
  getFreshness.mockResolvedValue({ "perm-cases": { asOf: "2026-06-30" } });
  employerMatch.mockResolvedValue({ where: "employer_slug IN (?)", args: ["x"], basis: "map", spellings: 1 });
  entityPending.mockResolvedValue({ tracked: 400, pending: 160, stages: [], oldest: null });
  searchByName.mockResolvedValue([]);
});

describe("lookupEmployer", () => {
  it("refuses a name it can't use, before any read", async () => {
    const r = await lookupEmployer("x");
    expect(r.ok).toBe(false);
    expect(one).not.toHaveBeenCalled();
  });

  it("matches a published PERM employer exactly on its key", async () => {
    db({ perm: "google-llc" });
    getEntityBySlug.mockResolvedValue(google);
    const r = await lookupEmployer("Google");
    expect(r.ok && r.data.match).toBe("exact");
    if (!r.ok) throw new Error("expected an answer");
    const e = r.data.employer!;
    expect(e.name).toBe("GOOGLE LLC");
    expect(e.url).toBe("https://permtracker.app/perm-employers/google-llc");
    expect(e.perm.certifiedShare).toBeCloseTo(0.989, 3);
    expect(e.perm.pending).toBe(160);
    expect(e.perm.newestFiling).toBe("2026-10-01");
    expect(e.h1bLcas).toBe(4321);
    expect(r.meta.asOf).toBe("2026-06-30");
    // Both keys are asked, so "JPMorgan Chase &amp; Co." still meets its entity key.
    const [sql, args] = one.mock.calls.find(([s]) => String(s).includes("FROM perm_entities"))!;
    expect(sql).toContain("merge_key IN");
    expect(args).toContain("google");
  });

  it("withholds the certified share under 30 decided cases", async () => {
    db({ perm: "meta-platforms-inc" });
    getEntityBySlug.mockResolvedValue(meta);
    const r = await lookupEmployer("Meta Platforms Inc");
    if (!r.ok) throw new Error("expected an answer");
    expect(r.data.employer!.perm.certifiedShare).toBeNull();
    expect(r.data.shareFloor).toBe(30);
  });

  it("uses the nightly map for an employer with no PERM page, only once its key index exists", async () => {
    db({ perm: null, mapIndexed: true, mapped: { page_slug: "acme-staffing", page_kind: "other" } });
    otherEmployerRecord.mockResolvedValue({ slug: "acme-staffing", name: "ACME STAFFING", lca: 50, pwd: 4, perm: 0 });
    const r = await lookupEmployer("Acme Staffing");
    if (!r.ok) throw new Error("expected an answer");
    expect(r.data.match).toBe("exact");
    expect(r.data.employer!.page).toBe("other");
    expect(r.data.employer!.h1bLcas).toBe(50);
    expect(r.data.employer!.perm.certifiedShare).toBeNull();

    forgetLookupsForTests();
    one.mockReset();
    db({ perm: null, mapIndexed: false, mapped: { page_slug: "acme-staffing", page_kind: "other" } });
    const unindexed = await lookupEmployer("Acme Staffing");
    expect(one.mock.calls.some(([s]) => String(s).includes("FROM employer_page_map"))).toBe(false);
    expect(unindexed.ok && unindexed.data.match).toBe("none");
  });

  it("offers a possible match, named, when only a longer name fits", async () => {
    db({ perm: null });
    const labs = { slug: "metamorphosis-labs", name: "METAMORPHOSIS LABS", total: 900, certified: 800, denied: 10, recent12m: 40 };
    searchByName.mockResolvedValue([labs, meta]);
    getEntityBySlug.mockImplementation(async (_k: string, slug: string) => [labs, meta].find((e) => e.slug === slug) ?? null);
    const r = await lookupEmployer("Meta");
    if (!r.ok) throw new Error("expected an answer");
    expect(r.data.match).toBe("possible");
    expect(r.data.employer!.name).toBe("META PLATFORMS, INC.");
  });

  it("says no record when nothing fits", async () => {
    db({ perm: null });
    const labs = { slug: "metamorphosis-labs", name: "METAMORPHOSIS LABS", total: 900, certified: 800, denied: 10, recent12m: 40 };
    searchByName.mockResolvedValue([labs]);
    getEntityBySlug.mockResolvedValue(labs);
    const r = await lookupEmployer("Meta");
    if (!r.ok) throw new Error("expected an answer");
    expect(r.data.match).toBe("none");
    expect(r.data.employer).toBeNull();
    expect(r.meta.url).toBe("https://permtracker.app/perm-employers?q=Meta");
  });

  it("sets a tiny exact match aside for a much busier namesake, and says possible", async () => {
    // Job sites print "Amazon"; DOL holds a 1-case "AMAZON" beside Amazon's real filer.
    db({ perm: "amazon" });
    const tiny = { slug: "amazon", name: "AMAZON", total: 1, certified: 1, denied: 0, recent12m: 0 };
    const big = { slug: "amazon-com-services-llc", name: "AMAZON.COM SERVICES LLC", total: 9000, certified: 8900, denied: 40, recent12m: 800 };
    searchByName.mockResolvedValue([big, tiny]);
    getEntityBySlug.mockImplementation(async (_k: string, slug: string) => [tiny, big].find((e) => e.slug === slug) ?? null);
    const r = await lookupEmployer("Amazon");
    if (!r.ok) throw new Error("expected an answer");
    expect(r.data.match).toBe("possible");
    expect(r.data.employer!.name).toBe("AMAZON.COM SERVICES LLC");
  });

  it("keeps a small exact match when no namesake is far busier", async () => {
    db({ perm: "acme" });
    const acme = { slug: "acme", name: "ACME", total: 20, certified: 18, denied: 1, recent12m: 2 };
    // 150 is busier, but not ten times 20.
    const brick = { slug: "acme-brick-co", name: "ACME BRICK CO", total: 150, certified: 140, denied: 3, recent12m: 9 };
    searchByName.mockResolvedValue([brick, acme]);
    getEntityBySlug.mockImplementation(async (_k: string, slug: string) => [acme, brick].find((e) => e.slug === slug) ?? null);
    const r = await lookupEmployer("Acme");
    if (!r.ok) throw new Error("expected an answer");
    expect(r.data.match).toBe("exact");
    expect(r.data.employer!.name).toBe("ACME");
  });

  it("never second-guesses an exact match with 30 or more published cases", async () => {
    db({ perm: "google-llc" });
    getEntityBySlug.mockResolvedValue(google);
    await lookupEmployer("Google");
    expect(searchByName).not.toHaveBeenCalled();
  });

  it("answers a repeat from memory", async () => {
    db({ perm: "google-llc" });
    getEntityBySlug.mockResolvedValue(google);
    await lookupEmployer("Google");
    const reads = one.mock.calls.length;
    await lookupEmployer("  google ");
    expect(one.mock.calls.length).toBe(reads);
  });
});
