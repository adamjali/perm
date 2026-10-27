#!/usr/bin/env python3
"""Bills in Congress on employment-based immigration, into the policy feed.

    python3 scripts/ingest_congress_bills.py                    # read from the cursor, write
    python3 scripts/ingest_congress_bills.py --dry-run          # the last week, printed; no database
    python3 scripts/ingest_congress_bills.py --since 2025-01-03 # walk from a day (a backfill; wants a real key)

WHAT IT READS (measured Oct 27 2026, congress.gov API v3 through api.data.gov,
lib_data_gov): `GET /v3/bill/<congress>?sort=updateDate+asc&fromDateTime=...`,
250 bills a page, each with its introduced date, its latest action (date and
text), its chamber and its title. The 119th Congress held 19,788 bills; about
a hundred are updated on an ordinary day, so a day is one page.

THE CURSOR. Bills are read oldest update first from `perm_docs['congress_bills_cursor']`
({"from": day, "offset": n}). A run that reaches the end moves `from` to the
newest update day it saw (re-reading that day next time costs nothing: an
unchanged bill writes nothing); a run its budget stops keeps `from` and moves
`offset` past the pages it read, so the next run carries on where it stopped
and no update is skipped. With no cursor a run starts LOOKBACK_DAYS back.

WHAT IT KEEPS, by the title alone. congress.gov's subjects and policy area are
assigned by the Congressional Research Service days or weeks after a bill is
introduced (H.R. 10896, introduced Oct 22 2026, had none on Oct 27), so a bill
the day it appears has only its title to go on. Kept: a title that names a
work-visa or employment-based green card subject (`KEEP`), or one of the
named acts known to be about them (`NAMED`). Bills and joint resolutions only:
a simple or concurrent resolution doesn't make law. A missed bill is the cost of
the rule; the rule is in the code and tested on real titles.

WRITES. `lib_policy_feed.write_notices(source="congress")`: type "Bill",
document number `bill-<congress>-<type>-<number>`, publication date the day it
was introduced, action the latest action's text, dates the latest action's day,
the congress.gov page. A new latest action is a change and is written; a bill
updated for anything else writes nothing. Freshness row
`policy-notices-congress`, as of the newest update day read.

TROUBLE. A spent budget, a 429, a 5xx or an outage is a stop: what was read is
written, the cursor keeps its place, the run is recorded ok with the reason. A
key the gateway refuses, or an answer that has lost its shape, writes nothing
and exits 1. A defect in this code crashes.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_data_gov import Client, KeyRefused, Stopped  # noqa: E402
from lib_db import Database, et_today, read_doc, record_run, stamp_freshness, write_doc  # noqa: E402
from lib_policy_feed import expire_policy_page, record_quiet_run, topics_of, write_notices  # noqa: E402

SCRIPT = "ingest_congress_bills.py"
DATASET = "policy-notices-congress"
SOURCE_LABEL = "congress.gov bills"
API = "https://api.congress.gov/v3"
CURSOR_KEY = "congress_bills_cursor"
PAGE = 250
LOOKBACK_DAYS = 7
# A resumed walk steps back this many bills: a bill updated again between two
# runs moves to the end of the list, and every bill after its old place moves
# up one, so without the overlap the bill at the boundary would be skipped.
OVERLAP = 25
TYPE = "Bill"
# congress.gov updates some bill every day, recess included (CRS keeps adding
# summaries and subjects); a week without one is a reader that stopped.
MAX_AGE_DAYS = 7
DOCS_DDL = "CREATE TABLE IF NOT EXISTS perm_docs (key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)"
# Bills and joint resolutions make law; simple and concurrent resolutions don't.
LAW_TYPES = {"HR": "house-bill", "S": "senate-bill", "HJRES": "house-joint-resolution",
             "SJRES": "senate-joint-resolution"}

# A title that names one of these is about employment-based immigration.
KEEP = re.compile(
    # Capitals matter for the short ones: "opt out" isn't OPT, and a word "perm" isn't PERM.
    r"\bH-?1B1?\b|\bH-?2A\b|\bH-?2B\b|\bL-1\b|\bO-1\b|\bE-3\b|\bEB-?[1-5]\b|\bCW-?1\b"
    r"|labor certification|(?-i:\bPERM\b)|prevailing wages?.{0,60}(?:visa|alien|immigra|H-?[12])|green cards?"
    r"|per-country|employment-based|high-skilled|highly[- ]skilled|skilled (?:immigrant|worker|foreign)s?"
    r"|immigrant investors?|optional practical training|(?-i:\bOPT\b)|foreign (?:workers?|labor|nurses?|physicians?|doctors?)"
    r"|guest[- ]workers?|nonimmigrant (?:workers?|visas?)|work (?:visas?|authori[sz]ation|permits?)"
    r"|employment authori[sz]ation|visa backlogs?|\bSTEM (?:talent|graduates?|workers?|green)"
    r"|agricultural (?:workers?|labor)\b.{0,40}(?:visa|immigra|H-?2)",
    re.I,
)
# Acts known to be about these subjects whose short titles don't say so.
NAMED = re.compile(
    r"Healthcare Workforce Resilience|Conrad State 30|Farm Workforce Modernization|\bEAGLE Act\b"
    r"|America's CHILDREN|America’s CHILDREN|Keep STEM Talent|Dignity Act|American Tech Workforce"
    r"|Startup Act|Global Talent",
    re.I,
)


class LostStructure(ValueError):
    """An answer that read fine and didn't look like itself."""


