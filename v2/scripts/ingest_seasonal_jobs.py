#!/usr/bin/env python3
"""DOL's SeasonalJobs data feeds: H-2A and H-2B applications DOL has accepted.

WHAT IT IS. SeasonalJobs.dol.gov publishes three files a day, "updated daily
at midnight Eastern Time": H-2A applications (`h2a`, H-300- numbers), H-2B
applications (`h2b`, H-400-) and H-2A job orders (`jo`, JO-A-300-). Each lists
the cases DOL accepted in about the last three weeks, with what the live
case-status service never returns: the wage, the workers wanted, the work
period and where the work is. That makes it the seasonal programs' equivalent
of the live remainder: a decided case arrives later in DOL's quarterly file
(h2a_cases, h2b_cases), and the status comes from the daily sweep
(seasonal_case_status); this is the job itself, before either.

    https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/<feed>/<YYYY-MM-DD>

A zip of one JSON array. Measured Oct 3 2026: a plain request gets 200 from
this laptop and from the server. The first day DOL serves is 2024-02-25
(Feb 24 answers 404 for all three feeds, Feb 25 answers 200), and that file
reaches back to applications accepted on 2024-02-06. Nothing earlier exists
in this form; older H-2A and H-2B cases are in DOL's quarterly files instead.

NO CONTACT DATA, AND NO STREET ADDRESSES. Every record carries the employer's
and the attorney's names, emails and phones, preparers' names, FEINs, and the
worksite's street address and postcode, which on a family farm is often a
home. None of those is read here. The worksite is kept to city, county and
state, as every other source on the site is.

ONE ROW PER CASE in `seasonal_postings`, upserted: a case appears in about
twenty consecutive daily files, so `first_seen` keeps the earliest file date
and `last_seen` the latest. A backfill therefore needs one file a week, not
one a day (each file spans about three weeks of acceptances).

    python3 scripts/ingest_seasonal_jobs.py                       # today's files (or yesterday's)
    python3 scripts/ingest_seasonal_jobs.py --from 2024-02-25 --to 2026-10-03 --step 7
    python3 scripts/ingest_seasonal_jobs.py --dry-run --local DIR # parse saved files, write nothing
"""
from __future__ import annotations

import argparse
import datetime
import io
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request
import zipfile
from zoneinfo import ZoneInfo

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_slugs import slugify  # noqa: E402
from lib_turso import Turso, add_missing_columns, record_run, run_stmts, stamp_freshness, stmt  # noqa: E402

SCRIPT = "ingest_seasonal_jobs.py"
DATASET = "seasonal-postings"
BASE = "https://api.seasonaljobs.dol.gov/datahub-search/sjCaseData/zip/{feed}/{day}"
FEEDS = ("h2a", "h2b", "jo")
FIRST_DAY = datetime.date(2024, 2, 25)
ET = ZoneInfo("America/New_York")
# A named agent: DOL's API answers it, and a default Python one is refused by
# more than one service behind Cloudflare (see permtracker-defend).
USER_AGENT = "permtracker-ingest/1.0 (+https://permtracker.app)"
NAME_LEN = 80

TABLE = "seasonal_postings"
COLUMNS = (
    "case_number", "feed", "visa", "employer_name", "employer_slug", "employer_city",
    "employer_state", "naics", "job_title", "soc_code", "soc_title", "workers",
    "workers_foreign", "begin_date", "end_date", "wage", "wage_unit", "worksite_city",
    "worksite_county", "worksite_state", "job_order_number", "pwd_number",
    "submitted_date", "accepted_date", "first_seen", "last_seen",
)
DDL = f"""
  CREATE TABLE IF NOT EXISTS {TABLE} (
    case_number TEXT PRIMARY KEY,
    feed TEXT NOT NULL,
    visa TEXT NOT NULL,
    employer_name TEXT, employer_slug TEXT, employer_city TEXT, employer_state TEXT,
    naics TEXT, job_title TEXT, soc_code TEXT, soc_title TEXT,
    workers INTEGER, workers_foreign INTEGER,
    begin_date TEXT, end_date TEXT, wage REAL, wage_unit TEXT,
    worksite_city TEXT, worksite_county TEXT, worksite_state TEXT,
    job_order_number TEXT, pwd_number TEXT,
    submitted_date TEXT, accepted_date TEXT,
    first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
  )"""
INDEXES = (
    f"CREATE INDEX IF NOT EXISTS {TABLE}_emp ON {TABLE} (employer_slug, accepted_date)",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_accepted ON {TABLE} (accepted_date)",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_state ON {TABLE} (worksite_state, accepted_date)",
)


def log(msg: str) -> None:
    print(msg, flush=True)


