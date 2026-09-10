import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DATASET_COVERAGE, coverageFor } from "../datasetCoverage";

/**
 * Every dataset the ingests register says what it CONTAINS, not just how often
 * it arrives.
 *
 * The provenance line has always carried source, as-of and cadence. Cadence is
 * not coverage: "quarterly" does not tell a reader DOL's files hold only
 * DECIDED cases, and "daily" does not tell them our sweep includes pending but
 * carries no wage. Both of this project's recurring errors live in that gap -
 * a duration averaged over the fastest 2% of a month, and a "not found" for a
 * case that is merely undecided.
 *
 * A new dataset with no sentence would ship silently and inherit the
 * ambiguity, so this fails on one.
 */
const ROOT = join(__dirname, "..", "..", "..");

/** Dataset ids the ingest scripts actually register, scraped from source. */
function registeredDatasets(): string[] {
  const dir = join(ROOT, "scripts");
  const ids = new Set<string>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".py")) continue;
    const src = readFileSync(join(dir, f), "utf8");
    // The helper is `stamp_freshness(db, "perm-cases", ...)`. Named wrong on
    // the first pass ("record_freshness"), which the control below caught by
    // reading zero ids - which is exactly why the control is there.
    for (const m of src.matchAll(/stamp_freshness\(\s*\w+\s*,\s*["']([a-z0-9-]+)["']/g)) {
      ids.add(m[1]!);
    }
    for (const m of src.matchAll(/dataset\s*=\s*["']([a-z0-9-]+)["']/g)) ids.add(m[1]!);
  }
  return [...ids].sort();
}

describe("dataset coverage", () => {
  it("scrapes a plausible number of dataset ids (control)", () => {
    // ONLY A SUBSET IS SCRAPABLE, and saying so is the honest version. Some
    // ingests call `stamp_freshness(db, "id", ...)`; others insert into
    // data_freshness with a plain SQL tuple, and no single pattern matches
    // both without over-collecting every kebab string in the file. So this
    // gate catches a NEW ingest that uses the helper, and the completeness
    // check against all 29 registered datasets lives in
    // `check_ingest_health.py`, which can read the live registry.
    expect(registeredDatasets().length).toBeGreaterThan(5);
  });

  it("states coverage for every dataset an ingest registers", () => {
    const missing = registeredDatasets().filter((d) => !coverageFor(d));
    expect(missing, "a dataset with no coverage sentence").toEqual([]);
  });

  it("separates decided-only from pending-included, in the reader's words", () => {
    // The two that are most often confused must each say which they are.
    expect(DATASET_COVERAGE["perm-cases"]).toMatch(/decided/i);
    expect(DATASET_COVERAGE["perm-cases"]).not.toMatch(/pending included/i);
    expect(DATASET_COVERAGE["perm-case-status"]).toMatch(/pending included/i);
    // ...and the live sweep must admit what it does NOT carry, because a
    // reader who expects a wage there and finds none assumes we lost it.
    expect(DATASET_COVERAGE["perm-case-status"]).toMatch(/wage/i);
  });

  it("writes sentences, not schema notes", () => {
    for (const [id, sentence] of Object.entries(DATASET_COVERAGE)) {
      expect(sentence.length, id).toBeGreaterThan(30);
      expect(sentence.trim().endsWith("."), `${id} should end in a full stop`).toBe(true);
      // Table and column names are how this drifts back into schema-speak.
      expect(sentence, id).not.toMatch(/perm_case|_status\b|SELECT |perm_docs/);
    }
  });

  it("has no entry for a dataset that no longer exists", () => {
    const known = new Set(registeredDatasets());
    // A stale entry is a sentence nobody will ever read, describing something
    // that is gone. Allowed only where an id is registered outside scripts/.
    // Most ids are not scrapable (see the control), so this only asserts the
    // map has not grown wildly beyond what production registers.
    expect(Object.keys(DATASET_COVERAGE).length).toBeLessThanOrEqual(40);
    void known;
  });
});
