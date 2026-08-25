/**
 * Case-browser tests.
 *
 * The thing that can actually go wrong in `convex/permCases.ts` is not a wrong
 * number, it is an unbounded read: a filter that resolves to the wrong index
 * scans the table, and over 259,000 rows that is a hard failure at Convex's
 * 4,096-document limit. It is also invisible on a fixture, because 200 rows
 * scan fine. So the tests below do three things a unit test of the planner
 * alone would not:
 *
 * 1. Every filter shape is RUN, not just planned. `withIndex` throws on an
 *    index the schema does not declare, so running all ten is what proves the
 *    planner cannot name one that isn't there.
 * 2. The schema definition is read at runtime and every browse index is
 *    asserted to END in `decisionDate`. That is the invariant the whole design
 *    rests on - it is what makes the date range free on all ten - and it is
 *    the one an added index would quietly break.
 * 3. `BROWSE_INDEXES` is checked against the same definition, so an index
 *    added later without being wired into the planner fails a test rather than
 *    sitting there costing storage and serving nothing.
 */

import { describe, it, expect } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { WAGE_CELL_FIELDS } from "../permWageStats";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import {
  BROWSE_INDEXES,
  INGEST_ROW_FIELDS,
  MAX_SEARCH_RESULTS,
  DEFAULT_PAGE_ITEMS,
  MAX_PAGE_ITEMS,
  clampPageItems,
  normalizeCaseNumber,
  pageCount,
  pageNumberForOffset,
  pageRange,
  planCaseQuery,
  type CaseFilter,
  type CaseSlice,
  type CaseStatus,
} from "../permCases";

const STATUSES: CaseStatus[] = ["certified", "denied", "withdrawn"];

const SLICES: CaseSlice[] = [
  { kind: "all" },
  { kind: "state", state: "CA" },
  { kind: "occupation", socCode: "15-1252" },
  { kind: "employer", employerSlug: "microsoft-corporation" },
  { kind: "attorney", attorneySlug: "bal-llp" },
];

/** Every filter shape the API can express: five slices, status on and off. */
function everyFilter(): CaseFilter[] {
  const out: CaseFilter[] = [];
  for (const slice of SLICES) {
    out.push({ slice });
    out.push({ slice, status: "denied" });
  }
  return out;
}

/** The `permCases` indexes as the schema actually defines them. */
function declaredIndexes(): { name: string; fields: string[] }[] {
  const table = schema.tables.permCases as unknown as {
    indexes: { indexDescriptor: string; fields: string[] }[];
  };
  return table.indexes.map((i) => ({ name: i.indexDescriptor, fields: i.fields }));
}

type SeedRow = {
  caseNumber: string;
  status: CaseStatus;
  receivedDate: string;
  decisionDate: string;
  days: number;
  fiscalYear: string;
  employerName: string;
  employerSlug: string;
  state: string;
  jobTitle: string;
  socCode: string;
  socTitle: string;
  attorneyName: string;
  attorneySlug: string;
  wage: number | null;
};

function seedRows(): SeedRow[] {
  const rows: SeedRow[] = [];
  const states = ["CA", "WA", "NJ", ""];
  const socs: [string, string][] = [
    ["15-1252", "Software Developers"],
    ["13-2011", "Accountants and Auditors"],
  ];
  const employers: [string, string][] = [
    ["MICROSOFT CORPORATION", "microsoft-corporation"],
    ["GOOGLE LLC", "google-llc"],
    // Below the entity floor: a real employer with no detail page.
    ["TINY BAKERY LLC", ""],
  ];
  const firms: [string, string][] = [
    ["BAL LLP", "bal-llp"],
    ["", ""],
  ];
  for (let i = 0; i < 120; i++) {
    const state = states[i % states.length] as string;
    const soc = socs[i % socs.length] as [string, string];
    const emp = employers[i % employers.length] as [string, string];
    const firm = firms[i % firms.length] as [string, string];
    const status = STATUSES[i % 3] as CaseStatus;
    // Decision dates march forward a day at a time from 2025-01-01, so an
    // ordering assertion has a single right answer.
    const day = String((i % 28) + 1).padStart(2, "0");
    const month = String(Math.floor(i / 28) + 1).padStart(2, "0");
    rows.push({
      caseNumber: `A-25000-${String(i).padStart(5, "0")}`,
      status,
      receivedDate: "2024-06-01",
      decisionDate: `2025-${month}-${day}`,
      days: 200 + i,
      fiscalYear: "2025",
      employerName: emp[0],
      employerSlug: emp[1],
      state,
      jobTitle: "Software Engineer II",
      socCode: soc[0],
      socTitle: soc[1],
      attorneyName: firm[0],
      attorneySlug: firm[1],
      wage: i % 7 === 0 ? null : 100_000 + i * 100,
    });
  }
  return rows;
}