# --- parsing ------------------------------------------------------------------

def text(v, limit: int = NAME_LEN) -> str | None:
    if v is None:
        return None
    s = " ".join(str(v).split())
    return s[:limit] if s else None


def number(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f >= 0 else None


def count(v) -> int | None:
    f = number(v)
    return int(f) if f is not None else None


def day(v) -> str | None:
    """'02-Dec-2026' or '2026-10-02T18:40:01.930Z' -> '2026-12-02' / '2026-10-02'."""
    if not v:
        return None
    s = str(v).strip()
    for fmt in ("%d-%b-%Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(s[:11] if fmt == "%d-%b-%Y" else s[:10], fmt).date().isoformat()
        except ValueError:
            continue
    return None


def state(v) -> str | None:
    """A two-letter code, judged before any truncation ("Georgia" is not "GE")."""
    s = text(v, 60)
    return s.upper() if s and len(s) == 2 and s.isalpha() else None


def county(v) -> str | None:
    s = text(v, 60)
    if not s:
        return None
    s = s.title()
    return s[:-7] if s.endswith(" County") else s


def unit(v) -> str | None:
    s = text(v, 20)
    return s.upper() if s else None


def soc(v) -> str | None:
    s = text(v, 10)
    return s if s and s[:2].isdigit() else None


def naics(v) -> str | None:
    s = text(v, 6)
    return s if s and s.isdigit() else None


def parse(feed: str, rec: dict, file_day: str) -> dict | None:
    """One feed record -> one row, or None without a case number. Contact
    fields, preparers, FEINs and street addresses are never read."""
    cn = text(rec.get("caseNumber"), 40)
    if not cn:
        return None
    employer = text(rec.get("empBusinessName"))
    row = {
        "case_number": cn.upper(), "feed": feed, "visa": "H-2B" if feed == "h2b" else "H-2A",
        "employer_name": employer, "employer_slug": slugify(employer) if employer else None,
        "employer_city": text(rec.get("empCity"), 60), "employer_state": state(rec.get("empState")),
        "naics": naics(rec.get("empNaics")),
        "job_title": None, "soc_code": None, "soc_title": None, "workers": None, "workers_foreign": None,
        "begin_date": None, "end_date": None, "wage": None, "wage_unit": None,
        "worksite_city": None, "worksite_county": None, "worksite_state": None,
        "job_order_number": None, "pwd_number": None,
        "submitted_date": day(rec.get("dateSubmitted") or rec.get("dateApplicationSubmitted")),
        "accepted_date": day(rec.get("dateAcceptanceLtrIssued")),
        "first_seen": file_day, "last_seen": file_day,
    }
    if feed == "h2b":
        row.update(
            job_title=text(rec.get("tempneedJobtitle")), soc_code=soc(rec.get("tempneedSoc")),
            soc_title=text(rec.get("tempneedSocTitle")),
            workers=count(rec.get("tempneedWkrPos")), workers_foreign=count(rec.get("tempneedWkrPos")),
            begin_date=day(rec.get("tempneedStart")), end_date=day(rec.get("tempneedEnd")),
            wage=number(rec.get("wageFrom")), wage_unit=unit(rec.get("wagePer")),
            worksite_city=text(rec.get("jobCity"), 60), worksite_county=county(rec.get("jobCounty")),
            worksite_state=state(rec.get("jobState")), pwd_number=text(rec.get("jobPwdNumber"), 40),
        )
        return row
    # The H-2A application carries its job order inline; a job order is its own record.
    jo = rec.get("clearanceOrder") if feed == "h2a" else rec
    if isinstance(jo, list):
        jo = jo[0] if jo else None
    jo = jo or {}
    row.update(
        job_title=text(jo.get("jobTitle")),
        soc_code=soc(rec.get("jobSoc") or jo.get("socCode")),
        soc_title=text(rec.get("jobSocTitle") or jo.get("socTitle")),
        workers=count(jo.get("jobWrksNeeded")), workers_foreign=count(jo.get("jobWrksNeededH2a")),
        begin_date=day(jo.get("jobBeginDate")), end_date=day(jo.get("jobEndDate")),
        wage=number(jo.get("jobWageOffer")), wage_unit=unit(jo.get("jobWagePer")),
        worksite_city=text(jo.get("jobCity"), 60), worksite_county=county(jo.get("jobCounty")),
        worksite_state=state(jo.get("jobState")),
        job_order_number=text(rec.get("jobOrderNumber") or jo.get("jobOrderNumber"), 40) if feed == "h2a" else None,
    )
    return row


def read_zip(blob: bytes) -> list[dict]:
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        names = [n for n in z.namelist() if n.endswith(".json")]
        if len(names) != 1:
            raise ValueError(f"expected one JSON file in the zip, found {names}")
        data = json.loads(z.read(names[0]))
    if not isinstance(data, list):
        raise ValueError("expected a JSON array")
    return data


# --- fetching -----------------------------------------------------------------

def fetch(feed: str, file_day: str, attempts: int = 4) -> bytes | None:
    """The day's zip, or None when DOL has not published that day (404)."""
    url = BASE.format(feed=feed, day=file_day)
    last: Exception | None = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last = e
        except (urllib.error.URLError, OSError) as e:
            last = e
        time.sleep(5 * (i + 1))
    raise RuntimeError(f"{feed} {file_day}: {last}")


# --- writing ------------------------------------------------------------------

def ensure_schema(db) -> None:
    db.execute(DDL, [])
    add_missing_columns(db, TABLE, {c: "TEXT" for c in COLUMNS})
    for sql in INDEXES:
        db.execute(sql, [])


UPSERT = (
    f"INSERT INTO {TABLE} ({', '.join(COLUMNS)}) VALUES ({', '.join('?' * len(COLUMNS))}) "
    "ON CONFLICT(case_number) DO UPDATE SET "
    + ", ".join(f"{c} = COALESCE(excluded.{c}, {c})"
                for c in COLUMNS if c not in ("case_number", "first_seen", "last_seen"))
    + ", first_seen = MIN(first_seen, excluded.first_seen), last_seen = MAX(last_seen, excluded.last_seen)"
)


def write(db, rows: list[dict]) -> int:
    if not rows:
        return 0
    run_stmts(db, (stmt(UPSERT, [r[c] for c in COLUMNS]) for r in rows), per_request=200)
    return len(rows)


# --- main ---------------------------------------------------------------------

def days_between(a: datetime.date, b: datetime.date, step: int) -> list[str]:
    out, d = [], b
    while d >= a:
        out.append(d.isoformat())
        d -= datetime.timedelta(days=step)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--from", dest="frm")
    ap.add_argument("--to")
    ap.add_argument("--step", type=int, default=7, help="days between files in a backfill (default 7)")
    ap.add_argument("--pace", type=float, default=2.0, help="seconds between downloads")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--local", help="parse <feed>.zip files saved in this folder instead of downloading")
    a = ap.parse_args(argv)
    started = time.time()
    today = datetime.datetime.now(ET).date()
    if a.frm or a.to:
        lo = max(FIRST_DAY, datetime.date.fromisoformat(a.frm) if a.frm else FIRST_DAY)
        hi = datetime.date.fromisoformat(a.to) if a.to else today
        days = days_between(lo, hi, a.step)
    else:
        # Today's files appear after midnight Eastern; before they do, yesterday's are current.
        days = [today.isoformat(), (today - datetime.timedelta(days=1)).isoformat()]
    db = None if a.dry_run else Turso()
    if db is not None:
        ensure_schema(db)
    totals = {f: 0 for f in FEEDS}
    newest: str | None = None
    try:
        for d in days:
            got_day = False
            for feed in FEEDS:
                if a.local:
                    p = pathlib.Path(a.local) / f"{feed}.zip"
                    blob = p.read_bytes() if p.exists() else None
                else:
                    blob = fetch(feed, d)
                    time.sleep(a.pace)
                if blob is None:
                    continue
                rows = [r for r in (parse(feed, rec, d) for rec in read_zip(blob)) if r]
                got_day = True
                totals[feed] += len(rows)
                log(f"  {d} {feed}: {len(rows):,} cases")
                if db is not None:
                    write(db, rows)
            if got_day:
                newest = max(newest or d, d)
                if not (a.frm or a.to):
                    break   # the daily run wants the newest day published, once
    except Exception as e:
        if db is not None:
            record_run(db, SCRIPT, status="failed", rows_written=sum(totals.values()),
                       note=str(e)[:300], started_at=started)
        raise
    note = ", ".join(f"{f} {n:,}" for f, n in totals.items()) + f" cases from {len(days)} day(s)"
    log(f"done: {note}")
    if db is None:
        return 0
    if newest is None:
        record_run(db, SCRIPT, status="failed", note=f"no SeasonalJobs file published for {days[0]} or after")
        return 1
    if not (a.frm or a.to) or newest >= (today - datetime.timedelta(days=2)).isoformat():
        stamp_freshness(db, DATASET, as_of=newest, source="SeasonalJobs.dol.gov data feeds (DOL)",
                        cadence="Daily", note=note, max_age_days=4)
    record_run(db, SCRIPT, status="ok", rows_written=sum(totals.values()), note=note, started_at=started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
