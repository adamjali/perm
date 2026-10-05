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

    # BEA's apps host forbids its regional download folder and allows only /api/
    # (its robots.txt on Oct 4 2026), which is why the price parities load
    # through the API.
    bea = """User-agent: *
Disallow: /
Allow: /api/
Allow: /regional/bearfacts/
"""
    gov._robots_text = lambda origin: bea if origin == "https://apps.bea.gov" else None
    gov._ROBOTS.clear()
    try:
        check("BEA's regional zip is forbidden",
              gov.robots_allowed("https://apps.bea.gov/regional/zip/SARPP.zip"), False)
        check("BEA's API is allowed",
              gov.robots_allowed("https://apps.bea.gov/api/data?method=GetData"), True)
    finally:
        gov._robots_text = saved[0]
        gov._ROBOTS.clear()

    # The rule matcher on its own, against lines two hosts carried on Oct 4 2026.
    bls = gov.parse_robots("""User-agent: archive.org_bot
Disallow:/include
User-agent:*
Disallow:/scripts
Disallow:/*print*
Disallow:/*.PDF$
""")
    check("BLS's group for every agent is the one read", len(bls), 3)
    check("an OEWS download is allowed",
          gov.rules_allow(bls, "/oes/special-requests/oesm25all.zip"), True)
    check("a wildcard in the middle matches", gov.rules_allow(bls, "/oes/print.htm"), False)
    check("a $ anchors the end", gov.rules_allow(bls, "/a/b.PDF"), False)
    check("and only the end", gov.rules_allow(bls, "/a/b.PDF?x=1"), True)
    onet = gov.parse_robots("""User-agent: W3C-checklink
Disallow:

User-agent: *
Disallow: /shared/rate
Disallow: /profile/jobinfo/

User-agent: Jobrapido
Disallow: /
""")
    check("an empty Disallow and another agent's group add nothing", len(onet), 2)
    check("O*NET's database download is allowed",
          gov.rules_allow(onet, "/dl_files/database/db_31_0_csv.zip"), True)
    check("a later group for one named crawler doesn't bind us",
          gov.rules_allow(onet, "/find/bright"), True)
    tie = gov.parse_robots("User-agent: *\nDisallow: /a\nAllow: /a\n")
    check("a tie goes to Allow", gov.rules_allow(tie, "/a/b"), True)

    # BLS refuses a browser User-Agent and serves one with contact details.
    check("BLS gets the contact header",
          gov.headers_for("https://www.bls.gov/oes/special-requests/oesm25nat.zip")["User-Agent"],
          gov.CONTACT_HEADERS["User-Agent"])
    check("its download host too",
          gov.headers_for("https://download.bls.gov/pub/time.series/oe/oe.footnote")["User-Agent"],
          gov.CONTACT_HEADERS["User-Agent"])
    check("the contact header names a way to reach us",
          "support@permtracker.app" in gov.CONTACT_HEADERS["User-Agent"], True)
    check("DOL keeps the browser set",
          gov.headers_for("https://www.dol.gov/x.xlsx")["User-Agent"], gov.BROWSER_HEADERS["User-Agent"])
    check("a caller's header dict is its own copy",
          gov.headers_for("https://www.dol.gov/x") is gov.BROWSER_HEADERS, False)

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
