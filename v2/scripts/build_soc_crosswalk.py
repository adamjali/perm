#!/usr/bin/env python3
"""Write BLS's SOC 2010 to 2018 crosswalk as scripts/data/soc_2010_to_2018.json.

WHY. DOL's wage tables coded jobs in the 2010 system through 2021-22 and in the 2018 system from 2022-23 (read off
our stored tables, Oct 29 2026: every 2021 code is a 2010 code, every 2022 code a 2018 one). So a job's wage history
under its 2018 code stops at 2022-23 unless the earlier years are read under the 2010 codes BLS maps to it. Software
developers (15-1252) came from 15-1132 and 15-1133, and each of those also fed 15-1253: the map is many-to-many, so a
page shows each earlier code as its own row, never one blended figure.

WHAT'S KEPT. For each 2018 code whose 2010 predecessors aren't exactly itself: each predecessor's code and title, and
the other 2018 codes that predecessor also became. The file is BLS's from November 2017 and doesn't change; run this
again only if BLS revises it. The link is read from BLS's own crosswalks page, never built.

Usage:
    python3 scripts/build_soc_crosswalk.py
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import zipfile
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import discover_links, fetch, log  # noqa: E402
from lib_reference import sheet_paths, sheet_rows  # noqa: E402

PAGE = "https://www.bls.gov/soc/2018/crosswalks.htm"
HOST = "https://www.bls.gov"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "soc_2010_to_2018.json")
HEADER = ["2010 SOC Code", "2010 SOC Title", "2018 SOC Code", "2018 SOC Title"]


def clean_title(t: str) -> str:
    """BLS marks some titles with footnote signs, "Software Developers, Applications (#)": the sign isn't the name."""
    return re.sub(r"\s*\([#*]+\)\s*$", "", t.strip())


def is_code(v: str) -> bool:
    return len(v) == 7 and v[2] == "-" and v.replace("-", "").isdigit()


def build(book: bytes) -> dict[str, list[dict]]:
    sheets = list(sheet_paths(zipfile.ZipFile(io.BytesIO(book))))
    rows = list(sheet_rows(book, sheets[0]))
    start = next((i for i, r in enumerate(rows) if [c.strip() for c in r[:4]] == HEADER), None)
    if start is None:
        raise SystemExit(f"the crosswalk's header row ({HEADER}) is missing")
    pairs = [(r[0].strip(), clean_title(r[1]), r[2].strip(), clean_title(r[3])) for r in rows[start + 1:] if len(r) >= 4]
    pairs = [p for p in pairs if is_code(p[0]) and is_code(p[2])]
    if len(pairs) < 800:
        raise SystemExit(f"only {len(pairs)} code pairs; BLS's crosswalk has about 900")
    title10 = {a: t for a, t, _, _ in pairs}
    title18 = {b: t for _, _, b, t in pairs}
    to18: dict[str, set[str]] = defaultdict(set)
    to10: dict[str, set[str]] = defaultdict(set)
    for a, _, b, _ in pairs:
        to18[a].add(b)
        to10[b].add(a)
    out: dict[str, list[dict]] = {}
    for b in sorted(to10):
        if to10[b] == {b}:
            continue
        out[b] = [
            {"code": a, "title": title10[a],
             "alsoTo": [{"code": c, "title": title18[c]} for c in sorted(to18[a] - {b})]}
            for a in sorted(to10[b])
        ]
    return out


def main() -> int:
    links = discover_links(fetch(PAGE).decode("utf-8", "replace"), r"soc_2010_to_2018_crosswalk\.xlsx$", HOST)
    if not links:
        raise SystemExit("BLS's crosswalks page links no soc_2010_to_2018_crosswalk.xlsx")
    url = next(iter(links.values()))
    codes = build(fetch(url, referer=PAGE))
    doc = {"source": "BLS, SOC 2010 to 2018 crosswalk (November 2017)", "url": url, "codes": codes}
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=1, sort_keys=True)
        f.write("\n")
    log(f"wrote {OUT}: {len(codes)} 2018 codes with other 2010 predecessors")
    return 0


if __name__ == "__main__":
    sys.exit(main())
