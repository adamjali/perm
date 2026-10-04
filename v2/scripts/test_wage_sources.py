#!/usr/bin/env python3
"""lca_wage_sources: the split by year, publishers grouped, employers by page."""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_wage_sources as bws  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def main() -> int:
    check("Aon's spellings group", [bws.publisher_group(n) for n in ("AON", "Aon plc", "AON Hewitt")], ["Aon"] * 3)
    check("Radford is its own group, AON Radford with it",
          [bws.publisher_group(n) for n in ("Radford Global Compensation Database", "AON Radford")], ["Radford (Aon)"] * 2)
    check("Willis Towers Watson's spellings group",
          [bws.publisher_group(n) for n in ("Towers Watson", "Willis Towers Watson Data Services, Inc.")],
          ["Willis Towers Watson"] * 2)
    check("an unknown publisher stands as printed", bws.publisher_group("Acme  Comp Survey"), "Acme Comp Survey")
    check("production's own misspellings of Willis Towers Watson group",
          [bws.publisher_group(n) for n in ("Willis Tower Watson", "WILLIS TOWER WATSON", "Wills Towers Watson", "WTW")],
          ["Willis Towers Watson"] * 4)
    check("the AAMC's five spellings group",
          {bws.publisher_group(n) for n in ("AAMC", "Association of American Medical Colleges (AAMC)",
                                            "Association Of American Medical Colleges",
                                            "AAMC (Association of American Medical Colleges)",
                                            "American Association of Medical Colleges")},
          {"Association of American Medical Colleges"})
    check("but not the veterinary colleges",
          bws.publisher_group("American Association of Veterinary Medical Colleges"),
          "American Association of Veterinary Medical Colleges")
    check("CUPA-HR's spellings group",
          {bws.publisher_group(n) for n in ("CUPA-HR", "CUPA HR", "College and University Professional Association for HR",
                                            "College & University Professional Assoc. for Human Resources",
                                            "Coll. and Univ. Prof. Assoc. for Human Resources (CUPA-HR)")},
          {"CUPA-HR"})
    check("Mercer's MBD/TRS survey is Mercer's", bws.publisher_group("2024 US MBD/TRS - Finance/Accounting/Legal"), "Mercer")
    check("an unlisted firm's case variants are one key",
          bws.publisher_key("National Institute of Health") == bws.publisher_key("NATIONAL INSTITUTE OF HEALTH"), True)

    db = SqliteTurso()
    db.script([
        "CREATE TABLE lca_cases (case_number TEXT PRIMARY KEY, fiscal_year INTEGER, employer_slug TEXT, employer_name TEXT, "
        "pw_wage REAL, pw_oes_year TEXT, pw_other_source TEXT, pw_survey_publisher TEXT, pw_survey_name TEXT)",
        "CREATE TABLE employer_page_map (source_slug TEXT PRIMARY KEY, page_slug TEXT, page_kind TEXT, key TEXT)",
        "INSERT INTO employer_page_map VALUES ('acme-com-inc','acme','perm','acme')",
        "INSERT INTO employer_page_map VALUES ('acme','acme','perm','acme')",
    ])
    n = 0
    def add(k, fy, slug, oes, other=None, pub=None, name=None, wage=100000.0):
        nonlocal n
        for _ in range(k):
            n += 1
            db.execute("INSERT INTO lca_cases VALUES (?,?,?,?,?,?,?,?,?)", [f"I-{n}", fy, slug, slug, wage, oes, other, pub, name])
    add(30, 2026, "acme", "7/1/2025 - 6/30/2026")
    add(15, 2026, "acme-com-inc", None, "Survey", "AON", "Radford Global Compensation Database")
    add(5, 2026, "acme-com-inc", None, "Survey", "Aon plc", "Radford Global Compensation Database")
    add(4, 2026, "union-shop", None, "CBA")
    add(2, 2026, "lab", None, "Survey", "National Institute of Health", "Pay scale")
    add(1, 2026, "lab", None, "Survey", "NATIONAL INSTITUTE OF HEALTH", "Pay scale")
    add(9, 2025, "acme", None, None, wage=None)  # not backfilled yet: not counted
    add(1, 2024, "acme", "7/1/2023 - 6/30/2024")
    add(10, 2024, "acme", None, None, wage=None)
    doc = bws.plan(bws.read(db), "2026-06-30")
    check("only rows with a prevailing wage on file count", doc["rows"], 58)
    y = doc["years"][-1]
    check("the split for the year", (y["fy"], y["OES"], y["Survey"], y["CBA"]), (2026, 30, 23, 4))
    check("each year carries every LCA held, read or not",
          [(y["fy"], y["total"], y["all"]) for y in doc["years"]], [(2024, 1, 11), (2026, 57, 57)])
    check("publishers grouped, spellings kept", (doc["publishers"][0]["name"], doc["publishers"][0]["n"], sorted(doc["publishers"][0]["spellings"])),
          ("Aon", 20, ["AON", "Aon plc"]))
    check("an unlisted firm's spellings are one row, named by the commoner",
          [(p["name"], p["n"]) for p in doc["publishers"] if "nstitute" in p["name"].lower()],
          [("National Institute of Health", 3)])
    check("an employer's spellings count once on its page, with its share",
          [(e["slug"], e["survey"], e["lcas"]) for e in doc["employers"]], [("acme", 20, 51)])
    print(f"{len(FAILED)} failure(s)")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
