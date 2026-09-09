#!/usr/bin/env python3
"""The OFLC announcements parser, against the page as captured on Sep 8 2026.

    python3 scripts/test_oflc_news.py

Three things it proves: the text fixture yields every announcement with the
right date and title; the HTML-to-text step produces the same line shape the
parser keys on (a synthetic page, since www.dol.gov refuses the laptop); and
the tags and document numbers are what the feed expects. A parser change that
drops announcements fails the count, which is the failure that matters.
"""
from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_oflc_news import html_to_text, parse_announcements  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "fixtures", "oflc_news.txt")


def check(cond: bool, msg: str, failures: list[str]) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def main() -> int:
    failures: list[str] = []
    text = open(FIXTURE, encoding="utf-8").read()
    rows = parse_announcements(text)
    check(len(rows) == 31, f"31 announcements parsed from the Sep 8 2026 capture (got {len(rows)})", failures)
    first = rows[0] if rows else {}
    check(first.get("publication_date") == "2026-09-02", f"first announcement dated 2026-09-02 (got {first.get('publication_date')})", failures)
    check(str(first.get("title", "")).startswith("OFLC Announces Updates to Implementation of the H-2A"), "first title kept verbatim", failures)
    check("h-2a" in first.get("topics", []), "first announcement tagged h-2a", failures)
    check(bool(first.get("abstract")) and len(first["abstract"]) <= 604, "abstract is the first paragraph, capped", failures)
    q3 = [r for r in rows if "Public Disclosure Data" in r["title"]]
    check(bool(q3) and "disclosure-data" in q3[0]["topics"], "the disclosure-data release is tagged disclosure-data", failures)
    ids = [r["document_number"] for r in rows]
    check(len(set(ids)) == len(ids), "document numbers are unique", failures)
    check(all(re.fullmatch(r"oflc-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}", i) for i in ids), "document numbers carry the date and a title digest", failures)
    check(rows == parse_announcements(text), "parsing is deterministic", failures)
    dates = [r["publication_date"] for r in rows]
    check(dates == sorted(dates, reverse=True), "newest first, as the page lists them", failures)

    # The HTML step: a synthetic page in the shape the site uses.
    page = """<html><head><title>x</title><script>var a=1;</script></head><body>
    <article><h2>Archive</h2><h3>Calendar Year 2026</h3><h4>Announcements</h4>
    <p><strong>September 2, 2026.</strong> OFLC Announces a Thing &amp; Another.</p>
    <p>First paragraph of the body, with an &ldquo;entity&rdquo;.</p><p>Second paragraph.</p>
    <p><strong>August 14, 2026.</strong> OFLC Releases Public Disclosure Data for Q3 of Fiscal Year 2026.</p>
    <p>Body two.</p></article></body></html>"""
    got = parse_announcements(html_to_text(page))
    check(len(got) == 2, f"HTML page yields 2 announcements (got {len(got)})", failures)
    check(got[0]["title"] == "OFLC Announces a Thing & Another" if got else False, "entities decoded and the trailing period dropped from the title", failures)
    check(got[0]["abstract"].startswith("First paragraph") if got else False, "abstract is the first paragraph after the head", failures)
    check("disclosure-data" in got[1]["topics"] if len(got) > 1 else False, "topic tagging works on HTML input", failures)

    # A page with no heads must parse to nothing, so the ingest refuses to write.
    check(parse_announcements(html_to_text("<html><body><p>Nothing here</p></body></html>")) == [], "an empty page parses to no rows", failures)

    print("\nALL PASS" if not failures else f"\n{len(failures)} FAILURE(S)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
