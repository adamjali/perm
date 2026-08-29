#!/usr/bin/env python3
"""How much a case's employer initial is actually worth, measured.

WHY THIS FIGURE EXISTS AT ALL. DOL works each filing month in order and, within
a month, alphabetically by employer name. That is a real ordering rule, it is
stated in DOL's own material, and every public PERM estimator uses it. What none
of them publishes is its SIZE, and the size is the whole question: an ordering
term worth two weeks is a footnote, and one worth five months is the dominant
factor. A rival prints `employer_letter_impact` from -80 to +80 days - a 160-day
spread - and markets the initial as roughly 80% of the outcome.

WHAT THE CORPUS SAYS. Pooled over ~340k decided cases, A averages about 11 days
under the mean and Z about 16 over it: the entire alphabet is worth roughly 27
days end to end, not 160. Per filing month the first third of the alphabet beats
the last third by a median of ~8 days, and in about a sixth of months the
ordering REVERSES and the back half is faster.

SO BOTH HALVES SHIP, AND THAT IS THE DESIGN. A pooled per-letter mean is the
shape, and it is the flattering half: it looks like a clean gradient. The
per-month gap series is the honest half, because a quantity that changes sign in
a sixth of its observations is not well described by its average, and a reader
deciding how much weight to give their own initial needs to know it sometimes
runs the other way. Publishing only the pooled figure would reproduce the
rival's error at a smaller magnitude.

WHY A PRECOMPUTE. It is a GROUP BY over every decided row on an expression
(`UPPER(SUBSTR(employer_name, 1, 1))`) with no covering index, twice - once
pooled, once per filing month. That is not a request-path query, and
`disclosure_stats` and `state_profiles` already establish the pattern of a
precomputed document read by one cheap lookup.

WHY ITS OWN DOCUMENT AND NOT A FIELD ON `disclosure_stats`. That document has
exactly one writer, the quarterly ingest. A second script patching a field into
it is the two-writers-one-truth defect this project has been bitten by before,
and it would also mean this figure could only refresh quarterly. One writer per
document; this one owns `alphabet`.

RUN IT AFTER EVERY `ingest_perm_disclosure.py` RUN. It reads the same corpus.
"""
from __future__ import annotations

import argparse
import json
import sys
import time

from lib_turso import Turso, lit

DOC_KEY = "alphabet"

# Cases an initial (or one end of the alphabet within one month) needs before
# its mean is reported. A letter carrying a handful of cases produces a mean
# that swings on a single audited case, and since the finding here is that the
# effect is SMALL, noise at that scale would swamp it.
MIN_CASES = 500

# Months need a smaller floor than the pooled letters or almost every month is
# dropped: one month holds a fraction of the corpus. Each end of the alphabet
# still needs enough cases for its mean to mean anything.
MIN_CASES_PER_MONTH = 200

# The corpus starts here. Earlier files exist but the disclosure layout changed,
# and a gradient measured across a layout change is measuring the layout.
SINCE_MONTH = "2023-01"


def log(msg: str) -> None:
    print(msg, flush=True)


def rows(db: Turso, sql: str, args: list | None = None) -> list[dict]:
    res = db.execute(sql, args or [])["response"]["result"]
    cols = [c["name"] for c in res["cols"]]
    out = []
    for row in res["rows"]:
        out.append(
            {
                c: (None if cell["type"] == "null" else cell["value"])
                for c, cell in zip(cols, row)
            }
        )
    return out


