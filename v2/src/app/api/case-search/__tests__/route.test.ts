import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The guards on the one search across PERM, wage requests and LCAs, and the
 * CSV download that runs through them.
 *
 * Each validation case is the public-endpoint checklist in v2/CLAUDE.md: shape
 * checks before any work, a length cap before any character test, and a
 * refusal that is a 400 rather than an empty 200. The CSV cases pin that the
 * download is the SAME answer as the JSON one (same guards, same search call,
 * same row cap) and that a cell a spreadsheet would run as a formula is not
 * written as one.
 */

const unifiedSearch = vi.fn();
vi.mock("@/lib/turso/unifiedSearch", async () => {
  // The pure half is real: `isSearchOrder`, `isProgram` and the row cap are
  // guards under test, and mocked versions would make those cases vacuous.
  const real = await vi.importActual<typeof import("@/lib/turso/unifiedSearch")>(
    "@/lib/turso/unifiedSearch",
  );
  return { ...real, unifiedSearch };
});
const searchByName = vi.fn();
vi.mock("@/lib/turso/entities", () => ({ searchByName }));

const { GET } = await import("../route");
const { UNIFIED_MAX } = await import("@/lib/turso/unifiedSearch");

const get = (qs: string) => GET(new Request(`https://permtracker.app/api/case-search?${qs}`));

function result(over: Record<string, unknown> = {}) {
  return {
    rows: [],
    counts: { perm: 0, pwd: 0, lca: 0, seasonal: 0 },
    truncated: false,
    capped: false,
    windowed: false,
    skipped: { live: false, published: false, because: [] },
    permOnly: [],
    order: "filed-desc",
    orderScope: "complete",
    lead: { kind: "employer", value: "acme" },
    ...over,
  };
}

const row = (over: Record<string, unknown> = {}) => ({
  caseNumber: "G-100-19001-000001",
  program: "perm",
  half: "published",
  status: "certified",
  isFinal: true,
  filedOn: "2019-01-02",
  decidedOn: "2019-06-01",
  employerName: "ACME CORP",
  employerSlug: "acme-corp",
  jobTitle: "Engineer",
  wage: 120000,
  wageUnit: null,
  state: "WA",
  firmName: null,
  firmSlug: null,
  socCode: "15-1252.00",
  socTitle: "Software Developers",
  days: 150,
  era: "history",
  industryCode: "541511",
  industryTitle: "Custom Computer Programming Services",
  city: "SEATTLE",
  citizenship: "INDIA",
  birthCountry: "INDIA",
  visaClass: "H-1B",
  education: "Master's",
  major: "COMPUTER SCIENCE",
  institution: "UNIVERSITY OF WASHINGTON",
  jobEducation: "Master's",
  ...over,
});

beforeEach(() => {
  unifiedSearch.mockReset();
  unifiedSearch.mockResolvedValue(result());
  searchByName.mockReset();
  searchByName.mockResolvedValue([]);
});

/** The `narrow` the route handed the search on its last call. */
const lastNarrow = () => unifiedSearch.mock.calls.at(-1)?.[0].narrow;

describe("the worker, job and industry filters", () => {
  it("passes each one to the search under an employer lead", async () => {
    const r = await get(
      "q=acme&naics=5415&city=seattle&cit=india&bcountry=india&visa=H-1B&edu=Master%27s&jobedu=Bachelor%27s",
    );
    expect(r.status).toBe(200);
    expect(lastNarrow()).toEqual({
      naics: "5415",
      city: "seattle",
      citizenship: "india",
      birthCountry: "india",
      visaClass: "H-1B",
      education: "Master's",
      jobEducation: "Bachelor's",
    });
  });

  it.each([
    ["a sector range", "31-33"],
    ["a sector", "54"],
    ["a six-digit code", "541511"],
  ])("accepts %s as the industry", async (_label, code) => {
    const r = await get(`q=acme&naics=${code}`);
    expect(r.status).toBe(200);
    expect(lastNarrow()).toEqual({ naics: code });
  });

  it.each([
    ["letters", "naics=software"],
    ["one digit", "naics=5"],
    ["seven digits", "naics=5415111"],
    ["a range with three digits a side", "naics=311-333"],
    ["a city with markup", "city=%3Cscript%3E"],
    ["a country with a semicolon", "cit=INDIA%3B%20DROP"],
    ["a field over the length cap", `bcountry=${"A".repeat(61)}`],
    ["an unknown order", "order=random"],
    ["an unknown format", "format=xml"],
  ])("400s on %s, before any search", async (_label, qs) => {
    const r = await get(`q=acme&${qs}`);
    expect(r.status).toBe(400);
    expect(unifiedSearch).not.toHaveBeenCalled();
  });

  it("accepts the punctuation real country names carry", async () => {
    const r = await get(`q=acme&cit=${encodeURIComponent("KOREA, SOUTH")}&bcountry=${encodeURIComponent("CONGO (KINSHASA)")}`);
    expect(r.status).toBe(200);
    expect(lastNarrow()).toEqual({ citizenship: "KOREA, SOUTH", birthCountry: "CONGO (KINSHASA)" });
  });

  it("drops them under a stage lead, which reads the live feed only, and says so", async () => {
    const r = await get("stage=rfi-issued&cit=INDIA&naics=54");
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(lastNarrow()).toEqual({});
    expect(body.dropped).toEqual(expect.arrayContaining(["industry", "citizenship"]));
  });
});

