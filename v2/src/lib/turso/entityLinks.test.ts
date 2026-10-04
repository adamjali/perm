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
  employer_other_index: [{ slug: "shore-crabs-llc" }],
  seasonal_employer_index: [{ slug: "green-acres-farm-llc" }],
};
const PAGE_MAP: { source_slug: string; page_slug: string }[] = [
  { source_slug: "adobe-inc", page_slug: "adobe-inc" },
  { source_slug: "salesforce-com-inc", page_slug: "salesforce-inc" },
];
const asked: string[] = [];
let fail = false;
let newTablesMissing = false;

vi.mock("./client", () => ({
  rows: async (sql: string, args: unknown[]) => {
    if (fail) throw new Error("database unavailable");
    asked.push(sql.replace(/\s+/g, " "));
    const table = /FROM (\w+)/.exec(sql)![1]!;
    if (newTablesMissing && (table === "employer_other_index" || table === "employer_page_map")) {
      throw new Error(`SQLITE_ERROR: no such table: ${table}`);
    }
    if (table === "employer_page_map") {
      const wanted = new Set(args as string[]);
      return PAGE_MAP.filter((r) => wanted.has(r.source_slug));
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
  newTablesMissing = false;
});

describe("linkableSlugs", () => {
  it("knows an employer page by its published row, an alias, a live PERM filing, a page with no PERM record, or the map", async () => {
    const ok = await linkableSlugs("employer", [
      "adobe-inc", "adobe-systems-inc", "new-startup-llc", "shore-crabs-llc", "salesforce-com-inc",
      "steamboat-ski-resort-corporation", null, "",
    ]);
    expect([...ok].sort()).toEqual(["adobe-inc", "adobe-systems-inc", "new-startup-llc", "salesforce-com-inc", "shore-crabs-llc"]);
  });

  it("falls back to the Oct 3 seasonal index before the nightly map's first build, without failing", async () => {
    newTablesMissing = true;
    const ok = await linkableSlugs("employer", ["adobe-inc", "green-acres-farm-llc", "shore-crabs-llc", "salesforce-com-inc"]);
    expect([...ok].sort()).toEqual(["adobe-inc", "green-acres-farm-llc"]);
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
    // 3 batches (300, 300, 50) x 5 tables.
    expect(asked).toHaveLength(15);
  });
});

describe("keepLinkableSlugs", () => {
  const rowsIn = [
    { employerSlug: "adobe-inc", firm: "fragomen-del-rey-bernsen-loewy-llp" },
    { employerSlug: "steamboat-ski-resort-corporation", firm: "goldstein-law-group" },
    { employerSlug: null, firm: null },
    { employerSlug: "salesforce-com-inc", firm: null },
  ];
  const firmOf = (r: { firm: string | null }) => r.firm;
  const clear = <T extends { firm: string | null }>(r: T): T => ({ ...r, firm: null });

  it("prints a name without a page as text, keeps every real link, and points a spelling at its page", async () => {
    const out = await keepLinkableSlugs(rowsIn, firmOf, clear);
    expect(out).toEqual([
      { employerSlug: "adobe-inc", firm: "fragomen-del-rey-bernsen-loewy-llp" },
      { employerSlug: null, firm: null },
      { employerSlug: null, firm: null },
      { employerSlug: "salesforce-inc", firm: null },
    ]);
  });

  it("leaves the rows alone if the lookup fails, rather than failing the page", async () => {
    fail = true;
    expect(await keepLinkableSlugs(rowsIn, firmOf, clear)).toBe(rowsIn);
  });
});
