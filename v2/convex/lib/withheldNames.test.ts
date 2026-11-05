import { describe, expect, it } from "vitest";

import {
  makeMasker,
  nameKey,
  neutralPath,
  neutralSlug,
  parseWithheld,
  parseWithheldEnv,
  shownLabel,
  WITHHELD_ENV,
  type WithheldEntry,
} from "./withheldNames";

// Every name here is made up. The real lists are server settings and build
// secrets; this public repository must never hold a name a request took down.
const FIRM_RAW =
  "example-law-group-pllc|Example Law Group, PLLC|Law firm||3|example-law-group-pllc-2,exampel-law-group|EXAMPLE LAW GROUP PLLC^Exampel Law Group";
const EMPLOYER_RAW =
  "jane-q-example|Jane Q Example|Private household employer|G-100-25001-000001,P-100-25001-000009|1||";
const LEGACY_RAW = "acme-x-holdings|Acme X Holdings|Employer|G-100-25001-000077";

const entries: WithheldEntry[] = [
  ...parseWithheld(EMPLOYER_RAW, "employer"),
  ...parseWithheld(LEGACY_RAW, "employer"),
  ...parseWithheld(FIRM_RAW, "firm"),
];
const m = makeMasker(entries);
const FIRM = entries.find((e) => e.kind === "firm")!;
const JANE = entries.find((e) => e.slug === "jane-q-example")!;
const LEGACY = entries.find((e) => e.slug === "acme-x-holdings")!;

/** Prepare and mask in one step, the way rows() does. */
function read<T>(sql: string, args: unknown[], rows: T[], opts?: { drop?: boolean }) {
  const p = m.prepare(sql, args);
  return { prepared: p, rows: m.mask(rows, p.ctx, opts) };
}

describe("the setting's format", () => {
  it("parses the old four fields and the new seven", () => {
    expect(JANE).toMatchObject({
      kind: "employer",
      slug: "jane-q-example",
      name: "Jane Q Example",
      label: "Private household employer",
      cases: ["G-100-25001-000001", "P-100-25001-000009"],
      number: 1,
      slugs: ["jane-q-example"],
    });
    expect(LEGACY).toMatchObject({ number: null, cases: ["G-100-25001-000077"], slugs: ["acme-x-holdings"] });
    expect(FIRM).toMatchObject({
      kind: "firm",
      number: 3,
      slugs: ["example-law-group-pllc", "example-law-group-pllc-2", "exampel-law-group"],
      names: ["Example Law Group, PLLC", "EXAMPLE LAW GROUP PLLC", "Exampel Law Group"],
    });
  });

  it("skips a malformed entry and an unset setting", () => {
    expect(parseWithheld(undefined)).toEqual([]);
    expect(parseWithheld("only-a-slug")).toEqual([]);
    expect(parseWithheld("a||b")).toEqual([]);
    expect(parseWithheld("a|A|Employer||zero")[0]?.number).toBeNull();
  });

  it("reads each kind from its own setting", () => {
    const both = parseWithheldEnv({ [WITHHELD_ENV.employer]: EMPLOYER_RAW, [WITHHELD_ENV.firm]: FIRM_RAW });
    expect(both.map((e) => e.kind)).toEqual(["employer", "firm"]);
    expect(WITHHELD_ENV).toEqual({ employer: "WITHHELD_EMPLOYERS", firm: "WITHHELD_FIRMS" });
  });
});

describe("labels and neutral pages", () => {
  it("numbers each entry site-wide, from the number stored in it", () => {
    expect(shownLabel(FIRM)).toBe("Law firm 3");
    expect(neutralSlug(FIRM)).toBe("law-firm-3");
    expect(neutralPath(FIRM)).toBe("/perm-attorneys/law-firm-3");
    expect(shownLabel(JANE)).toBe("Private household employer 1");
    expect(neutralPath(JANE)).toBe("/perm-employers/private-household-employer-1");
    expect(shownLabel({ label: "A law firm", number: 7 })).toBe("Law firm 7");
  });

  it("gives an entry without a number its plain label and no page", () => {
    expect(shownLabel(LEGACY)).toBe("Employer");
    expect(neutralSlug(LEGACY)).toBeNull();
  });
});