async function seeded() {
  const t = createTestContext();
  await t.mutation(internal.permCases.insertChunk, { rows: seedRows() });
  return t;
}

const FIRST_PAGE = { numItems: 25, cursor: null };
const WHOLE_SLICE = { numItems: MAX_PAGE_ITEMS, cursor: null };

describe("planCaseQuery", () => {
  it("maps every expressible filter to a distinct declared index", () => {
    const plans = everyFilter().map(planCaseQuery);
    expect(plans).toHaveLength(10);
    const names = plans.map((p) => p.index);
    // Distinct: two filters sharing an index would mean one of them is being
    // served by an ordering that does not match what it asked for.
    expect(new Set(names).size).toBe(10);
    for (const name of names) {
      expect(BROWSE_INDEXES as readonly string[]).toContain(name);
    }
  });

  it("carries the date bounds onto whichever index it chose", () => {
    for (const filter of everyFilter()) {
      const plan = planCaseQuery({ ...filter, from: "2025-01-01", to: "2025-06-30" });
      expect(plan.from).toBe("2025-01-01");
      expect(plan.to).toBe("2025-06-30");
    }
  });

  it("puts the slice value on the plan, not just the index name", () => {
    expect(planCaseQuery({ slice: { kind: "state", state: "TX" } })).toEqual({
      index: "by_state_decision",
      state: "TX",
      from: undefined,
      to: undefined,
    });
    expect(
      planCaseQuery({ slice: { kind: "employer", employerSlug: "acme" }, status: "certified" }),
    ).toEqual({
      index: "by_employer_status_decision",
      employerSlug: "acme",
      status: "certified",
      from: undefined,
      to: undefined,
    });
  });
});

describe("the index set", () => {
  it("ends every browse index in decisionDate", () => {
    const declared = declaredIndexes();
    // A control. Reading the wrong object would give an empty list, and an
    // empty list passes every assertion below by vacuous truth.
    expect(declared.map((i) => i.name)).toContain("by_case_number");
    expect(declared.length).toBeGreaterThan(10);

    for (const index of declared) {
      if (index.name === "by_case_number") continue;
      // Convex allows a range comparison only on an index's final field. This
      // is what spends that field on `decisionDate` for all ten, which is why
      // the date filter composes with every slice for free.
      // `.at(-1)` would be the natural way to write this and it does not
      // compile: convex/tsconfig.json targets ES2021, where Array.prototype.at
      // does not exist. The app tsconfig would have accepted it, and it
      // excludes test files, so nothing but `pnpm typecheck` catches this.
      const last = index.fields[index.fields.length - 1];
      expect([index.name, last]).toEqual([index.name, "decisionDate"]);
    }
  });

  it("lists exactly the browse indexes the schema declares", () => {
    // `by_case_number` serves the lookup, not the browser, so it is the one
    // declared index deliberately absent from BROWSE_INDEXES.
    const browse = declaredIndexes()
      .map((i) => i.name)
      .filter((name) => name !== "by_case_number");
    expect([...browse].sort()).toEqual([...BROWSE_INDEXES].sort());
  });
});

