#!/usr/bin/env python3
"""Load BEA's regional price parities: what the same basket costs by state and metro.

WHAT IT IS. The Bureau of Economic Analysis publishes regional price parities
(RPPs): an area's price level as a percentage of the national level (100). A
metro at 120 is 20% dearer than the country as a whole, for all items, and
separately for goods, housing rents, utilities and other services. Beside a
PERM salary it answers the question a raw dollar figure can't: what that pay
buys where the job is.

WHERE. BEA's robots.txt forbids its regional download folder to scripts and
allows its API, so this reads the API (tables SARPP for states and MARPP for
metro areas), which needs a free key (UserID) from apps.bea.gov/api/signup/.
Without BEA_API_KEY in the environment it says so and exits cleanly: no rows,
no freshness stamp, so nothing reports as stale before the key exists. BEA
ended metro real income figures in February 2026 and kept the metro RPPs.

LINE CODES ARE FOUND BY NAME. The API lists each table's lines with their
descriptions; the loader picks "All items", "Goods", "Housing", "Utilities"
and "Other" from that list rather than assuming numbers.

Usage:
    BEA_API_KEY=... python3 scripts/ingest_bea_rpp.py
    python3 scripts/ingest_bea_rpp.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import fetch, log  # noqa: E402
from lib_reference import sync_rows  # noqa: E402
from lib_turso import Turso, record_run, stamp_freshness, write_doc  # noqa: E402

SCRIPT = "ingest_bea_rpp.py"
# What the site prints as the source line: a readable name, never a bare URL (a URL has no
# spaces, so it can't wrap, and it pushed two pages sideways on a phone, Oct 5 2026).
SOURCE = "BEA regional price parities (bea.gov)"
API = "https://apps.bea.gov/api/data"
SIGNUP = "https://apps.bea.gov/api/signup/"
TABLE = "bea_rpp"
COLS = ("geo_fips", "year", "line", "kind", "geo_name", "value")
TABLES = {"state": ("SARPP", "STATE"), "msa": ("MARPP", "MSA")}
# Our line name -> words its BEA description must contain.
# BEA prints housing as "RPPs: Services: Rents" (read Oct 5 2026); the word housing never appears.
LINES = {"all": ("all items",), "goods": ("goods",), "housing": ("rents",),
         "utilities": ("utilities",), "other": ("other",)}
MIN_ROWS = {"state": 51, "msa": 300}
# BEA allows 100 requests a minute; this loader makes about a dozen.
PAUSE_S = 1.0

DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        geo_fips TEXT NOT NULL, year INTEGER NOT NULL, line TEXT NOT NULL, kind TEXT NOT NULL,
        geo_name TEXT NOT NULL, value REAL, PRIMARY KEY (geo_fips, year, line))""",
]


class Refusal(Exception):
    """A response that must not be written, with the reason."""


def call(key: str, **params) -> dict:
    url = API + "?" + urllib.parse.urlencode({"UserID": key, "ResultFormat": "JSON", **params})
    body = json.loads(fetch(url).decode("utf-8"))
    results = (body.get("BEAAPI") or {}).get("Results") or {}
    err = results.get("Error") if isinstance(results, dict) else None
    if err or (body.get("BEAAPI") or {}).get("Error"):
        raise Refusal(f"BEA API error: {json.dumps(err or body['BEAAPI'].get('Error'))[:300]}")
    return results


def pick_lines(values: list[dict]) -> dict[str, str]:
    """Our line name -> BEA's LineCode, by description. Each must match once."""
    out: dict[str, str] = {}
    for name, words in LINES.items():
        hits = [v for v in values if all(w in (v.get("Desc") or "").lower() for w in words)]
        if name == "goods":
            hits = [v for v in hits if "service" not in (v.get("Desc") or "").lower()]
        if name == "other":
            hits = [v for v in hits if "service" in (v.get("Desc") or "").lower()]
        if len(hits) != 1:
            raise Refusal(f"line {name!r}: {len(hits)} descriptions match ({[h.get('Desc') for h in hits]})")
        out[name] = str(hits[0]["Key"])
    return out


def rows_of(data: list[dict], kind: str, line: str) -> list[tuple]:
    out = []
    for d in data:
        fips, year = (d.get("GeoFips") or "").strip(), (d.get("TimePeriod") or "").strip()
        if not re.match(r"^\d{5}$", fips) or not year.isdigit() or fips == "00000":
            continue
        raw = (d.get("DataValue") or "").replace(",", "").strip()
        try:
            value = float(raw)
        except ValueError:
            value = None
        out.append((fips, int(year), line, kind, (d.get("GeoName") or "").strip(), value))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    key = os.environ.get("BEA_API_KEY", "").strip()
    if not key:
        log(f"BEA_API_KEY isn't set; price parities skipped. A free key comes from {SIGNUP}")
        return 0

    rows: list[tuple] = []
    counts: dict[str, int] = {}
    for kind, (table, geo) in TABLES.items():
        values = call(key, method="GetParameterValuesFiltered", datasetname="Regional",
                      TargetParameter="LineCode", TableName=table).get("ParamValue", [])
        lines = pick_lines(values)
        time.sleep(PAUSE_S)
        for name, code in lines.items():
            got = rows_of(call(key, method="GetData", datasetname="Regional", TableName=table,
                               LineCode=code, GeoFips=geo, Year="ALL").get("Data", []), kind, name)
            rows += got
            time.sleep(PAUSE_S)
        areas = len({r[0] for r in rows if r[3] == kind})
        if areas < MIN_ROWS[kind]:
            raise Refusal(f"{table}: only {areas} areas")
        counts[kind] = areas
    newest = max(r[1] for r in rows)
    us = [r for r in rows if r[3] == "state" and r[2] == "all" and r[1] == newest and r[5] is not None]
    if not all(60 <= r[5] <= 140 for r in us):
        raise Refusal("a state's all-items parity is outside 60 to 140, which no state has published")
    log(f"  {len(rows)} values; {counts}; newest year {newest}")
    if args.dry_run:
        return 0
    db = Turso()
    db.script(DDL)
    got = sync_rows(db, TABLE, ("geo_fips", "year", "line"), COLS, rows)
    write_doc(db, "bea_rpp_meta", {"newestYear": newest, "areas": counts})
    stamp_freshness(db, "bea-rpp", as_of=f"{newest}-12-31", source=SOURCE,
                    cadence="yearly", note=f"RPPs to {newest}: {counts}", max_age_days=900)
    record_run(db, SCRIPT, status="ok", rows_written=got["written"], note=f"{counts}; {got}", started_at=started)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Refusal as exc:
        log(f"REFUSED: {exc}")
        sys.exit(1)
