import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A filing's employer and law-firm slugs are stored whether or not a page
 * exists for them. Linking the ones without a page sent visitors and crawlers
 * to 132 404s in three days (Oct 1 2026). The fake answers the three tables a
 * page resolves from, at the SQL level.
 */

const TABLES: Record<string, { kind?: string; slug: string }[]> = {
  perm_entities: [
    { kind: "employer", slug: "adobe-inc" },
    { kind: "attorney", slug: "fragomen-del-rey-bernsen-loewy-llp" },
  ],
  perm_entity_alias: [{ kind: "employer", slug: "adobe-systems-inc" }],
  perm_live_recent: [{ slug: "new-startup-llc" }],
  seasonal_employer_index: [{ slug: "shore-crabs-llc" }],
};
const asked: string[] = [];
let fail = false;
let noSeasonalTable = false;

vi.mock("./client", () => ({
  rows: async (sql: string, args: unknown[]) => {
    if (fail) throw new Error("database unavailable");
    asked.push(sql.replace(/\s+/g, " "));
    const table = /FROM (\w+)/.exec(sql)![1]!;
    if (noSeasonalTable && table === "seasonal_employer_index") {
      throw new Error("SQLITE_ERROR: no such table: seasonal_employer_index");
    }
    const kind = /kind = \?/.test(sql) ? (args[0] as string) : undefined;
    const wanted = new Set((kind ? args.slice(1) : args) as string[]);
    return (TABLES[table] ?? [])
      .filter((r) => (kind ? r.kind === kind : true) && wanted.has(r.slug))
      .map((r) => ({ slug: r.slug }));
  },
}));

import { keepLinkableSlugs, linkableSlugs } from "./entityLinks";

beforeEach(() => {
  asked.length = 0;
  fail = false;
  noSeasonalTable = false;
});

describe("linkableSlugs", () => {
  it("knows an employer page by its published row, an alias, a live PERM filing or a seasonal-only page", async () => {
    const ok = await linkableSlugs("employer", [
      "adobe-inc", "adobe-systems-inc", "new-startup-llc", "shore-crabs-llc", "steamboat-ski-resort-corporation", null, "",
    ]);
    expect([...ok].sort()).toEqual(["adobe-inc", "adobe-systems-inc", "new-startup-llc", "shore-crabs-llc"]);
  });

  it("treats a missing seasonal index (before its first nightly build) as no seasonal pages, not a failure", async () => {
    noSeasonalTable = true;
    const ok = await linkableSlugs("employer", ["adobe-inc", "shore-crabs-llc"]);
    expect([...ok]).toEqual(["adobe-inc"]);
  });

  it("knows a law-firm page only by its published row or an alias, never by a live filing", async () => {
    const ok = await linkableSlugs("attorney", ["fragomen-del-rey-bernsen-loewy-llp", "new-startup-llc"]);
    expect([...ok]).toEqual(["fragomen-del-rey-bernsen-loewy-llp"]);
    expect(asked.some((q) => q.includes("perm_live_recent"))).toBe(false);
  });

  it("asks nothing when there is nothing to check", async () => {
    expect((await linkableSlugs("employer", [null, undefined, ""])).size).toBe(0);
    expect(asked).toEqual([]);
  });

  it("asks in batches, so a long list never builds one enormous query", async () => {
    const many = Array.from({ length: 650 }, (_, i) => `employer-${i}`);
    await linkableSlugs("employer", many);
    // 3 batches (300, 300, 50) x 4 tables.
    expect(asked).toHaveLength(12);
  });
});

describe("keepLinkableSlugs", () => {
  const rowsIn = [
    { employerSlug: "adobe-inc", firm: "fragomen-del-rey-bernsen-loewy-llp" },
    { employerSlug: "steamboat-ski-resort-corporation", firm: "goldstein-law-group" },
    { employerSlug: null, firm: null },
  ];
  const firmOf = (r: { firm: string | null }) => r.firm;
  const clear = <T extends { firm: string | null }>(r: T): T => ({ ...r, firm: null });

  it("prints a name without a page as text and keeps every real link", async () => {
    const out = await keepLinkableSlugs(rowsIn, firmOf, clear);
    expect(out).toEqual([
      { employerSlug: "adobe-inc", firm: "fragomen-del-rey-bernsen-loewy-llp" },
      { employerSlug: null, firm: null },
      { employerSlug: null, firm: null },
    ]);
  });

  it("leaves the rows alone if the lookup fails, rather than failing the page", async () => {
    fail = true;
    expect(await keepLinkableSlugs(rowsIn, firmOf, clear)).toBe(rowsIn);
  });
});
