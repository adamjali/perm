#!/usr/bin/env python3
"""Per-filing-month PERM queue statistics, including PENDING cases.

WHAT THIS CLOSES, AND WHY IT NEEDED A CORRECTION FIRST. I told Adam the rival
had no live per-case data, based on /api/cases (their disclosure browser,
which stops at the quarterly boundary) and a `sources` block that only flags
`pwd` as live. Both readings were right and the conclusion was wrong: there is
a whole /api/watchlist/* family I had not found, and it serves 416,407 cases
INCLUDING pending ones, each with a last_checked_at timestamp.

Measured against our own complete disclosure counts, their coverage on
fully-decided months is 99-102%. It is not a sample. On recent months they
hold 9,677 and 5,390 cases where our disclosure data has 413 and 168, because
DOL's files contain no pending rows at all. That gap is real, it is their
scanner, and it is the one thing they have that we cannot derive.

WHY AGGREGATES RATHER THAN ROWS. Their /api/watchlist pages at 200 rows, so
copying the row store would be 2,082 requests against their server.
/api/watchlist/month-stats returns exactly the aggregates a queue calculator
needs - total, pending, decided, and the RFI/audit/appeal split - in ONE
request per month. Thirty-six requests instead of two thousand. We are
reading published statistics, not cloning a database, and that is both the
politer and the more defensible thing to do.

Adam authorized this explicitly and repeatedly, with the reviewing attorney
requesting it. Every row records where it came from, and the intent is that
this is a bridge: the durable version is applicants adding their own case
numbers to us, which owes nobody anything.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso  # noqa: E402

BASE = "https://permtrack.app/api/watchlist"
UA = {"User-Agent": "permtracker.app month-stats (contact: notifications@permtracker.app)",
      "Accept": "application/json"}
SOURCE = "permtrack.app/api/watchlist/month-stats (mirror; underlying: flag.dol.gov per-case status)"

# The fields we take are counts of government case states. Their derived
# predictions (estimated dates, letter distributions used for forecasting)
# are deliberately not stored.
FIELDS = ["total", "pending", "decided", "analyst_review", "rfi_issued",
          "audit_response", "appeals", "certified", "denied", "withdrawn"]


def log(m: str) -> None:
    print(m, flush=True)


def get(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read())


def months(start: str, end: str) -> list[str]:
    y, m = (int(x) for x in start.split("-"))
    ey, em = (int(x) for x in end.split("-"))
    out = []
    while (y, m) <= (ey, em):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def main() -> int:
    db = Turso()
    db.execute("""CREATE TABLE IF NOT EXISTS perm_month_stats (
        filing_month TEXT PRIMARY KEY,
        total INTEGER, pending INTEGER, decided INTEGER,
        analyst_review INTEGER, rfi_issued INTEGER, audit_response INTEGER,
        appeals INTEGER, certified INTEGER, denied INTEGER, withdrawn INTEGER,
        source TEXT NOT NULL, fetched_at INTEGER NOT NULL)""")

    today = dt.date.today()
    # Their corpus starts around FY2024; go a little wider and let empty
    # months fall out rather than hardcoding a boundary that will age.
    wanted = months("2023-10", f"{today.year:04d}-{today.month:02d}")
    stamp = int(time.time() * 1000)

    stored = skipped = 0
    for m in wanted:
        try:
            d = get(f"{BASE}/month-stats?month={m}")
        except urllib.error.HTTPError as e:
            log(f"    {m}: HTTP {e.code}, skipping")
            skipped += 1
            time.sleep(1.0)
            continue
        except Exception as e:  # network, timeout - never fatal
            log(f"    {m}: {type(e).__name__}, skipping")
            skipped += 1
            time.sleep(1.0)
            continue
        if not isinstance(d, dict) or d.get("error") or not d.get("total"):
            skipped += 1
            time.sleep(0.6)
            continue
        vals = [int(d.get(f) or 0) for f in FIELDS]
        db.execute(
            "INSERT OR REPLACE INTO perm_month_stats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [m, *vals, SOURCE, stamp])
        stored += 1
        log(f"    {m}: total={vals[0]:>7,} pending={vals[1]:>7,} "
            f"decided={vals[2]:>7,} analyst={vals[3]:>7,} rfi={vals[4]:>5,}")
        time.sleep(0.6)   # polite: ~36 requests, spaced

    if stored == 0:
        raise SystemExit("stored no months - refusing to report success")

    tot = int(db.scalar("SELECT sum(total) FROM perm_month_stats") or 0)
    pend = int(db.scalar("SELECT sum(pending) FROM perm_month_stats") or 0)
    log(f"  VERIFY {stored} months stored ({skipped} skipped) | "
        f"{tot:,} cases | {pend:,} pending")

    db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
        dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
        source TEXT, cadence TEXT, note TEXT)""")
    newest = db.scalar("SELECT max(filing_month) FROM perm_month_stats")
    db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?)",
               ["perm-month-stats", str(newest), stamp, SOURCE, "Daily",
                f"{pend:,} cases pending across {stored} filing months. "
                f"Pending counts are not in DOL's disclosure files, which "
                f"carry decided cases only."])
    return 0


if __name__ == "__main__":
    sys.exit(main())
