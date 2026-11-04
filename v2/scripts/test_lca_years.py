"""The yearly LCA counts (build_lca_years.py), run for real on two in-memory databases routed as production's are.

    python3 scripts/test_lca_years.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_lca_years as ly  # noqa: E402
import ingest_flag_disclosure as fd  # noqa: E402
from lib_sqlite_shim import SplitSqlite  # noqa: E402

CHECKS = 0
FAILURES: list[str] = []


def check(name: str, got, want) -> None:
    global CHECKS
    CHECKS += 1
    ok = got == want
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + ("" if ok else f": got {got!r}, want {want!r}"))
    if not ok:
        FAILURES.append(name)


def seed(db: SplitSqlite) -> None:
    for table in ("lca_cases", "lca_cases_history"):
        db.script(fd.table_ddl(table))
    rows = [
        # table, case, status, decided, fiscal year, slug, visa
        ("lca_cases", "I-200-21001-1", "CERTIFIED", "2021-01-05", 2021, "acme", "H-1B"),
        ("lca_cases", "I-200-21001-2", "DENIED", "2021-02-05", 2021, "acme", "H-1B"),
        ("lca_cases", "I-200-21001-3", "CERTIFIED - WITHDRAWN", "2021-03-05", 2021, "acme", "H-1B"),
        ("lca_cases", "I-203-21001-4", "CERTIFIED", "2021-03-05", 2021, "acme", "E-3 Australian"),
        ("lca_cases_history", "I-200-17001-1", "CERTIFIED", "2017-01-05", 2017, "acme", "H-1B"),
        ("lca_cases_history", "I-200-17001-2", "WITHDRAWN", "2017-01-06", 2017, "acme-inc", "H-1B"),
        ("lca_cases_history", "I-200-17001-3", "CERTIFIED", "2017-01-06", 2017, "", "H-1B"),
        # A FY2021 row that somehow sits in the history table is never counted from there.
        ("lca_cases_history", "I-200-21009-9", "CERTIFIED", "2021-01-06", 2021, "acme", "H-1B"),
    ]
    for table, case, status, decided, fy, slug, visa in rows:
        db.execute(f"INSERT INTO {table} (case_number, case_status, decision_date, fiscal_year, employer_slug, "
                   "visa_class, source_file) VALUES (?,?,?,?,?,?,?)",
                   [case, status, decided, fy, slug, visa, "x.xlsx"])


def table(db: SplitSqlite) -> list[tuple]:
    res = db.execute("SELECT employer_slug, fy, certified, denied, withdrawn FROM lca_cases_years ORDER BY 1, 2")
    return [tuple(int(c["value"]) if c.get("type") == "integer" else c.get("value") for c in r)
            for r in res["response"]["result"]["rows"]]


def main() -> int:
    print("yearly LCA counts")
    db = SplitSqlite()
    seed(db)
    written = ly.build(db)
    got = table(db)
    check("each spelling and year: certified, denied, withdrawn (certified-then-withdrawn counts as withdrawn)",
          got, [("acme", 2017, 1, 0, 0), ("acme", 2021, 1, 1, 1), ("acme-inc", 2017, 0, 0, 1)])
    check("the rows written per year", written, {2017: 2, 2021: 1})
    check("the table lives in the LCA database, beside what it's built from",
          bool(db.lca.conn.execute("SELECT name FROM sqlite_master WHERE name = 'lca_cases_years'").fetchall()), True)
    ly.build(db)
    check("a rerun writes the same rows, never doubles them", table(db), got)
    # A spelling a year no longer holds goes; the year's other rows stay. The first version deleted a
    # whole year before inserting it, so an insert that failed emptied it (Nov 4 2026).
    db.execute("UPDATE lca_cases_history SET employer_slug = 'acme' WHERE case_number = 'I-200-17001-2'")
    ly.build(db, 2017)
    check("a spelling the year no longer holds is removed, and its LCAs counted where they went",
          [r for r in table(db) if r[1] == 2017], [("acme", 2017, 1, 0, 1)])
    db.execute("UPDATE lca_cases_history SET employer_slug = 'acme-inc' WHERE case_number = 'I-200-17001-2'")
    ly.build(db, 2017)
    check("and put back when the spelling returns", table(db), got)
    check("the years are read from the ends of an index, not every row",
          all("DISTINCT" not in q for q in ly.SPANS.values()), True)
    check("a fiscal year starts on October 1", (ly.fiscal_year_of("2020-09-30"), ly.fiscal_year_of("2020-10-01")),
          (2020, 2021))
    db.execute("UPDATE lca_cases SET case_status = 'CERTIFIED' WHERE case_number = 'I-200-21001-2'")
    ly.build(db, 2021)
    check("one year rebuilt alone replaces only that year", table(db),
          [("acme", 2017, 1, 0, 0), ("acme", 2021, 2, 0, 1), ("acme-inc", 2017, 0, 0, 1)])
    empty = SplitSqlite()
    empty.script(fd.table_ddl("lca_cases"))
    check("a history table not loaded yet adds no year and no error", ly.years_held(empty), [])
    check("a year before FY2020 reads the history table, FY2020 on the current one",
          [ly.source(y) for y in (2008, 2019, 2020, 2026)],
          ["lca_cases_history", "lca_cases_history", "lca_cases", "lca_cases"])
    print()
    print(f"{CHECKS} checks")
    if FAILURES:
        print(f"{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
