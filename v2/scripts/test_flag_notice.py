#!/usr/bin/env python3
"""DOL's FLAG notice reader, against FLAG's homepage as served on Oct 27 2026.

    python3 scripts/test_flag_notice.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_flag_notice import next_doc, parse_notice  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WITH = os.path.join(HERE, "fixtures", "flag_home_maintenance_2026-10-27.html")
WITHOUT = os.path.join(HERE, "fixtures", "flag_home_no_notice.html")


def check(cond: bool, msg: str, failures: list[str]) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def main() -> int:
    f: list[str] = []
    n = parse_notice(open(WITH, encoding="utf8").read())
    check(n is not None and n["heading"] == "Scheduled Maintenance", "reads the notice's heading", f)
    check(bool(n) and n["body"].startswith("Starting on Tuesday, October 27, 2026 at 7:00 PM Eastern Time,"), "keeps DOL's words as printed", f)
    check(bool(n) and "close" not in n["body"].lower(), "leaves out the banner's close button", f)
    check(parse_notice(open(WITHOUT, encoding="utf8").read()) is None, "no notice when the header area is empty, whatever headings the page has", f)
    first = next_doc(None, n, 1000)
    check(first["active"] and first["firstSeenAt"] == 1000 and first["checkedAt"] == 1000, "a new notice is first seen now", f)
    again = next_doc(first, n, 5000)
    check(again["firstSeenAt"] == 1000 and again["checkedAt"] == 5000, "the same notice keeps its first sighting, and the check time moves", f)
    changed = next_doc(first, {"heading": "Scheduled Maintenance", "body": "New dates."}, 9000)
    check(changed["firstSeenAt"] == 9000, "a changed notice is a new sighting", f)
    gone = next_doc(first, None, 9000)
    check(not gone["active"] and gone["checkedAt"] == 9000, "no notice reads inactive, with its check time", f)
    print("\nALL PASS" if not f else f"\n{len(f)} FAILURE(S)")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())
