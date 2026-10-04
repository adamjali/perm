#!/usr/bin/env python3
"""lca_cities on real SQLite: keyed like the PERM city pages, floored, linked."""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_lca_cities as blc  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def main() -> int:
    db = SqliteTurso()
    db.script([
        "CREATE TABLE lca_cases (case_number TEXT PRIMARY KEY, case_status TEXT, fiscal_year INTEGER, worksite_city TEXT, "
        "worksite_state TEXT, employer_slug TEXT, employer_name TEXT, soc_code TEXT, soc_title TEXT)",
        "CREATE TABLE employer_page_map (source_slug TEXT PRIMARY KEY, page_slug TEXT, page_kind TEXT, key TEXT)",
        "CREATE TABLE perm_entities (kind TEXT, slug TEXT, code TEXT)",
        "CREATE TABLE perm_groups (kind TEXT, slug TEXT, key TEXT)",
        "INSERT INTO employer_page_map VALUES ('acme-corp','acme','perm','acme')",
        "INSERT INTO perm_entities VALUES ('occupation','software-developers','15-1252')",
        "INSERT INTO perm_groups VALUES ('city','st-louis-mo','ST LOUIS|MO')",
    ])
    n = 0
    def add(city, state, k, status="CERTIFIED", fy=2026, emp="acme-corp", soc="15-1252.00"):
        nonlocal n
        for _ in range(k):
            n += 1
            db.execute("INSERT INTO lca_cases VALUES (?,?,?,?,?,?,?,?,?)",
                       [f"I-{n}", status, fy, city, state, emp, "Acme Corp", soc, "Software Developers"])
    add("St. Louis", "MO", 12)
    add("ST LOUIS", "MO", 10, emp="no-page-llc")
    add("Boise", "ID", 25)
    add("Tiny Town", "KS", 19)
    add("Boise", "ID", 5, fy=2020)
    rows = blc.plan(blc.read(db))
    by = {r[0]: dict(zip(blc.COLS, r)) for r in rows}
    check("spellings of one city fold under its key", by["ST LOUIS|MO"]["total"], 22)
    check("a city with a PERM page keeps that page's slug", by["ST LOUIS|MO"]["slug"], "st-louis-mo")
    check("an H-1B-only city gets its own slug", (by["BOISE|ID"]["slug"], json.loads(by["BOISE|ID"]["detail"])["hasPermPage"]), ("boise-id", False))
    check("under 20 LCAs, no row", "TINY TOWN|KS" in by, False)
    d = json.loads(by["ST LOUIS|MO"]["detail"])
    check("employers link to their page, or to nothing", [(e["slug"], e["n"]) for e in d["employers"]], [("acme", 12), (None, 10)])
    check("occupations by their group, linked", d["occupations"][0]["slug"], "software-developers")
    check("top lists cover the newest three fiscal years", json.loads(by["BOISE|ID"]["detail"])["employers"][0]["n"], 25)
    check("the span covers every year held", (by["BOISE|ID"]["fy_from"], by["BOISE|ID"]["fy_to"]), (2020, 2026))
    for ddl in blc.DDL:
        db.execute(ddl)
    check("first write stores every city", blc.write_diff(db, rows), (2, 0))
    check("an unchanged rebuild writes nothing", blc.write_diff(db, blc.plan(blc.read(db))), (0, 0))
    print(f"{len(FAILED)} failure(s)")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
