import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { makeWithholder, parseWithheld } from "@/lib/privacy/withheld";

// A made-up person. The real list is a server setting and a build secret; this
// public repository must never hold a name a request asked us to take down.
const NAME = "Jane Q Example";
const SLUG = "jane-q-example";
const LABEL = "Private household employer";
const CASE = "G-100-25001-000001";
const { withhold, shownName } = makeWithholder(parseWithheld(`${SLUG}|${NAME}|${LABEL}|${CASE},P-100-25001-000009`));
const ROOT = path.resolve(__dirname, "../../../..");

describe("withhold", () => {
  it("drops a row about the withheld employer's own page", () => {
    const rows = [
      { kind: "employer", slug: SLUG, name: NAME, rank: 2 },
      { kind: "employer", slug: "acme-inc", name: "ACME, INC.", rank: 3 },
    ];
    expect(withhold(rows)).toEqual([rows[1]]);
    expect(withhold([{ source_slug: SLUG, page_slug: SLUG }])).toEqual([]);
  });

  it("drops the employer's cases, and a live status row that only names it", () => {
    const other = { case_number: "G-100-25001-000002", employer_name: "ACME, INC.", employer_slug: "acme-inc" };
    const out = withhold([
      { case_number: "G-100-25001-000001", employer_name: NAME, employer_slug: SLUG, status: "withdrawn" },
      { case_number: "G-100-25001-000001", employer_name: NAME, current_status: "WITHDRAWN" },
      other,
    ]);
    expect(out).toEqual([other]);
  });

  it("drops a case by its number, whatever spelling a later DOL file prints", () => {
    expect(withhold([{ case_number: CASE, employer_name: "GAWEKO, J" }])).toEqual([]);
    expect(withhold([{ case_number: "p-100-25001-000009" }])).toEqual([]);
  });

  it("replaces the name inside a stored summary and keeps the JSON valid", () => {
    const doc = JSON.stringify({ employers: [{ name: "Jane  Q Example", n: 1 }, { name: "ACME, INC.", n: 4 }], note: "x".repeat(80) });
    const [out] = withhold([{ key: "summary", json: doc }]) as { json: string }[];
    expect(JSON.parse(out!.json).employers[0].name).toBe(LABEL);
    expect(out!.json).not.toMatch(/example/i);
  });

  it("matches the name whatever its case and spacing", () => {
    expect(withhold([{ employer_name: "  JANE  q example " }])).toEqual([]);
  });

  it("leaves every other row as it was", () => {
    const row = { employer_name: "Jane Q Examples", employer_slug: "jane-q-examples" };
    const [out] = withhold([row]);
    expect(out).toBe(row);
  });

  it("withholds a live answer's name and leaves others", () => {
    expect(shownName(NAME)).toBe(LABEL);
    expect(shownName("Some Other Spelling", CASE)).toBe(LABEL);
    expect(shownName(null, CASE)).toBe(LABEL);
    expect(shownName("ACME, INC.")).toBe("ACME, INC.");
    expect(shownName(null)).toBeNull();
  });

  it("withholds nothing when the setting is unset or malformed", () => {
    expect(parseWithheld(undefined)).toEqual([]);
    expect(parseWithheld("only-a-slug")).toEqual([]);
    const none = makeWithholder([]);
    const rows = [{ slug: SLUG, name: NAME }];
    expect(none.withhold(rows)).toBe(rows);
  });
});

describe("the wiring", () => {
  it("is applied where every read and every live answer pass", () => {
    const client = readFileSync(path.join(ROOT, "src/lib/db/client.ts"), "utf8");
    expect(client).toMatch(/return withhold\(out\);/);
    const discovery = readFileSync(path.join(ROOT, "src/lib/db/caseDiscovery.ts"), "utf8");
    expect(discovery).toMatch(/employerName: shownName\(hit\.employerName, caseNumber\)/);
    expect(discovery).toMatch(/withheld: shownName\(hit\.employerName, caseNumber\) !== \(hit\.employerName \?\? null\)/);
  });

  it("never records a withheld answer, which would put the case back in the lists", () => {
    const discovery = readFileSync(path.join(ROOT, "src/lib/db/caseDiscovery.ts"), "utf8");
    expect(discovery.match(/if \(!rec\.withheld\) try \{\s+await exec\(\s+`INSERT/g)?.length).toBe(2);
    const flag = readFileSync(path.join(ROOT, "src/lib/db/flagCases.ts"), "utf8");
    expect(flag).toMatch(/if \(!rec\.withheld\) try \{\s+await exec\(\s+`INSERT/);
    expect(flag).toMatch(/const slug = name && !rec\.withheld \? slugify\(name\) : null;/);
  });

  it("reaches the build, which prerenders pages from the same database", () => {
    const deploy = readFileSync(path.join(ROOT, "../.github/workflows/oracle-deploy.yml"), "utf8");
    expect(deploy).toMatch(/WITHHELD_EMPLOYERS: \$\{\{ secrets\.WITHHELD_EMPLOYERS \}\}/);
  });
});
