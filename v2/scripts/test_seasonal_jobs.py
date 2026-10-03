#!/usr/bin/env python3
"""The SeasonalJobs feed ingest (ingest_seasonal_jobs.py), against in-memory SQLite.

The fixtures are built here in the feeds' real shape (field names verbatim from
the Oct 3 2026 files) with invented employers and contacts: the real files
carry people's emails and phones, which have no place in a public repository.
"""
from __future__ import annotations

import io
import json
import pathlib
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_seasonal_jobs as sj  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402
from lib_turso import query_rows  # noqa: E402

fails: list[str] = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


CONTACT = {"emppocEmail": "boss@farm.example", "emppocPhone": "+15550100", "attyEmail": "law@firm.example",
           "empFein": "12-3456789", "emppocLastname": "Doe", "prepLastname": "Roe", "empAddr1": "1 Farm Rd"}
H2A = {**CONTACT, "caseNumber": "H-300-26272-266826", "empBusinessName": "Green  Valley Farms LLC",
       "empCity": "Danielsville", "empState": "GA", "empNaics": 111998, "jobSoc": "45-2092.02",
       "jobSocTitle": "Farmworkers and Laborers, Crop", "jobOrderNumber": "JO-A-300-26271-264525",
       "dateSubmitted": "2026-09-29T18:59:22.79Z", "dateAcceptanceLtrIssued": "2026-10-02T23:35:03.000Z",
       "clearanceOrder": {"jobOrderNumber": "JO-A-300-26271-264525", "jobTitle": "Farmworker",
                          "jobWrksNeeded": 3, "jobWrksNeededH2a": 2, "jobBeginDate": "27-Nov-2026",
                          "jobEndDate": "01-Feb-2027", "jobWageOffer": 13.95, "jobWagePer": "Hour",
                          "jobAddr1": "99 Home Lane", "jobPostcode": "30633", "jobCity": "DANIELSVILLE",
                          "jobState": "GA", "jobCounty": "MADISON COUNTY"}}
H2B = {**CONTACT, "caseNumber": "H-400-26265-251001", "tempneedJobtitle": "Landscape Laborer",
       "tempneedSoc": "37-3011", "tempneedSocTitle": "Landscaping and Groundskeeping Workers",
       "tempneedWkrPos": 40, "tempneedStart": "20-Dec-2026", "tempneedEnd": "30-Jun-2027",
       "empBusinessName": "Bluegrass Lawns Inc", "empCity": "Lexington", "empState": "KY", "empNaics": "561730",
       "jobCity": "Lexington", "jobState": "KY", "jobCounty": "FAYETTE COUNTY", "wageFrom": 18.86,
       "wagePer": "Hour", "jobPwdNumber": "P-400-26139-927900",
       "dateApplicationSubmitted": "2026-09-21T20:22:04.290Z", "dateAcceptanceLtrIssued": "2026-10-01T19:27:57.000Z"}
JO = {**CONTACT, "caseNumber": "JO-A-300-26276-278017", "jobTitle": "FARM WORKER", "jobWrksNeeded": 8,
      "jobWrksNeededH2a": 8, "jobBeginDate": "02-Dec-2026", "jobEndDate": "01-Oct-2027", "jobWageOffer": 15.0,
      "jobWagePer": "Hour", "jobCity": "DANIELSVILLE", "jobState": "GA", "jobCounty": "MADISON COUNTY",
      "socCode": None, "empBusinessName": "Lathem Orchards", "empNaics": 112340,
      "dateSubmitted": "2026-10-03T03:48:49.930Z", "dateAcceptanceLtrIssued": None}


def zipped(records: list[dict]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("2026-10-03_x.json", json.dumps(records))
    return buf.getvalue()


# ---- parsing ----------------------------------------------------------------
a = sj.parse("h2a", H2A, "2026-10-03")
check(a["case_number"] == "H-300-26272-266826" and a["visa"] == "H-2A", "an H-2A application keeps its number and visa")
check(a["employer_name"] == "Green Valley Farms LLC" and a["employer_slug"], "spaces collapse and the employer is slugged")
check((a["wage"], a["wage_unit"], a["workers"], a["workers_foreign"]) == (13.95, "HOUR", 3, 2),
      "the wage and workers come from the job order the application carries")
check((a["begin_date"], a["end_date"]) == ("2026-11-27", "2027-02-01"), "DOL's 27-Nov-2026 dates become ISO")
check((a["worksite_city"], a["worksite_county"], a["worksite_state"]) == ("DANIELSVILLE", "Madison", "GA"),
      "the worksite is city, county (without the word County) and state")
check(a["job_order_number"] == "JO-A-300-26271-264525", "the application links its job order")
check(a["accepted_date"] == "2026-10-02" and a["submitted_date"] == "2026-09-29", "submitted and accepted days")
check(a["soc_code"] == "45-2092.02", "the occupation code")

b = sj.parse("h2b", H2B, "2026-10-03")
check(b["visa"] == "H-2B" and b["pwd_number"] == "P-400-26139-927900", "an H-2B application links its wage determination")
check((b["wage"], b["workers"], b["begin_date"]) == (18.86, 40, "2026-12-20"), "H-2B wage, workers and start")
check(b["submitted_date"] == "2026-09-21", "H-2B's own submitted-date field")

j = sj.parse("jo", JO, "2026-10-03")
check(j["case_number"] == "JO-A-300-26276-278017" and j["accepted_date"] is None, "a job order not yet accepted keeps a blank date")
check(j["naics"] == "112340", "a numeric NAICS becomes text")

everything = json.dumps([a, b, j])
check(not any(v in everything for v in ("example", "5550100", "12-3456789", "Doe", "Roe", "Farm Rd", "Home Lane", "30633")),
      "no email, phone, FEIN, contact name, street address or postcode reaches a row")
check(sj.parse("h2a", {"caseNumber": ""}, "2026-10-03") is None, "a record with no case number is skipped")
check(sj.day("junk") is None and sj.state("Georgia") is None, "an unreadable date or state stays NULL")

# ---- reading a zip ------------------------------------------------------------
check(len(sj.read_zip(zipped([H2A, H2A]))) == 2, "a zip of one JSON array is read")
two = io.BytesIO()
with zipfile.ZipFile(two, "w") as z:
    z.writestr("a.json", "[]")
    z.writestr("b.json", "[]")
try:
    sj.read_zip(two.getvalue())
    check(False, "a zip of two JSON files is refused")
except ValueError:
    check(True, "a zip of two JSON files is refused")

# ---- writing: the same case across days ------------------------------------
db = SqliteTurso()
sj.ensure_schema(db)
sj.write(db, [sj.parse("h2a", H2A, "2026-10-01")])
later = dict(H2A, empCity=None)              # a later file missing a field must not blank it
sj.write(db, [sj.parse("h2a", later, "2026-10-03")])
sj.write(db, [sj.parse("h2a", H2A, "2026-09-28")])  # a backfill reaching an older day
got = query_rows(db, f"SELECT case_number, first_seen, last_seen, employer_city FROM {sj.TABLE}", [])
check(len(got) == 1, f"one row per case however many files list it ({len(got)})")
check(tuple(got[0][1:3]) == ("2026-09-28", "2026-10-03"), f"first and last seen span every file ({got[0][1:3]})")
check(got[0][3] == "Danielsville", "a blank in a later file never erases a value")

print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAILURE(S)'}")
raise SystemExit(1 if fails else 0)