def build(db: Turso) -> dict:
    log("  reading pooled per-letter means...")
    pooled = rows(
        db,
        """SELECT UPPER(SUBSTR(TRIM(employer_name), 1, 1)) AS letter,
                  COUNT(*) AS n, AVG(CAST(days AS REAL)) AS mean_days
             FROM perm_cases
            WHERE days IS NOT NULL AND received_date >= ?
            GROUP BY letter HAVING n >= ? ORDER BY letter""",
        [SINCE_MONTH, MIN_CASES],
    )
    # Only A-Z. A name starting with a digit or a symbol has no position in an
    # alphabetical ordering, so a bucket for it would be a number nobody can
    # reason about.
    pooled = [r for r in pooled if r["letter"] and r["letter"].isalpha() and len(r["letter"]) == 1]
    if not pooled:
        raise SystemExit("no letters cleared the floor - refusing to write an empty doc")

    total_n = sum(int(r["n"]) for r in pooled)
    overall = sum(float(r["mean_days"]) * int(r["n"]) for r in pooled) / total_n
    letters = [
        {
            "letter": r["letter"],
            "cases": int(r["n"]),
            "meanDays": round(float(r["mean_days"]), 1),
            "deltaDays": round(float(r["mean_days"]) - overall, 1),
        }
        for r in pooled
    ]

    log("  reading the per-month gap between the ends of the alphabet...")
    per_month = rows(
        db,
        """SELECT SUBSTR(received_date, 1, 7) AS month,
                  SUM(CASE WHEN UPPER(SUBSTR(TRIM(employer_name),1,1)) BETWEEN 'A' AND 'I'
                           THEN 1 ELSE 0 END) AS early_n,
                  SUM(CASE WHEN UPPER(SUBSTR(TRIM(employer_name),1,1)) BETWEEN 'A' AND 'I'
                           THEN CAST(days AS REAL) ELSE 0 END) AS early_sum,
                  SUM(CASE WHEN UPPER(SUBSTR(TRIM(employer_name),1,1)) BETWEEN 'S' AND 'Z'
                           THEN 1 ELSE 0 END) AS late_n,
                  SUM(CASE WHEN UPPER(SUBSTR(TRIM(employer_name),1,1)) BETWEEN 'S' AND 'Z'
                           THEN CAST(days AS REAL) ELSE 0 END) AS late_sum
             FROM perm_cases
            WHERE days IS NOT NULL AND received_date >= ?
            GROUP BY month ORDER BY month""",
        [SINCE_MONTH],
    )
    gaps = []
    for r in per_month:
        en, ln = int(r["early_n"] or 0), int(r["late_n"] or 0)
        if en < MIN_CASES_PER_MONTH or ln < MIN_CASES_PER_MONTH:
            continue
        gap = float(r["late_sum"]) / ln - float(r["early_sum"]) / en
        gaps.append({"month": r["month"], "gapDays": round(gap, 1), "cases": en + ln})

    only = sorted(g["gapDays"] for g in gaps)
    doc = {
        "letters": letters,
        "meanDays": round(overall, 1),
        "cases": total_n,
        # End to end, the whole alphabet.
        "spreadDays": round(
            max(l["meanDays"] for l in letters) - min(l["meanDays"] for l in letters), 1
        ),
        "monthlyGaps": gaps,
        "medianGapDays": round(only[len(only) // 2], 1) if only else 0.0,
        "monthsMeasured": len(only),
        # How often the ordering runs BACKWARDS. A single average cannot say
        # this, and it is the fact that decides how much weight the term bears.
        "monthsReversed": sum(1 for g in only if g < 0),
        "since": SINCE_MONTH,
        "source": "DOL PERM disclosure files",
    }

    log(
        f"  {len(letters)} letters over {total_n:,} cases | "
        f"spread {doc['spreadDays']}d | median monthly gap {doc['medianGapDays']}d | "
        f"reversed in {doc['monthsReversed']} of {doc['monthsMeasured']} months"
    )
    return doc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="compute and print, write nothing")
    args = ap.parse_args()

    db = Turso()
    doc = build(db)

    if args.dry_run:
        log("  --dry-run: nothing written")
        log(json.dumps(doc["letters"], indent=1))
        return 0

    payload = json.dumps(doc, separators=(",", ":"))
    log(f"  writing perm_docs['{DOC_KEY}'] ({len(payload):,} bytes)")
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
        [DOC_KEY, payload, int(time.time() * 1000)],
    )

    # Read it back. An INSERT a pipeline reported as fine is not evidence the
    # row is there in the shape the reader expects.
    check = rows(db, "SELECT length(json) AS n FROM perm_docs WHERE key = ?", [DOC_KEY])
    if not check or int(check[0]["n"]) != len(payload):
        log("  FAIL: read-back does not match what was written.")
        return 1
    log("  ok")
    return 0


if __name__ == "__main__":
    _ = lit
    sys.exit(main())
