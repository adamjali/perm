#!/usr/bin/env python3
"""The shared policy writer, on real SQLite.

    python3 scripts/test_policy_feed.py

Each check is the rule a writer used to break: a source that knew fewer
columns wiping the rest (`INSERT OR REPLACE`), a first sighting moved by a
rewrite, a published document sent back to public inspection.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_policy_feed as pf  # noqa: E402
from lib_db import query_dicts  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILS: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def row(num: str, **kw) -> dict:
    base = {"document_number": num, "publication_date": "2026-10-28", "type": "Notice",
            "title": "A notice", "abstract": None, "html_url": f"https://example.gov/{num}",
            "agencies": ["U.S. Citizenship and Immigration Services"], "topics": ["H-1B"]}
    base.update(kw)
    return base


def get(db, num: str) -> dict:
    return query_dicts(db, "SELECT * FROM policy_notices WHERE document_number = ?", [num], typed=True)[0]


def main() -> int:
    db = SqliteTurso()

    r = pf.write_notices(db, [row("2026-1", effective_on="2026-12-01", status="public-inspection",
                                  pi_filed="2026-10-27")], source="public-inspection", now_ms=1000)
    check("a new row is written and named new", r.written == 1 and r.new == ["2026-1"], str(r))
    check("first sighting is set", get(db, "2026-1")["first_seen_at"] == 1000)

    r = pf.write_notices(db, [row("2026-1", effective_on="2026-12-01", status="public-inspection",
                                  pi_filed="2026-10-27")], source="public-inspection", now_ms=2000)
    check("an unchanged row writes nothing", r.written == 0 and r.unchanged == 1, str(r))

    r = pf.write_notices(db, [row("2026-1", abstract="The abstract.", status="published", topics=["PERM"],
                                  citation="91 FR 1")], source="federal-register", now_ms=3000)
    got = get(db, "2026-1")
    check("the published write lands", r.written == 1 and got["status"] == "published", str(got))
    check("a column the source left empty keeps its value (effective date)", got["effective_on"] == "2026-12-01")
    check("the public inspection day survives publication", got["pi_filed"] == "2026-10-27")
    check("first sighting never moves", got["first_seen_at"] == 1000, str(got["first_seen_at"]))
    check("topics are a union", got["topics"] in ('["H-1B", "PERM"]', ["H-1B", "PERM"]), str(got["topics"]))
    check("the source is the latest writer", got["source"] == "federal-register")

    pf.write_notices(db, [row("2026-1", status="public-inspection")], source="public-inspection", now_ms=4000)
    check("a published document never goes back to public inspection", get(db, "2026-1")["status"] == "published")

    # A row written the old way, before the new columns, is backfilled.
    db.execute("INSERT INTO policy_notices (document_number, publication_date, type, title, abstract, html_url, "
               "agencies, topics, fetched_at) VALUES ('oflc-2026-01-01-x','2026-01-01','OFLC announcement','t',"
               "NULL,'u','[]','[]', 777)")
    pf.ensure_table(db)
    old = get(db, "oflc-2026-01-01-x")
    check("an old row's first sighting is its last write", old["first_seen_at"] == 777, str(old))
    check("an old row's source follows its type", old["source"] == "oflc")

    try:
        pf.write_notices(db, [row("x")], source="somewhere")
        check("an unknown source is refused", False)
    except ValueError:
        check("an unknown source is refused", True)
    try:
        pf.write_notices(db, [row("y", title="")], source="white-house")
        check("a row with no title is refused", False)
    except ValueError:
        check("a row with no title is refused", True)

    # The White House row folds into the Register's once published.
    pf.write_notices(db, [row("wh:restriction", type="Presidential action", source="white-house",
                              title="Restriction on Entry of Certain Nonimmigrant Workers",
                              publication_date="2026-09-19")], source="white-house")
    pf.write_notices(db, [row("wh:far", type="Presidential action", title="Restriction on Entry of Certain Nonimmigrant Workers",
                              publication_date="2026-01-02")], source="white-house")
    pf.write_notices(db, [row("2026-19554", type="Presidential Document", signing_date="2026-09-19",
                              title="Restriction on Entry of Certain Nonimmigrant Workers.",
                              publication_date="2026-09-23", status="published")], source="federal-register")
    pf.write_notices(db, [row("wh:typo", type="Presidential action",
                              title="Enhancing Program Integrity and Integrity and Interagency Coordination in the Administration of the H-1B Nonimmigrant Visa Program",
                              publication_date="2026-09-18")], source="white-house")
    pf.write_notices(db, [row("2026-19555", type="Presidential Document", signing_date="2026-09-18",
                              title="Enhancing Program Integrity and Interagency Coordination in the Administration of the H-1B Nonimmigrant Visa Program",
                              publication_date="2026-09-23", status="published")], source="federal-register")
    n = pf.link_presidential(db)
    check("a White House title with a typo still links", get(db, "wh:typo")["superseded_by"] == "2026-19555")
    check("a White House row links to its Register document", get(db, "wh:restriction")["superseded_by"] == "2026-19554", str(n))
    check("a same-title row months apart stays apart", get(db, "wh:far")["superseded_by"] is None)

    keep = pf.mentions_immigration
    check("the H-1B proclamation is kept", keep("Restriction on Entry of Certain Nonimmigrant Workers"))
    check("a holiday proclamation is not", not keep("Labor Day, 2026"))
    check("State's museum notices are not", not keep("Notice of Determinations; Culturally Significant Objects Being Imported for Exhibition"))
    check("an EAD rule is", keep("Employment Authorization Reform and Reinforcement"))
    check("topics: H-2B and fees", pf.topics_of("Supplemental cap increase for H-2B; fee") == ["H-2B", "Fees"],
          str(pf.topics_of("Supplemental cap increase for H-2B; fee")))
    check("an RFC 822 date is an Eastern day", pf.eastern_day("Tue, 28 Oct 2026 02:30:00 +0000") == "2026-10-27")

    # A job read every 30 minutes writes a quiet run row at most every 3 hours.
    import time as _t
    q = SqliteTurso()
    count = lambda: int(q.scalar("SELECT count(*) FROM ingest_runs WHERE script = 'x.py'") or 0)
    pf.record_quiet_run(q, "x.py", written=0, note="first")
    check("the first quiet run is recorded", count() == 1)
    pf.record_quiet_run(q, "x.py", written=0, note="again")
    check("a second quiet run inside 3 hours is not", count() == 1)
    pf.record_quiet_run(q, "x.py", written=2, note="wrote")
    check("a run that wrote something always is", count() == 2)
    pf.record_quiet_run(q, "x.py", written=0, note="later", now_ms=int(_t.time() * 1000) + 4 * 3600 * 1000)
    check("a quiet run after 3 hours is", count() == 3)

    # Every source's freshness row is named on the page and in the coverage registry.
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    page = open(os.path.join(root, "src/app/(site)/(public)/policy-changes/page.tsx")).read()
    coverage = open(os.path.join(root, "src/lib/datasetCoverage.ts")).read()
    for d in pf.POLICY_DATASETS:
        check(f"the policy page names {d} in its sources", f'"{d}"' in page)
        check(f"{d} has a coverage sentence and a label", coverage.count(f'"{d}"') >= 2, str(coverage.count(f'"{d}"')))

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
