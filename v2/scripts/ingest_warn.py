#!/usr/bin/env python3
"""WARN notices, matched to the PERM sponsors in the record. California first.

    python3 scripts/ingest_warn.py                    # fetch California's report, write
    python3 scripts/ingest_warn.py --dry-run          # print, write nothing
    python3 scripts/ingest_warn.py --from-file x.xlsx # parse a saved report

WHAT THIS IS. The Worker Adjustment and Retraining Notification Act makes an
employer file 60 days' notice of a mass layoff or closing with the state,
and some states publish the notices. DOL's PERM files record no layoff, so a
WARN notice is the only public trace of one, and 20 CFR 656.17(k) makes a
layoff in the six months before filing something the employer has to
account for. Each notice becomes one row in `warn_notices`, matched to a
sponsor when the employer's normalised name (`entity_identity.entity_key`,
the same rule the entity table is keyed on) equals a PERM employer's
`merge_key`. An exact key match only: a prefix match would attach a
foundation's layoff to a company that shares its first word.

PARTIAL BY DESIGN. California publishes a spreadsheet with a stable shape
(edd.ca.gov, the "Detailed WARN Report" sheet), so it is read. Texas answers
scripts with a challenge page, Washington keeps a database behind a search
form, New York publishes an HTML list; none is read yet, and the page that
shows these notices says so. Adding a state means a parser for its file and
the same row shape; nothing else changes.

WHAT IT IS NOT. A layoff count for an employer, or a judgment about one. A
notice is one filing as the state printed it, with the state's own numbers.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from entity_identity import entity_key  # noqa: E402
from lib_turso import Turso, record_run, stamp_freshness  # noqa: E402

CA_URL = "https://edd.ca.gov/siteassets/files/jobs_and_training/warn/warn_report1.xlsx"
CA_PAGE = "https://edd.ca.gov/en/jobs_and_training/Layoff_Services_WARN/"
DATASET = "warn-notices"
MAX_AGE_DAYS = 21
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

DDL = [
    """CREATE TABLE IF NOT EXISTS warn_notices (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        notice_date TEXT NOT NULL,
        effective_date TEXT,
        company TEXT NOT NULL,
        kind TEXT,
        employees INTEGER,
        county TEXT,
        industry TEXT,
        employer_slug TEXT,
        source_url TEXT NOT NULL,
        fetched_at INTEGER NOT NULL)""",
    "CREATE INDEX IF NOT EXISTS warn_notices_slug ON warn_notices (employer_slug, notice_date DESC)",
    "CREATE INDEX IF NOT EXISTS warn_notices_date ON warn_notices (notice_date DESC)",
]


def log(msg: str) -> None:
    print(f"[warn] {msg}", flush=True)


def _date(v) -> str | None:
    if v is None or v == "":
        return None
    if isinstance(v, (dt.datetime, dt.date)):
        return v.date().isoformat() if isinstance(v, dt.datetime) else v.isoformat()
    s = str(v).strip()[:10]
    try:
        return dt.date.fromisoformat(s).isoformat()
    except ValueError:
        return None


def _int(v) -> int | None:
    try:
        return int(float(str(v).replace(",", "")))
    except (TypeError, ValueError):
        return None


def parse_california(xlsx_bytes: bytes) -> list[dict]:
    """The 'Detailed WARN Report' sheet: one row per notice, columns resolved by header name."""
    import openpyxl  # the runner installs it; the laptop's miniconda has it

    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), read_only=True, data_only=True)
    sheet = next((n for n in wb.sheetnames if "detailed" in n.lower() and "warn" in n.lower()), None)
    if not sheet:
        raise ValueError(f"no detailed WARN sheet; sheets are {wb.sheetnames}")
    rows = [r for r in wb[sheet].iter_rows(values_only=True)]
    header_i = next((i for i, r in enumerate(rows) if r and any(isinstance(c, str) and "company" in c.lower() for c in r)), None)
    if header_i is None:
        raise ValueError("no header row naming a company column")
    header = [str(c or "").lower().replace("\n", " ").strip() for c in rows[header_i]]

    def col(*needles: str) -> int | None:
        for i, h in enumerate(header):
            if all(n in h for n in needles):
                return i
        return None

    c_county, c_notice, c_effective = col("county"), col("notice", "date"), col("effective")
    c_company, c_kind, c_n, c_industry = col("company"), col("layoff"), col("employees"), col("industry")
    c_address = col("address")
    if c_company is None or c_notice is None:
        raise ValueError(f"company or notice-date column missing; header={header}")
    out: list[dict] = []
    for r in rows[header_i + 1 :]:
        if not r or r[c_company] in (None, ""):
            continue
        company = str(r[c_company]).strip()
        notice = _date(r[c_notice])
        if not notice:
            continue
        effective = _date(r[c_effective]) if c_effective is not None else None
        county = str(r[c_county]).strip() if c_county is not None and r[c_county] else None
        out.append(
            {
                "state": "CA",
                "notice_date": notice,
                "effective_date": effective,
                "company": company,
                "kind": str(r[c_kind]).strip() if c_kind is not None and r[c_kind] else None,
                "employees": _int(r[c_n]) if c_n is not None else None,
                "county": county,
                "industry": str(r[c_industry]).strip() if c_industry is not None and r[c_industry] else None,
                "source_url": CA_PAGE,
                "_address": str(r[c_address]).strip() if c_address is not None and r[c_address] else "",
            }
        )
    # One employer can file several notices on one day for several sites, and
    # the report has printed identical rows outright; the address and count
    # separate the first, a sequence number the second. Row order is stable
    # between downloads of the same report, so the ids are stable too.
    seen: dict[str, int] = {}
    for row in out:
        base = "|".join([row["state"], row["notice_date"], row["company"], row["effective_date"] or "", row["county"] or "", row.pop("_address"), str(row["employees"])])
        n = seen.get(base, 0)
        seen[base] = n + 1
        row["id"] = hashlib.sha1(f"{base}|{n}".encode()).hexdigest()[:16]
    return out


def match_employers(db: Turso, rows: list[dict]) -> int:
    """Attach a sponsor slug where the normalised name equals a PERM employer's merge key."""
    keys = sorted({entity_key(r["company"]) for r in rows if r["company"]})
    slug_by_key: dict[str, str] = {}
    for i in range(0, len(keys), 100):
        chunk = keys[i : i + 100]
        marks = ",".join("?" * len(chunk))
        res = db.execute(f"SELECT merge_key, slug, total FROM perm_entities WHERE kind = 'employer' AND merge_key IN ({marks}) ORDER BY total DESC", chunk)
        for r in res["response"]["result"]["rows"]:
            vals = [None if c["type"] == "null" else c["value"] for c in r]
            slug_by_key.setdefault(str(vals[0]), str(vals[1]))  # busiest spelling wins
    n = 0
    for r in rows:
        slug = slug_by_key.get(entity_key(r["company"]))
        r["employer_slug"] = slug
        n += 1 if slug else 0
    return n