describe("paging arithmetic", () => {
  it("numbers pages from one", () => {
    expect(pageNumberForOffset(0, 50)).toBe(1);
    expect(pageNumberForOffset(49, 50)).toBe(1);
    expect(pageNumberForOffset(50, 50)).toBe(2);
    expect(pageNumberForOffset(101, 50)).toBe(3);
  });

  it("survives a nonsense page size or a negative offset", () => {
    expect(pageNumberForOffset(-10, 50)).toBe(1);
    expect(pageNumberForOffset(10, 0)).toBe(1);
    expect(pageCount(100, 0)).toBe(1);
    expect(pageRange(-5, 10)).toEqual({ first: 1, last: 10 });
  });

  it("reports a row range that names real rows", () => {
    expect(pageRange(0, 50)).toEqual({ first: 1, last: 50 });
    expect(pageRange(50, 50)).toEqual({ first: 51, last: 100 });
    expect(pageRange(50, 7)).toEqual({ first: 51, last: 57 });
  });

  it("does not claim a row on an empty page", () => {
    // The bug this pins: `start + 1` on an empty result renders "showing 1 to
    // 0", which reads as a broken page rather than an empty filter.
    expect(pageRange(0, 0)).toEqual({ first: 0, last: 0 });
    expect(pageRange(200, 0)).toEqual({ first: 200, last: 200 });
  });

  it("counts pages, never fewer than one", () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(1, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
    expect(pageCount(259_489, 50)).toBe(5190);
  });

  it("clamps a page size that arrived from a stranger", () => {
    expect(clampPageItems(undefined)).toBe(DEFAULT_PAGE_ITEMS);
    expect(clampPageItems(25)).toBe(25);
    expect(clampPageItems(0)).toBe(1);
    expect(clampPageItems(-5)).toBe(1);
    expect(clampPageItems(1_000_000)).toBe(MAX_PAGE_ITEMS);
    expect(clampPageItems(Number.NaN)).toBe(DEFAULT_PAGE_ITEMS);
    expect(clampPageItems(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PAGE_ITEMS);
    expect(clampPageItems(10.7)).toBe(10);
  });
});

describe("normalizeCaseNumber", () => {
  it("tidies a pasted number", () => {
    expect(normalizeCaseNumber(" a-25000-00001 ")).toBe("A-25000-00001");
    expect(normalizeCaseNumber("A-25000- 00001")).toBe("A-25000-00001");
  });

  it("refuses a string long enough to be an attack rather than a case number", () => {
    // The cap runs BEFORE anything walks the string, because this is reachable
    // unauthenticated and v.string() accepts about a megabyte.
    expect(normalizeCaseNumber("A".repeat(80_000))).toBe("");
    expect(normalizeCaseNumber("A".repeat(33))).toBe("");
    expect(normalizeCaseNumber("A".repeat(32))).toBe("A".repeat(32));
  });
});

describe("listCases", () => {
  it("runs every expressible filter against a real index", async () => {
    const t = await seeded();
    for (const filter of everyFilter()) {
      // `withIndex` throws on an index the schema does not declare, so this
      // loop is what proves the planner can only name real ones.
      const res = await t.query(api.permCases.listCases, {
        paginationOpts: FIRST_PAGE,
        filter,
      });
      expect(Array.isArray(res.page)).toBe(true);
    }
  });

  it("returns newest first by default and oldest first on request", async () => {
    const t = await seeded();
    const newest = await t.query(api.permCases.listCases, {
      paginationOpts: { numItems: 5, cursor: null },
      filter: { slice: { kind: "all" } },
    });
    const oldest = await t.query(api.permCases.listCases, {
      paginationOpts: { numItems: 5, cursor: null },
      filter: { slice: { kind: "all" } },
      order: "oldest",
    });
    const dates = newest.page.map((r) => r.decisionDate);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(oldest.page[0]!.decisionDate <= newest.page[0]!.decisionDate).toBe(true);
  });

  it("slices by state without leaking another state's rows", async () => {
    const t = await seeded();
    const res = await t.query(api.permCases.listCases, {
      paginationOpts: WHOLE_SLICE,
      filter: { slice: { kind: "state", state: "CA" } },
    });
    expect(res.page.length).toBeGreaterThan(0);
    expect(res.page.every((r) => r.state === "CA")).toBe(true);
    // A row DOL published no state for is reachable as its own slice rather
    // than silently folded into somebody else's.
    const blank = await t.query(api.permCases.listCases, {
      paginationOpts: WHOLE_SLICE,
      filter: { slice: { kind: "state", state: "" } },
    });
    expect(blank.page.length).toBeGreaterThan(0);
    expect(blank.page.every((r) => r.state === "")).toBe(true);
  });

  it("applies the status filter and the date range together", async () => {
    const t = await seeded();
    const res = await t.query(api.permCases.listCases, {
      paginationOpts: WHOLE_SLICE,
      filter: {
        slice: { kind: "state", state: "CA" },
        status: "denied",
        from: "2025-02-01",
        to: "2025-03-31",
      },
    });
    expect(res.page.length).toBeGreaterThan(0);
    for (const row of res.page) {
      expect(row.state).toBe("CA");
      expect(row.status).toBe("denied");
      expect(row.decisionDate >= "2025-02-01").toBe(true);
      expect(row.decisionDate <= "2025-03-31").toBe(true);
    }
  });

  it("bounds a date range on both ends, inclusively", async () => {
    const t = await seeded();
    const one = await t.query(api.permCases.listCases, {
      paginationOpts: WHOLE_SLICE,
      filter: { slice: { kind: "all" }, from: "2025-01-05", to: "2025-01-05" },
    });
    expect(one.page.length).toBeGreaterThan(0);
    expect(one.page.every((r) => r.decisionDate === "2025-01-05")).toBe(true);
  });

  it("pages without repeating or dropping a row", async () => {
    const t = await seeded();
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 20; i++) {
      const res: { page: { caseNumber: string }[]; isDone: boolean; continueCursor: string } =
        await t.query(api.permCases.listCases, {
          paginationOpts: { numItems: 25, cursor },
          filter: { slice: { kind: "all" } },
        });
      seen.push(...res.page.map((r) => r.caseNumber));
      if (res.isDone) break;
      cursor = res.continueCursor;
    }
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
  });

  it("clamps a hostile page size instead of trying to read the table", async () => {
    const t = await seeded();
    const res = await t.query(api.permCases.listCases, {
      paginationOpts: { numItems: 10_000_000, cursor: null },
      filter: { slice: { kind: "all" } },
    });
    expect(res.page.length).toBeLessThanOrEqual(MAX_PAGE_ITEMS);
  });

  it("says isDone for a slice small enough to sort client-side", async () => {
    // This is the signal the UI switches modes on: a complete slice can be
    // sorted and paged locally, an incomplete one cannot.
    const t = await seeded();
    const res = await t.query(api.permCases.listCases, {
      paginationOpts: WHOLE_SLICE,
      filter: { slice: { kind: "employer", employerSlug: "google-llc" } },
    });
    expect(res.isDone).toBe(true);
    expect(res.page.every((r) => r.employerSlug === "google-llc")).toBe(true);
  });

  it("slices by an employer that has no detail page", async () => {
    const t = await seeded();
    const res = await t.query(api.permCases.listCases, {
      paginationOpts: WHOLE_SLICE,
      filter: { slice: { kind: "employer", employerSlug: "" } },
    });
    expect(res.page.length).toBeGreaterThan(0);
    expect(res.page.every((r) => r.employerSlug === "")).toBe(true);
  });
});

