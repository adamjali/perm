#!/usr/bin/env python3
"""The LCA filings' own database file: routing, and the main file's number list.

    python3 scripts/test_lca_numbers.py

The H-1B LCA table moved to a database file of its own on Oct 19 2026. These
run the real client's routing rule, the real list repair and the real loader
against two in-memory SQLite databases (lib_sqlite_shim.SplitSqlite), so a
statement sent to the wrong file fails here the way it would in production:
with "no such table".
"""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_flag_disclosure as fd  # noqa: E402
import lca_numbers  # noqa: E402
from lib_db import Database, lca_joins, pipeline_home, statement_home, stmt  # noqa: E402
from lib_sqlite_shim import SplitSqlite  # noqa: E402

FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def raises(name: str, fn, needle: str) -> None:
    try:
        fn()
    except (RuntimeError, SystemExit) as e:
        check(name, needle in str(e), True)
        return
    check(name, "no error", "an error naming " + needle)


def routing() -> None:
    check("a read of the LCA table goes to the LCA file",
          statement_home("SELECT COUNT(*) FROM lca_cases INDEXED BY lca_cases_emp"), "lca")
    check("its column check goes there too", statement_home("PRAGMA table_info(lca_cases)"), "lca")
    for other in ("lca_case_status", "lca_case_events", "lca_case_numbers", "lca_cities", "perm_cases"):
        check(f"{other} stays in the main file", statement_home(f"SELECT 1 FROM {other}"), "main")
    check("transaction control goes with its request", statement_home("BEGIN"), None)
    check("an LCA request with transaction control is the LCA file's",
          pipeline_home([stmt("BEGIN"), stmt("INSERT INTO lca_cases VALUES (1)"), stmt("COMMIT"),
                         {"type": "close"}]), "lca")
    check("an empty request is the main file's", pipeline_home([{"type": "close"}]), "main")
    raises("a request naming both files is refused",
           lambda: pipeline_home([stmt("SELECT 1 FROM lca_cases"), stmt("SELECT 1 FROM perm_docs")]),
           "send them separately")
    db = Database("https://main.example", "t", lca_url="libsql://lca.example")
    check("the client sends LCA reads to the LCA server",
          db.url_for([stmt("SELECT 1 FROM lca_cases")]), "https://lca.example")
    check("and everything else to the main one", db.url_for([stmt("SELECT 1 FROM perm_docs")]),
          "https://main.example")
    solo = Database("https://main.example", "t")
    check("with no LCA server set, LCA reads stay in the main file",
          solo.url_for([stmt("SELECT 1 FROM lca_cases")]), "https://main.example")


def fixture() -> None:
    cases = json.loads((pathlib.Path(__file__).resolve().parent / "fixtures" / "lca_routing.json")
                       .read_text())["cases"]
    check("the routing fixture holds its cases", len(cases) >= 15, True)
    for c in cases:
        short = " ".join(c["sql"].split())[:60]
        check(f"fixture home: {short}", statement_home(c["sql"]), c["home"])
        check(f"fixture joins: {short}", sorted(lca_joins(c["sql"])), c["joins"])


def joins() -> None:
    # The shapes the LCA readers really run: a CTE over the table, a function
    # in FROM, an index hint. None of them reaches the main file.
    facets = ("WITH f AS (SELECT wage FROM lca_cases WHERE x = 1),\n c AS (SELECT COUNT(*) AS n FROM f),\n"
              " o AS (SELECT wage, ROW_NUMBER() OVER (ORDER BY wage) AS rn FROM f)\n"
              "SELECT (SELECT n FROM c), (SELECT AVG(wage) FROM f) FROM o LIMIT 1")
    for name, sql in (("a CTE over the table", facets),
                      ("an index hint", "SELECT COUNT(*) FROM lca_cases INDEXED BY lca_cases_emp WHERE a = ?"),
                      ("a table-valued function", "SELECT value FROM lca_cases, json_each(lca_cases.tags)"),
                      ("a write", "INSERT INTO lca_cases (case_number) VALUES (?)"),
                      ("an update", "UPDATE lca_cases SET naics = ? WHERE case_number = ?"),
                      ("an upsert", "INSERT INTO lca_cases (case_number) VALUES (?) "
                                    "ON CONFLICT(case_number) DO UPDATE SET naics = excluded.naics"),
                      ("a statement on another table", "SELECT 1 FROM perm_docs JOIN perm_cases USING (x)")):
        check(f"{name} names nothing in the main file", lca_joins(sql), set())
    check("a join to a main-file table is found",
          lca_joins("SELECT 1 FROM lca_case_status s WHERE NOT EXISTS "
                    "(SELECT 1 FROM lca_cases c WHERE c.case_number = s.case_number)"), {"lca_case_status"})
    check("so is a join written out", lca_joins("SELECT * FROM lca_cases l JOIN employer_page_map m ON 1"),
          {"employer_page_map"})
    mixed = [stmt("SELECT * FROM lca_cases l JOIN employer_page_map m ON 1")]
    raises("with the LCA database its own server, a join is refused",
           lambda: Database("https://m.example", "t", lca_url="https://l.example").url_for(mixed), "read them separately")
    check("before that it still runs on the one file",
          Database("https://m.example", "t").url_for(mixed), "https://m.example")
    raises("and the two-database test shim refuses it", lambda: SplitSqlite().execute(mixed[0]["stmt"]["sql"]),
           "read them separately")


