#!/usr/bin/env python3
"""The layoff-answer summary, against in-memory SQLite.

Asserts:
1. a blank answer counts as unanswered, never as no, and a year whose file
   didn't print the question isn't shown;
2. the yes and no cases' outcomes are counted apart;
3. an employer's spellings fold onto its page, one with no page keeps its name
   and no link, and an employer that only answered no isn't listed;
4. jobs group by the seven-character SOC code;
5. the doc is written and read back.

Run:  python3 scripts/test_layoff_disclosures.py
"""
from __future__ import annotations

import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_layoff_disclosures as b  # noqa: E402
from lib_db import read_doc  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILS: list[str] = []


def check(label: str, ok: bool) -> None:
    print(("PASS " if ok else "FAIL ") + label)
    if not ok:
        FAILS.append(label)


COLS = "case_number, status, decision_date, fiscal_year, employer_name, employer_slug, soc_code, soc_title, layoff"


def seeded() -> SqliteTurso:
    db = SqliteTurso()
    c = db.conn
    for t in ("perm_cases", "perm_cases_history"):
        c.execute(f"CREATE TABLE {t} (case_number TEXT PRIMARY KEY, status TEXT, decision_date TEXT, "
                  "fiscal_year TEXT, employer_name TEXT, employer_slug TEXT, soc_code TEXT, soc_title TEXT, layoff TEXT)")
    c.execute("CREATE TABLE employer_page_map (source_slug TEXT, page_slug TEXT)")
    c.execute("CREATE TABLE perm_entities (kind TEXT, slug TEXT, name TEXT, code TEXT, total INTEGER)")
    c.execute("CREATE TABLE perm_docs (key TEXT PRIMARY KEY, json TEXT, computed_at INTEGER)")
    c.execute("CREATE TABLE ingest_runs (script TEXT, status TEXT, started_at INTEGER, finished_at INTEGER, "
              "rows_written INTEGER, note TEXT)")
    c.executemany("INSERT INTO employer_page_map VALUES (?,?)", [("acme-corp", "acme-inc")])
    c.executemany("INSERT INTO perm_entities VALUES (?,?,?,?,?)", [
        ("employer", "acme-inc", "Acme Inc", None, 9), ("employer", "quiet-llc", "Quiet LLC", None, 9),
        ("occupation", "software-developers", "Software Developers", "15-1252.00", 900),
        ("occupation", "software-developers-old", "Software Developers", "15-1252", 10),
        ("occupation", "a-specialty", "A Specialty", "13-2011.01", 500),
        ("occupation", "accountants-and-auditors", "Accountants and Auditors", "13-2011.00", 50)])
    rows = []
    n = 0

    def add(table, status, fy, name, slug, soc, layoff, count=1):
        nonlocal n
        for _ in range(count):
            n += 1
            rows.append((table, (f"G-100-{n:05d}", status, f"{int(fy) - 1}-12-01", fy, name, slug, soc,
                                 "Software Developers" if soc.startswith("15-1252") else "Accountants", layoff)))

    add("perm_cases", "certified", "2026", "ACME INC", "acme-inc", "15-1252.00", "Y", 3)
    add("perm_cases", "denied", "2026", "Acme Corp", "acme-corp", "15-1252", "Y", 1)
    add("perm_cases", "certified", "2026", "ACME INC", "acme-inc", "15-1252.00", "N", 2)
    add("perm_cases", "certified", "2026", "Small Shop", "", "13-2011.00", "Y", 1)
    add("perm_cases", "certified", "2026", "Quiet LLC", "quiet-llc", "13-2011.00", "N", 4)
    # A title of N/A never names a job.
    rows.append(("perm_cases", ("G-100-99999", "certified", "2025-12-01", "2026", "Quiet LLC", "quiet-llc", "13-2011.00", "N/A", "N")))
    add("perm_cases", "withdrawn", "2026", "Quiet LLC", "quiet-llc", "13-2011.00", None, 1)
    add("perm_cases", "certified", "2025", "ACME INC", "acme-inc", "15-1252.00", "Y", 2)
    add("perm_cases", "certified", "2025", "Quiet LLC", "quiet-llc", "13-2011.00", "N", 2)
    # FY2015's file doesn't print the question: every answer blank.
    add("perm_cases_history", "certified", "2015", "ACME INC", "acme-inc", "15-1252.00", None, 5)
    add("perm_cases_history", "certified", "2019", "ACME INC", "acme-inc", "15-1252.00", "Y", 1)
    add("perm_cases_history", "certified", "2019", "Quiet LLC", "quiet-llc", "13-2011.00", "N", 1)
    for table, r in rows:
        c.execute(f"INSERT INTO {table} ({COLS}) VALUES ({','.join('?' * 9)})", r)
    c.commit()
    return db


def main() -> int:
    db = seeded()
    years = b.read_years(db)
    fy26 = years[2026]
    check(f"FY2026: 13 decided, 12 answered, 5 yes (got {fy26['cases']}, {fy26['answered']}, {fy26['yes']})",
          (fy26["cases"], fy26["answered"], fy26["yes"]) == (13, 12, 5))
    check(f"outcomes counted apart (got {fy26['yesOutcomes']}, {fy26['noOutcomes']})",
          fy26["yesOutcomes"] == {"certified": 4, "denied": 1, "withdrawn": 0}
          and fy26["noOutcomes"] == {"certified": 7, "denied": 0, "withdrawn": 0})
    check(f"a blank answer is not a no (FY2015 answered {years[2015]['answered']})", years[2015]["answered"] == 0)
    fys = b.shown_years(years)
    check(f"a year with no answers isn't shown (got {fys})", fys == [2019, 2025, 2026])

    from build_h1b_ranks import read_pages
    page_of, names = read_pages(db)
    emps, answering = b.read_employers(db, 2026, page_of, names)
    check(f"spellings fold onto the page (got {emps[0] if emps else None})",
          emps and emps[0] == {"slug": "acme-inc", "name": "Acme Inc", "yes": 4, "answered": 6, "certified": 3})
    check(f"no page: its name, no link (got {emps[1:] })",
          emps[1:] == [{"slug": None, "name": "Small Shop", "yes": 1, "answered": 1, "certified": 1}])
    check("an employer that only answered no isn't listed", all(e["name"] != "Quiet LLC" for e in emps))
    check(f"answering employers, each once across its spellings (got {answering})", answering == 3)
    jobs = b.read_jobs(db, 2026)
    check(f"jobs by the seven-character code, each with its busiest page (got {jobs})",
          [(j["code"], j["title"], j["yes"], j["answered"], j["slug"]) for j in jobs]
          == [("15-1252", "Software Developers", 4, 6, "software-developers"), ("13-2011", "Accountants and Auditors", 1, 6, "accountants-and-auditors")])

    import builtins
    old_print = builtins.print
    b.Database = lambda: db
    old_argv = sys.argv
    sys.argv = ["build_layoff_disclosures.py"]
    try:
        rc = b.main()
    finally:
        sys.argv = old_argv
        builtins.print = old_print
    doc = read_doc(db, b.DOC_KEY)
    check(f"the doc is written (rc {rc})", rc == 0 and doc and doc["newestFy"] == 2026
          and [y["fy"] for y in doc["years"]] == [2019, 2025, 2026] and doc["employersYes"] == 2
          and doc["topByYear"]["2019"][0]["name"] == "Acme Inc")

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
