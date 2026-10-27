#!/usr/bin/env python3
"""The White House reader, on a trimmed copy of its real feed and real SQLite.

    python3 scripts/test_white_house.py
"""
from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ingest_white_house as wh  # noqa: E402
import lib_policy_feed as pf  # noqa: E402
from lib_db import query_dicts  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "white_house", "presidential-actions-feed.xml")
FAILS: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def main() -> int:
    rows, built, read = wh.parse_feed(open(FIX, "rb").read())
    titles = [r["title"] for r in rows]
    check("six actions are read", read == 6, str(read))
    check("the feed's own build day is read", built == "2026-10-23", str(built))
    check("the H-1B proclamation is kept", "Restriction on Entry of Certain Nonimmigrant Workers" in titles, str(titles))
    check("the H-1B executive order is kept", any(t.startswith("Enhancing Program Integrity") for t in titles))
    check("a holiday proclamation is dropped", not any("Gold Star" in t for t in titles))
    check("the Labor Day proclamation, which names H-1B once in passing, is dropped", not any("Labor Day" in t for t in titles))
    check("a sanctions order is dropped", not any("Sanctioning" in t for t in titles))
    check("an all-capitals angling order is dropped", not any("Angling" in t for t in titles))
    p = next(r for r in rows if r["title"].startswith("Restriction"))
    check("it's dated by its posting day, Eastern", p["publication_date"] == "2026-09-18", p["publication_date"])
    check("its kind is the White House's category", p["action"] == "Proclamation", str(p["action"]))
    check("its number is stable and from its address",
          p["document_number"] == "wh-2026-09-restriction-on-entry-of-certain-nonimmigrant-workers-faad", p["document_number"])
    check("its abstract skips the formal opening", bool(p["abstract"]) and not p["abstract"].upper().startswith("BY THE"),
          str(p["abstract"])[:80])
    check("its topics come from its text", "H-1B" in p["topics"], str(p["topics"]))

    check("capitals become title case", wh.readable_title("RESTORING AMERICAN SALTWATER ANGLING AND RECREATION")
          == "Restoring American Saltwater Angling and Recreation", wh.readable_title("RESTORING AMERICAN SALTWATER ANGLING AND RECREATION"))
    check("H-1B survives title case", wh.readable_title("PROTECTING THE H-1B PROGRAM") == "Protecting the H-1B Program",
          wh.readable_title("PROTECTING THE H-1B PROGRAM"))
    check("a mixed-case title is kept as printed", wh.readable_title("Labor Day, 2026") == "Labor Day, 2026")

    db = SqliteTurso()
    r1 = pf.write_notices(db, rows, source="white-house")
    r2 = pf.write_notices(db, rows, source="white-house")
    check("the first write writes both", r1.written == 2 and len(r1.new) == 2, str(r1))
    check("a second run writes nothing", r2.written == 0, str(r2))
    pf.write_notices(db, [{"document_number": "2026-19554", "publication_date": "2026-09-23", "type": "Presidential Document",
                           "title": "Restriction on Entry of Certain Nonimmigrant Workers", "abstract": None,
                           "html_url": "https://www.federalregister.gov/d/2026-19554", "agencies": ["Executive Office of the President"],
                           "topics": ["H-1B"], "signing_date": "2026-09-19", "status": "published"}], source="federal-register")
    pf.link_presidential(db)
    got = query_dicts(db, "SELECT superseded_by FROM policy_notices WHERE document_number = ?", [p["document_number"]])
    check("the Register's document replaces it once published", got and got[0]["superseded_by"] == "2026-19554", str(got))

    try:
        wh.parse_feed(b"<rss><channel><title>x</title></channel></rss>")
        empty = True
    except Exception:  # noqa: BLE001
        empty = False
    check("an empty feed parses to nothing (main() refuses it)", empty)

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