def write(db: Turso, rows: list[dict]) -> int:
    db.script(DDL)
    res = db.execute("SELECT id, employees, employer_slug FROM warn_notices WHERE state = 'CA'")
    have = {}
    for r in res["response"]["result"]["rows"]:
        vals = [None if c["type"] == "null" else c["value"] for c in r]
        have[vals[0]] = (vals[1], vals[2])
    now = int(time.time() * 1000)
    written = 0
    for r in rows:
        if have.get(r["id"]) == (r["employees"], r.get("employer_slug")):
            continue
        db.execute(
            "INSERT OR REPLACE INTO warn_notices VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            [r["id"], r["state"], r["notice_date"], r["effective_date"], r["company"], r["kind"], r["employees"], r["county"], r["industry"], r.get("employer_slug"), r["source_url"], now],
        )
        written += 1
    return written


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from-file")
    a = ap.parse_args()
    started = time.time()
    raw = open(a.from_file, "rb").read() if a.from_file else fetch(CA_URL)
    rows = parse_california(raw)
    log(f"California: {len(rows)} notices, {min(r['notice_date'] for r in rows)} to {max(r['notice_date'] for r in rows)}")
    if not rows:
        log("no rows parsed; refusing to write")
        return 1
    db = Turso()
    matched = match_employers(db, rows)
    log(f"matched {matched} of {len(rows)} to a PERM sponsor by merge key")
    if a.dry_run:
        for r in [x for x in rows if x.get("employer_slug")][:8]:
            print(json.dumps(r))
        return 0
    written = write(db, rows)
    stamp_freshness(db, DATASET, as_of=max(r["notice_date"] for r in rows), source=CA_PAGE, cadence="Weekly", note=f"California: {len(rows)} notices, {matched} matched, {written} written", max_age_days=MAX_AGE_DAYS)
    record_run(db, "ingest_warn.py", status="ok", rows_written=written, note=f"CA {len(rows)} parsed, {matched} matched", started_at=started)
    log(f"wrote {written}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
