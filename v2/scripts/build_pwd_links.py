"""Each decided PERM linked to the wage request it names: how employers, law firms and jobs time it.

DOL's PERM file names each case's wage request (`pwd_number`), and its wage-request file dates
each determination. Joined, they answer two questions no single file can:

  - how long after the wage determination the PERM went in (the employer's recruitment and
    preparation, the part of the process it controls), and
  - how soon after the quiet period ended it was filed: recruitment's last step plus 30 days is
    the first day a PERM may be filed (20 C.F.R. § 656.17(e)), and a firm that files within two
    weeks of it is moving as fast as the rules allow.

Only wage requests determined long enough ago that their PERMs have been decided count. A PERM
shows up here only once DOL decides it, so a recent determination's linked cases are the ones
filed fastest, and every figure would lean early. The window ends a wage determination's longest
life (a year) plus how long DOL took on three in four recent decisions before the newest decision
DOL published. It starts at the later of where the oldest wage-request file loaded begins and the
first filing month DOL's PERM file carries the wage request's number for (June 2023, when PERM
moved to the new Form 9089; 0% before, 99.7% after, measured Oct 28 2026): a PERM filed earlier
can't be linked, so an earlier determination would be read only through its slow filers. Both
edges are stored on every row, so the page says which determinations it read.

Not counted, on purpose: how many of an employer's wage requests a PERM followed. DOL's live
record doesn't name a pending PERM's wage request, so an employer with its PERMs on hold (Amazon,
Oct 28 2026: 2,479 wage requests in the window, 10 named by a decided PERM, 1,329 PERMs pending)
would read as one that rarely files.

Written to `perm_pwd_stats`, one row per employer, law firm and job (SOC group), plus one for
every case together, only where the page's own floor holds: MIN_DECIDED_FOR_MEDIAN (10) linked
cases, as the employer page's medians use (src/lib/entityPayload.ts). Statistics, never a rating.

Runs after the quarterly PERM load and the monthly wage-request load (both workflows), and
stamps `perm-pwd-links`, so the health check sees it stop.

    python3 scripts/build_pwd_links.py [--dry-run] [--no-stamp] [--show attorney:fragomen-del-rey-...]

`--no-stamp` writes the table without registering the dataset's freshness row: for a preview
before the site that describes the dataset ships, since the health check fails a registered
dataset src/lib/datasetCoverage.ts doesn't describe yet.
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
import time
from collections import defaultdict

from lib_db import Database, query_rows, record_run, stamp_freshness
from lib_recruitment import quiet_period_end
from lib_reference import sync_rows

TABLE = "perm_pwd_stats"
COLS = [
    "kind", "slug", "linked", "clients",
    "pwd_to_perm_p25", "pwd_to_perm_p50", "pwd_to_perm_p75",
    "quiet_n", "quiet_to_file_p50", "quiet_within",
    "from_day", "to_day",
]
DDL = f"""CREATE TABLE IF NOT EXISTS {TABLE} (
    kind TEXT NOT NULL,
    slug TEXT NOT NULL,
    linked INTEGER NOT NULL,
    clients INTEGER,
    pwd_to_perm_p25 INTEGER, pwd_to_perm_p50 INTEGER, pwd_to_perm_p75 INTEGER,
    quiet_n INTEGER, quiet_to_file_p50 INTEGER, quiet_within INTEGER,
    from_day TEXT, to_day TEXT,
    PRIMARY KEY (kind, slug))"""

# The employer page's floor for a median (MIN_DECIDED_FOR_MEDIAN in src/lib/entityPayload.ts).
MIN_LINKED = 10
# "Filed within two weeks of the quiet period's end": as soon as the rules allow, give or take.
WITHIN_DAYS = 14
# A gap longer than this is a typo in one of DOL's dates, not a plan: a determination is valid
# a year at most, and a PERM filed on it is filed within that year.
MAX_GAP_DAYS = 3 * 365
# A wage determination is valid a year at most (20 C.F.R. § 656.40(c)), so a PERM filed on one
# goes in within about this long; the window's end allows for it.
DETERMINATION_LIFE_DAYS = 365
# The share of recent PERM decisions DOL had reached by the window's end allowance.
DECIDED_SHARE = 0.75
# A filing month counts as carrying the wage request's number when this share of its decided cases do.
NUMBERED_SHARE = 0.95
# The every-case row's kind and slug.
ALL = ("all", "")
PAGE = 50_000


def log(msg: str) -> None:
    print(msg, flush=True)


def days(a: str | None, b: str | None) -> int | None:
    try:
        return (dt.date.fromisoformat(str(b)[:10]) - dt.date.fromisoformat(str(a)[:10])).days
    except (TypeError, ValueError):
        return None


def at(vals: list[int], q: float) -> int:
    """Nearest-rank percentile of a sorted list."""
    return vals[min(len(vals) - 1, max(0, round(q * (len(vals) - 1))))]


def read(db: Database) -> list[dict]:
    """Every decided PERM that names a wage request we hold, in pages of rowid."""
    out: list[dict] = []
    after = 0
    while True:
        page = query_rows(
            db,
            """SELECT p.rowid, p.employer_slug, p.attorney_slug, substr(p.soc_code, 1, 7), p.received_date,
                      w.determined_on, w.decision_date, p.ad1, p.ad2, p.job_order_end, p.recr_steps,
                      p.decision_date
                 FROM perm_cases p JOIN pwd_cases w ON w.case_number = p.pwd_number
                WHERE p.rowid > ? ORDER BY p.rowid LIMIT ?""",
            [after, PAGE],
        )
        for r in page:
            out.append({
                "employer": r[1], "attorney": r[2], "occupation": r[3], "filed": r[4],
                # The first determination; DOL's newest decision date where the file predates the column.
                "determined": r[5] or r[6],
                "ad1": r[7], "ad2": r[8], "job_order_end": r[9], "recr_steps": r[10],
                "decided": r[11],
            })
        if len(page) < PAGE:
            return out
        after = int(float(page[-1][0]))


def window(db: Database, cases: list[dict]) -> tuple[str, str]:
    """The determinations old enough that their PERMs have been decided: see the module's notes."""
    newest = max(str(c["decided"])[:10] for c in cases if c["decided"])
    year_ago = (dt.date.fromisoformat(newest) - dt.timedelta(days=365)).isoformat()
    taking = sorted(d for c in cases if c["decided"] and str(c["decided"])[:10] >= year_ago
                    for d in [days(c["filed"], c["decided"])] if d is not None and d >= 0)
    end = dt.date.fromisoformat(newest) - dt.timedelta(days=DETERMINATION_LIFE_DAYS + at(taking, DECIDED_SHARE))
    first_fy = query_rows(db, "SELECT MIN(fiscal_year) FROM pwd_cases WHERE visa_class = 'PERM'")[0][0]
    return max(f"{int(float(first_fy)) - 1}-10-01", numbered_from(db)), end.isoformat()


