"""The National Visa Center's own timeframes, read weekly, for a green card through a consulate.

State publishes on its NVC Timeframes page, once a week, how far behind the National Visa Center
is: "As of 26-Oct-26, we are working on cases that were received from USCIS on 17-Oct-26" (a new
case is created about that long after USCIS sends it) and "we are reviewing documents submitted
to us on 18-Aug-26" (documents wait about that long for review). The planner dates consular
processing from these two lags; the consulate's own interview wait has no public figure.

Read from adoption.state.gov, State's second host for the same pages (travel.state.gov refuses
scripts; adoption.state.gov serves them and has no robots.txt rule against them, measured Oct 28
2026). Each new reading is appended to perm_docs['nvc_timeframes'] (the newest READINGS_KEPT), so
the planner can set a quick-to-slow range from recent weeks. A page that won't parse fails the run
and writes nothing: a guessed lag is worse than a missing one.

    python3 scripts/ingest_nvc_timeframes.py [--from-file page.html] [--dry-run] [--no-stamp]

`--no-stamp` stores the reading without registering the dataset's freshness row, for a preview
before the site that describes it ships (the health check fails a registered dataset
src/lib/datasetCoverage.ts doesn't describe).
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
import time

from lib_db import Database, read_doc, record_run, stamp_freshness, write_doc
from lib_gov_data import fetch

URL = "https://adoption.state.gov/content/travel/en/us-visas/immigrate/nvc-timeframes.html"
SOURCE = "The State Department's NVC Timeframes page"
DOC_KEY = "nvc_timeframes"
DATASET = "nvc-timeframes"
# A year of weekly readings: enough for a range, small enough to be one row.
READINGS_KEPT = 52
# State updates the page weekly; three weeks without a new reading is its page or our reader stopping.
MAX_AGE_DAYS = 21
SCRIPT = "ingest_nvc_timeframes.py"

DAY = r"(\d{1,2}-[A-Za-z]{3}-\d{2})"
CREATION = re.compile(rf"As of {DAY}, we are working on cases that were received from USCIS on {DAY}", re.I)
REVIEW = re.compile(rf"As of {DAY}, we are reviewing documents submitted to us on {DAY}", re.I)


def log(msg: str) -> None:
    print(msg, flush=True)


def day_of(text: str) -> str:
    """"26-Oct-26" to "2026-10-26"."""
    return dt.datetime.strptime(text, "%d-%b-%y").date().isoformat()


def parse(html: str) -> dict:
    """The two readings, each with the day it's as of and the day it has reached. Raises if either is missing."""
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
    c, r = CREATION.search(text), REVIEW.search(text)
    if not c or not r:
        raise ValueError("the NVC Timeframes page no longer says what it said: no creation or review line")
    as_of = max(day_of(c.group(1)), day_of(r.group(1)))
    created, reviewed = day_of(c.group(2)), day_of(r.group(2))
    lag = lambda on, through: (dt.date.fromisoformat(on) - dt.date.fromisoformat(through)).days  # noqa: E731
    out = {
        "asOf": as_of,
        "createdThrough": created,
        "reviewedThrough": reviewed,
        "creationLagDays": lag(day_of(c.group(1)), created),
        "reviewLagDays": lag(day_of(r.group(1)), reviewed),
    }
    if not (0 <= out["creationLagDays"] <= 365 and 0 <= out["reviewLagDays"] <= 730):
        raise ValueError(f"a lag outside what the page could mean: {out}")
    return out


def merged(doc: dict | None, reading: dict) -> tuple[dict, bool]:
    """The stored readings with this one added once, newest first, at most READINGS_KEPT."""
    held = list((doc or {}).get("readings") or [])
    if any(r.get("asOf") == reading["asOf"] for r in held):
        return {"readings": held}, False
    readings = sorted([reading, *held], key=lambda r: r["asOf"], reverse=True)[:READINGS_KEPT]
    return {"readings": readings}, True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--from-file")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-stamp", action="store_true")
    args = ap.parse_args()
    started = time.time()
    html = open(args.from_file, encoding="utf8").read() if args.from_file else fetch(URL).decode("utf8", "replace")
    reading = parse(html)
    log(f"NVC as of {reading['asOf']}: creating cases received {reading['createdThrough']} "
        f"({reading['creationLagDays']} days), reviewing documents sent {reading['reviewedThrough']} "
        f"({reading['reviewLagDays']} days)")
    if args.dry_run:
        return 0
    db = Database()
    doc, new = merged(read_doc(db, DOC_KEY), reading)
    if new:
        write_doc(db, DOC_KEY, doc)
    if not args.no_stamp:
        stamp_freshness(db, DATASET, as_of=reading["asOf"], source=SOURCE, cadence="weekly, read daily",
                        note=f"{len(doc['readings'])} readings held", max_age_days=MAX_AGE_DAYS)
    record_run(db, SCRIPT, status="ok", rows_written=1 if new else 0,
               note=f"as of {reading['asOf']}" + ("" if new else ", already held"), started_at=started)
    log("stored" if new else "already held")
    return 0


if __name__ == "__main__":
    sys.exit(main())
