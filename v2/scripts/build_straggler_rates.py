#!/usr/bin/env python3
"""How fast DOL decides the in-line cases its queue has already passed.

DOL works PERM cases in filing order; its published "Analyst Review" month is
the front of the line. A case filed before that month and still in analyst
review is a straggler: no filing-order model can date it (every such date has
already passed), and the estimate used to show no date at all.

What we can measure is how fast stragglers are being decided. Over the last
WINDOW_DAYS this counts, from our own daily sweep's record of DOL's statuses:

* `pool`: stragglers pending now, plus those that left during the window
  (so the pool is the population at risk, not the survivors);
* `decided`: stragglers DOL moved from analyst review to a decision (a
  withdrawal is the employer's act and is not counted as DOL deciding);
* `otherExits`: stragglers that left analyst review some other way (an RFI,
  a hold, a withdrawal), which leave the pool without being decided.

The daily rate is decided / exposure, where exposure counts each case for the
days it was in the pool (a case that left mid-window counts for about half).
From the rate: the days by which half of a straggler group is decided, and
eight in ten. Measured Oct 3 2026: about 8% a day, half within 9 days.

Written to perm_docs['straggler_rates'] after the nightly full sweep; the case
estimate reads it and falls back to no date when it is stale or thin
(src/lib/turso/stragglers.ts). Nothing here is a fitted constant.

    python3 scripts/build_straggler_rates.py [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime
import json
import math
import pathlib
import sys
import time
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, query_rows, record_run, write_doc  # noqa: E402

SCRIPT = "build_straggler_rates.py"
DOC = "straggler_rates"
WINDOW_DAYS = 14
IN_LINE = "ANALYST REVIEW"
# The sweep's own events. A reconciliation writes none; a timestamp carrying
# more than this many rows is a catch-up, not a day's work (see changes.ts).
EVENT_SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, direct)"
BULK_WRITE_ROWS = 5000
ET = ZoneInfo("America/New_York")


def frontier_month(db) -> str | None:
    """DOL's own Analyst Review month, from its newest processing-times reading."""
    rows = query_rows(db, "SELECT json FROM processing_times ORDER BY perm_as_of DESC LIMIT 1", [])
    if not rows or not rows[0][0]:
        return None
    try:
        doc = json.loads(rows[0][0])
    except ValueError:
        return None
    for q in doc.get("permQueues") or []:
        if str(q.get("queue", "")).strip().lower() == "analyst review":
            m = str(q.get("priorityDate") or "")
            return m if len(m) == 7 and m[4] == "-" else None
    return None


def days_for(rate: float, share_decided: float) -> int | None:
    """Days until `share_decided` of a group is decided at `rate` a day."""
    if not 0 < rate < 1:
        return None
    return math.ceil(math.log(1 - share_decided) / math.log(1 - rate))


def measure(db, now_ms: int | None = None) -> dict | None:
    now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
    front = frontier_month(db)
    if not front:
        return None
    since = now_ms - WINDOW_DAYS * 86_400_000
    first_of_front = f"{front}-01"
    # Stragglers pending today.
    pending = int(query_rows(
        db, "SELECT COUNT(*) FROM perm_case_status WHERE current_status = ? AND is_final = 0 "
            "AND filing_date < ?", [IN_LINE, first_of_front])[0][0] or 0)
    # Their exits from analyst review in the window, minus bulk catch-up writes.
    exits = query_rows(db, """
        SELECT e.changed_at, e.to_status, e.to_final
          FROM perm_case_events e JOIN perm_case_status s ON s.case_number = e.case_number
         WHERE e.source = ? AND e.from_status = ? AND e.changed_at >= ?
           AND s.filing_date < ?
           AND e.changed_at NOT IN (
               SELECT changed_at FROM perm_case_events WHERE changed_at >= ?
                GROUP BY changed_at HAVING COUNT(*) > ?)
    """, [EVENT_SOURCE, IN_LINE, since, first_of_front, since, BULK_WRITE_ROWS])
    decided = other = 0
    exposure = float(pending) * WINDOW_DAYS
    for changed_at, to_status, to_final in exits:
        left_after = (int(changed_at) - since) / 86_400_000
        exposure += max(0.0, min(float(WINDOW_DAYS), left_after))
        final = str(to_final) == "1"
        if final and "WITHDRAWN" not in str(to_status or "").upper():
            decided += 1
        else:
            other += 1
    rate = decided / exposure if exposure > 0 else 0.0
    as_of = datetime.datetime.fromtimestamp(now_ms / 1000, ET).date().isoformat()
    return {
        "asOf": as_of,
        "frontierMonth": front,
        "windowDays": WINDOW_DAYS,
        "pending": pending,
        "pool": pending + decided + other,
        "decided": decided,
        "otherExits": other,
        "dailyRate": round(rate, 5),
        "medianDays": days_for(rate, 0.5),
        "p80Days": days_for(rate, 0.8),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    db = Turso()
    doc = measure(db)
    print(json.dumps(doc, indent=1))
    if a.dry_run:
        return 0
    if doc is None:
        record_run(db, SCRIPT, status="ok", note="no DOL Analyst Review month to measure behind; nothing written")
        return 0
    write_doc(db, DOC, doc)
    record_run(db, SCRIPT, status="ok", rows_written=1,
               note=f"{doc['decided']} of {doc['pool']} stragglers decided in {WINDOW_DAYS} days, "
                    f"{doc['dailyRate']:.1%} a day, half within {doc['medianDays']} days")
    return 0


if __name__ == "__main__":
    sys.exit(main())
