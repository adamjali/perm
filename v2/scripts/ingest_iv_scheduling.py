#!/usr/bin/env python3
"""Load the State Department's IV Scheduling Status Tool: for each consulate, the month of
documentarily complete cases the National Visa Center is scheduling interviews for.

State's own words for what the table shows: "the documentarily complete month and year for
which NVC is scheduling most interviews in your classification at the selected U.S. embassy or
consulate." It's NVC's paperwork queue. It never says whether a post is holding interviews: on
State's Oct 7 2026 update, 105 of its 142 named posts read Oct-2026 for employment cases while interviews
were paused at most of them. Every page that prints it says so.

travel.state.gov refuses scripts (Cloudflare 403, robots.txt included), so there are two routes:

--from-file   The table copied in a browser: a "Last Updated: <Month DD, YYYY>" line, the header
              row, then one row a post, cells split by "|". A saved page (HTML) works too. This is
              the monthly route, read in the owner's Chrome with the bulletin.
--archive     The Internet Archive's captures, for the history before the first browser copy.
              Its copies stop in mid-July 2026, when State began refusing its crawler too.

Every route goes through one parser, which refuses a page that isn't the whole table: no date,
the wrong columns, too few posts, a post twice, a month it can't read or one later than the
page's own date.

Usage:
  python3 scripts/ingest_iv_scheduling.py --from-file ~/Downloads/iv-tool.txt
  python3 scripts/ingest_iv_scheduling.py --archive [--newest 60]
  python3 scripts/ingest_iv_scheduling.py --from-file FILE --dry-run

Server: sudo -u permtracker permtracker-uscis iv-tool <file>
Tests: python3 scripts/test_iv_scheduling.py
"""
from __future__ import annotations

import argparse
import datetime
import html
import json
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, query_rows, record_run, stamp_freshness  # noqa: E402

TABLE = "iv_scheduling"
DATASET = "iv-scheduling"
SOURCE = "State Department's IV Scheduling Status Tool (travel.state.gov, read in a browser)"
TOOL_URL = "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/iv-wait-times.html"
FACTS = pathlib.Path(__file__).resolve().parent / "data" / "consular_facts.json"

# State updates the tool monthly, about the first week; the copy is read in a browser after that.
MAX_AGE_DAYS = 50
MIN_POSTS = 100
# More unreadable cells than this and the table isn't what the parser knows.
MAX_UNREADABLE_SHARE = 0.05

# The column headers, as State prints them, to the category each holds. State's page lists the
# categories as "Immediate Relative", "Family-Sponsored Preference" and "Employment-Based Preference".
COLUMNS = {"employment": "employment", "preference": "family", "relative": "immediate"}
CATEGORIES = ("employment", "family", "immediate")

MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
CELL_RE = re.compile(r"^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[-\s]?(\d{2}|\d{4})$", re.I)
NOT_SHOWN = {"n/a", "na", "-", "--"}
UPDATED_RE = re.compile(r"Last Updated:\s*([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})", re.I)
# State's own table carried a row named "null" on Oct 7 2026: a blank in its source, not a post.
NOT_A_POST = {"", "null", "undefined"}

COLS = ("as_of", "post_key", "category", "post", "printed", "month")


class Refused(ValueError):
    """The page isn't the whole table; nothing is written."""


def facts() -> dict:
    return json.loads(FACTS.read_text())


def post_key(name: str, aliases: dict[str, str]) -> str:
    """One key per post, the key State's issuance tables use, so a post's page reads both.

    The same rule as ingest_visa_issuances.group_key, after dropping a parenthetical ("Mumbai
    (Bombay)"), then State's spelling differences between its two tables.
    """
    folded = re.sub(r"\s*\(.*?\)", "", name)
    folded = re.sub(r"[‐-―−]", "-", folded)
    folded = re.sub(r"\s+", " ", re.sub(r"\s*-\s*", " - ", folded)).strip().casefold()
    return aliases.get(folded, folded)