def split_with(published: list[tuple[str, str | None]], listed: list[tuple[str, str | None]]) -> SplitSqlite:
    db = SplitSqlite()
    db.script(fd.table_ddl("lca_cases"))
    for c, d in published:
        db.execute("INSERT INTO lca_cases (case_number, received_date) VALUES (?, ?)", [c, d])
    lca_numbers.ensure_table(db)
    for c, d in listed:
        db.execute("INSERT INTO lca_case_numbers VALUES (?, ?)", [c, d])
    return db


def listed(db: SplitSqlite) -> list[tuple]:
    rows = db.main.conn.execute("SELECT case_number, received_date FROM lca_case_numbers ORDER BY 1").fetchall()
    return [tuple(r) for r in rows]


def repair() -> None:
    pub = [(f"I-200-25{d:03d}-{n:06d}", f"2025-0{1 + d % 9}-1{d % 10}") for d in range(10, 13) for n in range(5)]
    db = split_with(pub, [])
    out = lca_numbers.sync(db, page=4, pause=0, log=lambda *_: None)
    check("an empty list is filled from the LCA table", listed(db), sorted(pub))
    check("in pages", out["pages"], 4)
    check("the counts agree after", lca_numbers.counts(db), (15, 15))

    gone = "I-200-25012-999999"
    db = split_with(pub, [*pub[:3], (pub[3][0], "1999-01-01"), (gone, None)])
    out = lca_numbers.sync(db, page=4, pause=0, log=lambda *_: None)
    check("a changed date is rewritten, a missing number added, an extra one removed",
          (listed(db), out["deleted"]), (sorted(pub), 1))
    tail = "I-203-26001-000001"
    db = split_with(pub, [*pub, (tail, None)])
    lca_numbers.sync(db, page=100, pause=0, log=lambda *_: None)
    check("a listed number past the last published one is removed", tail in [c for c, _ in listed(db)], False)

    db = split_with([], pub)
    raises("an empty LCA table never empties the list",
           lambda: lca_numbers.sync(db, pause=0, log=lambda *_: None), "check DATABASE_LCA_URL")
    check("and nothing was removed", len(listed(db)), 15)

    db = split_with(pub, pub)
    out = lca_numbers.sync(db, page=4, pause=0, dry=False, log=lambda *_: None)
    check("a whole list writes nothing", (out["upserted"], out["deleted"]), (0, 0))


def loader() -> None:
    db = SplitSqlite()
    db.script(fd.table_ddl("lca_cases"))

    def row(case: str, received: str) -> dict:
        r = {c: None for c in fd.COLUMNS}
        r.update(case_number=case, received_date=received, decision_date="2026-01-05",
                 case_status="CERTIFIED", source_file="LCA_Disclosure_Data_FY2026_Q1.xlsx")
        return r

    rows = [row(f"I-200-25300-{n:06d}", "2025-10-27") for n in range(7)]
    sent, written = fd.write_cases(db, "lca_cases", rows, pause=0)
    check("the loader writes LCA rows to the LCA file", (sent, written,
          db.lca.conn.execute("SELECT COUNT(*) FROM lca_cases").fetchone()[0]), (7, 7, 7))
    check("and lists their numbers in the main file", len(listed(db)), 7)
    check("the main file holds no LCA table",
          db.main.conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE name = 'lca_cases'").fetchone()[0], 0)
    db.script(fd.table_ddl("pwd_cases"))
    fd.write_cases(db, "pwd_cases", [row("P-100-25300-000001", "2025-10-27")], pause=0)
    check("another program lists nothing", len(listed(db)), 7)


def main() -> int:
    routing()
    fixture()
    joins()
    repair()
    loader()
    print(f"\n{len(FAILED)} failure(s)" if FAILED else "\nall passed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
