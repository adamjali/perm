#!/usr/bin/env python3
"""Load the O*NET database: what each occupation is, and what it takes.

WHAT IT IS. The O*NET database (National Center for O*NET Development, for the
Department of Labor's Employment and Training Administration) describes every
occupation in the SOC: a description, the tasks, the education workers in it
report needing, a Job Zone (how much preparation it takes, 1 to 5) and the
titles people use for it. DOL itself uses the Job Zones when it sets a
prevailing wage level, which is why they belong beside PERM figures.

LICENCE. CC BY 4.0. The pages that show it carry O*NET's own credit line, link
the licence, and say what we changed (we round the education shares and keep
the top tasks). "O*NET" is a trademark and is used only as an adjective.

WHAT'S KEPT, PER O*NET-SOC CODE: title, description, Job Zone, the Bright
Outlook categories from O*NET OnLine, and in `detail`: the education shares
(required level, each at 5% or more), up to eight titles workers report, the
top six core tasks by rated importance, and up to six related occupations.
One row per O*NET-SOC code (1,016 in release 31.0); `soc7` is the six-digit
SOC code the site's occupation pages are keyed by. A SOC code can carry
several O*NET codes (11-1011.00 and 11-1011.03); the page shows the `.00` one
first.

DISCOVERED, NEVER CONSTRUCTED: the CSV zip is found by its link on
onetcenter.org/database.html, so a new release is picked up when it appears.
Skipped when the zip's bytes match the last load.

Usage:
    python3 scripts/ingest_onet.py                 # discover, load if changed
    python3 scripts/ingest_onet.py --force         # reload even if unchanged
    python3 scripts/ingest_onet.py --dry-run       # parse and check, write nothing
    python3 scripts/ingest_onet.py --local ZIP [--bright CSV]
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gov_data import fetch, log  # noqa: E402
from lib_reference import keep_record, seen_before, sha256, sync_rows  # noqa: E402
from lib_turso import Turso, record_run, stamp_freshness, write_doc  # noqa: E402

SCRIPT = "ingest_onet.py"
# What the site prints as the source line: a readable name, never a bare URL (a URL has no
# spaces, so it can't wrap, and it pushed two pages sideways on a phone, Oct 5 2026).
SOURCE = "O*NET Database, USDOL/ETA (onetcenter.org)"
PAGE = "https://www.onetcenter.org/database.html"
HOST = "https://www.onetcenter.org"
BRIGHT_CSV = "https://www.onetonline.org/find/bright/All_Bright_Outlook_Occupations.csv?b=0&fmt=csv"
TABLE = "onet_occupations"
RECORD = "onet_load"
DOC = "onet_reference"
COLS = ("onet_code", "soc7", "title", "description", "job_zone", "bright", "detail")
CODE = re.compile(r"^\d{2}-\d{4}\.\d{2}$")
EDUCATION_FLOOR_PCT = 5.0
TOP_TASKS = 6
TOP_TITLES = 8
TOP_RELATED = 6
# A release with fewer occupations than this is not the full database.
MIN_OCCUPATIONS = 900

DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        onet_code TEXT PRIMARY KEY,
        soc7 TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        job_zone INTEGER,
        bright TEXT,
        detail TEXT NOT NULL)""",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_soc7 ON {TABLE} (soc7, onet_code)",
]


class Refusal(Exception):
    """A release that must not be written, with the reason."""


