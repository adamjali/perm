import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseReviewStagesDoc, MIN_BAND_N } from "../rfi";

/**
 * The precomputed review-stages doc, and the rules that decide when it is
 * safe to serve.
 *
 * WHY THE DOC EXISTS. `getReviewStages()` was a CTE over ~98,000 pending rows
 * with three window functions, a COUNT(DISTINCT employer_name) and three
 * joins. Measured against production 2026-08-31: 19.56s cold, 2.49s warm,
 * against a 20s deadline. It blew the deadline, retried, blew it again and
 * threw, so all ten stage pages 500'd on a cold render - and Google's
 * Inspection Tool refused to index two of them, with Sentry naming the cause
 * verbatim as `turso query deadline (20000ms, attempt 2): WITH pend AS (`.
 */

const now = Date.UTC(2026, 7, 31, 12, 0, 0);

function stage(over: Record<string, unknown> = {}) {
  return {
    status: "RFI ISSUED",
    cases: 974,
    employerNames: 402,
    topEmployer: "SOME EMPLOYER LLC",
    topEmployerCases: 31,
    seenFrom: "2026-08-01",
    seenTo: "2026-08-31",
    aged: 900,
    d10: 120,
    d50: 260,
    d90: 480,
    ...over,
  };
}

function doc(stages: unknown[], over: Record<string, unknown> = {}) {
  const pendingTotal = (stages as { cases: number }[]).reduce(
    (a, s) => a + (s?.cases ?? 0),
    0,
  );
  return JSON.stringify({
    asOf: "2026-08-31",
    source: "DOL",
    pendingTotal,
    stages,
    ...over,
  });
}

describe("parseReviewStagesDoc", () => {
  it("returns the stages when the doc is well formed", () => {
    const out = parseReviewStagesDoc(doc([stage()]), now - 1000, now);
    expect(out).not.toBeNull();
    expect(out).toHaveLength(1);
    expect(out![0]!.status).toBe("RFI ISSUED");
    expect(out![0]!.cases).toBe(974);
    expect(out![0]!.topEmployer).toBe("SOME EMPLOYER LLC");
  });

  it("applies the SAME age-band guards as the live query", () => {
    // The editorial rules live in ageBand() and are deliberately NOT
    // reimplemented in the Python writer, so the doc carries raw numbers and
    // this asserts the guard still runs on them. A band under MIN_BAND_N is
    // two cases wearing the clothes of a distribution.
    const small = parseReviewStagesDoc(
      doc([stage({ cases: 4, aged: MIN_BAND_N - 1 })]),
      now - 1000,
      now,
    );
    expect(small![0]!.ageBand).toBeNull();

    // ...and a band computed from under half its own stage describes a slice
    // while wearing the stage's name.
    const thin = parseReviewStagesDoc(
      doc([stage({ cases: 1000, aged: 100 })]),
      now - 1000,
      now,
    );
    expect(thin![0]!.ageBand).toBeNull();

    const good = parseReviewStagesDoc(doc([stage()]), now - 1000, now);
    expect(good![0]!.ageBand).toEqual({ p10: 120, median: 260, p90: 480, n: 900 });
  });

  it("REJECTS a doc whose stages do not sum to pendingTotal", () => {
    // The reconciliation is the whole point: a doc missing one stage still
    // folds into a plausible page - a slightly smaller backlog, one fewer row
    // - and nothing downstream could tell. pendingTotal is counted by a
    // separate query in the writer, so a mismatch means the two saw
    // different tables.
    const bad = doc([stage()], { pendingTotal: 999_999 });
    expect(parseReviewStagesDoc(bad, now - 1000, now)).toBeNull();
  });

  it("REJECTS a doc older than the staleness budget", () => {
    // A stale stage census reads as a current one, which is worse than
    // falling back to the slow query.
    const nineDays = 9 * 24 * 60 * 60 * 1000;
    expect(parseReviewStagesDoc(doc([stage()]), now - nineDays, now)).toBeNull();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(parseReviewStagesDoc(doc([stage()]), now - sevenDays, now)).not.toBeNull();
  });

  it("REJECTS malformed JSON rather than throwing", () => {
    expect(parseReviewStagesDoc("{not json", now, now)).toBeNull();
    expect(parseReviewStagesDoc("null", now, now)).toBeNull();
    expect(parseReviewStagesDoc("[]", now, now)).toBeNull();
  });

  it("REJECTS a doc with one malformed stage, all-or-nothing", () => {
    const mixed = JSON.stringify({
      asOf: "2026-08-31",
      source: "DOL",
      pendingTotal: 974,
      stages: [stage(), { status: "BROKEN" }],
    });
    expect(parseReviewStagesDoc(mixed, now - 1000, now)).toBeNull();
  });

  it("accepts null percentiles, which is a real shape", () => {
    // A stage where no case carries both a filing date and an observation
    // date has no percentiles at all. That is not corruption.
    const out = parseReviewStagesDoc(
      doc([stage({ aged: null, d10: null, d50: null, d90: null })]),
      now - 1000,
      now,
    );
    expect(out).not.toBeNull();
    expect(out![0]!.ageBand).toBeNull();
  });
});

describe("the writer and the reader agree on the fixture row", () => {
  it("uses a byte-identical TEST_FIXTURE_EMPLOYER on both sides", () => {
    // ONE CONSTANT, TWO LANGUAGES. The Python writer excludes DOL's own
    // fixture row from the doc; the TypeScript fallback excludes it from the
    // live query. If they drift, the published page and the fallback count
    // different populations and neither is wrong enough to notice. Same
    // class of hazard as DIRECT_EVENT_SOURCE, which is pinned the same way.
    const ts = readFileSync(
      join(process.cwd(), "src", "lib", "turso", "rfi.ts"),
      "utf8",
    );
    const py = readFileSync(
      join(process.cwd(), "scripts", "ingest_case_status_direct.py"),
      "utf8",
    );

    const tsMatch = ts.match(/TEST_FIXTURE_EMPLOYER\s*=\s*"([^"]+)"/);
    const pyMatch = py.match(/TEST_FIXTURE_EMPLOYER\s*=\s*"([^"]+)"/);

    // Control: a test that cannot find either constant must fail loudly
    // rather than pass by comparing undefined to undefined.
    expect(tsMatch, "TEST_FIXTURE_EMPLOYER not found in rfi.ts").not.toBeNull();
    expect(pyMatch, "TEST_FIXTURE_EMPLOYER not found in the ingest").not.toBeNull();
    expect(tsMatch![1]).toBe(pyMatch![1]);
  });

  it("writes the doc under the key the reader looks for", () => {
    const ts = readFileSync(
      join(process.cwd(), "src", "lib", "turso", "rfi.ts"),
      "utf8",
    );
    const py = readFileSync(
      join(process.cwd(), "scripts", "ingest_case_status_direct.py"),
      "utf8",
    );
    expect(ts).toContain("key = 'review_stages'");
    expect(py).toContain('"review_stages"');
  });
});