describe("lookupByCaseNumber", () => {
  it("finds a case however it was typed", async () => {
    const t = await seeded();
    for (const typed of ["A-25000-00007", " a-25000-00007 ", "A-25000- 00007"]) {
      const row = await t.query(api.permCases.lookupByCaseNumber, { caseNumber: typed });
      expect(row?.caseNumber).toBe("A-25000-00007");
    }
  });

  it("returns null rather than throwing for a miss", async () => {
    const t = await seeded();
    expect(
      await t.query(api.permCases.lookupByCaseNumber, { caseNumber: "A-99999-99999" }),
    ).toBeNull();
    expect(await t.query(api.permCases.lookupByCaseNumber, { caseNumber: "" })).toBeNull();
    expect(
      await t.query(api.permCases.lookupByCaseNumber, { caseNumber: "x".repeat(50_000) }),
    ).toBeNull();
  });
});

describe("the coverage document", () => {
  const base = {
    sourceFiles: ["PERM_Disclosure_Data_FY2026_Q3.xlsx"],
    firstDecisionDate: "2024-10-01",
    lastDecisionDate: "2026-06-30",
    firstReceivedDate: "2023-01-02",
    lastReceivedDate: "2026-06-29",
    byStatus: [{ status: "certified" as const, count: 5 }],
    byFiscalYear: [{ fiscalYear: "2026", total: 5, certified: 5, denied: 0, withdrawn: 0 }],
    byState: [{ state: "CA", total: 5, certified: 5, denied: 0, withdrawn: 0 }],
    contentHash: "abc",
  };

  it("is null before an ingest has run", async () => {
    const t = createTestContext();
    expect(await t.query(api.permCases.getMeta, {})).toBeNull();
  });

  it("refuses a payload reporting no cases, so a bad run cannot blank the page", async () => {
    const t = createTestContext();
    const refused = await t.mutation(internal.permCases.storeMeta, { ...base, totalCases: 0 });
    expect(refused.stored).toBe(false);
    expect(await t.query(api.permCases.getMeta, {})).toBeNull();

    const stored = await t.mutation(internal.permCases.storeMeta, { ...base, totalCases: 5 });
    expect(stored.stored).toBe(true);
    const meta = await t.query(api.permCases.getMeta, {});
    expect(meta?.totalCases).toBe(5);
    expect(meta?.byState[0]?.state).toBe("CA");
  });

  it("keeps one row, so a re-ingest replaces rather than accumulates", async () => {
    const t = createTestContext();
    await t.mutation(internal.permCases.storeMeta, { ...base, totalCases: 5 });
    await t.mutation(internal.permCases.storeMeta, {
      ...base,
      totalCases: 9,
      contentHash: "def",
    });
    expect((await t.query(api.permCases.getMeta, {}))?.totalCases).toBe(9);
    // Bounded on purpose even in a test: `take(5)` proves "exactly one row"
    // just as well as collect() and models the habit the rest of the file
    // depends on.
    const all = await t.run(async (ctx) => ctx.db.query("permCasesMeta").take(5));
    expect(all).toHaveLength(1);
  });
});