describe("the prevailing wage source", () => {
  it.each(["oes", "survey", "cba", "contract"])("passes wsrc=%s to the search", async (src) => {
    const r = await get(`q=acme&wsrc=${src}`);
    expect(r.status).toBe(200);
    expect(lastNarrow()).toEqual({ wageSource: src });
  });

  it.each([
    ["DOL's own spelling", "wsrc=Survey"],
    ["an unknown source", "wsrc=union"],
    ["a prototype key", "wsrc=toString"],
  ])("400s on %s, before any search", async (_label, qs) => {
    const r = await get(`q=acme&${qs}`);
    expect(r.status).toBe(400);
    expect(unifiedSearch).not.toHaveBeenCalled();
  });

  it.each([
    ["an industry", "naics=54"],
    ["a city", "city=austin"],
    ["the worker's citizenship", "cit=india"],
  ])("400s when it's combined with %s, which only the PERM file carries", async (_label, qs) => {
    const r = await get(`q=acme&wsrc=survey&${qs}`);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain("LCA file");
    expect(unifiedSearch).not.toHaveBeenCalled();
  });

  it("drops it under a stage lead, which reads the live feed only, and says so", async () => {
    const r = await get("stage=rfi-issued&wsrc=survey");
    expect(r.status).toBe(200);
    expect(lastNarrow()).toEqual({});
    expect((await r.json()).dropped).toContain("wageSource");
  });
});

describe("the order", () => {
  it("hands the chosen order to the search", async () => {
    await get("q=acme&order=wage-desc");
    expect(unifiedSearch.mock.calls.at(-1)?.[0].order).toBe("wage-desc");
  });

  it("passes no order when none is asked, so the search keeps its default", async () => {
    await get("q=acme");
    expect(unifiedSearch.mock.calls.at(-1)?.[0]).not.toHaveProperty("order");
  });
});

describe("format=csv", () => {
  it("returns the same search's rows as CSV, every column named", async () => {
    unifiedSearch.mockResolvedValue(result({ rows: [row()] }));
    const r = await get("q=acme&cit=INDIA&format=csv");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/^text\/csv/);
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; filename=".+\.csv"$/);
    const [header, first, ...rest] = (await r.text()).trimEnd().split("\r\n");
    expect(header).toBe(
      "case_number,program,form,record,status,filed,decided,days_to_decision,employer,job_title,occupation_code,occupation,worksite_state,worksite_city,law_firm,wage,wage_unit,wage_note,industry_naics,industry,worker_citizenship,worker_birth_country,worker_visa_at_filing,worker_education,worker_field_of_study,worker_school,job_minimum_education",
    );
    expect(first).toContain("G-100-19001-000001,perm,,\"published, FY2016-FY2023\",certified");
    expect(first).toContain("SEATTLE,,120000,Year,,541511");
    expect(rest).toEqual([]);
    // The same search the JSON answer makes, with the same filter.
    expect(lastNarrow()).toEqual({ citizenship: "INDIA" });
  });

  it("keeps DOL's amount and unit as printed, and marks one that looks like a yearly salary", async () => {
    unifiedSearch.mockResolvedValue(
      result({ rows: [row({ caseNumber: "I-200-24300-000001", program: "lca", wage: 100000, wageUnit: "Month" })] }),
    );
    const text = await (await get("q=acme&format=csv")).text();
    expect(text).toContain(",100000,Month,looks like a yearly salary under this unit,");
  });

  it("names the seasonal form a row is, which the program key alone does not", async () => {
    unifiedSearch.mockResolvedValue(
      result({ rows: [row({ caseNumber: "JO-A-300-26271-264525", program: "seasonal" })] }),
    );
    const text = await (await get("q=acme&format=csv")).text();
    expect(text).toContain("JO-A-300-26271-264525,seasonal,H-2A job order,");
  });

  it("asks for no more rows than the JSON answer can hold", async () => {
    await get("q=acme&format=csv&limit=5000");
    expect(unifiedSearch.mock.calls.at(-1)?.[0].limit).toBe(UNIFIED_MAX);
    expect(UNIFIED_MAX).toBeLessThanOrEqual(1000);
  });

  it("never writes a cell a spreadsheet would run as a formula", async () => {
    unifiedSearch.mockResolvedValue(
      result({ rows: [row({ employerName: "=HYPERLINK(\"x\")", jobTitle: "+1 engineer", major: "@SUM" })] }),
    );
    const text = await (await get("q=acme&format=csv")).text();
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
    expect(text).toContain(",'+1 engineer,");
    expect(text).toContain(",'@SUM,");
    expect(text).not.toMatch(/,=|,\+|,@/);
  });

  it("refuses a download with nothing to search by, rather than serving an empty file", async () => {
    const r = await get("format=csv");
    expect(r.status).toBe(400);
    expect(unifiedSearch).not.toHaveBeenCalled();
  });

  it("refuses a malformed download as JSON, like the search itself", async () => {
    const r = await get("q=acme&format=csv&naics=abc");
    expect(r.status).toBe(400);
    expect(r.headers.get("content-type")).toMatch(/json/);
  });
});