def log(msg: str) -> None:
    print(msg, flush=True)


def current_congress(today: str) -> int:
    """The Congress sitting on `today`: the 119th from Jan 3 2025, a new one
    every odd year on Jan 3."""
    d = dt.date.fromisoformat(today)
    year = d.year if (d.month, d.day) >= (1, 3) else d.year - 1
    if year % 2 == 0:
        year -= 1
    return 119 + (year - 2025) // 2


def keeps(title: str, bill_type: str) -> bool:
    """A bill or joint resolution whose title names an employment-based
    immigration subject. Pure."""
    if (bill_type or "").upper() not in LAW_TYPES:
        return False
    t = title or ""
    return bool(KEEP.search(t) or NAMED.search(t))


def ordinal(n: int) -> str:
    """119th, 121st, 122nd, 123rd: congress.gov's spelling in its addresses."""
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def bill_url(congress: int, bill_type: str, number: str) -> str:
    return f"https://www.congress.gov/bill/{ordinal(congress)}-congress/{LAW_TYPES[bill_type.upper()]}/{number}"


def bill_row(b: dict) -> dict:
    t = b["type"].upper()
    congress = int(b["congress"])
    la = b.get("latestAction") or {}
    chamber = b.get("originChamber")
    return {
        "document_number": f"bill-{congress}-{t.lower()}-{b['number']}",
        "publication_date": b["introducedDate"],
        "type": TYPE,
        "title": " ".join((b.get("title") or "").split()),
        "abstract": None,
        "html_url": bill_url(congress, t, str(b["number"])),
        "agencies": [chamber] if chamber in ("House", "Senate") else [],
        "topics": topics_of(b.get("title")),
        "action": (la.get("text") or "").strip() or None,
        "dates": la.get("actionDate"),
    }


def parse_page(d: dict) -> tuple[list[dict], str | None]:
    """(bills, the next page's address). Raises LostStructure on a changed shape."""
    if not isinstance(d, dict) or not isinstance(d.get("bills"), list):
        raise LostStructure("the bill list answered without a bills list")
    bills = []
    for b in d["bills"]:
        if not isinstance(b, dict):
            continue
        if not all(b.get(k) for k in ("congress", "type", "number", "updateDate")):
            raise LostStructure("a bill on the list has no congress, type, number or update date")
        bills.append(b)
    nxt = (d.get("pagination") or {}).get("next")
    return bills, nxt


