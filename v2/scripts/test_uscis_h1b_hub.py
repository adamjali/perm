#!/usr/bin/env python3
"""Contract tests for ingest_uscis_h1b_hub.py, offline.

The export's shape (header, the twelve measures, one row per petitioner
address and measure, the Fiscal Year field with three trailing spaces) is
copied from the live hub's FY2026 export, read 2026-10-01. Each refusal the
loader makes gets a case, because each stands between a changed export and a
wrong number on an employer page.

Run: python3 scripts/test_uscis_h1b_hub.py
"""
from __future__ import annotations

import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_uscis_h1b_hub as hub  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILS: list[str] = []
N = 0


def check(label: str, got, want) -> None:
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


def refuses(label: str, fn) -> None:
    global N
    N += 1
    try:
        fn()
    except hub.Refusal:
        return
    FAILS.append(f"{label}: did not refuse")


HEADER = ('Employer (Petitioner) Name,Fiscal Year   ,Industry (NAICS) Code,Measure Names,Petitioner City,'
          'Petitioner State,Petitioner Zip Code,Tax ID,Line by line,Measure Values')


def rows_for(name: str, naics: str, city: str, values: dict[str, str], fy: str = "2026", line: str = "1") -> list[str]:
    out = []
    for m in hub.MEASURES:
        out.append(f'"{name}",{fy},"{naics}",{m},"{city}",TX,75082,0235,"{line}","{values.get(m, "0")}"')
    return out


def export(*blocks: list[str]) -> str:
    return "\n".join([HEADER, *[r for b in blocks for r in b]]) + "\n"


ACME = rows_for("ACME CORP", "54 - Professional, Scientific, and Technical Services", "RICHARDSON",
                {"New Employment Approval": "1,234", "Change of Employer Approval": "7", "New Employment Denial": "3"})
STEEL = rows_for("STEEL WORKS INC", "31-33 - Manufacturing", "AUSTIN", {"Continuation Approval": "2"}, line="2")


def test_discovery() -> None:
    page = ('<p>The H-1B Employer Data Hub includes data from fiscal year 2009 through fiscal year 2026 '
            '(quarter 3) on employers</p><script src="https://bigdataanalyticspub-sb.uscis.dhs.gov/javascripts/'
            'api/tableau.embedding.3.latest.min.js"></script><tableau-viz src="https://bigdataanalyticspub-sb.'
            'uscis.dhs.gov/views/H1BEmployerDataHub-Final/H1B-EmployerDataHub"></tableau-viz>')
    check("the view the page embeds", hub.view_url(page),
          "https://bigdataanalyticspub-sb.uscis.dhs.gov/views/H1BEmployerDataHub-Final/H1B-EmployerDataHub")
    check("coverage from the page's sentence", hub.coverage(page), (2009, 2026, 3))
    check("Q3 ends June 30", hub.quarter_end(2026, 3), "2026-06-30")
    check("Q1 ends the December before", hub.quarter_end(2026, 1), "2025-12-31")
    refuses("a page without the sentence", lambda: hub.coverage("<p>H-1B data</p>"))
    refuses("a page without a view", lambda: hub.view_url("<p>no viz here</p>"))


def test_parse() -> None:
    fy, rows = hub.parse(export(ACME, STEEL), 2026)
    check("year", fy, 2026)
    check("one row per petitioner address", len(rows), 2)
    acme = next(r for r in rows if r["employer"] == "ACME CORP")
    check("a count printed with a thousands comma", acme["new_appr"], 1234)
    check("change of employer", acme["chg_appr"], 7)
    check("a denial", acme["new_den"], 3)
    check("the slug the LCA table uses", acme["employer_slug"], "acme-corp")
    steel = next(r for r in rows if r["employer"] == "STEEL WORKS INC")
    check("a NAICS sector that spans codes", steel["naics_sector"], "31-33")
    check("the Fiscal Year field, trailing spaces kept for the URL filter",
          hub.fy_field(HEADER.split(",")), "Fiscal Year   ")