def read_csv(archive: zipfile.ZipFile, name: str) -> list[dict[str, str]]:
    member = next((m for m in archive.namelist() if m.endswith("/" + name) or m == name), None)
    if member is None:
        raise Refusal(f"{name} is missing from the release")
    with archive.open(member) as handle:
        return list(csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8-sig")))


def csv_zip_url(html: str) -> str | None:
    """The newest release's CSV zip, as the page itself names it.

    The page's buttons link the Excel zip in `href` and carry the CSV zip in a
    `data-href-csv` attribute and in the page's schema.org `contentURL`, so a
    finder that reads only hrefs sees no CSV at all (it ran that way once, on
    the server, Oct 5 2026).
    """
    found = re.findall(r"(/dl_files/database/db_(\d+)_(\d+)_csv\.zip)", html)
    if not found:
        return None
    path = max(found, key=lambda m: (int(m[1]), int(m[2])))[0]
    return HOST + path


def version_of(link_name: str) -> str | None:
    m = re.match(r"db_(\d+)_(\d+)_csv\.zip$", link_name)
    return f"{m.group(1)}.{m.group(2)}" if m else None


def parse(zip_bytes: bytes, bright_rows: list[dict[str, str]] | None,
          min_occupations: int = MIN_OCCUPATIONS) -> tuple[list[tuple], dict]:
    """The table rows and the reference doc, from the release zip."""
    archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    occs = read_csv(archive, "occupation_data.csv")
    zones = {r["O*NET-SOC Code"]: int(r["Job Zone"]) for r in read_csv(archive, "job_zones.csv")
             if r.get("Job Zone", "").strip().isdigit()}
    zone_ref = {
        int(r["Job Zone"]): {"name": r["Name"].strip(), "education": r["Education"].strip(),
                             "experience": r["Experience"].strip()}
        for r in read_csv(archive, "job_zone_reference.csv") if r.get("Job Zone", "").strip().isdigit()
    }
    levels = {r["Category"]: r["Category Description"].strip()
              for r in read_csv(archive, "education_categories.csv") if r.get("Scale ID") == "RL"}

    education: dict[str, list[tuple[int, float]]] = {}
    for r in read_csv(archive, "education.csv"):
        if r.get("Scale ID") != "RL" or r.get("Recommend Suppress") == "Y":
            continue
        try:
            education.setdefault(r["O*NET-SOC Code"], []).append((int(r["Category"]), float(r["Data Value"])))
        except ValueError:
            continue

    titles: dict[str, list[tuple[bool, str]]] = {}
    for r in read_csv(archive, "sample_of_reported_titles.csv"):
        titles.setdefault(r["O*NET-SOC Code"], []).append(
            (r.get("Shown in My Next Move") == "Y", r["Reported Job Title"].strip()))

    importance: dict[str, float] = {}
    for r in read_csv(archive, "task_ratings.csv"):
        if r.get("Scale ID") == "IM" and r.get("Recommend Suppress") != "Y":
            try:
                importance[r["Task ID"]] = float(r["Data Value"])
            except ValueError:
                pass
    tasks: dict[str, list[tuple[float, str]]] = {}
    for r in read_csv(archive, "task_statements.csv"):
        if r.get("Task Type") != "Core":
            continue
        tasks.setdefault(r["O*NET-SOC Code"], []).append((importance.get(r["Task ID"], 0.0), r["Task"].strip()))

    related: dict[str, list[tuple[int, str, str]]] = {}
    for r in read_csv(archive, "related_occupations.csv"):
        try:
            idx = int(r["Index"])
        except ValueError:
            continue
        related.setdefault(r["O*NET-SOC Code"], []).append(
            (idx, r["Related O*NET-SOC Code"], r["Related Title"].strip()))

    bright = {}
    for r in bright_rows or []:
        code = (r.get("Code") or "").strip()
        if CODE.match(code):
            bright[code] = "; ".join(c.strip() for c in (r.get("Categories") or "").split(";") if c.strip())

    rows: list[tuple] = []
    for o in occs:
        code = o["O*NET-SOC Code"].strip()
        if not CODE.match(code):
            continue
        shares = sorted(education.get(code, []))
        edu = [{"level": levels.get(str(cat), str(cat)), "pct": round(pct)}
               for cat, pct in shares if pct >= EDUCATION_FLOOR_PCT and str(cat) in levels]
        t = titles.get(code, [])
        picked = [name for shown, name in t if shown] + [name for shown, name in t if not shown]
        detail = {
            "education": edu,
            "titles": list(dict.fromkeys(picked))[:TOP_TITLES],
            "tasks": [text for _, text in sorted(tasks.get(code, []), key=lambda x: -x[0])[:TOP_TASKS]],
            "related": [{"code": c, "title": ti} for _, c, ti in sorted(related.get(code, []))[:TOP_RELATED]],
        }
        rows.append((code, code[:7], o["Title"].strip(), o["Description"].strip(), zones.get(code),
                     bright.get(code), json.dumps(detail, separators=(",", ":"), ensure_ascii=False)))

    if len(rows) < min_occupations:
        raise Refusal(f"only {len(rows)} occupations (expected {min_occupations}+)")
    with_zone = sum(1 for r in rows if r[4] is not None)
    if with_zone < len(rows) * 0.8:
        raise Refusal(f"only {with_zone} of {len(rows)} occupations carry a Job Zone")
    if len(zone_ref) < 4:
        raise Refusal(f"the Job Zone reference holds {len(zone_ref)} zones")
    newest = max((info.date_time for info in archive.infolist()), default=None)
    as_of = f"{newest[0]:04d}-{newest[1]:02d}-{newest[2]:02d}" if newest else time.strftime("%Y-%m-%d")
    reference = {"jobZones": {str(k): v for k, v in sorted(zone_ref.items())}, "asOf": as_of,
                 "brightCount": sum(1 for r in rows if r[5])}
    return rows, reference


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--local")
    ap.add_argument("--bright")
    args = ap.parse_args()
    started = time.time()

    if args.local:
        zip_bytes = open(args.local, "rb").read()
        version = version_of(os.path.basename(args.local)) or "local"
        bright_text = open(args.bright, encoding="utf-8-sig").read() if args.bright else ""
    else:
        url = csv_zip_url(fetch(PAGE).decode("utf-8", "replace"))
        if url is None:
            raise SystemExit("no O*NET CSV zip named on the database page")
        version = version_of(url.rsplit("/", 1)[-1]) or url
        log(f"O*NET {version}: {url}")
        zip_bytes = fetch(url, referer=PAGE)
        try:
            bright_text = fetch(BRIGHT_CSV).decode("utf-8-sig", "replace")
        except Exception as exc:  # noqa: BLE001 - the list is a bonus; the database isn't
            log(f"  Bright Outlook list unavailable ({exc}); loading without it")
            bright_text = ""
    bright_rows = list(csv.DictReader(io.StringIO(bright_text))) if bright_text else None
    digest = sha256(zip_bytes + bright_text.encode())

    try:
        rows, reference = parse(zip_bytes, bright_rows)
    except Refusal as exc:
        log(f"REFUSED: {exc}")
        if not args.dry_run:
            record_run(Turso(), SCRIPT, status="failed", note=f"refused: {exc}", started_at=started)
        return 1
    log(f"  {len(rows)} occupations, {sum(1 for r in rows if r[4])} with a Job Zone, "
        f"{reference['brightCount']} Bright Outlook")
    if args.dry_run:
        for r in rows[:2]:
            log(f"  {r[0]} {r[2]} zone {r[4]} bright {r[5]!r} {r[6][:160]}")
        return 0

    db = Turso()
    db.script(DDL)
    if not args.force and seen_before(db, RECORD, digest):
        log("  unchanged since the last load; nothing to write")
        record_run(db, SCRIPT, status="ok", rows_written=0, note=f"O*NET {version} unchanged", started_at=started)
        return 0
    counts = sync_rows(db, TABLE, ("onet_code",), COLS, rows)
    write_doc(db, DOC, {**reference, "version": version})
    keep_record(db, RECORD, digest, version=version, rows=len(rows))
    stamp_freshness(db, "onet", as_of=reference["asOf"], source=SOURCE, cadence="twice a year",
                    note=f"O*NET {version}: {len(rows)} occupations", max_age_days=300)
    record_run(db, SCRIPT, status="ok", rows_written=counts["written"],
               note=f"O*NET {version}: {counts}", started_at=started)
    log(f"  done: {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
