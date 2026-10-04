#!/usr/bin/env python3
"""The shared fetcher refuses what a host's robots.txt forbids, offline.

`lib_gov_data.fetch` serves every loader that reads a government file. Until
Oct 4 2026 nothing in it looked at robots.txt, and the H-1B Employer Data Hub
loader read a page www.uscis.gov asks automated clients not to, every month,
with nothing to say so. The rules below are the lines USCIS's robots.txt
carried on Oct 4 2026.

Run: python3 scripts/test_robots_guard.py
"""
from __future__ import annotations

import pathlib
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import lib_gov_data as gov  # noqa: E402

FAILS: list[str] = []
N = 0

USCIS_ROBOTS = """User-agent: *
Crawl-delay: 10
# Custom
Disallow: /sites/default/files/archive/
Disallow: /tools/reports-and-studies/h-1b-employer-data-hub
Disallow: /tools/civil-surgeons-by-region
Disallow: /tools/find-a-doctor/list/export
Allow: /core/*.css$
"""


def check(label: str, got, want) -> None:
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


def main() -> int:
    asked: list[str] = []

    def fake_text(origin: str) -> str | None:
        asked.append(origin)
        return USCIS_ROBOTS if origin == "https://www.uscis.gov" else None

    def no_network(*a, **k):
        raise AssertionError("fetch went to the network for a forbidden path")

    saved = (gov._robots_text, urllib.request.urlopen)
    gov._robots_text = fake_text
    gov._ROBOTS.clear()
    try:
        u = "https://www.uscis.gov"
        check("the Data Hub page is forbidden",
              gov.robots_allowed(f"{u}/tools/reports-and-studies/h-1b-employer-data-hub"), False)
        check("and so is every path under it (robots rules are prefixes)",
              gov.robots_allowed(f"{u}/tools/reports-and-studies/h-1b-employer-data-hub-understanding-our-data"),
              False)
        check("the civil-surgeon export is forbidden",
              gov.robots_allowed(f"{u}/tools/find-a-doctor/list/export"), False)
        check("the archive folder is forbidden",
              gov.robots_allowed(f"{u}/sites/default/files/archive/old.xlsx"), False)
        check("USCIS's data page is allowed",
              gov.robots_allowed(f"{u}/tools/reports-and-studies/immigration-and-citizenship-data?items_per_page=100"),
              True)
        check("a quarterly workbook is allowed",
              gov.robots_allowed(f"{u}/sites/default/files/document/data/quarterly_all_forms_fy2026_q3_v1.xlsx"),
              True)
        check("a host whose robots.txt can't be read has no rules",
              gov.robots_allowed("https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/PERM_FY2008.xlsx"), True)
        check("each host's file is read once per run", asked, ["https://www.uscis.gov", "https://www.dol.gov"])

        urllib.request.urlopen = no_network
        try:
            gov.fetch(f"{u}/tools/reports-and-studies/h-1b-employer-data-hub")
            refused = False
        except gov.RobotsDisallowed:
            refused = True
        except AssertionError:
            refused = False
        check("fetch refuses a forbidden path before any request", refused, True)
    finally:
        gov._robots_text, urllib.request.urlopen = saved
        gov._ROBOTS.clear()

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
