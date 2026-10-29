import { describe, expect, it } from "vitest";

import {
  answerForCode,
  answerForTitle,
  codeHref,
  majorGroups,
  parseCodes,
  parseSocQuery,
  type SocTitleRow,
} from "../socFinder";
import { successorsOf } from "../socCrosswalk";

// The soc_codes doc's compact rows, as written Oct 29 2026 (figures cut down).
const CODES = parseCodes([
  ["15-1252", "Software Developers", 4, 900, 300, 2000, "software-developers", 120],
  ["15-2051", "Data Scientists", 4, 100, 50, 300, "data-scientists", 40],
  ["15-2041", "Statisticians", 5, 10, 5, 30, null, 10],
  ["15-1253", "Software Quality Assurance Analysts and Testers", 4, 50, 20, 200, "software-quality-assurance-analysts-and-testers", 30],
  ["29-1141", "Registered Nurses", 3, 5, 10, 20, "registered-nurses", 15],
  ["not-a-row"],
]);

const row = (soc: string, filings: number, source: SocTitleRow["source"] = "dol", keyFilings = 1000): SocTitleRow => ({
  key: "data scientist",
  soc,
  title: "Data Scientist",
  source,
  filings,
  perm: filings,
  pwd: 0,
  lca: 0,
  spellings: [["DATA SCIENTIST", filings]],
  keyFilings,
});

describe("parseCodes", () => {
  it("reads the doc's rows and skips a malformed one", () => {
    expect(CODES.size).toBe(5);
    expect(CODES.get("15-2041")).toMatchObject({ title: "Statisticians", zone: 5, slug: null });
  });
});

describe("parseSocQuery", () => {
  it("reads a code however it's typed", () => {
    for (const q of ["15-1252", "15-1252.00", "151252", "15 1252", " 15-1252 "]) {
      expect(parseSocQuery(q), q).toEqual({ kind: "code", soc: "15-1252" });
    }
  });

  it("reads anything else as words", () => {
    expect(parseSocQuery("data scientist")).toEqual({ kind: "words", text: "data scientist" });
    expect(parseSocQuery("15-125")).toEqual({ kind: "words", text: "15-125" });
    expect(parseSocQuery("   ")).toEqual({ kind: "empty" });
  });
});

describe("answerForTitle", () => {
  const rows = [row("15-2041", 60), row("15-2051", 850, "both"), row("15-1252", 0, "onet")];

  it("lists the codes employers used busiest first, then O*NET's alone", () => {
    const a = answerForTitle(rows, CODES, 50)!;
    expect(a.codes.map((c) => c.soc)).toEqual(["15-2051", "15-2041", "15-1252"]);
    expect(a.codes[0]).toMatchObject({ codeTitle: "Data Scientists", onet: true, slug: "data-scientists", zone: 4 });
    expect(a.codes[2]!.share).toBeNull();
  });

  it("takes each share of the title's filings under every code, kept rows or not", () => {
    const a = answerForTitle(rows, CODES, 50)!;
    expect(a.total).toBe(1000);
    expect(a.codes[0]!.share).toBeCloseTo(0.85);
  });

  it("gives the title a page from its floor up", () => {
    expect(answerForTitle(rows, CODES, 1000)!.slug).toBe("data-scientist");
    expect(answerForTitle(rows, CODES, 1001)!.slug).toBeNull();
  });

  it("marks a code BLS retired with the codes it became", () => {
    const a = answerForTitle([row("15-1132", 30)], CODES, 50)!;
    expect(a.codes[0]!.becameCodes).toEqual(expect.arrayContaining(["15-1252", "15-1253"]));
  });

  it("answers nothing for no rows", () => {
    expect(answerForTitle([], CODES, 50)).toBeNull();
  });
});

describe("answerForCode", () => {
  it("reads a held code", () => {
    expect(answerForCode("15-1252", CODES)).toMatchObject({ known: true, title: "Software Developers", filings: 3200, became: [] });
  });

  it("reads a 2010 code as the 2018 codes it became", () => {
    expect(successorsOf("15-1132")).toEqual(expect.arrayContaining(["15-1252", "15-1253"]));
    const a = answerForCode("15-1132", CODES);
    expect(a.known).toBe(false);
    expect(a.became.map((b) => b.soc)).toEqual(expect.arrayContaining(["15-1252", "15-1253"]));
    expect(a.became.find((b) => b.soc === "15-1252")).toMatchObject({ title: "Software Developers", slug: "software-developers" });
  });
});

describe("majorGroups and codeHref", () => {
  it("groups codes under their major group, in code order", () => {
    const g = majorGroups(CODES);
    expect(g.map((x) => x.major)).toEqual(["15", "29"]);
    expect(g[0]!.codes.map((c) => c.soc)).toEqual(["15-1252", "15-1253", "15-2041", "15-2051"]);
    expect(g[0]!.filings).toBe(900 + 300 + 2000 + 50 + 20 + 200 + 10 + 5 + 30 + 100 + 50 + 300);
  });

  it("sends a code to its page, or to the wage tool set to it", () => {
    expect(codeHref("15-1252", "software-developers")).toBe("/perm-wages/software-developers");
    expect(codeHref("15-2041", null)).toBe("/tools/wage-levels?soc=15-2041");
  });
});