def parse_cell(text: str) -> tuple[str, str | None, bool]:
    """(printed, YYYY-MM or None, readable). "N/A" is readable and has no month."""
    printed = re.sub(r"\s+", " ", text).strip()
    if printed.casefold() in NOT_SHOWN:
        return printed, None, True
    m = CELL_RE.match(printed)
    if not m:
        return printed, None, False
    year = int(m.group(2))
    if year < 100:
        year += 2000
    return printed, f"{year:04d}-{MONTHS[m.group(1)[:3].lower()]:02d}", True


def as_of_of(text: str) -> str:
    m = UPDATED_RE.search(text)
    if not m:
        raise Refused("no 'Last Updated' date on the page")
    month = MONTHS.get(m.group(1)[:3].lower())
    if not month:
        raise Refused(f"unreadable 'Last Updated' month {m.group(1)!r}")
    return datetime.date(int(m.group(3)), month, int(m.group(2))).isoformat()


def table_rows(text: str) -> list[list[str]]:
    """The table's rows as cells, from a browser copy or a saved page."""
    if "<table" in text.lower():
        t = re.search(r"<table.*?</table>", text, re.S | re.I)
        if not t:
            raise Refused("no table on the page")
        out = []
        for row in re.findall(r"<tr.*?</tr>", t.group(0), re.S | re.I):
            cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.S | re.I)
            out.append([html.unescape(re.sub(r"<[^>]+>", "", c)).replace("\xad", "").strip() for c in cells])
        return out
    return [[c.strip() for c in line.split("|")] for line in text.splitlines() if "|" in line]


def parse(text: str, aliases: dict[str, str] | None = None) -> dict:
    """{as_of, rows, skipped}. Raises Refused for anything that isn't the whole table."""
    aliases = aliases if aliases is not None else {k: v for k, v in facts()["postAliases"].items() if not k.startswith("_")}
    as_of = as_of_of(text)
    rows = table_rows(text)
    if not rows:
        raise Refused("no rows")
    header = [c.casefold() for c in rows[0]]
    if not header or "post" not in header[0]:
        raise Refused(f"the first row isn't the header: {rows[0][:4]}")
    columns: list[str | None] = [None]
    for h in header[1:]:
        columns.append(next((cat for word, cat in COLUMNS.items() if word in h), None))
    if sorted(c for c in columns if c) != sorted(CATEGORIES):
        raise Refused(f"unexpected columns: {rows[0]}")

    out: list[tuple] = []
    skipped: list[str] = []
    seen: set[str] = set()
    cells = unreadable = 0
    as_of_month = as_of[:7]
    for row in rows[1:]:
        name = re.sub(r"\s+", " ", row[0]).strip() if row else ""
        if name.casefold() in NOT_A_POST:
            skipped.append(name or "(blank)")
            continue
        if len(row) != len(columns):
            raise Refused(f"row for {name!r} has {len(row)} cells, the header {len(columns)}")
        key = post_key(name, aliases)
        if key in seen:
            raise Refused(f"{name!r} appears twice")
        seen.add(key)
        for cat, cell in zip(columns[1:], row[1:]):
            printed, month, readable = parse_cell(cell)
            cells += 1
            if not readable:
                unreadable += 1
            if month and month > as_of_month:
                raise Refused(f"{name!r} {cat} reads {printed}, after the page's own date {as_of}")
            out.append((as_of, key, cat, name, printed, month))
    if len(seen) < MIN_POSTS:
        raise Refused(f"only {len(seen)} posts (expected {MIN_POSTS}+)")
    if cells and unreadable / cells > MAX_UNREADABLE_SHARE:
        raise Refused(f"{unreadable} of {cells} cells unreadable")
    return {"as_of": as_of, "rows": out, "skipped": skipped, "posts": len(seen), "unreadable": unreadable}