describe("nameKey", () => {
  it("reads one firm under its printed spellings", () => {
    const k = nameKey("Example Law Group, PLLC");
    expect(k).toBe("example law group");
    expect(nameKey("EXAMPLE LAW GROUP P.L.L.C.")).toBe(k);
    expect(nameKey("example-law-group-pllc")).toBe(k);
    expect(nameKey("The Example Law Group LLC")).toBe(k);
    expect(nameKey("Smith & Jones")).toBe("smith and jones");
  });
});

describe("a read asked by the real name or slug", () => {
  const firmRow = { slug: "example-law-group-pllc", name: "Example Law Group, PLLC", rank: 40, total: 120 };

  it("drops the entity's own row, so the old URL answers 404", () => {
    const { rows, prepared } = read(
      "SELECT slug, name, rank, total FROM perm_entities WHERE kind = ? AND slug = ?",
      ["attorney", "example-law-group-pllc"],
      [firmRow],
    );
    expect(rows).toEqual([]);
    expect([...prepared.ctx.byReal]).toEqual([FIRM]);
  });

  it("drops it by any of its slugs and spellings, and by a search's words", () => {
    for (const slug of ["example-law-group-pllc-2", "exampel-law-group", "EXAMPLE-LAW-GROUP-PLLC"]) {
      expect(read("SELECT slug, name FROM perm_entities WHERE kind = ? AND slug = ?", ["attorney", slug], [firmRow]).rows).toEqual([]);
    }
    const cases = [{ case_number: "G-100-24001-000001", attorney_name: "Example Law Group PLLC", attorney_slug: "example-law-group-pllc" }];
    expect(read("SELECT * FROM perm_cases WHERE attorney_slug = ?", ["example-law-group-pllc"], cases).rows).toEqual([]);
    expect(read("SELECT * FROM perm_cases WHERE attorney_name LIKE ?", ["%Example Law Group, P.L.L.C.%"], cases).rows).toEqual([]);
  });

  it("drops an alias that would redirect the old name, even one the list doesn't hold", () => {
    const alias = [{ target_slug: "example-law-group-pllc" }];
    expect(read("SELECT target_slug FROM perm_entity_alias WHERE kind = ? AND slug = ?", ["attorney", "a-brand-new-spelling"], alias).rows).toEqual([]);
    expect(read("SELECT page_slug, page_kind FROM employer_page_map WHERE source_slug = ?", ["jane-q-example-2"], [{ page_slug: "jane-q-example", page_kind: "perm" }]).rows).toEqual([]);
  });

  it("never takes a case number for the name: a lookup by number keeps the case", () => {
    const row = { case_number: "G-100-25001-000001", employer_name: "JANE Q EXAMPLE", employer_slug: "jane-q-example", status: "Certified" };
    const { rows, prepared } = read("SELECT * FROM perm_cases WHERE case_number = ?", ["G-100-25001-000001"], [row]);
    expect(prepared.ctx.byReal.size).toBe(0);
    expect(rows).toEqual([{ ...row, employer_name: "Private household employer 1", employer_slug: "private-household-employer-1" }]);
  });
});

