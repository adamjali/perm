#!/usr/bin/env python3
"""The Justice Department reader, on real SQLite.

    python3 scripts/test_doj_enforcement.py

The fixtures are trimmed real copies read on www.justice.gov on Nov 1 2026 (fixtures/policy_news/doj_*):
IER's settlements list (its newest 70 entries), OCAHO's volume 22 table, and a page of the press-release
API holding the Cloudera settlement and a U.S. Attorney's release. The API page's third result is made up
here: a Civil Rights Division release about housing, to prove the work-visa rule keeps it out. No request
leaves the machine.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.pop("REVALIDATE_SECRET", None)  # no call to the site from a test
import ingest_doj_enforcement as d  # noqa: E402
from lib_db import query_dicts, read_doc  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures", "policy_news")
FAILS: list[str] = []


def check(cond: bool, what: str) -> None:
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        FAILS.append(what)


def read(name: str) -> str:
    return open(os.path.join(FIX, name), encoding="utf-8").read()


API = json.loads(read("doj_api.json"))
IER = read("doj_ier.html")
OCAHO = read("doj_ocaho.html")


def fake_fetch(url: str) -> str:
    if "/api/" in url:
        return json.dumps(API)
    if "settlements-and-lawsuits" in url:
        return IER
    if "listing-volume-22" in url:
        return OCAHO
    raise AssertionError(f"unexpected fetch {url}")


# --- the API: Civil Rights Division and a work-visa subject, nothing else ---
rows = d.api_rows(API)
check([r["document_number"] for r in rows] == ["doj-26-1166"], "the API keeps the Cloudera settlement alone")
check(rows[0]["publication_date"] == "2026-10-16", "dated by its posted day, Eastern")
check("&amp;" not in rows[0]["title"] and "PERM Debarment & Back Pay" in rows[0]["title"], "its title's entities decoded")
check(rows[0]["agencies"] == ["Justice Department"] and rows[0]["type"] == d.TYPE, "named as the Justice Department's")
media: set[str] = set()
d.api_rows(API, media)
check("1465571" in media, "remembers the agreement the release links")

# --- IER's list ---
entries = d.ier_entries(IER)
check(len(entries) >= 60, f"reads every entry on the list ({len(entries)})")
cloudera = next(e for e in entries if e["name"].startswith("Cloudera"))
check(cloudera["day"] == "2026-10-13", "takes a settlement's day from its summary's first words")
ier = d.ier_rows(entries)
names = [r["title"] for r in ier]
check("Settlement with LanceSoft, Inc." in names and "Settlement with Creative Team, LLC" in names,
      "keeps the settlements that have no release")
check(not any("Cloudera" in n for n in names), "leaves a settlement with a release to the API")
check(not any("Whirlpool" in n for n in names), "leaves out a settlement that isn't about visas")
check(all(r["publication_date"] >= d.SINCE for r in ier), "nothing before 2025")
openai = [r for r in ier if "OpenAI" in r["title"]]
check(len(openai) == 1, "lists OpenAI, whose entry links its agreement and not its release")
check(not [r for r in d.ier_rows(entries, released={"1455621"}) if "OpenAI" in r["title"]],
      "and skips it once its release's row links the same agreement")

# --- OCAHO ---
cases = d.ocaho_cases(OCAHO)
c = next(x for x in cases if "Cloudera" in x["caption"])
check(c["number"] == "2026B00044" and len(c["orders"]) == 4, "reads Cloudera's four orders across the rowspan")
companies = {d.company_key(e["name"]) for e in entries if e["day"] and e["day"] >= d.SINCE and d.WORK.search(e["summary"])}
oc = d.ocaho_rows(cases, companies)
check([r["document_number"] for r in oc] == ["ocaho-2026B00044"], "keeps the government's discrimination case against a company IER names")
check(oc[0]["publication_date"] == "2026-10-08", "dated by its newest order")

# --- a run on real SQLite ---
db = SqliteTurso()
now = dt.datetime(2026, 11, 1, 22, 0, tzinfo=dt.timezone.utc)
rc = d.run(db, fetch=fake_fetch, sleep=lambda s: None, robots=lambda u: True, now=now)
stored = query_dicts(db, "SELECT document_number, source FROM policy_notices ORDER BY document_number", [])
check(rc == 0 and {r["source"] for r in stored} == {"doj"}, "writes its rows under source doj")
check(any(r["document_number"] == "doj-26-1166" for r in stored) and any(r["document_number"] == "ocaho-2026B00044" for r in stored),
      "the release and the court case both land")
check("1465571" in (read_doc(db, d.MEDIA_DOC) or {}).get("ids", []), "keeps the release's agreement id for later runs")
check(read_doc(db, d.LISTS_DOC) is not None, "notes when it read the lists")

asked: list[str] = []
d.run(db, fetch=lambda u: (asked.append(u), fake_fetch(u))[1], sleep=lambda s: None, robots=lambda u: True,
      now=now + dt.timedelta(hours=1))
check(len(asked) == 1 and "/api/" in asked[0], "an hour later it reads the API alone: the lists wait 6 hours")

# --- refusals and broken pages ---
def refused(url: str) -> str:
    raise urllib.error.HTTPError(url, 403, "Forbidden", None, None)  # type: ignore[arg-type]

check(d.run(SqliteTurso(), fetch=refused, sleep=lambda s: None, robots=lambda u: True, now=now) == 0,
      "a refusal is a warning, not a failure")
broken = lambda u: "<html>nothing here</html>" if "/api/" not in u else json.dumps(API)  # noqa: E731
check(d.run(SqliteTurso(), fetch=broken, sleep=lambda s: None, robots=lambda u: True, now=now) == 1,
      "a list that doesn't look like itself fails, writing nothing")


def boom(url: str) -> str:
    raise KeyError("a defect")

try:
    d.run(SqliteTurso(), fetch=boom, sleep=lambda s: None, robots=lambda u: True, now=now)
    check(False, "a code defect re-raises")
except KeyError:
    check(True, "a code defect re-raises")

print(f"\n{len(FAILS)} failed")
sys.exit(1 if FAILS else 0)
