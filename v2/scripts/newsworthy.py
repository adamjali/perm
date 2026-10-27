#!/usr/bin/env python3
"""The evening check: what moved since the morning report, for the owner's inbox.

    python3 scripts/newsworthy.py --out news.json

Writes {"day": "YYYY-MM-DD", "since": ms, "items": [line, ...]} for
`convex/newsworthy.ts`, which emails the owner only when the list isn't empty.
The window opens at 7:00 AM Eastern today (the morning report covers the 24
hours before it), so an item is in one evening email and the next morning's
report, never in two emails.

THIS REPOSITORY'S ACTIONS LOGS ARE PUBLIC. stdout is one word ("found" or
"none"), never a line or a figure; the lines go to the file only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import sys
import time
from zoneinfo import ZoneInfo

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import lib_newsworthy as nw  # noqa: E402

ET = ZoneInfo("America/New_York")
MORNING_HOUR = 7


def window_start(now: dt.datetime) -> int:
    """7:00 AM Eastern on the day `now` falls on (yesterday's, before 7 AM)."""
    local = now.astimezone(ET)
    start = local.replace(hour=MORNING_HOUR, minute=0, second=0, microsecond=0)
    if local < start:
        start -= dt.timedelta(days=1)
    return int(start.timestamp() * 1000)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    from lib_db import Database  # noqa: PLC0415

    now = dt.datetime.now(dt.timezone.utc)
    now_ms = int(time.time() * 1000)
    since = window_start(now)
    items = nw.newsworthy(nw.read_inputs(Database(), since), since, now_ms)
    pathlib.Path(args.out).write_text(json.dumps({
        "day": now.astimezone(ET).date().isoformat(), "since": since, "items": [nw.line(i) for i in items]}))
    found = "true" if items else "false"
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as fh:
            fh.write(f"found={found}\n")
    print("found" if items else "none")
    return 0


if __name__ == "__main__":
    sys.exit(main())
