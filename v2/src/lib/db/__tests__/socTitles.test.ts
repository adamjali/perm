import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn(), exec: vi.fn() }));
const doc = vi.fn<(key: string) => Promise<unknown>>();
vi.mock("../publicData", () => ({ doc }));

const CODES_DOC = {
  builtAt: "2026-10-29T13:25:19Z",
  onetRelease: "31.0",
  spans: {},
  counts: { rows: 3, titles: 2, dolTitles: 2, codes: 2, pages: 2 },
  pageMin: 50,
  codes: [
    ["15-1252", "Software Developers", 4, 900, 300, 2000, "software-developers", 120],
    ["15-2051", "Data Scientists", 4, 100, 50, 300, "data-scientists", 40],
  ],
};

const DS_ROWS = [
  { title_key: "data scientist", soc7: "15-2051", title: "Data Scientist", source: "dol", filings: "850", perm: "100", pwd: "50", lca: "700", spellings: '[["DATA SCIENTIST",800]]', key_filings: "1000" },
  { title_key: "data scientist", soc7: "15-1252", title: "Data Scientist", source: "dol", filings: "100", perm: "10", pwd: "10", lca: "80", spellings: "not json", key_filings: "1000" },
];

/** The SQL each call ran, so a test can answer by what was asked. */
function answer(sql: string, args: unknown[] = []): unknown[] {
  if (sql.includes("GROUP BY title_key")) {
    const lo = String(args[0] ?? "");
    const all = [
      { title_key: "data scientist", title: "Data Scientist", total: "1000" },
      { title_key: "data science manager", title: "Data Science Manager", total: "12" },
      { title_key: "software engineer", title: "Software Engineer", total: "200000" },
    ];
    return all.filter((r) => r.title_key >= lo && (args.length < 2 || r.title_key < String(args[1])));
  }
  if (sql.includes("WHERE title_key IN")) return DS_ROWS.filter((r) => args.includes(r.title_key));
  if (sql.includes("filings > 0")) return [{ title_key: "software engineer", title: "Software Engineer", filings: "190000", key_filings: "200000" }];
  if (sql.includes("source != 'dol'")) return [{ title: "Software Engineer" }, { title: "Software Engineer" }, { title: "Web Developer" }];
  return [];
}

const reads = await import("../socTitles");

describe("the job code finder's reads", () => {
  beforeEach(() => {
    rows.mockReset();
    rows.mockImplementation(async (sql, args) => answer(sql, args));
    doc.mockReset();
    doc.mockResolvedValue(CODES_DOC);
  });

  it("answers a typed code from the codes doc, with what a 2010 code became", async () => {
    const got = await reads.findSoc("15-1132");
    expect(got.code?.became.map((b) => b.soc)).toEqual(expect.arrayContaining(["15-1252"]));
    expect(got.titles).toEqual([]);
  });

  it("puts the exact title first, with its codes and shares, and reads every key range", async () => {
    const got = await reads.findSoc("Data Scientist");
    expect(got.titles[0]).toMatchObject({ key: "data scientist", total: 1000, slug: "data-scientist" });
    expect(got.titles[0]!.codes.map((c) => [c.soc, c.share])).toEqual([["15-2051", 0.85], ["15-1252", 0.1]]);
    expect(got.titles[0]!.codes[1]!.spellings).toEqual([]);
    const ranges = rows.mock.calls.filter(([sql]) => sql.includes("GROUP BY title_key"));
    expect(ranges.length).toBe(27);
  });

  it("finds a code by BLS's own name for the job", async () => {
    const got = await reads.findSoc("Data Scientists");
    expect(got.codes.map((c) => c.soc)).toContain("15-2051");
  });

  it("lists a code's titles with their shares, and O*NET's once each", async () => {
    const got = await reads.titlesForCode("15-1252");
    expect(got.filed[0]).toMatchObject({ key: "software engineer", share: 0.95 });
    expect(got.onet).toEqual(["Software Engineer", "Web Developer"]);
  });

  it("answers nothing for an empty box, without a read", async () => {
    const got = await reads.findSoc("   ");
    expect(got).toEqual({ query: "", code: null, titles: [], codes: [] });
  });
});
