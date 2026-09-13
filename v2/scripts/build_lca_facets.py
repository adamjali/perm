#!/usr/bin/env python3
"""Precompute the /lca-wages filter lists into perm_docs['lca_filter_options'].

WHY THIS EXISTS. `getLcaWageFilterOptions` was a triple-nested GROUP BY over
every row of `lca_cases` plus a sibling aggregate on worksite state, run at
build time. Affordable at 437,000 rows; fatal at 1.96M.

Measured 2026-09-13, the production build that followed the LCA history
backfill:

    Failed to build /lca-wages because it took more than 180 seconds
    Error: turso query deadline (90000ms, attempt 2):
      WITH t AS (SELECT substr(soc_code, 1, 7) AS code, ...

A bare COUNT over the table measures 16.8 seconds now with nothing else
running, so this is the table's SIZE and not write contention - pausing the
backfill did not fix it and would not have.

PERM has had this doc since the salary explorer hit the same wall
(`build_wage_bands.py`, `wage_filter_options`). This is the LCA twin, and the
reader keeps the live query as the doc-missing fallback so a fresh database
still renders: degraded to slow, never to empty.

    python3 scripts/build_lca_facets.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, record_run  # noqa: E402

DOC_KEY = "lca_filter_options"

# MUST EQUAL MIN_FOR_MEDIAN IN src/lib/wageStats.ts. The facets are the filter
# lists the page offers, so a Python copy that drifts from the TypeScript floor
# offers a state the page then refuses a median for - which reads to a visitor
# as broken filtering rather than a stale document. Read out of the TS file
# rather than restated, so it cannot rot.
TS_SOURCE = pathlib.Path(__file__).resolve().parents[1] / "src" / "lib" / "wageStats.ts"


def min_for_median() -> int:
    m = re.search(r"MIN_FOR_MEDIAN\s*=\s*(\d+)", TS_SOURCE.read_text())
    if not m:
        raise SystemExit(
            f"FATAL: no MIN_FOR_MEDIAN in {TS_SOURCE}. Refusing to guess the "
            "floor: a facet list built under the wrong one offers filters the "
            "page cannot answer."
        )
    return int(m.group(1))


def _rows(db: Turso, sql: str, args: list) -> list[list]:
    res = db.execute(sql, args)
    return [
        [None if c["type"] == "null" else c["value"] for c in r]
        for r in res["response"]["result"]["rows"]
    ]


# MUST STAY IN STEP WITH ANNUAL_WAGE_SQL AND THE BAND IN src/lib/turso/lcaWages.ts.
# Duplicated deliberately, the same way the entity slug rules are duplicated in
# store_entities.py and entitySlug.ts: a doc built over a different population
# than the fallback query reads is worse than no doc, because it is invisible.
ANNUAL_WAGE_SQL = (
    "CASE wage_unit WHEN 'YEAR' THEN wage WHEN 'HOUR' THEN wage * 2080 "
    "WHEN 'MONTH' THEN wage * 12 WHEN 'WEEK' THEN wage * 52 "
    "WHEN 'BI-WEEKLY' THEN wage * 26 END"
)
DEFAULT_WHERE = (
    f"wage IS NOT NULL AND wage > 0 AND ({ANNUAL_WAGE_SQL}) BETWEEN 10000 AND 1500000 "
    "AND case_status = 'CERTIFIED'"
)


def bin_width(p5, p95) -> int:
    """A port of binWidth() in src/lib/wageStats.ts.

    The reader compares the stored width against its own binWidth() and falls
    back to the live query when they differ, so a drift here degrades to slow
    rather than to wrong bins. Keep them in step anyway.
    """
    import math
    span = (p95 - p5) if (p5 is not None and p95 is not None) else 0
    if not span > 0:
        return 10_000
    target = span / 20
    magnitude = 10 ** math.floor(math.log10(target))
    for step in (1, 2, 5, 10):
        if magnitude * step >= target:
            return max(1_000, int(magnitude * step))
    return max(1_000, int(magnitude * 10))


QUANTILES = ((0.05, "p5"), (0.25, "p25"), (0.5, "p50"), (0.75, "p75"), (0.95, "p95"))


def percentile_select() -> str:
    """A byte-faithful port of percentileExpr() in src/lib/turso/publicData.ts.

    THESE INTERPOLATE. An obvious `rn = CAST(n * q AS INTEGER) + 1` picks the
    nearest rank and lands a few hundred dollars off, which is exactly the kind
    of near-miss a doc must never introduce: the page would show one number and
    its own fallback another, with nothing erroring. `verify_against_live()`
    below proves these agree before anything is written.
    """
    out = []
    for p, name in QUANTILES:
        k = f"(c.n - 1) * {p}"
        lo = f"1 + CAST({k} AS INTEGER)"
        out.append(
            f"(SELECT ROUND(lo.wage + (hi.wage - lo.wage) * ({k} - CAST({k} AS INTEGER)))"
            f"   FROM c JOIN o lo ON lo.rn = {lo}"
            f"          JOIN o hi ON hi.rn = MIN({lo} + 1, c.n)) AS {name}"
        )
    return ",\n            ".join(out)


def state_percentile_select() -> str:
    """A byte-faithful port of statePercentileExpr()."""
    out = []
    for p, name in QUANTILES:
        k = f"(n - 1) * {p}"
        lo_rank = f"1 + CAST({k} AS INTEGER)"
        lo = f"MAX(CASE WHEN rn = {lo_rank} THEN wage END)"
        hi = f"MAX(CASE WHEN rn = MIN({lo_rank} + 1, n) THEN wage END)"
        frac = f"(MAX({k}) - CAST(MAX({k}) AS INTEGER))"
        out.append(f"ROUND({lo} + ({hi} - {lo}) * {frac}) AS {name}")
    return ",\n            ".join(out)


def build_default_view(db: Turso, min_cases: int) -> dict:
    """The unfiltered certified view: stats, histogram, per-state percentiles."""
    # `FROM o` over an EMPTY population returns ZERO rows, not a row of nulls,
    # so an empty or missing table would be an IndexError here rather than a
    # readable refusal. The caller's guard below only sees what this returns.
    st_rows = _rows(db, f"""
        WITH f AS (SELECT ({ANNUAL_WAGE_SQL}) AS wage FROM lca_cases WHERE {DEFAULT_WHERE}),
             c AS (SELECT COUNT(*) AS n FROM f),
             o AS (SELECT wage, ROW_NUMBER() OVER (ORDER BY wage) AS rn FROM f)
        SELECT (SELECT n FROM c) AS n, (SELECT AVG(wage) FROM f) AS avg,
               {percentile_select()}
          FROM o
    """, [])
    if not st_rows:
        raise SystemExit(
            "FATAL: no rows match the default view. Either lca_cases is empty "
            "or the wage band excludes everything - either way, writing this "
            "doc would replace a good one with nothing."
        )
    st = st_rows[0]
    stats = {
        "n": int(st[0] or 0), "avg": _f(st[1]),
        "p5": _f(st[2]), "p25": _f(st[3]), "p50": _f(st[4]),
        "p75": _f(st[5]), "p95": _f(st[6]),
    }
    width = bin_width(stats["p5"], stats["p95"])
    print(f"[lca-facets] default view n={stats['n']:,} binWidth={width:,}", flush=True)

    hist = _rows(db, f"""
        SELECT CAST(({ANNUAL_WAGE_SQL}) / ? AS INTEGER) * ? AS bin, COUNT(*) AS n
          FROM lca_cases WHERE {DEFAULT_WHERE} GROUP BY bin ORDER BY bin
    """, [width, width])

    by_state = _rows(db, f"""
        WITH o AS (
          SELECT worksite_state AS state, ({ANNUAL_WAGE_SQL}) AS wage,
                 ROW_NUMBER() OVER (PARTITION BY worksite_state
                                    ORDER BY ({ANNUAL_WAGE_SQL})) AS rn,
                 COUNT(*)     OVER (PARTITION BY worksite_state) AS n
            FROM lca_cases WHERE {DEFAULT_WHERE}
             AND worksite_state IS NOT NULL AND worksite_state <> ''
        )
        SELECT state, MAX(n) AS n, AVG(wage) AS avg,
               {state_percentile_select()}
          FROM o GROUP BY state HAVING MAX(n) >= ? ORDER BY MAX(n) DESC
    """, [min_cases])

    return {
        "binWidth": width,
        "stats": stats,
        "histogram": [{"from": int(b), "count": int(n)} for b, n in hist],
        "byState": [
            {"state": str(r[0]), "n": int(r[1]), "avg": _f(r[2]), "p5": _f(r[3]),
             "p25": _f(r[4]), "p50": _f(r[5]), "p75": _f(r[6]), "p95": _f(r[7])}
            for r in by_state
        ],
    }


def verify_median(db: Turso, stats: dict) -> None:
    """Prove the ported percentile SQL against an instrument that shares none of it.

    The CTE above interpolates between two row numbers. This asks the same
    population for the two wages at those ranks with a plain ORDER BY / OFFSET
    and checks p50 lands between them.

    BE HONEST ABOUT WHAT IT CATCHES. Run against the real corpus on
    2026-09-13 it printed "p50 116,376 verified between ranked 116,376 and
    116,376" - both neighbours hold the same wage, because 116,376 is a fat
    mode. So on THIS population it cannot tell an interpolating port from a
    nearest-rank one. What it does catch, on any population, is a query built
    over the wrong ROWS: a changed band, a dropped status clause, a different
    wage expression. The port itself is held by string equality against the
    TypeScript in test_lca_facets.py, which is the check for that defect.

    An OFFSET of ~950,000 walks that many index entries once per build. That is
    the same cost class as the queries it is checking, and it is the difference
    between a doc that is right and a doc that looks right.
    """
    n = stats["n"]
    if n < 3 or stats["p50"] is None:
        raise SystemExit(f"FATAL: default view has n={n} and p50={stats['p50']}")
    k = (n - 1) * 0.5
    lo_off = int(k)
    pair = _rows(db, f"""
        SELECT ({ANNUAL_WAGE_SQL}) AS wage FROM lca_cases WHERE {DEFAULT_WHERE}
         ORDER BY wage LIMIT 2 OFFSET ?
    """, [lo_off])
    if len(pair) < 2:
        raise SystemExit("FATAL: median probe returned fewer than two rows")
    lo, hi = float(pair[0][0]), float(pair[1][0])
    got = stats["p50"]
    if not (min(lo, hi) - 1 <= got <= max(lo, hi) + 1):
        raise SystemExit(
            f"FATAL: p50 {got:,.0f} is not between the ranked neighbours "
            f"{lo:,.0f} and {hi:,.0f}. The ported percentile SQL has drifted "
            "from src/lib/turso/publicData.ts; the doc was NOT written."
        )
    print(
        f"[lca-facets] p50 {got:,.0f} verified between ranked {lo:,.0f} and {hi:,.0f}",
        flush=True,
    )


def _f(v):
    return None if v is None else float(v)


def build(db: Turso, min_cases: int) -> dict:
    """The three lists the page's selectors need, in the reader's own shape."""
    # The label is the title MOST rows carry for the code, not the first one
    # alphabetically: MIN(soc_title) names 15-1252 "Computer Programmers"
    # because a few filings still use the old title, while the bulk say
    # "Software Developers".
    occ = _rows(db, """
        WITH t AS (SELECT substr(soc_code, 1, 7) AS code, soc_title AS title,
                          COUNT(*) AS n
                     FROM lca_cases
                    WHERE case_status = 'CERTIFIED'
                      AND soc_code IS NOT NULL AND soc_code <> ''
                    GROUP BY code, title),
             tot AS (SELECT code, SUM(n) AS n FROM t GROUP BY code HAVING SUM(n) >= ?),
             top AS (SELECT code, title, MAX(n) AS m FROM t GROUP BY code)
        SELECT tot.code, top.title, tot.n
          FROM tot JOIN top ON top.code = tot.code
         ORDER BY tot.n DESC LIMIT 400
    """, [min_cases])

    st = _rows(db, """
        SELECT worksite_state, COUNT(*) AS n
          FROM lca_cases
         WHERE case_status = 'CERTIFIED'
           AND worksite_state IS NOT NULL AND worksite_state <> ''
         GROUP BY worksite_state HAVING COUNT(*) >= ?
         ORDER BY n DESC
    """, [min_cases])

    fy = _rows(db, """
        SELECT DISTINCT fiscal_year FROM lca_cases
         WHERE fiscal_year IS NOT NULL AND fiscal_year <> ''
         ORDER BY fiscal_year DESC
    """, [])

    return {
        "minCases": min_cases,
        "occupations": [
            {"value": str(c), "label": str(t), "n": int(n)} for c, t, n in occ if c
        ],
        "states": [
            {"value": str(s), "label": str(s), "n": int(n)} for s, n in st if s
        ],
        "fiscalYears": [str(f[0]) for f in fy if f[0]],
    }


def main() -> int:
    started = time.time()
    db = Turso()
    floor = min_for_median()
    print(f"[lca-facets] building at minCases={floor}", flush=True)
    facets = build(db, floor)
    facets.update(build_default_view(db, floor))
    verify_median(db, facets["stats"])

    # AN EMPTY LIST MUST NEVER REPLACE A GOOD ONE. The reader falls back to the
    # live query when the doc is missing, but a doc that is PRESENT and empty
    # would render three empty selectors and look like a working page with no
    # data. Same guard shape as live_census's reconciliation.
    if (
        not facets["occupations"]
        or not facets["states"]
        or not facets["fiscalYears"]
        or not facets["byState"]
        or not facets["stats"]["n"]
    ):
        print(
            f"[lca-facets] NOT writing: {len(facets['occupations'])} occupations, "
            f"{len(facets['states'])} states, {len(facets['fiscalYears'])} years",
            flush=True,
        )
        return 1

    payload = json.dumps(facets, separators=(",", ":"))
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)""", [])
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
        [DOC_KEY, payload, int(time.time() * 1000)],
    )
    got = db.scalar("SELECT length(json) FROM perm_docs WHERE key = ?", [DOC_KEY])
    if int(got or 0) != len(payload):
        raise SystemExit("FATAL: lca_filter_options read-back does not match write")

    print(
        f"[lca-facets] wrote {len(payload):,} bytes: "
        f"{len(facets['occupations'])} occupations, {len(facets['states'])} states, "
        f"{len(facets['fiscalYears'])} fiscal years, "
        f"{len(facets['byState'])} state rows, {len(facets['histogram'])} bins, "
        f"n={facets['stats']['n']:,}",
        flush=True,
    )
    record_run(db, "build_lca_facets.py", status="ok",
               rows_written=len(facets["occupations"]) + len(facets["states"]),
               note=f"minCases {floor}", started_at=started)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