describe("the row contract with the Python ingest", () => {
  it("writes exactly these fields, and nothing else", () => {
    // Written out on purpose. `scripts/store_cases.py` carries the same list,
    // and the two are the only thing standing between a renamed field and a
    // quarterly ingest that fails at the last step. Changing this list is the
    // moment to change that one.
    expect(INGEST_ROW_FIELDS).toEqual([
      "attorneyName",
      "attorneySlug",
      "caseNumber",
      "days",
      "decisionDate",
      "employerName",
      "employerSlug",
      "fiscalYear",
      "jobTitle",
      "receivedDate",
      "socCode",
      "socTitle",
      "state",
      "status",
      "wage",
    ]);
  });
});

describe("searchCases", () => {
  it("finds an employer by part of its name", async () => {
    const t = await seeded();
    const hits = await t.query(api.permCases.searchCases, {
      field: "employer",
      text: "microsoft",
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.employerName.toLowerCase().includes("microsoft"))).toBe(true);
  });

  it("searches law firms on the other index", async () => {
    const t = await seeded();
    const hits = await t.query(api.permCases.searchCases, { field: "attorney", text: "BAL" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.attorneyName === "BAL LLP")).toBe(true);
  });

  it("narrows a search by outcome", async () => {
    const t = await seeded();
    const hits = await t.query(api.permCases.searchCases, {
      field: "employer",
      text: "microsoft",
      status: "denied",
    });
    expect(hits.every((h) => h.status === "denied")).toBe(true);
  });

  it("runs its cheap guards before touching the index", async () => {
    const t = await seeded();
    // Under two characters is not a search, it is a scan of the whole index.
    expect(await t.query(api.permCases.searchCases, { field: "employer", text: "" })).toEqual([]);
    expect(await t.query(api.permCases.searchCases, { field: "employer", text: "m" })).toEqual([]);
    // The length cap runs before anything walks the string, because this is
    // reachable unauthenticated and v.string() accepts about a megabyte.
    expect(
      await t.query(api.permCases.searchCases, {
        field: "employer",
        text: "microsoft ".repeat(50_000),
      }),
    ).toEqual([]);
  });

  it("caps how many matches it will return", async () => {
    const t = await seeded();
    const hits = await t.query(api.permCases.searchCases, {
      field: "employer",
      text: "microsoft",
      limit: 10_000,
    });
    expect(hits.length).toBeLessThanOrEqual(MAX_SEARCH_RESULTS);
  });
});