def run(db=None, *, client: Client | None = None, dry_run: bool = False, since: str | None = None,
        today: str | None = None) -> int:
    started = time.time()
    today = today or et_today()
    congress = current_congress(today)
    if not dry_run:
        db = db if db is not None else Database()
        db.execute(DOCS_DDL)
    # A dry run touches no database: it reads the last LOOKBACK_DAYS (or --since).
    cursor = (read_doc(db, CURSOR_KEY) if not dry_run else None) or {}
    if since:
        cursor = {"from": since, "offset": 0}
    if cursor.get("congress") not in (None, congress):
        cursor = {}  # a new Congress starts its own list
    start = cursor.get("from") or (dt.date.fromisoformat(today) - dt.timedelta(days=LOOKBACK_DAYS)).isoformat()
    offset = max(0, int(cursor.get("offset") or 0) - OVERLAP) if cursor.get("offset") else 0
    client = client or Client(log=log)
    log(f"{ordinal(congress)} Congress, bills updated from {start} (offset {offset}), {client.key_note}")

    seen: list[dict] = []
    newest = None
    stop_note = ""
    finished = False
    pages = 0
    try:
        while True:
            d = client.get_json(f"{API}/bill/{congress}", {
                "format": "json", "limit": PAGE, "offset": offset, "sort": "updateDate+asc",
                "fromDateTime": f"{start}T00:00:00Z"})
            bills, nxt = parse_page(d)
            pages += 1
            seen += bills
            for b in bills:
                day = str(b["updateDate"])[:10]
                if newest is None or day > newest:
                    newest = day
            offset += len(bills)
            if not nxt or not bills:
                finished = True
                break
    except Stopped as e:
        stop_note = str(e)
        log(f"::warning::congress.gov stopped: {e}")
    except (KeyRefused, LostStructure) as e:
        print(f"::error::{e}. Nothing was written.", flush=True)
        if db is not None and not dry_run:
            record_run(db, SCRIPT, status="failed", rows_written=0, note=str(e), started_at=started)
        return 1

    kept = []
    for b in seen:
        if not keeps(b.get("title", ""), b.get("type", "")):
            continue
        if not b.get("introducedDate"):
            log(f"::warning::{b.get('type')} {b.get('number')} has no introduced date; left out")
            continue
        kept.append(bill_row(b))
    log(f"read {len(seen)} updated bills in {pages} pages, kept {len(kept)}")
    for r in kept[:15]:
        log(f"  {r['document_number']}  {r['dates']}  {r['title'][:90]}")
    if dry_run:
        return 0

    res = write_notices(db, kept, source="congress")
    if finished:
        new_cursor = {"congress": congress, "from": min(newest or start, today), "offset": 0}
    elif pages:
        new_cursor = {"congress": congress, "from": start, "offset": offset}
    else:
        new_cursor = cursor  # nothing read: the place stays exactly where it was
    if new_cursor != cursor:
        write_doc(db, CURSOR_KEY, new_cursor)
    if seen or finished:
        stamp_freshness(db, DATASET, as_of=min(newest or start, today), source=SOURCE_LABEL,
                        cadence="Several times a day",
                        note=f"{len(seen)} updated bills read, {len(kept)} kept, {res.written} written",
                        max_age_days=MAX_AGE_DAYS)
    note = (f"{len(seen)} updated bills read in {pages} pages, {len(kept)} kept, {res.written} written "
            f"({len(res.new)} new), {client.used} requests {client.key_note}")
    if stop_note:
        note += f"; stopped: {stop_note} (the cursor keeps its place)"
    if res.written and expire_policy_page(log) is False:
        note += "; policy page refresh refused"
    log(note)
    if stop_note:
        record_run(db, SCRIPT, status="ok", rows_written=res.written, note=note, started_at=started)
    else:
        record_quiet_run(db, SCRIPT, written=res.written, note=note, started_at=started)
    print(json.dumps({"new": res.new}) if res.new else "", end="")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="read and print, write nothing")
    ap.add_argument("--since", help="walk bills updated from this day (YYYY-MM-DD), resetting the cursor")
    a = ap.parse_args()
    return run(dry_run=a.dry_run, since=a.since)


if __name__ == "__main__":
    sys.exit(main())