describe("a read asked by the neutral slug", () => {
  it("is rewritten to the real page slug, and the row comes back masked", () => {
    const { prepared, rows } = read(
      "SELECT slug, name, rank FROM perm_entities WHERE kind = ? AND slug = ?",
      ["attorney", "law-firm-3"],
      [{ slug: "example-law-group-pllc", name: "Example Law Group, PLLC", rank: 40 }],
    );
    expect(prepared.args).toEqual(["attorney", "example-law-group-pllc"]);
    expect([...prepared.ctx.byNeutral]).toEqual([FIRM]);
    expect(rows).toEqual([{ slug: "law-firm-3", name: "Law firm 3", rank: 40 }]);
  });

  it("widens an IN list to every slug the entity is known by", () => {
    const p = m.prepare("SELECT * FROM lca_cases WHERE attorney_slug IN (?, ?) AND x = ?", ["law-firm-3", "other-firm", 1]);
    expect(p.sql).toBe("SELECT * FROM lca_cases WHERE attorney_slug IN (?, ?, ?, ?) AND x = ?");
    expect(p.args).toEqual(["example-law-group-pllc", "example-law-group-pllc-2", "exampel-law-group", "other-firm", 1]);
  });

  it("widens a list of many neutral copies once, so a page map can't multiply it", () => {
    const p = m.prepare("SELECT * FROM pwd_cases WHERE x = ? AND attorney_slug IN (?,?,?) ORDER BY y", [7, "law-firm-3", "law-firm-3", "law-firm-3"]);
    expect(p.sql).toBe("SELECT * FROM pwd_cases WHERE x = ? AND attorney_slug IN (?, ?, ?) ORDER BY y");
    expect(p.args).toEqual([7, "example-law-group-pllc", "example-law-group-pllc-2", "exampel-law-group"]);
  });

  it("keeps a page-map row the neutral page asked for", () => {
    const { rows } = read(
      "SELECT source_slug FROM firm_page_map WHERE page_slug = ?",
      ["law-firm-3"],
      [{ source_slug: "exampel-law-group" }, { source_slug: "example-law-group-pllc" }],
    );
    expect(rows).toEqual([{ source_slug: "law-firm-3" }, { source_slug: "law-firm-3" }]);
  });

  it("leaves a range on a neutral slug alone, so its other bound can't make a nonsense range", () => {
    const p = m.prepare("SELECT * FROM perm_cases WHERE attorney_slug >= ? AND attorney_slug < ?", ["law-firm-3", "law-firm-4"]);
    expect(p.args).toEqual(["law-firm-3", "law-firm-4"]);
    expect(p.ctx.byNeutral.size).toBe(0);
    const like = m.prepare("SELECT * FROM perm_cases WHERE attorney_slug LIKE ?", ["law-firm-3"]);
    expect(like.args).toEqual(["law-firm-3"]);
  });

  it("is kind-aware: a firm's neutral slug doesn't open an employer page", () => {
    const p = m.prepare("SELECT slug, name FROM perm_entities WHERE kind = ? AND slug = ?", ["employer", "law-firm-3"]);
    expect(p.args).toEqual(["employer", "law-firm-3"]);
    expect(m.prepare("SELECT * FROM perm_cases WHERE employer_slug = ?", ["law-firm-3"]).args).toEqual(["law-firm-3"]);
  });

  it("ignores a string literal that looks like a placeholder", () => {
    const p = m.prepare("SELECT '?' AS q, slug FROM perm_entities WHERE kind = 'attorney' AND slug = ?", ["law-firm-3"]);
    expect(p.args).toEqual(["example-law-group-pllc"]);
  });
});

