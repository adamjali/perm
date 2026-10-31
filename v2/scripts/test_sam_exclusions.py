#!/usr/bin/env python3
"""SAM.gov exclusions join a sponsor's page only on strict rules (ingest_sam_exclusions.py).

Each rule is a record in SAM's file of Oct 31 2026:

* people and vessels are never kept, whatever their name;
* a firm joins a sponsor only in a city the sponsor's own PERM filings name ("Maverick Services" in Clarksville
  against a one-case Houston sponsor stays off), unless the sponsor is national;
* "Dania" and "Dania Beach" are one place (the city's renamed);
* a layout change, a short file and a download that isn't a zip are refused.

Run: python3 scripts/test_sam_exclusions.py
"""
from __future__ import annotations

import csv
import io
import pathlib
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ingest_sam_exclusions as s  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


HEADER = ["Classification", "Name", "Prefix", "First", "Middle", "Last", "Suffix", "Address 1", "Address 2", "Address 3",
          "Address 4", "City", "State / Province", "Country", "Zip Code", "Open Data Flag", "Blank (Deprecated)",
          "Unique Entity ID", "Exclusion Program", "Excluding Agency", "CT Code", "Exclusion Type", "Additional Comments",
          "Active Date", "Termination Date", "Record Status", "Cross-Reference", "SAM Number", "CAGE", "NPI", "Creation_Date"]


def record(cls, name, city, state, agency="EPA", kind="Prohibition/Restriction", active="2003-12-08", ends="Indefinite"):
    r = dict.fromkeys(HEADER, "")
    r.update({"Classification": cls, "Name": name, "City": city, "State / Province": state, "Excluding Agency": agency,
              "Exclusion Type": kind, "Active Date": active, "Termination Date": ends})
    return [r[h] for h in HEADER]


def archive(rows, header=HEADER) -> zipfile.ZipFile:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    w.writerows(rows)
    raw = io.BytesIO()
    with zipfile.ZipFile(raw, "w") as z:
        z.writestr("SAM_Exclusions_Public_Extract_V2_26304.CSV", "﻿" + buf.getvalue())
    raw.seek(0)
    return zipfile.ZipFile(raw)


check("a city's first word is its key", s.city_key("DANIA BEACH") == "DANIA" and s.city_key("Dania") == "DANIA")
check("a city with no letters has no key", s.city_key("  ") == "" and s.city_key(None) == "")
check("SAM's dates read in both its shapes", s.day("2026-09-28") == "2026-09-28" and s.day("09/28/2026") == "2026-09-28")
check("'Indefinite' is no date", s.day("Indefinite") is None)

SPONSORS = {"ROYAL CARIBBEAN CRUISES, LTD.": "royal-caribbean", "MAVERICK SERVICES": "maverick-services-llc",
            "Q LINK WIRELESS LLC": "q-link", "BIG NATIONAL INC": "big-national", "JANE DOE": "jane-doe-llc"}


def match(name, state):
    return SPONSORS.get(name.upper())


rows = list(s.records(archive([
    record("Firm", "Royal Caribbean Cruises, Ltd.", "Miami", "FL"),
    record("Firm", "Maverick Services", "Clarksville", "TX", agency="USA"),
    record("Firm", "Q Link Wireless LLC", "Dania", "FL", agency="SBA", ends="08/16/2069"),
    record("Firm", "Big National Inc", "Nowhere", "OH"),
    record("Individual", "Jane Doe", "Miami", "FL"),
    record("Vessel", "Royal Caribbean Cruises, Ltd.", "Miami", "FL"),
]))) * 1
cities = {"royal-caribbean": {"MIAMI", "MIRAMAR"}, "maverick-services-llc": {"HOUSTON"}, "q-link": {"DANIA"},
          "big-national": {"BOSTON"}}
totals = {"big-national": 400}
keep, seen = s.select(rows, match, s.same_city(cities, totals))
by = {r[1]: r for r in keep}
check("people and vessels are never kept", "Jane Doe" not in by and sum(1 for r in keep if r[6] == "Vessel") == 0, str(list(by)))
check("a firm in a city its sponsor files in joins", "Royal Caribbean Cruises, Ltd." in by)
check("a firm in a city its sponsor never names stays off", "Maverick Services" not in by)
check("a renamed city still joins (Dania, Dania Beach)", "Q Link Wireless LLC" in by)
check("a national sponsor joins from any city", "Big National Inc" in by)
check("an indefinite exclusion says so and keeps no end date",
      by["Royal Caribbean Cruises, Ltd."][11] is None and by["Royal Caribbean Cruises, Ltd."][12] == 1)
check("a dated end is kept", by["Q Link Wireless LLC"][11] == "2069-08-16" and by["Q Link Wireless LLC"][12] == 0)
check("the counts say what was named and what was kept", seen["named"] == 4 and seen["matched"] == 3 and seen["records"] == 6, str(seen))
check("the record keys its page last", all(r[-1] for r in keep) and s.COLS[-1] == "employer_slug")

try:
    list(s.records(archive([record("Firm", "X", "Y", "Z")], header=[h for h in HEADER if h != "Excluding Agency"])))
    check("a changed layout is refused", False, "it was read")
except RuntimeError as exc:
    check("a changed layout is refused", "layout changed" in str(exc), str(exc))

print(f"\n{len(failures)} failure(s)" if failures else "\nall passed")
sys.exit(1 if failures else 0)
