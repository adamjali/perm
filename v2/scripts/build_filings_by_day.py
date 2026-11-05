#!/usr/bin/env python3
"""How many cases were filed each day, every program, DOL's live record and its files together.

perm_docs['filings_by_day'] answers "how many were filed today, yesterday, this
week, on March 3" for PERM, wage requests, H-1B LCAs and the seasonal programs
(owner, Nov 5 2026: "work properly with both live data and published from
disclosure ... and properly handle mismatch or only in one").

DOL holds each case twice. Its live case-status service (our sweep's
`*_case_status` tables, `filing_date`) has every case it indexes, pending
included, from about mid-2023; its quarterly files (`perm_cases`,
`perm_cases_history`, `pwd_cases`, `lca_case_numbers`, `seasonal_cases`,
`received_date`) have decided cases only, back years further. A case is
counted once, by case number:

* on its live filing day when the live record holds it;
* otherwise on the file's received day (the first file that holds it);
* `mismatch` counts the day's cases whose file gives another day (most are one
  day apart: 8,303 PERM cases on Nov 5 2026, the live service dating by when
  DOL indexed the filing);
* `fileOnly` counts the day's cases only a file holds; `waiting` the live ones
  DOL hasn't decided (a file only holds decided cases).

One row per day: [day, filed, waiting, fileOnly, mismatch], from FROM_DAY to
today, days with nothing left out. About 40 s for all four programs (measured
on production Nov 5 2026). Run after each case-status pass, so today's count
follows the discovery walk.

    python3 scripts/build_filings_by_day.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, et_today, query_rows, record_run, write_doc  # noqa: E402

SCRIPT = "build_filings_by_day.py"
DOC = "filings_by_day"
# DOL's FY2020: every program's files reach it.
FROM_DAY = "2019-10-01"

# Per program: the live table, then the files in the order they're preferred (a
# case in two files counts on the first one's day, as the case lookup reads them).
PROGRAMS: dict[str, dict] = {
    # `is_final IN (0, 1)` lets SQLite seek the (is_final, filing_date) index twice.
    "perm": {"live": "perm_case_status", "live_where": "is_final IN (0, 1) AND ",
             "files": ["perm_cases", "perm_cases_history"]},
    "pwd": {"live": "pwd_case_status", "live_where": "", "files": ["pwd_cases"]},
    "lca": {"live": "lca_case_status", "live_where": "", "files": ["lca_case_numbers"]},
    "seasonal": {"live": "seasonal_case_status", "live_where": "", "files": ["seasonal_cases"]},
}


def merge(live: list, file_only: list, mismatch: list) -> list[list]:
    """Pure: the day rows. `live` is (day, n, waiting); `file_only` and `mismatch` are (day, n).

    A day appears once whatever lists name it; counts are summed per day, and a
    row with nothing filed is left out."""
    days: dict[str, list[int]] = {}

    def row(d) -> list[int] | None:
        day = str(d or "")[:10]
        if len(day) != 10 or day[4] != "-":
            return None
        return days.setdefault(day, [0, 0, 0, 0])

    for d, n, w in live:
        r = row(d)
        if r is not None:
            r[0] += int(n or 0)
            r[1] += int(w or 0)
    for d, n in file_only:
        r = row(d)
        if r is not None:
            r[0] += int(n or 0)
            r[2] += int(n or 0)
    for d, n in mismatch:
        r = row(d)
        if r is not None:
            r[3] += int(n or 0)
    return [[d, *v] for d, v in sorted(days.items()) if v[0] > 0]


def program_days(db: Database, cfg: dict, since: str, until: str) -> tuple[list[list], dict]:
    live_t, where = cfg["live"], cfg["live_where"]
    live = query_rows(db, f"""
        SELECT filing_date, COUNT(*), SUM(is_final = 0) FROM {live_t}
         WHERE {where}filing_date >= ? AND filing_date <= ? GROUP BY filing_date""", [since, until])
    file_only: list = []
    mismatch: list = []
    earlier: list[str] = []
    for f in cfg["files"]:
        not_earlier = "".join(f" AND NOT EXISTS (SELECT 1 FROM {e} x WHERE x.case_number = p.case_number)" for e in earlier)
        file_only += query_rows(db, f"""
            SELECT p.received_date, COUNT(*) FROM {f} p
             WHERE p.received_date >= ? AND p.received_date <= ?
               AND NOT EXISTS (SELECT 1 FROM {live_t} s WHERE s.case_number = p.case_number){not_earlier}
             GROUP BY p.received_date""", [since, until])
        mismatch += query_rows(db, f"""
            SELECT s.filing_date, COUNT(*) FROM {live_t} s JOIN {f} p ON p.case_number = s.case_number
             WHERE s.filing_date >= ? AND s.filing_date <= ? AND p.received_date <> s.filing_date{not_earlier}
             GROUP BY s.filing_date""", [since, until])
        earlier.append(f)
    rows = merge(live, file_only, mismatch)
    first_live = min((str(d)[:10] for d, *_ in live if d), default=None)
    return rows, {"liveFrom": first_live}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    db = Database()
    today = et_today()
    doc = {"computedAt": int(time.time() * 1000), "asOf": today, "from": FROM_DAY, "programs": {}}
    notes = []
    for name, cfg in PROGRAMS.items():
        t = time.time()
        rows, meta = program_days(db, cfg, FROM_DAY, today)
        doc["programs"][name] = {"days": rows, **meta}
        filed = sum(r[1] for r in rows)
        notes.append(f"{name}: {len(rows)} days, {filed:,} filed, {sum(r[3] for r in rows):,} only in a file, "
                     f"{sum(r[4] for r in rows):,} dated otherwise by a file ({time.time() - t:.0f} s)")
        print(notes[-1], flush=True)
    if not any(p["days"] for p in doc["programs"].values()):
        print("no days read: nothing written", file=sys.stderr)
        if not a.dry_run:
            record_run(db, SCRIPT, status="failed", rows_written=0, note="no days read")
        return 1
    if a.dry_run:
        print(json.dumps({k: v["days"][-3:] for k, v in doc["programs"].items()}))
        return 0
    write_doc(db, DOC, json.dumps(doc, separators=(",", ":")))
    record_run(db, SCRIPT, status="ok", rows_written=1, note="; ".join(notes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