describe("every other row that names it", () => {
  it("keeps the row and its numbers, with the label and the neutral slug in the name's place", () => {
    const ranking = [
      { slug: "big-firm-llp", name: "Big Firm LLP", rank: 39, total: 130 },
      { slug: "example-law-group-pllc", name: "Example Law Group, PLLC", rank: 40, total: 120 },
    ];
    const { rows } = read("SELECT slug, name, rank, total FROM perm_entities WHERE kind = ? AND rank BETWEEN ? AND ?", ["attorney", 1, 100], ranking);
    expect(rows).toEqual([ranking[0], { slug: "law-firm-3", name: "Law firm 3", rank: 40, total: 120 }]);
    expect(rows[0]).toBe(ranking[0]);
  });

  it("masks a firm on an employer page's cases and facets", () => {
    const cases = [
      { case_number: "G-100-24001-000002", employer_name: "Acme Corp", employer_slug: "acme-corp", attorney_name: "EXAMPLE LAW GROUP PLLC", attorney_slug: "example-law-group-pllc", wage: 90000 },
    ];
    expect(read("SELECT * FROM perm_cases WHERE employer_slug = ?", ["acme-corp"], cases).rows).toEqual([
      { ...cases[0], attorney_name: "Law firm 3", attorney_slug: "law-firm-3" },
    ]);
    const facets = [
      { facet: "attorney", key: "exampel-law-group", label: "Exampel Law Group", n: 12 },
      { facet: "occupation", key: "example-law-group-pllc", label: "Example Law Group, PLLC", n: 3 },
    ];
    const got = read(
      "SELECT f.facet, f.key, f.label, f.n FROM perm_entity_facets f WHERE f.kind = ? AND f.slug = ?",
      ["employer", "acme-corp"],
      facets,
    ).rows;
    expect(got[0]).toEqual({ facet: "attorney", key: "law-firm-3", label: "Law firm 3", n: 12 });
    expect(got[1]).toBe(facets[1]);
  });

  it("is kind-aware: a firm's slug never drops or masks an employer row with the same slug", () => {
    const asEmployer = { slug: "example-law-group-pllc", name: "Example Law Group, PLLC", rank: 9000 };
    const { rows } = read("SELECT slug, name, rank FROM perm_entities WHERE kind = ? AND slug = ?", ["employer", "example-law-group-pllc"], [asEmployer]);
    expect(rows).toEqual([asEmployer]);
    const caseRow = { case_number: "G-100-24001-000003", employer_name: "Example Law Group, PLLC", employer_slug: "example-law-group-pllc", attorney_name: "Big Firm LLP" };
    expect(read("SELECT * FROM perm_cases WHERE employer_slug = ?", ["example-law-group-pllc"], [caseRow]).rows).toEqual([caseRow]);
  });

  it("masks an employer's case by its number whatever spelling a later file printed", () => {
    const row = { case_number: "P-100-25001-000009", employer_name: "J. EXAMPLE", employer_slug: "j-example", job_title: "Nanny" };
    expect(read("SELECT * FROM pwd_cases WHERE x = ?", [1], [row]).rows).toEqual([
      { ...row, employer_name: "Private household employer 1", employer_slug: "private-household-employer-1" },
    ]);
  });

  it("gives an entry without a number its plain label and no link", () => {
    const row = { employer_name: "ACME X HOLDINGS", employer_slug: "acme-x-holdings", n: 2 };
    expect(read("SELECT * FROM perm_cases WHERE state = ?", ["CA"], [row]).rows).toEqual([{ employer_name: "Employer", employer_slug: null, n: 2 }]);
  });

  it("scrubs a whole name out of other text, and leaves a part of one and an entity's own long name alone", () => {
    const titled = { job_title: "Researcher at Example Law Group, PLLC", employer_name: "Acme Corp" };
    expect(read("SELECT * FROM perm_cases WHERE state = ?", ["CA"], [titled]).rows[0]).toEqual({
      job_title: "Researcher at Law firm 3",
      employer_name: "Acme Corp",
    });
    const partial = { job_title: "Example Law researcher", employer_name: "Acme Corp" };
    expect(read("SELECT * FROM perm_cases WHERE state = ?", ["CA"], [partial]).rows[0]).toBe(partial);
    // An employer whose own name contains a firm's is a different company, kind-aware.
    const employer = { employer_name: "Example Law Group Holdings International Corporation of the Americas" };
    expect(read("SELECT * FROM perm_cases WHERE state = ?", ["CA"], [employer]).rows[0]).toBe(employer);
  });
});

describe("stored summaries", () => {
  it("walks the JSON: names to labels, slugs to neutral slugs, every number kept", () => {
    const doc = {
      employers: [
        { name: "Jane Q Example", slug: "jane-q-example", n: 2 },
        { name: "Acme Corp", slug: "acme-corp", n: 5 },
      ],
      firms: [["Example Law Group, PLLC", 12], ["Big Firm LLP", 30]],
      cases: [{ caseNumber: "G-100-25001-000001", employer: "Someone Else Entirely" }],
      note: "Most of these came from example-law-group-pllc and others, filed through the year.",
    };
    const [out] = read("SELECT json FROM perm_docs WHERE key = ?", ["summary"], [{ key: "summary", json: JSON.stringify(doc) }]).rows as { json: string }[];
    const back = JSON.parse(out!.json);
    expect(back.employers[0]).toEqual({ name: "Private household employer 1", slug: "private-household-employer-1", n: 2 });
    expect(back.employers[1]).toEqual(doc.employers[1]);
    expect(back.firms).toEqual([["Law firm 3", 12], ["Big Firm LLP", 30]]);
    expect(back.cases[0].employer).toBe("Private household employer 1");
    expect(out!.json).not.toMatch(/example law|jane q|example-law-group/i);
  });

  it("renames a summary's key that is a withheld slug or name", () => {
    const doc = { bySlug: { "jane-q-example": { held: 2 }, "acme-corp": { held: 5 } } };
    const [out] = read("SELECT json FROM perm_docs WHERE key = ?", ["holds"], [{ json: JSON.stringify(doc) }]).rows as { json: string }[];
    expect(JSON.parse(out!.json)).toEqual({ bySlug: { "private-household-employer-1": { held: 2 }, "acme-corp": { held: 5 } } });
  });

  it("scrubs a long text that isn't JSON", () => {
    const text = "Filed by EXAMPLE LAW GROUP, P.L.L.C. for clients; see /perm-attorneys/example-law-group-pllc for the record.";
    const [out] = read("SELECT note FROM policy_notices WHERE id = ?", [1], [{ note: text }]).rows as { note: string }[];
    expect(out!.note).toBe("Filed by Law firm 3 for clients; see /perm-attorneys/law-firm-3 for the record.");
  });
});

