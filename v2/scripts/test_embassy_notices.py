#!/usr/bin/env python3
"""The embassies' visa notices reader, on real SQLite.

    python3 scripts/test_embassy_notices.py

The fixture is a trimmed real copy of six embassies' Visas feeds and robots.txt files, read in a browser on
Nov 4 2026 (fixtures/embassies/feeds_2026-11-04.json). No request leaves the machine.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.pop("REVALIDATE_SECRET", None)  # no call to the site from a test
import ingest_embassy_notices as e  # noqa: E402
from lib_db import query_dicts  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures", "embassies", "feeds_2026-11-04.json")
TODAY = "2026-11-04"
FAILS: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def with_bundle(bundle: dict, fn):
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "copy.json")
        open(path, "w").write(json.dumps(bundle))
        return fn(path)


def notices(db) -> list[dict]:
    return query_dicts(db, "SELECT document_number, publication_date, type, title, agencies, html_url, abstract "
                           "FROM policy_notices ORDER BY document_number", typed=True)


def main() -> int:
    bundle = json.load(open(FIX))
    plan = e.embassies()

    # --- the list ---------------------------------------------------------------
    check("twenty embassies, each with a code, a host, a name, a consulate and a time zone",
          len(plan) == 20 and all(x.get("code") and x.get("host") and x.get("name") and x.get("posts") and x.get("tz") for x in plan))
    check("each code is used once", len({x["code"] for x in plan}) == 20)
    check("posts are the issuance tables' keys (lower case, no stray spaces)",
          all(p == " ".join(p.split()).casefold() for x in plan for p in x["posts"]))

    # --- the rules, on real titles ------------------------------------------------
    keep = lambda t, x="": e.decide(t, x)[0]  # noqa: E731
    check("an operations update is kept", keep("August 18 Consular Operations Update"))
    check("routine services resuming are kept", keep("Important Notice: Resumption of Routine Visa Services"))
    check("appointments cancelled for a protest are kept", keep("Notice: Visa Appointments Cancelled Due to Possible Protests"))
    check("an immigrant visa process notice is kept", keep("IMPORTANT NOTICE: Immigrant Visa Appointment Registration Process"))
    check("a checklist is dropped", not keep("Checklist for Immigrant Visas"))
    check("a fraud warning is dropped", not keep("Beware of ESTA Scams"))
    # Shapes only the evergreen rule drops: each names an operation or an immigrant visa too.
    check("an FAQ about appointments is dropped (Türkiye's, Jul 2025)", not keep("Appointment Scheduling FAQ"))
    check("an interview checklist is dropped though it names immigrant visas", not keep("Immigrant Visa Interview Checklist"))
    check("visiting the embassy is dropped", not keep("Visiting The Embassy or Consulate"))
    check("a health alert is dropped", not keep("Health Alert: Dengue Fever on Kenyan Coast"))
    check("a student-only notice is dropped", not keep("Interviews for student visa applicants resume"))
    check("a policy statement naming no operation is dropped", not keep("New Visa Restriction Policy to Deter Cyberscams"))
    check("'nonimmigrant' alone is not an immigrant visa", not keep("DS-160 Compliance for Nonimmigrant Visa Applicants"))
    check("an evergreen page that names a closure is kept", keep("Consular sections closed: what to bring instead of a checklist"))
    check("WordPress's 'appeared first on' line is dropped from an excerpt",
          e.text_of("<p>Interviews resume Monday.</p><p>The post <a>X</a> appeared first on <a>U.S. Embassy</a>.</p>") == "Interviews resume Monday.")
    check("a day is the embassy's own: 23:30 UTC is the next morning in Manila",
          e.local_day("Mon, 17 Aug 2026 23:30:00 +0000", "Asia/Manila") == "2026-08-18")
    check("a feed with an entity declaration is refused before it's parsed", (lambda: _raises(lambda: e.parse_feed(
        '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY a "aaaa">]><rss><channel><item><title>&a;</title></item></channel></rss>')))())

    # --- a full run -------------------------------------------------------------
    db = SqliteTurso()
    rc = with_bundle(bundle, lambda p: e.run(db, p, plan=plan, today=TODAY))
    rows = notices(db)
    nums = [r["document_number"] for r in rows]
    check("the run exits 0 with fourteen embassies' copies missing", rc == 0, str(rc))
    check("fourteen notices are kept from the six feeds", len(rows) == 14, f"{len(rows)}: {nums}")
    check("a number is embassy-<code>-<slug>", "embassy-ph-august-18-consular-operations-update" in nums, str(nums[:3]))
    names = [json.loads(r["agencies"]) if isinstance(r["agencies"], str) else r["agencies"] for r in rows]
    check("each row names its embassy", all(a and a[0].startswith(("U.S. Embassy", "American")) for a in names), str(names[:2]))
    check("each row links the embassy's own post", all(r["html_url"].startswith("https://") for r in rows))
    check("nothing older than a year before the copy is kept", all(r["publication_date"] >= "2025-11-04" for r in rows))
    check("nothing from Korea or China is kept (checklists, permits, policy statements)",
          not any(n.startswith(("embassy-kr-", "embassy-china-")) for n in nums))
    fresh = query_dicts(db, "SELECT as_of, note FROM data_freshness WHERE dataset = ?", [e.DATASET], typed=True)
    check("freshness is the newest post on any feed (Korea's, Nov 4)", fresh and fresh[0]["as_of"] == "2026-11-04", str(fresh))
    runs = query_dicts(db, "SELECT status, note FROM ingest_runs WHERE script = ?", [e.SCRIPT], typed=True)
    check("the run's note names the embassies with no copy", runs and "no copy or no answer" in runs[-1]["note"], str(runs))

    rc = with_bundle(bundle, lambda p: e.run(db, p, plan=plan, today=TODAY))
    check("a second run of the same copy changes nothing", rc == 0 and notices(db) == rows)

    # --- what a run refuses -------------------------------------------------------
    blocked = json.loads(json.dumps(bundle))
    blocked["robots"]["ph.usembassy.gov"] = {"status": 200, "text": "User-agent: *\nDisallow: /category/\n"}
    bdb = SqliteTurso()
    with_bundle(blocked, lambda p: e.run(bdb, p, plan=plan, today=TODAY))
    check("a feed whose robots.txt asks robots off is skipped", not any(n.startswith("embassy-ph-") for n in (r["document_number"] for r in notices(bdb))))

    broken = json.loads(json.dumps(bundle))
    broken["feeds"]["ae.usembassy.gov"]["text"] = "<html>Technical Difficulties</html>"
    kdb = SqliteTurso()
    rc = with_bundle(broken, lambda p: e.run(kdb, p, plan=plan, today=TODAY))
    runs = query_dicts(kdb, "SELECT note FROM ingest_runs WHERE script = ?", [e.SCRIPT], typed=True)
    check("a feed that doesn't parse is named, and the rest load", rc == 0 and "didn't parse: ae" in runs[-1]["note"], str(runs))

    none = {"copiedAt": bundle["copiedAt"], "feeds": {}, "robots": {}}
    ndb = SqliteTurso()
    rc = with_bundle(none, lambda p: e.run(ndb, p, plan=plan, today=TODAY))
    runs = query_dicts(ndb, "SELECT status FROM ingest_runs WHERE script = ?", [e.SCRIPT], typed=True)
    check("a copy with no feed fails, writing nothing", rc == 1 and runs and runs[-1]["status"] == "failed" and not notices_or_empty(ndb))

    rc = with_bundle(bundle, lambda p: e.run(None, p, dry_run=True, plan=plan, today=TODAY))
    check("a dry run reads and writes nowhere", rc == 0)

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


def _raises(fn) -> bool:
    try:
        fn()
    except ValueError:
        return True
    return False


def notices_or_empty(db) -> list:
    if not query_dicts(db, "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'policy_notices'"):
        return []
    return notices(db)


if __name__ == "__main__":
    sys.exit(main())