def ensure_table(db: Database) -> None:
    db.execute(
        f"""CREATE TABLE IF NOT EXISTS {TABLE} (
            as_of TEXT NOT NULL, post_key TEXT NOT NULL, post TEXT NOT NULL, category TEXT NOT NULL,
            printed TEXT NOT NULL, month TEXT,
            PRIMARY KEY (as_of, post_key, category))"""
    )
    db.execute(f"CREATE INDEX IF NOT EXISTS {TABLE}_post ON {TABLE} (post_key, as_of)")


def write(db: Database, parsed: dict) -> int:
    """Replace one reading's rows; returns rows written. A reading is State's own update day."""
    from lib_reference import sync_rows

    got = sync_rows(db, TABLE, ("as_of", "post_key", "category"), COLS, parsed["rows"],
                    scope_sql="as_of = ?", scope_args=[parsed["as_of"]])
    return got["written"] + got["deleted"]


def stamp(db: Database, note: str) -> None:
    newest = query_rows(db, f"SELECT max(as_of) FROM {TABLE}")[0][0]
    stamp_freshness(db, DATASET, as_of=newest, source=SOURCE,
                    cadence="monthly, copied in a browser (State refuses scripts)",
                    note=note, max_age_days=MAX_AGE_DAYS)


def load_file(path: str, dry_run: bool) -> int:
    started = time.time()
    text = pathlib.Path(path).expanduser().read_text(errors="replace")
    try:
        parsed = parse(text)
    except Refused as exc:
        print(f"REFUSED {path}: {exc}", file=sys.stderr)
        return 1
    skipped = f"; skipped rows named {parsed['skipped']}" if parsed["skipped"] else ""
    print(f"read {parsed['posts']} posts, State's update of {parsed['as_of']}{skipped}")
    if dry_run:
        return 0
    db = Database()
    ensure_table(db)
    n = write(db, parsed)
    note = f"State's update of {parsed['as_of']}: {parsed['posts']} posts{skipped}"
    stamp(db, note)
    record_run(db, "ingest_iv_scheduling.py", status="ok", rows_written=n, note=note, started_at=started)
    print(f"stored {parsed['as_of']}: {n} rows written")
    return 0


def load_archive(newest: int, dry_run: bool) -> int:
    """Every Archive capture whose State update isn't held yet, oldest first."""
    from lib_warn import WAYBACK, _archive_read, archive_captures

    started = time.time()
    db = None if dry_run else Database()
    if db:
        ensure_table(db)
    held = {r[0] for r in query_rows(db, f"SELECT DISTINCT as_of FROM {TABLE}")} if db else set()
    loaded, refused = [], []
    for ts in reversed(archive_captures(TOOL_URL, newest)):
        try:
            text = _archive_read(f"{WAYBACK}/web/{ts}/{TOOL_URL}").decode("utf-8", errors="replace")
            parsed = parse(text)
        except Refused as exc:
            refused.append(f"{ts}: {exc}")
            continue
        except Exception as exc:  # the Archive down or refusing: stop, keep what's loaded
            refused.append(f"{ts}: {type(exc).__name__}")
            break
        if parsed["as_of"] in held:
            continue
        held.add(parsed["as_of"])
        if db:
            write(db, parsed)
        loaded.append(parsed["as_of"])
        print(f"  {ts}: State's update of {parsed['as_of']}, {parsed['posts']} posts")
    note = f"Internet Archive: {len(loaded)} updates loaded ({', '.join(loaded) or 'none new'}); {len(refused)} captures refused"
    print(note)
    for r in refused[:10]:
        print("  refused", r)
    if db and loaded:
        stamp(db, note)
        record_run(db, "ingest_iv_scheduling.py --archive", status="ok", rows_written=len(loaded), note=note, started_at=started)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--from-file", help="the table copied in a browser, or a saved page")
    src.add_argument("--archive", action="store_true", help="the Internet Archive's captures (history)")
    ap.add_argument("--newest", type=int, default=60, help="how many of the Archive's newest captures to look at")
    ap.add_argument("--dry-run", action="store_true", help="parse and report; write nothing")
    args = ap.parse_args()
    if args.from_file:
        return load_file(args.from_file, args.dry_run)
    return load_archive(args.newest, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