describe("permWageStats", () => {
  function cell(over: Partial<Record<string, unknown>> = {}) {
    return {
      kind: "occupation" as const,
      key: "15-1252",
      socCode: "15-1252",
      socTitle: "Software Developers",
      state: "",
      fiscalYear: "all",
      count: 1200,
      p5: 70_000,
      p10: 82_000,
      p25: 105_000,
      p50: 150_000,
      p75: 190_000,
      p90: 230_000,
      p95: 250_000,
      mean: 152_000,
      histogram: [0, 0, 100, 200, 300, 300, 200, 50, 30, 20, 0, 0, 0, 0],
      ...over,
    };
  }

  const META = {
    sourceFiles: ["PERM_Disclosure_Data_FY2026_Q3.xlsx"],
    binEdges: [0, 40_000, 60_000, 80_000, 100_000, 120_000, 140_000, 160_000, 180_000, 200_000, 250_000, 300_000, 400_000, 500_000],
    floors: { single: 50, pair: 100 },
    policy: {
      rule: "exclude-out-of-band",
      min: 15_000,
      max: 1_000_000,
      considered: 6_000,
      kept: 5_527,
      excluded: 473,
      excludedByReason: [
        { reason: "above-band", count: 116 },
        { reason: "below-band", count: 296 },
        { reason: "unknown-unit", count: 61 },
      ],
      population: "certified cases with a published wage",
      percentileMethod: "linear-interpolation",
    },
    cells: 3,
    fiscalYears: ["2025", "2026"],
    contentHash: "abc",
  };

  it("writes exactly these fields, and nothing else", () => {
    // The Python half of this contract is EXPECTED_WAGE_KEYS in
    // scripts/store_cases.py. Changing this list is the moment to change that
    // one, or a quarterly ingest dies at its last step.
    expect(WAGE_CELL_FIELDS).toEqual([
      "count",
      "fiscalYear",
      "histogram",
      "key",
      "kind",
      "mean",
      "p10",
      "p25",
      "p5",
      "p50",
      "p75",
      "p90",
      "p95",
      "socCode",
      "socTitle",
      "state",
    ]);
  });

  it("ranks a partition by count, descending", async () => {
    const t = createTestContext();
    await t.mutation(internal.permWageStats.insertChunk, {
      rows: [
        cell({ key: "15-1252", count: 1200 }),
        cell({ key: "13-2011", socCode: "13-2011", count: 3000 }),
        cell({ key: "29-1141", socCode: "29-1141", count: 800 }),
      ],
    });
    const top = await t.query(api.permWageStats.listTop, { kind: "occupation" });
    expect(top.map((c) => c.count)).toEqual([3000, 1200, 800]);
    const capped = await t.query(api.permWageStats.listTop, {
      kind: "occupation",
      limit: 10_000,
    });
    expect(capped.length).toBeLessThanOrEqual(500);
  });

  it("keeps the pooled row and the per-year rows apart", async () => {
    const t = createTestContext();
    await t.mutation(internal.permWageStats.insertChunk, {
      rows: [
        cell({ fiscalYear: "all", count: 1200, p50: 150_000 }),
        cell({ fiscalYear: "2026", count: 400, p50: 165_000 }),
      ],
    });
    // Pooling five years into one median publishes a rate that was never the
    // market rate in any year of it, so the two must be separately reachable.
    const pooled = await t.query(api.permWageStats.getCell, {
      kind: "occupation",
      key: "15-1252",
    });
    const year = await t.query(api.permWageStats.getCell, {
      kind: "occupation",
      key: "15-1252",
      fiscalYear: "2026",
    });
    expect(pooled?.p50).toBe(150_000);
    expect(year?.p50).toBe(165_000);
    expect(await t.query(api.permWageStats.listTop, { kind: "occupation", fiscalYear: "2026" })).toHaveLength(1);
  });

  it("returns null for a cell that never cleared its floor", async () => {
    const t = createTestContext();
    await t.mutation(internal.permWageStats.insertChunk, { rows: [cell()] });
    // Null means "not published", not "nobody earns anything there", and a
    // page must not render it as zero.
    expect(
      await t.query(api.permWageStats.getCell, { kind: "state", key: "WY" }),
    ).toBeNull();
    expect(
      await t.query(api.permWageStats.getCell, { kind: "occupation", key: "15-1252", fiscalYear: "1999" }),
    ).toBeNull();
  });

  it("refuses a meta document that would leave a chart with no axis", async () => {
    const t = createTestContext();
    expect(await t.query(api.permWageStats.getMeta, {})).toBeNull();

    const noCells = await t.mutation(internal.permWageStats.storeMeta, { ...META, cells: 0 });
    expect(noCells.stored).toBe(false);
    // An empty bin list renders as a histogram with no scale rather than an
    // error, which is why it is refused rather than stored.
    const noBins = await t.mutation(internal.permWageStats.storeMeta, { ...META, binEdges: [] });
    expect(noBins.stored).toBe(false);
    expect(await t.query(api.permWageStats.getMeta, {})).toBeNull();

    expect((await t.mutation(internal.permWageStats.storeMeta, META)).stored).toBe(true);
    const meta = await t.query(api.permWageStats.getMeta, {});
    expect(meta?.binEdges).toHaveLength(14);
    // The exclusions must reconcile: a reader who sums the reasons has to get
    // `excluded`, not `considered`. "ok" is deliberately not in that list.
    const summed = (meta?.policy.excludedByReason ?? []).reduce((a, r) => a + r.count, 0);
    expect(summed).toBe(meta?.policy.excluded);
    expect((meta?.policy.kept ?? 0) + (meta?.policy.excluded ?? 0)).toBe(meta?.policy.considered);
  });

  it("keeps one meta row, so a re-ingest replaces rather than accumulates", async () => {
    const t = createTestContext();
    await t.mutation(internal.permWageStats.storeMeta, META);
    await t.mutation(internal.permWageStats.storeMeta, { ...META, cells: 9, contentHash: "def" });
    expect((await t.query(api.permWageStats.getMeta, {}))?.cells).toBe(9);
    const all = await t.run(async (ctx) => ctx.db.query("permWageMeta").take(5));
    expect(all).toHaveLength(1);
  });

  it("clears in batches, reporting whether more remain", async () => {
    const t = createTestContext();
    await t.mutation(internal.permWageStats.insertChunk, {
      rows: Array.from({ length: 30 }, (_, i) => cell({ key: `soc-${i}`, count: i + 1 })),
    });
    const first = await t.mutation(internal.permWageStats.clearBatch, { max: 10 });
    expect(first).toEqual({ deleted: 10, done: false });
    let deleted = first.deleted;
    for (let i = 0; i < 5; i++) {
      const res = await t.mutation(internal.permWageStats.clearBatch, { max: 10 });
      deleted += res.deleted;
      if (res.done) break;
    }
    expect(deleted).toBe(30);
  });
});

describe("clearBatch", () => {
  it("reports whether more remain, so the caller knows to loop", async () => {
    const t = await seeded();
    const first = await t.mutation(internal.permCases.clearBatch, { max: 50 });
    expect(first).toEqual({ deleted: 50, done: false });
    let deleted = first.deleted;
    for (let i = 0; i < 10; i++) {
      const res = await t.mutation(internal.permCases.clearBatch, { max: 50 });
      deleted += res.deleted;
      if (res.done) break;
    }
    expect(deleted).toBe(120);
    const left = await t.run(async (ctx) => ctx.db.query("permCases").take(1));
    expect(left).toHaveLength(0);
  });
});
