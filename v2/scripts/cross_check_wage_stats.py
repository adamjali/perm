#!/usr/bin/env python3
"""Cross-check the materialised wage table against the live corpus.

WHY THIS EXISTS. Two things now compute wage percentiles from the same
373,162 cases by different routes: `perm_wage_stats`, a materialised view the
prerendered entity pages read, and the live query the salary explorer runs
over `perm_cases`. Precomputing a hot path is legitimate. Two routes over one
corpus silently disagreeing is not, and nothing would have told us: a stale
materialisation looks exactly like a fresh one from the page that reads it.

WHAT THE TABLE ACTUALLY CONTAINS, measured rather than assumed. It is
CERTIFIED-ONLY. For soc_code 15-1252.00 the precomputed FY2025 row is
n=31,323 p50=136,822, which matches the live query restricted to
status='certified' exactly, and does NOT match the same query across all
statuses (n=32,985, p50=136,947). Comparing against an unfiltered live query
would therefore report a divergence on every row, which is the worst kind of
check: one that fails so reliably that people turn it off.

It also carries `fiscal_year = 'all'` rows alongside the per-year ones. Those
are compared with the year filter dropped rather than against a literal 'all',
which matches nothing in perm_cases.

Exit 1 only on a real divergence. A row the live corpus no longer contains at
all is reported and does not fail, because dropping out of the window is what
an old cohort is supposed to do.
"""
from __future__ import annotations

import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from lib_turso import Turso  # noqa: E402

# How many of the largest materialised rows to check. The point is a canary on
# the ingest, not a full reconciliation: if the newest and biggest rows agree,
# the materialisation ran against the current corpus.
SAMPLE = 25

# Counts must match exactly: a different count means the two sides read
# different rows, which is the failure this exists to catch.
#
# Medians are allowed to differ by exactly ONE DOLLAR and no more. Both routes
# interpolate identically; SQLite rounds a half away from zero while Python
# rounds it to even, so a percentile landing on a half-dollar differs by $1.
# That is the only explained difference, and a wider tolerance would start
# hiding the definition mismatches this check was written for - the original
# ones were $1, $10, $37 and $11.
DOLLAR_TOLERANCE = 1
# The SAME definition the app uses: linear interpolation, matching
# ingest_perm_disclosure.percentile(). A checker running a DIFFERENT
# definition from its subject reports a divergence on every row and teaches
# people to ignore it - which is what the first version of this script did.
_K = "(c.n - 1) * 0.5"
_LO = f"1 + CAST({_K} AS INTEGER)"
P50 = (
    f"(SELECT ROUND(lo.wage + (hi.wage - lo.wage) * ({_K} - CAST({_K} AS INTEGER)))"
    f"   FROM c JOIN o lo ON lo.rn = {_LO}"
    f"          JOIN o hi ON hi.rn = MIN({_LO} + 1, c.n)) AS p50"
)


def rows(t: Turso, sql: str, args: list | None = None) -> list[dict]:
    res = t.execute(sql, args or [])["response"]["result"]
    cols = [c["name"] for c in res["cols"]]
    return [
        {c: (None if cell["type"] == "null" else cell["value"]) for c, cell in zip(cols, row)}
        for row in res["rows"]
    ]


def main() -> int:
    t = Turso()
    pre = rows(
        t,
        """SELECT soc_code, fiscal_year, count, p50 FROM perm_wage_stats
            WHERE kind = 'occupation' AND soc_code IS NOT NULL AND soc_code <> ''
            ORDER BY count DESC LIMIT ?""",
        [SAMPLE],
    )
    print(f"checking {len(pre)} materialised occupation rows against the live corpus")

    diverged: list[str] = []
    absent = 0
    for r in pre:
        year_clause, args = "", [r["soc_code"]]
        if r["fiscal_year"] != "all":
            year_clause = " AND fiscal_year = ?"
            args.append(r["fiscal_year"])
        live = rows(
            t,
            f"""WITH f AS (
                  SELECT wage FROM perm_cases
                   WHERE wage IS NOT NULL AND wage > 0 AND status = 'certified'
                     AND soc_code = ?{year_clause}
                ),
                c AS (SELECT COUNT(*) AS n FROM f),
                o AS (SELECT wage, ROW_NUMBER() OVER (ORDER BY wage) AS rn FROM f)
                SELECT (SELECT n FROM c) AS n, {P50}""",
            args,
        )[0]

        label = f"{r['soc_code']} FY{r['fiscal_year']}"
        if live["n"] is None or int(live["n"]) == 0:
            # The materialised row survives a cohort leaving the window. That
            # is expected, not a defect.
            print(f"  {label}: absent from the live corpus, skipped")
            absent += 1
            continue
        drift = abs(float(live["p50"]) - float(r["p50"]))
        if str(live["n"]) != str(r["count"]) or drift > DOLLAR_TOLERANCE:
            diverged.append(
                f"  {label}: materialised n={r['count']} p50={r['p50']}"
                f"  vs live n={live['n']} p50={live['p50']}"
            )

    if diverged:
        print(f"\n{len(diverged)} DIVERGED - one of the two is reading a stale corpus:")
        for d in diverged:
            print(d)
        print("\nRe-run the wage-stats ingest, then this check.")
        return 1

    print(f"\nall {len(pre) - absent} comparable rows agree exactly ({absent} absent, not a failure)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
