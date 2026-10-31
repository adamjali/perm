#!/usr/bin/env python3
"""DOL's TAA petitions join a sponsor's page only on strict rules (ingest_taa.py).

* a petition decided before FY2013 isn't kept; one with no decision date isn't either;
* a petition joins only in a city the sponsor's own PERM filings name, unless the sponsor is national;
* DOL's typed years (1902, 2203) are no date; a worker count that isn't a number is none;
* the people's names in DOL's file are never read; a changed layout is refused.

Run: python3 scripts/test_taa.py
"""
from __future__ import annotations

import csv
import io
import pathlib
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ingest_taa as t  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


HEADER = list(t.SOURCE_COLS.values()) + ["PETITIONER_NAMES", "LAST_INVESTIGATOR", "CERTIFYING_OFFICER_LAST_NAME"]


def petition(pid, name, city, state, code="C2", decided="2022-06-16 00:00:00+00:00", workers="92"):
    r = dict.fromkeys(HEADER, "")
    r.update({"TAWSUFF": pid, "WORKER_GROUP_NAME": name, "CITY": city, "STATE": state, "DET_CODE": code,
              "DET_DATE": decided, "EST_WORKERS_OBJ": workers, "PETITION_DATE": "2203-01-01 00:00:00+00:00",
              "PETITIONER_NAMES": "A Private Person", "LAST_INVESTIGATOR": "Someone"})
    return [r[h] for h in HEADER]


def archive(rows, header=HEADER) -> zipfile.ZipFile:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    w.writerows(rows)
    raw = io.BytesIO()
    with zipfile.ZipFile(raw, "w") as z:
        z.writestr("2026-10-31_chunk_1.csv", "﻿" + buf.getvalue())
    raw.seek(0)
    return zipfile.ZipFile(raw)


check("DOL's dates read to the day", t.day("2022-06-16 00:00:00+00:00") == "2022-06-16")
check("a typed year is no date", t.day("2203-01-01 00:00:00+00:00") is None and t.day("1902-05-01") is None)
check("a worker count reads as a number, or none", t.workers("92.0") == 92 and t.workers("") is None and t.workers("x") is None)

SPONSORS = {"ORACLE AMERICA INC.": "oracle-america", "PELOTON INTERACTIVE, INC.": "peloton", "BIG NATIONAL INC": "big"}
rows = list(t.records(archive([
    petition("1", "Oracle America Inc.", "Hillsboro", "OR"),
    petition("2", "Peloton Interactive, Inc.", "Dayton", "OH", code="D"),
    petition("3", "Big National Inc", "Anywhere", "KS", code="ZZ"),
    petition("4", "Oracle America Inc.", "Hillsboro", "OR", decided="2011-03-01 00:00:00+00:00"),
    petition("5", "Oracle America Inc.", "Hillsboro", "OR", decided=""),
])))
cities = {"oracle-america": {"HILLSBORO"}, "peloton": {"NEW"}, "big": set()}
keep, seen = t.select(rows, lambda n, s: SPONSORS.get(n.upper()), t.dol.same_city(cities, {"big": 400}))
by = {r[0]: r for r in keep}
check("a petition in a city its sponsor files in joins", "1" in by)
check("a petition in a city its sponsor never names stays off", "2" not in by)
check("a national sponsor joins from any city", "3" in by)
check("a code DOL's dictionary doesn't list is kept as printed", by["3"][9] == "ZZ")
check("a petition decided before FY2013, or never, isn't kept", "4" not in by and "5" not in by)
check("a typed petition date is stored as none", by["1"][7] is None)
check("the counts say what was decided, named and kept", seen == {"petitions": 5, "recent": 3, "named": 3, "matched": 2}, str(seen))
check("no person's name is read", not any("Private Person" in str(v) or "Someone" in str(v) for r in keep for v in r))
check("every determination code in DOL's dictionary has words", set(t.CODES) >= {"C1", "C2", "CU", "CD", "C", "P", "D", "T"})

try:
    list(t.records(archive([petition("9", "X", "Y", "Z")], header=[h for h in HEADER if h != "DET_CODE"])))
    check("a changed layout is refused", False, "it was read")
except RuntimeError as exc:
    check("a changed layout is refused", "layout changed" in str(exc), str(exc))

print(f"\n{len(failures)} failure(s)" if failures else "\nall passed")
sys.exit(1 if failures else 0)
