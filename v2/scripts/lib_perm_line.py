"""Where DOL is in the PERM line by our own daily check of its case status.

The Python twin of permLineFrom in src/lib/permLine.ts: the oldest filing month with FRONT_MIN_CASES or more
cases that DOL hasn't decided WORKING_BELOW of, read from the census matrix (one row per filing month, status
and is_final). DOL's processing-times page stopped printing a filing month on Oct 31 2026, so the scripts that
read DOL's month take this one when DOL prints none. scripts/fixtures/perm_line.json holds both twins to the
same answers.
"""

from __future__ import annotations

import json
from typing import Iterable, Mapping

# src/lib/liveQueue.ts FRONT_MIN_CASES and src/lib/pwdLine.ts WORKING_BELOW; the fixture test reads both files.
FRONT_MIN_CASES = 100
WORKING_BELOW = 0.5


def perm_line_month(matrix: Iterable[Mapping]) -> str | None:
    """The month DOL is deciding, "YYYY-MM", or None when the record doesn't reach back far enough to show it."""
    months: dict[str, list[int]] = {}
    for r in matrix:
        m = str(r.get("month") or "")
        if len(m) != 7 or m[4] != "-":
            continue
        t = months.setdefault(m, [0, 0])
        n = int(r.get("n") or 0)
        t[0] += n
        if int(r.get("is_final") or 0) == 1:
            t[1] += n
    busy = sorted((m, t) for m, t in months.items() if t[0] >= FRONT_MIN_CASES)
    at = next((i for i, (_, t) in enumerate(busy) if t[1] / t[0] < WORKING_BELOW), -1)
    # The first month on record still mostly waiting: the record doesn't show where DOL is.
    return busy[at][0] if at > 0 else None


def _rows(db, query_rows, sql: str, args: list) -> list:
    """The rows, or none when the table doesn't exist yet (a fresh database); any other error is raised."""
    try:
        return query_rows(db, sql, args)
    except Exception as e:  # sqlite3 and libSQL raise different classes for the same message
        if "no such table" in str(e).lower():
            return []
        raise


def line_now(db, query_rows) -> tuple[str | None, str | None]:
    """(month, our check's day) from perm_docs['live_census'], or (None, None)."""
    rows = _rows(db, query_rows, "SELECT json FROM perm_docs WHERE key = 'live_census'", [])
    if not rows or not rows[0][0]:
        return None, None
    try:
        doc = json.loads(rows[0][0])
    except ValueError:
        return None, None
    return perm_line_month(doc.get("matrix") or []), doc.get("asOf")


def line_on(db, query_rows, day: str) -> str | None:
    """The month by the census as it stood on a past day (perm_census_days, from Aug 30 2026), or None."""
    got = _rows(db, query_rows, "SELECT MAX(day) FROM perm_census_days WHERE day <= ?", [day])
    newest = got[0][0] if got else None
    if not newest:
        return None
    rows = query_rows(db, "SELECT month, is_final, SUM(n) FROM perm_census_days WHERE day = ? GROUP BY month, is_final",
                      [newest])
    return perm_line_month({"month": r[0], "is_final": r[1], "n": r[2]} for r in rows)