def test_merge() -> None:
    spaced = rows_for("ACME CORP", "54 - Professional, Scientific, and Technical Services", "RICHARDSON ",
                      {"New Employment Approval": "1"}, line="3")
    _, rows = hub.parse(export(ACME, spaced), 2026)
    check("spacing variants of one address are one row", len(rows), 1)
    check("and their counts are summed", rows[0]["new_appr"], 1235)


def test_refusals() -> None:
    refuses("a row of another year: the filter didn't apply", lambda: hub.parse(export(ACME), 2025))
    refuses("two years in one export", lambda: hub.parse(export(ACME, rows_for("B", "", "X", {}, fy="2025")), None))
    bad = [r.replace("Amended Denial", "Amended Withdrawal") for r in ACME]
    refuses("an unknown measure", lambda: hub.parse(export(bad), 2026))
    refuses("a key missing a measure", lambda: hub.parse(export(ACME[:-1]), 2026))
    refuses("a measure seen twice on one published key", lambda: hub.parse(export(ACME, ACME[:1]), 2026))
    frac = [ACME[0].replace('"1,234"', '"1.5"'), *ACME[1:]]
    refuses("a count that isn't whole", lambda: hub.parse(export(frac), 2026))
    refuses("a renamed column", lambda: hub.parse(export(ACME).replace("Measure Values", "Values"), 2026))
    refuses("an empty export", lambda: hub.parse(HEADER + "\n", 2026))


def test_drift() -> None:
    _, rows = hub.parse(export(ACME, STEEL), 2026)
    check("no previous load, nothing to compare", hub.drift(None, rows), [])
    check("about the same, fine", hub.drift({"rows": 2, "approvals": 1243}, rows), [])
    check("half the rows is refused", len(hub.drift({"rows": 10, "approvals": 1243}, rows)), 1)
    check("a third of the approvals is refused", len(hub.drift({"rows": 2, "approvals": 5000}, rows)), 1)


def test_years() -> None:
    check("routine: this year and last until last is held through Q4",
          hub.years_to_load(2009, 2026, 3, {}), [2026, 2025])
    check("routine: last year already held through Q4",
          hub.years_to_load(2009, 2026, 3, {"2025": {"quarter": 4}}), [2026])
    held = {str(y): {"quarter": 4} for y in range(2009, 2026)} | {"2026": {"quarter": 3}}
    check("--all with everything held fetches nothing", hub.years_to_load(2009, 2026, 3, held, every=True), [])
    held["2026"] = {"quarter": 2}
    held.pop("2012")
    check("--all picks up the current year's new quarter and a missing year, newest first",
          hub.years_to_load(2009, 2026, 3, held, every=True), [2026, 2012])
    check("--fy", hub.years_to_load(2009, 2026, 3, {}, fy=2015), [2015])
    refuses("--fy outside the hub's years", lambda: hub.years_to_load(2009, 2026, 3, {}, fy=2008))


def test_store() -> None:
    db = SqliteTurso()
    _, rows26 = hub.parse(export(ACME, STEEL), 2026)
    _, rows25 = hub.parse(export(rows_for("OLD CO", "", "DALLAS", {"New Employment Approval": "4"}, fy="2025")), 2025)
    hub.store(db, 2025, rows25)
    check("one year stored", hub.store(db, 2026, rows26), 2)
    _, again = hub.parse(export(ACME), 2026)
    hub.store(db, 2026, again)
    check("a reload replaces the year, it doesn't add to it",
          int(db.scalar(f"SELECT count(*) FROM {hub.TABLE} WHERE fy = 2026")), 1)
    check("and leaves other years alone", int(db.scalar(f"SELECT count(*) FROM {hub.TABLE} WHERE fy = 2025")), 1)
    check("the staging table is gone",
          db.scalar("SELECT count(*) FROM sqlite_master WHERE name = ?", [hub.STAGE]), "0")
    check("approvals land in their columns",
          int(db.scalar(f"SELECT new_appr FROM {hub.TABLE} WHERE employer = 'ACME CORP'")), 1234)


def main() -> int:
    for t in (test_discovery, test_parse, test_merge, test_refusals, test_drift, test_years, test_store):
        t()
    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
