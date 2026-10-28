"""ingest_nvc_timeframes: parsing State's page, and keeping one reading a week."""
from __future__ import annotations

import pathlib
import sys

import ingest_nvc_timeframes as N

FAILS = []


def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        FAILS.append(name)


page = (pathlib.Path(__file__).parent / "fixtures" / "nvc_timeframes.html").read_text(encoding="utf8")
r = N.parse(page)
check("reads the day it's as of", r["asOf"] == "2026-10-26")
check("case creation: received from USCIS on Oct 17, 9 days behind", (r["createdThrough"], r["creationLagDays"]) == ("2026-10-17", 9))
check("document review: sent Aug 18, 69 days behind", (r["reviewedThrough"], r["reviewLagDays"]) == ("2026-08-18", 69))

try:
    N.parse("<p>We have moved this page.</p>")
    check("a page that no longer says it refuses", False)
except ValueError:
    check("a page that no longer says it refuses", True)

doc, new = N.merged({"readings": [dict(r, asOf="2026-10-19")]}, r)
check("a new week is added, newest first", new and [x["asOf"] for x in doc["readings"]] == ["2026-10-26", "2026-10-19"])
doc2, new2 = N.merged(doc, r)
check("the same week again writes nothing", not new2 and doc2 == doc)
many = {"readings": [dict(r, asOf=f"2025-{m:02d}-01") for m in range(1, 13)] * 5}
doc3, _ = N.merged(many, r)
check("keeps a year of readings at most", len(doc3["readings"]) == N.READINGS_KEPT)

sys.exit(1 if FAILS else 0)