describe("navigation lists", () => {
  it("drop the entity outright, so the neutral page is no search result of its own", () => {
    const rows = [{ slug: "example-law-group-pllc", name: "Example Law Group, PLLC" }, { slug: "big-firm-llp", name: "Big Firm LLP" }];
    expect(read("SELECT slug, name FROM perm_entities WHERE kind = 'attorney' AND rank > ? AND rank <= ?", [0, 5000], rows, { drop: true }).rows).toEqual([rows[1]]);
  });

  it("drop a finder row unless the neutral page asked", () => {
    const row = { slug: "jane-q-example", name: "Jane Q Example", perm_rank: 0.4 };
    expect(read("SELECT * FROM sponsor_index WHERE perm_rank > ?", [0.1], [row]).rows).toEqual([]);
    expect(read("SELECT * FROM sponsor_index WHERE slug = ?", ["private-household-employer-1"], [row]).rows).toEqual([
      { slug: "private-household-employer-1", name: "Private household employer 1", perm_rank: 0.4 },
    ]);
  });

  it("report which rows they kept, so a pager can count the rows it read", () => {
    const p = m.prepare("SELECT slug FROM perm_entities WHERE kind = ? AND slug IN (?, ?)", ["attorney", "a", "example-law-group-pllc"]);
    const got = m.maskIndexed([{ slug: "a" }, { slug: "example-law-group-pllc" }, { slug: "b" }], p.ctx);
    expect(got.kept).toEqual([0, 2]);
  });
});

describe("DOL's live answers, searches and refusals", () => {
  it("shows the label for a withheld name or case", () => {
    expect(m.shownName("JANE Q EXAMPLE")).toBe("Private household employer 1");
    expect(m.shownName("Another Spelling", "g-100-25001-000001")).toBe("Private household employer 1");
    expect(m.shownName("Acme Corp")).toBe("Acme Corp");
    expect(m.shownName(null)).toBeNull();
  });

  it("knows a search by the real name or slug, and not by the neutral one", () => {
    expect(m.isWithheldQuery("firm", "Example Law Group")).toBe(true);
    expect(m.isWithheldQuery("firm", "example-law-group-pllc-2")).toBe(true);
    expect(m.isWithheldQuery("firm", "law-firm-3")).toBe(false);
    expect(m.isWithheldQuery("employer", "Example Law Group")).toBe(false);
    expect(m.isWithheldQuery("any", "jane q example")).toBe(true);
    expect(m.isWithheldQuery("firm", "Example")).toBe(false);
  });

  it("finds a neutral page by its path, and a slug either way for refusals", () => {
    expect(m.neutralForPath("/perm-attorneys/law-firm-3")).toBe(FIRM);
    expect(m.neutralForPath("/perm-employers/law-firm-3")).toBeNull();
    expect(m.neutralForPath("/perm-employers/private-household-employer-1?x=1")).toBe(JANE);
    expect(m.withheldBySlug("firm", "exampel-law-group")).toBe(FIRM);
    expect(m.withheldBySlug("firm", "law-firm-3")).toBe(FIRM);
    expect(m.withheldBySlug("firm", "jane-q-example")).toBeNull();
  });

  it("does nothing at all when nothing is withheld", () => {
    const none = makeMasker([]);
    const rows = [{ slug: "example-law-group-pllc", name: "Example Law Group, PLLC" }];
    const p = none.prepare("SELECT * FROM perm_entities WHERE slug = ?", ["law-firm-3"]);
    expect(p.args).toEqual(["law-firm-3"]);
    expect(none.mask(rows, p.ctx)).toBe(rows);
    expect(none.isWithheldQuery("any", "Example Law Group")).toBe(false);
  });
});
