#!/usr/bin/env python3
"""audit_all_pages.py holds each page's day to its structured data, its page and its sitemap.

    python3 scripts/test_audit_dates.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import audit_all_pages as ap  # noqa: E402

FAILS: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        FAILS.append(msg)


def ld(node: str) -> str:
    return f'<script type="application/ld+json">{node}</script>'


WEBPAGE = ld('{"@type":"WebPage","dateModified":"2026-10-16"}')
SHOWN = '<p>Updated <time dateTime="2026-10-16">October 16, 2026</time></p>'
DATASET_ONLY = ld('{"@type":"Dataset","dateModified":"2026-06-30"}')
ARTICLE = ld('{"@context":"https://schema.org","@graph":[{"@type":"Article","dateModified":"2026-10-12"}]}')
ARTICLE_SHOWN = '<time dateTime="2026-10-12">October 12, 2026</time>'


def main() -> int:
    check(ap.check_dates("/x", WEBPAGE + SHOWN, "2026-10-16") == [], "a page whose three dates agree passes")
    check(ap.check_dates("/x", WEBPAGE + SHOWN, "2026-10-17") == [], "a day either side of the sitemap passes")
    check(
        any("no dateModified" in f for f in ap.check_dates("/x", DATASET_ONLY + SHOWN, None)),
        "a Dataset's date isn't taken for the page's",
    )
    check(
        any("isn't shown" in f for f in ap.check_dates("/x", WEBPAGE, None)),
        "a structured date the page doesn't show is caught",
    )
    check(ap.check_dates("/", WEBPAGE, None) == [], "the home page may carry its date in structured data alone")
    check(
        any("sitemap says" in f for f in ap.check_dates("/x", WEBPAGE + SHOWN, "2026-06-30")),
        "a page and a sitemap far apart are caught",
    )
    check(ap.check_dates("/guides/a", ARTICLE + ARTICLE_SHOWN, "2026-10-12") == [], "an article's own node counts")
    sm = "<urlset><url><loc>https://permtracker.app/a</loc><lastmod>2026-10-01</lastmod></url><url><loc>https://permtracker.app/</loc><lastmod>2026-10-02</lastmod></url></urlset>"
    check(ap.url_lastmods(sm) == {"/a": "2026-10-01", "/": "2026-10-02"}, "lastmods are read per URL path")
    print(f"\n{len(FAILS)} failed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
