import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one, exec: vi.fn() }));

const ref = await import("../reference");

describe("reference reads", () => {
  beforeEach(() => {
    rows.mockReset();
    one.mockReset();
    rows.mockResolvedValue([]);
    one.mockResolvedValue(null);
  });

  it("reads a SOC code with or without its O*NET suffix, and nothing else", () => {
    expect(ref.soc7("15-1252.00")).toBe("15-1252");
    expect(ref.soc7(" 15-1252 ")).toBe("15-1252");
    expect(ref.soc7("N/A")).toBeNull();
    expect(ref.soc7(null)).toBeNull();
  });

  it("names a wage year by the July that opened it", () => {
    expect(ref.wageYearLabel(2026)).toBe("2026-27");
    expect(ref.wageYearLabel(2099)).toBe("2099-00");
  });

  it("maps O*NET rows in code order, tolerating a broken detail cell", async () => {
    rows.mockResolvedValueOnce([
      { onet_code: "11-1011.00", title: "Chief Executives", description: "Direct.", job_zone: "5", bright: "Rapid Growth; Numerous Job Openings", detail: JSON.stringify({ education: [{ level: "Master's Degree", pct: 46 }], titles: ["CEO"], tasks: ["Direct."], related: [] }) },
      { onet_code: "11-1011.03", title: "Chief Sustainability Officers", description: "Coordinate.", job_zone: null, bright: null, detail: "{not json" },
    ]);
    one.mockResolvedValueOnce({ json: JSON.stringify({ jobZones: { "5": { name: "Job Zone Five", education: "Graduate", experience: "Years" } }, version: "31.0" }) });
    const got = await ref.onetForSoc("11-1011");
    expect(rows.mock.calls[0]![0]).toContain("ORDER BY onet_code");
    expect(got?.occupations.map((o) => o.code)).toEqual(["11-1011.00", "11-1011.03"]);
    expect(got?.occupations[0]).toMatchObject({ jobZone: 5, bright: ["Rapid Growth", "Numerous Job Openings"], titles: ["CEO"] });
    expect(got?.occupations[1]).toMatchObject({ jobZone: null, bright: [], tasks: [], education: [] });
    expect(got?.version).toBe("31.0");
  });

  it("has no O*NET answer for a code with no rows, or no code", async () => {
    expect(await ref.onetForSoc("99-9999")).toBeNull();
    expect(await ref.onetForSoc("junk")).toBeNull();
  });

  it("maps BLS pay, top-coding and annual-only flags", async () => {
    one.mockResolvedValueOnce({
      area: "99", area_type: "1", area_title: "U.S.", title: "Chief Executives", tot_emp: "204350", a_mean: "269630",
      a_p10: "75700", a_p25: "129540", a_median: "213990", a_p75: null, a_p90: null, top_coded: "pct75,pct90", annual_only: "0", series: "May 2025",
    });
    const pay = await ref.marketPayNational("11-1011.00");
    expect(one.mock.calls[0]![1]).toEqual(["11-1011"]);
    expect(pay).toMatchObject({ median: 213990, p75: null, topCoded: ["pct75", "pct90"], annualOnly: false, employment: 204350 });
  });

  it("asks for no area pay without a valid code or area", async () => {
    expect(await ref.marketPayIn("x", ["41940"])).toEqual([]);
    expect(await ref.marketPayIn("15-1252", ["Robert'); DROP"])).toEqual([]);
    expect(rows).not.toHaveBeenCalled();
  });

  it("reads an area's wage levels from the newest wage year, all-industries table", async () => {
    rows.mockResolvedValueOnce([{ soc7: "15-1252", wage_year: "2026", l1: "73.46", l2: "89.94", l3: "106.43", l4: "122.91", label: "" }]);
    const got = await ref.wageLevelsForArea("41940", ["15-1252.00", "15-1252"]);
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toContain("max(wage_year)");
    expect(sql).toContain("collection = 'alc'");
    expect(args).toEqual(["41940", "15-1252"]);
    expect(got[0]).toMatchObject({ soc: "15-1252", wageYear: 2026, levels: [73.46, 89.94, 106.43, 122.91], label: null });
  });

  it("keeps DOL's High Wage label on a row with no levels", async () => {
    rows.mockResolvedValueOnce([{ wage_year: "2026", l1: null, l2: null, l3: null, l4: null, label: "High Wage" }]);
    const got = await ref.wageLevelHistory("29-1216", "14460");
    expect(got[0]).toEqual({ wageYear: 2026, levels: [null, null, null, null], label: "High Wage" });
  });

  it("gives the busiest occupation page for each SOC code", async () => {
    rows.mockResolvedValueOnce([
      { soc: "13-2011", slug: "accountants-and-auditors" },
      { soc: "13-2011", slug: "132011-01-accountants" },
    ]);
    const got = await ref.occupationSlugs(["13-2011.00", "13-2011.01"]);
    expect(got.get("13-2011")).toBe("accountants-and-auditors");
  });

  it("maps BEA's lines for an area's newest year, and nothing for a bad code", async () => {
    rows.mockResolvedValueOnce([
      { year: "2024", line: "all", value: "118.5", geo_name: "San Jose" },
      { year: "2024", line: "housing", value: "160.2", geo_name: "San Jose" },
    ]);
    expect(await ref.priceParity("41940")).toMatchObject({ year: 2024, all: 118.5, housing: 160.2, goods: null });
    expect(await ref.priceParity("4194")).toBeNull();
  });
});
