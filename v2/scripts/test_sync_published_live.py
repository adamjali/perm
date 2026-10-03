#!/usr/bin/env python3
"""The published-to-live sync (sync_published_live.py), against real in-memory SQLite."""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import sync_published_live as s  # noqa: E402
import ingest_pwd_status_direct as programs  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

fails: list[str] = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


TODAY = datetime.date(2026, 10, 3)


def fresh_db() -> SqliteTurso:
    db = SqliteTurso()
    db.script([
        "CREATE TABLE perm_cases (case_number TEXT PRIMARY KEY, received_date TEXT, status TEXT)",
        "CREATE TABLE perm_case_status (case_number TEXT PRIMARY KEY, filing_date TEXT, current_status TEXT, "
        "is_final INTEGER, is_disclosed INTEGER, employer_name TEXT, job_title TEXT, submitted_date TEXT, "
        "last_checked_at TEXT, verified INTEGER, source TEXT, fetched_at INTEGER)",
        "CREATE TABLE pwd_cases (case_number TEXT PRIMARY KEY, received_date TEXT)",
        "CREATE TABLE lca_cases (case_number TEXT PRIMARY KEY, received_date TEXT)",
    ])
    programs.ensure_schema(db)
    return db


db = fresh_db()
# PERM: a published G- case the live table lacks, one it has, an old A- one.
db.execute("INSERT INTO perm_cases VALUES ('G-100-25010-100001', '2025-01-10', 'certified')")
db.execute("INSERT INTO perm_cases VALUES ('G-200-25010-100002', '2025-01-10', 'denied')")
db.execute("INSERT INTO perm_cases VALUES ('A-22187-83701', '2022-07-08', 'certified')")
db.execute("INSERT INTO perm_case_status (case_number, current_status, is_final) "
           "VALUES ('G-200-25010-100002', 'DENIED', 1)")
# Wage requests: one recent (inside the 180-day window), one old.
db.execute("INSERT INTO pwd_cases VALUES ('P-200-26150-200001', '2026-05-30')")
db.execute("INSERT INTO pwd_cases VALUES ('P-100-24100-200002', '2024-04-09')")

asked: list[list[str]] = []


def dol(nums):
    asked.append(list(nums))
    out = []
    for n in nums:
        if n == "G-100-25010-100001":
            # Published as certified; DOL says it has since expired.
            out.append({"caseNumber": n, "caseStatus": "CERTIFIED - EXPIRED", "employerName": "Acme",
                        "jobTitle": "Engineer", "submittedDate": "2025-01-10"})
        if n == "P-200-26150-200001":
            out.append({"caseNumber": n, "caseStatus": "DETERMINATION ISSUED", "employerName": "Tech Co",
                        "jobTitle": "Analyst", "visaType": "H-1B"})
    # The endpoint is a search: it volunteers near matches too.
    out.append({"caseNumber": "G-100-25010-999999", "caseStatus": "ANALYST REVIEW"})
    return out


r = s.sync(db, cap=99, lookup=dol, today=TODAY, pace=0, sleep=lambda _x: None)
flat = [n for b in asked for n in b]
_all = {"perm_cases", "perm_case_status", "pwd_cases", "lca_cases", "seasonal_cases",
        *(c["table"] for c in programs.PROGRAMS.values())}
_seasonal = sorted(pub for pub, live, _p, _w in s.plan(_all) if live == "seasonal_case_status")
check(_seasonal == ["pwd_cases", "seasonal_cases"],
      f"the seasonal live table is fed by the PW file and the shared H-2A, H-2B and CW-1 table ({_seasonal})")
check(not [pub for pub, _l, _p, _w in s.plan(_all - {"seasonal_cases"}) if pub == "seasonal_cases"],
      "a published table the database lacks is left out of the plan")
check("G-100-25010-100001" in flat, "a published new-form PERM case missing live is asked")
check("G-200-25010-100002" not in flat, "a case the live table holds is not asked")
check(not any(n.startswith("A-") for n in flat), "old-form A- numbers are never asked (DOL's live service lacks them)")
check("P-200-26150-200001" in flat, "a recent published wage request missing live is asked")
check("P-100-24100-200002" not in flat, "a wage request past the re-check window is left to the file")

row = db.execute("SELECT current_status, is_final, is_disclosed, source FROM perm_case_status "
                 "WHERE case_number = 'G-100-25010-100001'")["response"]["result"]["rows"]
vals = [c["value"] if c["type"] != "null" else None for c in row[0]] if row else []
check(vals[:3] == ["CERTIFIED - EXPIRED", "1", "1"],
      f"stored with DOL's status today, final, and marked disclosed (got {vals})")
check(vals[3:] == [s.SYNC_SOURCE], "and the source says it came from the published file")
check(not db.execute("SELECT 1 FROM perm_case_status WHERE case_number = 'G-100-25010-999999'")
      ["response"]["result"]["rows"], "a near match DOL volunteers is not stored")
pwd_row = db.execute("SELECT current_status FROM pwd_case_status WHERE case_number = 'P-200-26150-200001'")
check(bool(pwd_row["response"]["result"]["rows"]), "the H-1B wage request lands in the wage-request table")
check(r["stored"] == 2, f"two rows stored (got {r['stored']})")
check(not db.execute("SELECT 1 FROM sqlite_master WHERE name = 'perm_case_events'")["response"]["result"]["rows"]
      or not db.execute("SELECT 1 FROM perm_case_events")["response"]["result"]["rows"],
      "no status-change event is written")

asked.clear()
r2 = s.sync(db, cap=99, lookup=dol, today=TODAY, pace=0, sleep=lambda _x: None)
check(r2["requests"] == 0 and not asked, "a second run has nothing to sync and asks nothing")
check(s.note_of(r2) == "nothing to sync", f"and says so (got {s.note_of(r2)!r})")

# A refusal stops the run and is named, not raised.
db3 = fresh_db()
db3.execute("INSERT INTO perm_cases VALUES ('G-100-25010-100001', '2025-01-10', 'certified')")


def refuse(_nums):
    raise RuntimeError("HTTP 403")


r3 = s.sync(db3, cap=99, lookup=refuse, today=TODAY, pace=0, sleep=lambda _x: None)
check(r3["refused"] == "HTTP 403" and r3["stored"] == 0, "a refusal stops the run without storing")
check("refusal" in s.note_of(r3), "and the note names it")

# The cap stops it and the rest wait for tomorrow.
db4 = fresh_db()
for i in range(120):
    db4.execute("INSERT INTO perm_cases VALUES (?, '2025-01-10', 'certified')", [f"G-100-25010-{i:06d}"])
asked.clear()
r4 = s.sync(db4, cap=2, lookup=dol, today=TODAY, pace=0, sleep=lambda _x: None)
check(r4["requests"] == 2 and r4["capped"], "the request cap stops the run")
check(all(len(b) <= 50 for b in asked), "no request carries more than DOL's 50")

print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAILURE(S)'}")
raise SystemExit(1 if fails else 0)
