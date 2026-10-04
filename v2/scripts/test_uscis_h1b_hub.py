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


# USCIS's data page as it read on Oct 4 2026: quarterly headings, newest first.
REPORTS = ('<h3>Fiscal Year 2026: Quarter 3 Data Reports, April\u2013June</h3><p>...</p>'
           '<h3>Fiscal Year 2026: Quarter 2 Data Reports, January\u2013March</h3>'
           '<h3>Fiscal Year 2025: Quarter 4 Data Reports, July\u2013September</h3>')
# The rules USCIS's robots.txt carried on Oct 4 2026, cut to the lines that matter here.
USCIS_ROBOTS = """User-agent: *
Crawl-delay: 10
Disallow: /sites/default/files/archive/
Disallow: /tools/reports-and-studies/h-1b-employer-data-hub
Disallow: /tools/reports-and-studies/h-1b-employer-data-hub/export
Disallow: /tools/civil-surgeons-by-region
Disallow: /tools/find-a-doctor/list/export
"""


def test_discovery() -> None:
    check("the newest quarter on USCIS's data page", hub.reports_quarter(REPORTS), (2026, 3))
    refuses("a data page with no quarterly release", lambda: hub.reports_quarter("<p>H-1B data</p>"))
    check("hub and page on one year: the page's quarter", hub.hub_quarter(2026, 2026, 3), 3)
    check("page moved on, hub hasn't: the hub's year is complete", hub.hub_quarter(2026, 2027, 1), 4)
    check("hub opened a year the page doesn't list yet: Q1", hub.hub_quarter(2027, 2026, 4), 1)
    refuses("two years apart is a refusal", lambda: hub.hub_quarter(2024, 2026, 3))
    check("Q3 ends June 30", hub.quarter_end(2026, 3), "2026-06-30")
    check("Q1 ends the December before", hub.quarter_end(2026, 1), "2025-12-31")


def test_reads_only_allowed_pages() -> None:
    """A dry run reads USCIS's data page and the Tableau host, nothing robots.txt forbids."""
    import urllib.robotparser
    rules = urllib.robotparser.RobotFileParser()
    rules.parse(USCIS_ROBOTS.splitlines())
    check("the hub page itself is forbidden (the fixture is live)", rules.can_fetch("*", hub.HUB_PAGE), False)
    fetched: list[str] = []
    saved = (hub.fetch, hub.session_sheets, hub.export)

    def fake_fetch(url: str, *a, **k) -> bytes:
        fetched.append(url)
        if url != hub.REPORTS_PAGE:
            raise AssertionError(f"unexpected fetch {url}")
        return REPORTS.encode()

    hub.fetch = fake_fetch
    hub.session_sheets = lambda view: [view.rsplit("/", 1)[0] + "/H1BPublic"]
    hub.export = lambda sheet, field=None, fy=None: export(
        rows_for("ACME CORP", "54 - Professional, Scientific, and Technical Services", "RICHARDSON",
                 {"New Employment Approval": "1,234"}, fy=str(fy or 2026)))
    try:
        rc = hub.main(["--dry-run"])
    finally:
        hub.fetch, hub.session_sheets, hub.export = saved
    check("the dry run completes", rc, 0)
    check("it reads only USCIS's data page on www.uscis.gov", fetched, [hub.REPORTS_PAGE])
    check("which robots.txt allows", all(rules.can_fetch("*", u) for u in fetched), True)
    check("the Tableau view sits on another host", hub.VIEW.startswith("https://www.uscis.gov"), False)


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
    for t in (test_discovery, test_reads_only_allowed_pages, test_parse, test_merge, test_refusals, test_drift, test_years, test_store):
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
