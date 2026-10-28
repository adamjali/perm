"""How many PERM jobs meet the EB-2 bar, from what their wage requests say they require.

The employer picks EB-2 or EB-3 at the I-140, so no PERM record says which line a case will join.
What DOL's wage-request file does print is the job's own minimum: its education and experience,
and the employer's alternative. A job whose minimum is a master's or higher, or a bachelor's and
five years of progressive experience, meets the advanced-degree bar EB-2 asks for (8 C.F.R.
§ 204.5(k)(2)); one that doesn't can only go EB-3. An alternative counts too: the minimum is the
lower of the two. So this is the share of jobs that COULD file EB-2, an upper bound on the EB-2
share, never a count of who did.

Over the PERM wage requests DOL determined in the newest WINDOW_MONTHS the file holds: the jobs
whose PERMs are being filed and decided now. Written to perm_docs['eb_split']; runs after each
wage-request load.

    python3 scripts/build_eb_split.py [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
import time

from lib_db import Database, query_rows, record_run, write_doc

DOC_KEY = "eb_split"
SCRIPT = "build_eb_split.py"
# A year of determinations: every season's filings, and recent enough to be the jobs in line now.
WINDOW_MONTHS = 12
# Five years of progressive experience after a bachelor's is the advanced-degree equivalent.
BACHELORS_PLUS_MONTHS = 60
ADVANCED = {"Master's", "Doctorate (PhD)", "Other degree (JD, MD, etc.)"}


def log(msg: str) -> None:
    print(msg, flush=True)


def meets(edu: str | None, months) -> bool | None:
    """Whether one requirement meets the EB-2 bar; None when DOL's file doesn't say."""
    if not edu:
        return None
    if edu in ADVANCED:
        return True
    if edu == "Bachelor's":
        try:
            return float(months) >= BACHELORS_PLUS_MONTHS if months not in (None, "") else False
        except (TypeError, ValueError):
            return False
    return False


def eb2_bar(edu, months, alt_edu, alt_months) -> bool | None:
    """The job's minimum meets the bar only when the requirement and any alternative both do."""
    main = meets(edu, months)
    if main is None:
        return None
    if not alt_edu or alt_edu == "None":
        return main
    alt = meets(alt_edu, alt_months)
    return main and bool(alt)


def window_start(newest: str) -> str:
    d = dt.date.fromisoformat(newest[:10])
    y, m = d.year, d.month - WINDOW_MONTHS + 1
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y:04d}-{m:02d}-01"


def summarize(rows, start: str, end: str) -> dict:
    counts = {"eb2": 0, "eb3": 0, "unknown": 0}
    for r in rows:
        v = eb2_bar(*r)
        counts["eb2" if v else "unknown" if v is None else "eb3"] += 1
    return {"from": start, "to": end, "requests": sum(counts.values()), **counts}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    db = Database()
    newest = query_rows(db, "SELECT MAX(COALESCE(determined_on, decision_date)) FROM pwd_cases WHERE visa_class = 'PERM'")[0][0]
    if not newest:
        log("no PERM wage request held: nothing to split")
        return 1
    end = str(newest)[:10]
    start = window_start(end)
    rows = query_rows(
        db,
        """SELECT req_education, req_experience_months, alt_education, alt_experience_months
             FROM pwd_cases WHERE visa_class = 'PERM'
              AND COALESCE(determined_on, decision_date) BETWEEN ? AND ?""",
        [start, end],
    )
    doc = summarize(rows, start, end)
    known = doc["eb2"] + doc["eb3"]
    log(f"{doc['requests']:,} PERM wage requests determined {start} to {end}: "
        f"{doc['eb2']:,} meet the EB-2 bar ({doc['eb2'] / max(known, 1):.0%} of those that say), "
        f"{doc['eb3']:,} don't, {doc['unknown']:,} don't say")
    if args.dry_run:
        return 0
    if known == 0:
        log("no wage request says what the job requires: refusing to write an empty split")
        record_run(db, SCRIPT, status="failed", note="no requirement columns", started_at=started)
        return 1
    write_doc(db, DOC_KEY, doc)
    record_run(db, SCRIPT, status="ok", rows_written=1, note=f"{doc['requests']:,} requests, {start} to {end}", started_at=started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
