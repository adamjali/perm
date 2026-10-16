#!/usr/bin/env python3
"""Where the RFIs our sweep watched stand, and how the decided ones ended.

    python3 scripts/test_rfi_path.py

NO NETWORK and no production database: the real SQL in
`ingest_case_status_direct.RFI_PATH_SQL` runs against in-memory SQLite through
`lib_sqlite_shim`. What has to hold:

  1. Only RFIs whose start the sweep saw are counted: one already at an RFI on
     the log's first day has no known start and is left out.
  2. Each RFI sits in exactly one place: still at the RFI, replied and waiting,
     or decided (its first final status, so a denial reopened on appeal still
     counts as the denial).
  3. "After the reply" means decided after the case left RFI for review; a case
     withdrawn straight from the RFI is decided but not after a reply.
"""
from __future__ import annotations

import datetime
import pathlib
import sys
from zoneinfo import ZoneInfo

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from lib_sqlite_shim import SqliteTurso  # noqa: E402
import ingest_case_status_direct as core  # noqa: E402

FAILS: list[str] = []
ET = ZoneInfo("America/New_York")


def check(label: str, cond: bool, detail: str = "") -> None:
    print(("ok   " if cond else "FAIL ") + label + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(label)


def ts(day: str, hour: int = 8) -> int:
    d = datetime.datetime.strptime(day, "%Y-%m-%d").replace(hour=hour, tzinfo=ET)
    return int(d.timestamp() * 1000)


EVENTS_DDL = """CREATE TABLE perm_case_events (
    case_number TEXT NOT NULL, changed_at INTEGER NOT NULL,
    from_status TEXT NOT NULL, to_status TEXT NOT NULL,
    to_final INTEGER NOT NULL, source TEXT NOT NULL,
    PRIMARY KEY (case_number, changed_at))"""

FINAL = {"CERTIFIED", "DENIED", "WITHDRAWN", "CERTIFIED - EXPIRED"}


def seeded(events: list[tuple[str, str, str, str]]) -> SqliteTurso:
    db = SqliteTurso()
    db.conn.execute(EVENTS_DDL)
    for case, day, frm, to in events:
        db.conn.execute(
            "INSERT INTO perm_case_events VALUES (?, ?, ?, ?, ?, ?)",
            [case, ts(day, 8 + len(frm) % 5), frm, to, 1 if to in FINAL else 0, core.SOURCE],
        )
    db.conn.commit()
    return db


def main() -> int:
    db = seeded([
        # The log's first day: this RFI's start is unknown, so it is left out.
        ("G-1", "2026-08-27", "ANALYST REVIEW", "RFI ISSUED"),
        ("G-1", "2026-09-28", "RFI ISSUED", "ANALYST REVIEW"),
        # Still at the RFI.
        ("G-2", "2026-09-20", "ANALYST REVIEW", "RFI ISSUED"),
        # Replied, not yet decided.
        ("G-3", "2026-09-01", "ANALYST REVIEW", "RFI ISSUED"),
        ("G-3", "2026-10-02", "RFI ISSUED", "ANALYST REVIEW"),
        # Replied, then certified (and the certification later lapsed).
        ("G-4", "2026-09-01", "ANALYST REVIEW", "RFI ISSUED"),
        ("G-4", "2026-10-02", "RFI ISSUED", "ANALYST REVIEW"),
        ("G-4", "2026-10-06", "ANALYST REVIEW", "CERTIFIED"),
        ("G-4", "2026-10-09", "CERTIFIED", "CERTIFIED - EXPIRED"),
        # Replied, denied, then reopened on reconsideration: still a denial.
        ("G-5", "2026-09-02", "ANALYST REVIEW", "RFI ISSUED"),
        ("G-5", "2026-10-03", "RFI ISSUED", "ANALYST REVIEW"),
        ("G-5", "2026-10-08", "ANALYST REVIEW", "DENIED"),
        ("G-5", "2026-10-12", "DENIED", "RECONSIDERATION APPEALS"),
        # Withdrawn straight from the RFI: decided, but not after a reply.
        ("G-6", "2026-09-03", "ANALYST REVIEW", "RFI ISSUED"),
        ("G-6", "2026-09-15", "RFI ISSUED", "WITHDRAWN"),
        # A case that never had an RFI does not count.
        ("G-7", "2026-09-03", "ANALYST REVIEW", "CERTIFIED"),
    ])
    p = core.rfi_path(db)
    check("a path is computed", p is not None)
    if p is None:
        return 1
    check("the log's first day is left out of the count", p["entered"] == 5, str(p))
    check("still at the RFI", p["inRfi"] == 1, str(p))
    check("replied and waiting", p["repliedWaiting"] == 1, str(p))
    check("decided: the first final status counts",
          p["decided"] == {"certified": 1, "denied": 1, "withdrawn": 1, "other": 0}, str(p["decided"]))
    check("after the reply excludes a withdrawal straight from the RFI",
          p["afterReply"] == {"certified": 1, "denied": 1, "withdrawn": 0, "other": 0}, str(p["afterReply"]))
    placed = p["inRfi"] + p["repliedWaiting"] + sum(p["decided"].values())
    check("every RFI sits in exactly one place", placed == p["entered"], f"{placed} of {p['entered']}")
    check("the window starts the day after the log opened", p["since"] == "2026-08-28", str(p["since"]))

    empty = SqliteTurso()
    empty.conn.execute(EVENTS_DDL)
    check("no events, no path", core.rfi_path(empty) is None)

    print(f"\n{'FAILED: ' + ', '.join(FAILS) if FAILS else 'all passed'}")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
