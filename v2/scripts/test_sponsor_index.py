#!/usr/bin/env python3
"""sponsor_index on real SQLite (lib_sqlite_shim).

Each part is ranked only among sponsors with enough cases; H-1B and USCIS
rows reach a sponsor through employer_page_map; warnings are dated facts;
and an unchanged rebuild writes nothing.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_sponsor_index as bsi  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILED: list[str] = []
TODAY = dt.date(2026, 10, 4)


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def seed() -> SqliteTurso:
    db = SqliteTurso()
    db.script([
        "CREATE TABLE perm_entities (kind TEXT, slug TEXT, name TEXT, total INTEGER, certified INTEGER, denied INTEGER, "
        "recent_12m INTEGER)",
        "CREATE TABLE perm_entity_facets (kind TEXT, slug TEXT, facet TEXT, key TEXT, n INTEGER)",
        "CREATE TABLE employer_page_map (source_slug TEXT PRIMARY KEY, page_slug TEXT, page_kind TEXT, key TEXT)",
        "CREATE TABLE lca_cases (case_number TEXT PRIMARY KEY, case_status TEXT, decision_date TEXT, employer_slug TEXT, "
        "workers INTEGER, change_employer INTEGER, wage_level TEXT, h1b_dependent INTEGER, willful_violator INTEGER)",
        "CREATE TABLE uscis_h1b_employers (fy INTEGER, employer_slug TEXT, new_appr INTEGER, new_den INTEGER, "
        "cont_appr INTEGER, cont_den INTEGER, same_appr INTEGER, same_den INTEGER, conc_appr INTEGER, conc_den INTEGER, "
        "chg_appr INTEGER, chg_den INTEGER, amend_appr INTEGER, amend_den INTEGER)",
        "CREATE TABLE debarments (entity_slug TEXT, program TEXT, start_date TEXT, end_date TEXT)",
        "CREATE TABLE perm_cases (case_number TEXT PRIMARY KEY, employer_slug TEXT, state TEXT)",
        "CREATE TABLE warn_notices (employer_slug TEXT, notice_date TEXT, employees INTEGER)",
    ])
    # Three sponsors with 20+ decided cases (ranked), one with 5 (not ranked on the rate).
    for slug, total, cert, den, recent, state in [
        ("alpha", 100, 90, 10, 40, "CA"),
        ("beta", 50, 49, 1, 10, "TX"),
        ("gamma", 30, 15, 15, 0, "NY"),
        ("tiny", 5, 5, 0, 2, "WA"),
    ]:
        db.execute("INSERT INTO perm_entities VALUES ('employer',?,?,?,?,?,?)", [slug, slug.title(), total, cert, den, recent])
        db.execute("INSERT INTO perm_entity_facets VALUES ('employer',?,'state',?,?)", [slug, state, total])
    db.execute("INSERT INTO perm_entity_facets VALUES ('employer','alpha','state','NJ',3)")
    # A sponsor under the facet floor has no state facet; its cases name one.
    db.execute("DELETE FROM perm_entity_facets WHERE slug = 'tiny' AND facet = 'state'")
    for i, st in enumerate(["OR", "OR", "WA"]):
        db.execute("INSERT INTO perm_cases VALUES (?,?,?)", [f"G-{i}", "tiny", st])
    db.execute("INSERT INTO perm_entity_facets VALUES ('employer','gamma','industry','611310',20)")
    db.execute("INSERT INTO perm_entity_facets VALUES ('employer','gamma','industry','541511',5)")
    db.execute("INSERT INTO perm_entity_facets VALUES ('employer','alpha','industry','334413',50)")
    db.execute("INSERT INTO employer_page_map VALUES ('alpha-com-inc','alpha','perm','alpha')")
    db.execute("INSERT INTO employer_page_map VALUES ('alpha','alpha','perm','alpha')")
    n = 0
    # alpha: 25 certified LCAs under a second spelling, 10 transfers of 25 positions, 15 at level III/IV.
    for i in range(25):
        n += 1
        db.execute("INSERT INTO lca_cases VALUES (?,?,?,?,?,?,?,?,?)",
                   [f"I-{n}", "CERTIFIED", "2026-03-01", "alpha-com-inc", 1, 1 if i < 10 else 0,
                    "III" if i < 15 else "I", 1 if i == 0 else None, 0])
    # alpha's newest LCA says it is no longer dependent.
    n += 1
    db.execute("INSERT INTO lca_cases VALUES (?,?,?,?,?,?,?,?,?)",
               [f"I-{n}", "CERTIFIED", "2026-06-01", "alpha", 1, 0, "II", 0, 0])
    # An LCA older than 24 months doesn't count.
    n += 1
    db.execute("INSERT INTO lca_cases VALUES (?,?,?,?,?,?,?,?,?)",
               [f"I-{n}", "CERTIFIED", "2023-01-01", "alpha", 50, 50, "IV", 1, 1])
    # beta: 20 certified, all transfers, one willful-violator declaration.
    for i in range(20):
        n += 1
        db.execute("INSERT INTO lca_cases VALUES (?,?,?,?,?,?,?,?,?)",
                   [f"I-{n}", "CERTIFIED", "2026-02-01", "beta", 1, 1, "II", None, 1 if i == 0 else 0])
    db.execute("INSERT INTO uscis_h1b_employers VALUES (2026,'alpha-com-inc',30,0,0,0,0,0,0,0,0,0,0,0)")
    db.execute("INSERT INTO uscis_h1b_employers VALUES (2023,'alpha',0,99,0,0,0,0,0,0,0,0,0,0)")
    db.execute("INSERT INTO debarments VALUES ('gamma','H-2A','2026-01-01','2027-01-01')")
    db.execute("INSERT INTO debarments VALUES ('beta','PERM','2020-01-01','2021-01-01')")
    db.execute("INSERT INTO warn_notices VALUES ('beta','2026-05-01',120)")
    db.execute("INSERT INTO warn_notices VALUES ('beta','2020-05-01',999)")
    return db


def main() -> int:
    db = seed()
    rows = bsi.plan(bsi.read(db, TODAY), TODAY)
    by = {r[0]: dict(zip(bsi.COLS, r)) for r in rows}
    parts = {s: {p["id"]: p for p in json.loads(by[s]["parts"])} for s in by}
    facts = {s: [f["id"] for f in json.loads(by[s]["facts"])] for s in by}

    check("approval rates", [by[s]["perm_rate"] for s in ("alpha", "beta", "gamma")], [0.9, 0.98, 0.5])
    check("a sponsor under 20 decided cases isn't ranked on the rate", "perm_rate" in parts["tiny"], False)
    check("rate ranks among the three that qualify", [parts[s]["perm_rate"]["pct"] for s in ("gamma", "alpha", "beta")],
          [0.0, 0.5, 1.0])
    check("the rank says how many it was ranked among", parts["alpha"]["perm_rate"]["of"], 3)
    check("H-1B rows reach the sponsor through the map, 24 months only", by["alpha"]["lca_24m"], 26)
    check("transfer share over certified positions", by["alpha"]["transfer_share"], round(10 / 26, 4))
    check("senior share over LCAs with a level", by["alpha"]["senior_share"], round(15 / 26, 4))
    check("a sponsor with no PERM filings this year isn't ranked on them", "perm_recent" in parts["gamma"], False)
    check("USCIS's last three fiscal years only", by["alpha"]["uscis_rate"], 1.0)
    check("dependent is the newest declaration, not any", by["alpha"]["dependent"], 0)
    check("willful violator is a fact, with its count", "willful" in facts["beta"], True)
    check("WARN in the last two years only", by["beta"]["warn_2y"], 1)
    check("an expired debarment isn't a fact", "debarred" in facts["beta"], False)
    check("an active debarment is", ("debarred" in facts["gamma"], by["gamma"]["debarred"]), (True, 1))
    check("mostly a college's industry code: likely cap-exempt", (by["gamma"]["cap_exempt"], "cap_exempt" in facts["gamma"]), (1, True))
    check("state is the one most of its PERM filings name", by["alpha"]["state"], "CA")
    check("with no state facet, the state its cases name most", by["tiny"]["state"], "OR")
    check("the shares say which window they cover", (parts["alpha"]["transfer_share"]["from"], parts["alpha"]["transfer_share"]["to"]),
          ("2024-06-01", "2026-06-01"))
    check("sector named from the top industry code", (by["alpha"]["sector"], by["alpha"]["sector_label"]), ("31", "Manufacturing"))

    for ddl in bsi.DDL:
        db.execute(ddl)
    first = bsi.write_diff(db, rows)
    check("first write stores every sponsor", first, (4, 0))
    again = bsi.write_diff(db, bsi.plan(bsi.read(db, TODAY), TODAY))
    check("an unchanged rebuild writes nothing", again, (0, 0))
    print(f"{len(FAILED)} failure(s)")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
