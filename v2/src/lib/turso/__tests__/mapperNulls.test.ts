import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A row mapper may only return `null` for a field its SOURCE genuinely lacks.
 *
 * THE DEFECT THIS EXISTS FOR, reported by a reader on 2026-09-04. They searched
 * a law firm, got 44 wage requests back, and every one showed an empty law-firm
 * column. The rows were correct - `attorney_slug` matched in the database - and
 * `fromFlagDisclosed` returned `firmName: null` regardless, because the column
 * was never added to the SELECT list or the mapper. The same audit then found
 * two more: `days` was null on wage requests and LCAs although both dates it is
 * computed from were right there, and `employerSlug` was null on live PERM rows
 * although `perm_live_recent` carries it and the query is indexed on it.
 *
 * A hardcoded null is invisible: it renders as an empty cell, which looks
 * exactly like data DOL did not publish. So every one has to be declared here
 * with the reason it is genuinely absent. Adding a field to a mapper as `null`
 * without adding it below fails this test, which is the point: the author has
 * to say why the source cannot supply it.
 */

const FILE = join(process.cwd(), "src/lib/turso/unifiedSearch.ts");

/**
 * Every null this codebase is allowed to return, and why.
 *
 * The live tables are `perm_case_status`, `pwd_case_status` and
 * `lca_case_status`. DOL's batch endpoint returns five fields on a case that is
 * still moving - number, employer, job title, filing date, status - so nothing
 * else exists to map. `perm_cases` has no `wage_unit` column at all.
 */
const JUSTIFIED: Record<string, Record<string, string>> = {
  fromPermPublished: {
    wageUnit: "perm_cases has no wage_unit column; the PERM file quotes a bare wage",
  },
  fromPermLive: {
    decidedOn: "a live row is undecided by definition",
    wage: "DOL returns no wage on a live case",
    wageUnit: "no wage, so no unit",
    state: "the worksite is published, not returned live",
    firmName: "DOL names the firm only at publication",
    firmSlug: "no firm on a live row means no slug for one either",
    socCode: "the SOC is published; live returns the free-text job title",
    socTitle: "no SOC code live, so no title for one either",
    days: "no decision date, so nothing to measure to",
  },
  fromFlagLive: {
    decidedOn: "a live row is undecided by definition",
    wage: "DOL returns no wage on a live case",
    wageUnit: "no wage, so no unit",
    state: "the worksite is published, not returned live",
    firmName: "DOL names the firm only at publication",
    firmSlug: "no firm on a live row means no slug for one either",
    socCode: "the SOC is published; live returns the free-text job title",
    socTitle: "no SOC code live, so no title for one either",
    days: "no decision date, so nothing to measure to",
  },
  fromFlagDisclosed: {},
};

/** Field names a mapper assigns a bare `null`. */
function nullFields(src: string, mapper: string): string[] {
  const at = src.indexOf(`const ${mapper} = `);
  if (at === -1) throw new Error(`mapper ${mapper} not found`);
  const open = src.indexOf("({", at);
  const close = src.indexOf("\n});", open);
  const body = src.slice(open, close);
  return [...body.matchAll(/^\s*(\w+):\s*null,\s*$/gm)].map((m) => m[1]!);
}

describe("row mappers only null what the source cannot supply", () => {
  const src = readFileSync(FILE, "utf8");

  it("finds every mapper, so the check cannot pass by looking at nothing", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    for (const mapper of Object.keys(JUSTIFIED)) {
      expect([mapper, src.includes(`const ${mapper} = `)]).toEqual([mapper, true]);
    }
  });

  it.each(Object.keys(JUSTIFIED))("%s nulls only what it must", (mapper) => {
    const actual = nullFields(src, mapper).sort();
    const allowed = Object.keys(JUSTIFIED[mapper]!).sort();
    expect(actual).toEqual(allowed);
  });

  it("every declared null carries a reason, not an empty string", () => {
    for (const [mapper, fields] of Object.entries(JUSTIFIED)) {
      for (const [field, why] of Object.entries(fields)) {
        expect([mapper, field, why.length > 8]).toEqual([mapper, field, true]);
      }
    }
  });

  it("the published FLAG mapper nulls nothing at all", () => {
    // It is the one whose source holds every field: `pwd_cases` and
    // `lca_cases` carry the wage, the unit, the worksite, the occupation and -
    // since the 2026-09-03 backfill - the firm. `days` is derived from the two
    // dates rather than stored. If a null appears here again it is the reported
    // bug coming back.
    expect(nullFields(src, "fromFlagDisclosed")).toEqual([]);
  });
});
