"""build_census_days.py: the PERM census replayed to the end of each past DOL day.

Runs the real reads and writes against in-memory SQLite (lib_sqlite_shim), so a
query that reads the wrong rows fails here rather than drawing a wrong wall.
"""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_census_days as bcd  # noqa: E402
from ingest_case_status_direct import SOURCE  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILED: list[str] = []
ET = datetime.timezone(datetime.timedelta(hours=-4))  # EDT, all of these days


def check(name: str, got, want) -> None:
    ok = got == want
    print(("ok  " if ok else "FAIL") + f" {name}" + ("" if ok else f": got {got!r}, want {want!r}"))
    if not ok:
        FAILED.append(name)


def ms(day: str, hour: int) -> int:
    y, m, d = map(int, day.split("-"))
    return int(datetime.datetime(y, m, d, hour, tzinfo=ET).timestamp() * 1000)


def seed() -> SqliteTurso:
    db = SqliteTurso()
    db.script([
        "CREATE TABLE perm_case_status (case_number TEXT PRIMARY KEY, filing_date TEXT, current_status TEXT, is_final INTEGER)",
        "CREATE TABLE perm_case_events (case_number TEXT NOT NULL, changed_at INTEGER NOT NULL, from_status TEXT NOT NULL, "
        "to_status TEXT NOT NULL, to_final INTEGER NOT NULL, source TEXT NOT NULL, PRIMARY KEY (case_number, changed_at))",
    ])
    rows = [
        # Never moved: analyst review from its filing day on.
        ("G-1", "2026-01-10", "ANALYST REVIEW", 0),
        # Went to an RFI on Sep 2 (seen 3 PM), back to analyst review on Sep 4, certified Sep 5 (seen 5 AM Sep 6).
        ("G-2", "2026-01-11", "CERTIFIED", 1),
        # Filed Sep 3: not in the census before then.
        ("G-3", "2026-09-03", "ANALYST REVIEW", 0),
        # Filed with no date: never counted, like the live census.
        ("G-4", "", "ANALYST REVIEW", 0),
        # Filed Sep 4 and sent an RFI Sep 5: absent before its filing day though it has a change.
        ("G-6", "2026-09-04", "RFI ISSUED", 0),
        # Denied, then appealed on Sep 3: a final status before the change, pending after.
        ("G-7", "2025-06-01", "RECONSIDERATION APPEALS", 0),
    ]
    for r in rows:
        db.execute("INSERT INTO perm_case_status VALUES (?,?,?,?)", list(r))
    for case, at, frm, to, fin, src in [
        ("G-2", ms("2026-09-02", 15), "ANALYST REVIEW", "RFI ISSUED", 0, SOURCE),
        ("G-2", ms("2026-09-04", 15), "RFI ISSUED", "ANALYST REVIEW", 0, SOURCE),
        ("G-2", ms("2026-09-06", 5), "ANALYST REVIEW", "CERTIFIED", 1, SOURCE),
        ("G-6", ms("2026-09-05", 16), "ANALYST REVIEW", "RFI ISSUED", 0, SOURCE),
        ("G-7", ms("2026-09-03", 10), "DENIED", "RECONSIDERATION APPEALS", 0, SOURCE),
        # A retired mirror's correction is no change DOL made: ignored.
        ("G-1", ms("2026-09-03", 12), "DENIED", "ANALYST REVIEW", 0, "retired mirror (third party)"),
    ]:
        db.execute("INSERT INTO perm_case_events VALUES (?,?,?,?,?,?)", [case, at, frm, to, fin, src])
    return db


def at(census: dict, day: str) -> dict:
    """{(month, status, final): n} for a day, without zero rows."""
    return {k: n for k, n in census.get(day, {}).items() if n}


def main() -> int:
    db = seed()
    days = bcd.day_range("2026-09-01", "2026-09-06")
    census = bcd.replay(bcd.read_cases(db), bcd.read_events(db), days)

    check("a day before every change has every case at its first status", at(census, "2026-09-01"),
          {("2026-01", "ANALYST REVIEW", 0): 2, ("2025-06", "DENIED", 1): 1})
    check("an appeal reopens a denied case on its day", at(census, "2026-09-03").get(("2025-06", "RECONSIDERATION APPEALS", 0)), 1)
    check("a change counts from the DOL day it was seen", at(census, "2026-09-02"),
          {("2026-01", "ANALYST REVIEW", 0): 1, ("2026-01", "RFI ISSUED", 0): 1, ("2025-06", "DENIED", 1): 1})
    check("a case enters the census on its filing day", at(census, "2026-09-03").get(("2026-09", "ANALYST REVIEW", 0)), 1)
    check("a case that later moved enters on its filing day, at its first status", at(census, "2026-09-04").get(("2026-09", "ANALYST REVIEW", 0)), 2)
    check("a change seen before 7 AM is the day before's work", at(census, "2026-09-05").get(("2026-01", "CERTIFIED", 1)), 1)
    check("the newest day is the live table, case for case", at(census, "2026-09-06"),
          {("2026-01", "ANALYST REVIEW", 0): 1, ("2026-01", "CERTIFIED", 1): 1, ("2026-09", "ANALYST REVIEW", 0): 1,
           ("2026-09", "RFI ISSUED", 0): 1, ("2025-06", "RECONSIDERATION APPEALS", 0): 1})
    # A status corrected without an event (the sweep's --reconcile) is what the days after its last change hold.
    db.execute("UPDATE perm_case_status SET current_status = 'CERTIFIED - EXPIRED' WHERE case_number = 'G-2'")
    fixed = bcd.replay(bcd.read_cases(db), bcd.read_events(db), days)
    check("a correction without an event reaches the days after the last change", at(fixed, "2026-09-06").get(("2026-01", "CERTIFIED - EXPIRED", 1)), 1)
    check("and not the days before it", at(fixed, "2026-09-04").get(("2026-01", "CERTIFIED - EXPIRED", 1)), None)
    db.execute("UPDATE perm_case_status SET current_status = 'CERTIFIED' WHERE case_number = 'G-2'")
    check("the mirror's correction moves nothing", at(census, "2026-09-02").get(("2026-01", "DENIED", 0)), None)
    check("a status before a change is final by DOL's own list", bcd.is_final_status("DENIED - BALCA DISMISSED"), True)

    rows = bcd.to_rows(census)
    db.execute(bcd.DDL)
    first = bcd.write(db, rows)
    check("the first write stores every row", first["written"], len(rows))
    check("an unchanged night writes nothing", bcd.write(db, rows)["written"], 0)
    # A case found later (the walk) with an older filing day joins the days it belonged to, rewriting only those rows.
    db.execute("INSERT INTO perm_case_status VALUES ('G-5','2026-09-05','ANALYST REVIEW',0)")
    again = bcd.to_rows(bcd.replay(bcd.read_cases(db), bcd.read_events(db), days))
    check("a late-found case rewrites only its own days' rows", bcd.write(db, again)["written"], 2)

    check("the series starts once the log settled", bcd.day_range(bcd.START, "2026-08-31"), ["2026-08-30", "2026-08-31"])
    check("an empty range is empty", bcd.day_range("2026-09-02", "2026-09-01"), [])
    print(f"{len(FAILED)} failure(s)")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