def numbered_from(db: Database) -> str:
    """The first day of the first filing month from which every month's decided PERMs carry the
    wage request's number (NUMBERED_SHARE of them)."""
    months = query_rows(
        db,
        """SELECT substr(received_date, 1, 7), AVG(pwd_number IS NOT NULL AND pwd_number <> '')
             FROM perm_cases WHERE received_date IS NOT NULL GROUP BY 1 ORDER BY 1""",
    )
    first = None
    for month, share in months:
        if float(share) >= NUMBERED_SHARE:
            first = first or month
        else:
            first = None
    if not first:
        raise SystemExit("no filing month carries the wage request's number: refusing to guess a window")
    return f"{first}-01"


def plan(cases: list[dict], start: str, end: str) -> list[list]:
    """One row per employer, firm, job and every case, where the floor holds.

    Only cases whose wage request was determined inside [start, end] count.
    """
    gaps: dict[tuple, list[int]] = defaultdict(list)
    quiet: dict[tuple, list[int]] = defaultdict(list)
    clients: dict[tuple, set] = defaultdict(set)
    for c in cases:
        if not (c["determined"] and start <= str(c["determined"])[:10] <= end):
            continue
        keys = [ALL] + [(k, c[k]) for k in ("employer", "attorney", "occupation") if c[k]]
        gap = days(c["determined"], c["filed"])
        q = days(quiet_period_end(c), c["filed"])
        for key in keys:
            if gap is not None and 0 <= gap <= MAX_GAP_DAYS:
                gaps[key].append(gap)
            if q is not None and 0 <= q <= MAX_GAP_DAYS:
                quiet[key].append(q)
            if key[0] == "attorney" and c["employer"]:
                clients[key].add(c["employer"])
    rows = []
    for key, g in gaps.items():
        if len(g) < MIN_LINKED:
            continue
        g.sort()
        qs = sorted(quiet.get(key, []))
        enough = len(qs) >= MIN_LINKED
        rows.append([
            key[0], key[1], len(g), len(clients[key]) if key[0] == "attorney" else None,
            at(g, 0.25), at(g, 0.5), at(g, 0.75),
            len(qs), at(qs, 0.5) if enough else None,
            sum(1 for x in qs if x <= WITHIN_DAYS) if enough else None,
            start, end,
        ])
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-stamp", action="store_true", help="write the table, leave the freshness row alone")
    ap.add_argument("--show", nargs="*", default=[], metavar="KIND:SLUG")
    args = ap.parse_args()
    started = time.time()
    db = Database()
    cases = read(db)
    if not cases:
        log("no case links to a wage request: refusing to write an empty table")
        record_run(db, "build_pwd_links.py", status="failed", note="no linked cases", started_at=started)
        return 1
    start, end = window(db, cases)
    rows = plan(cases, start, end)
    by_kind = defaultdict(int)
    for r in rows:
        by_kind[r[0]] += 1
    every = next((r for r in rows if (r[0], r[1]) == ALL), None)
    log(f"window: wage requests determined {start} to {end}")
    log(f"{len(cases):,} decided PERM cases name a wage request we hold; rows: "
        + ", ".join(f"{k} {n:,}" for k, n in sorted(by_kind.items())))
    if every:
        log(f"  every case: determination to filing {every[4]} / {every[5]} / {every[6]} days; "
            f"quiet period to filing {every[8]} days typical, {every[9] / every[7]:.0%} within {WITHIN_DAYS}")
    for want in args.show:
        kind, _, slug = want.partition(":")
        log(f"  {want}: {next((dict(zip(COLS, r)) for r in rows if r[0] == kind and r[1] == slug), 'below the floor')}")
    if args.dry_run:
        return 0
    if not every:
        log("no case links to a wage request: refusing to write an empty table")
        record_run(db, "build_pwd_links.py", status="failed", note="no linked cases", started_at=started)
        return 1
    db.execute(DDL)
    got = sync_rows(db, TABLE, ["kind", "slug"], COLS, rows, pause_s=0.2)
    if not args.no_stamp:
        stamp_freshness(
            db, "perm-pwd-links", source="DOL's PERM and wage-request disclosure files, joined",
            cadence="after each PERM and wage-request load", max_age_days=100,
            note=f"{every[2]:,} linked cases, determined {start} to {end}; {len(rows):,} rows",
        )
    record_run(db, "build_pwd_links.py", status="ok", rows_written=got["written"],
               note=f"{every[2]:,} linked; {len(rows):,} rows ({got['written']:,} written, {got['deleted']:,} removed)",
               started_at=started)
    log(f"  wrote {got['written']:,}, removed {got['deleted']:,}, unchanged {got['unchanged']:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
