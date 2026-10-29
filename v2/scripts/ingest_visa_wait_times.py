#!/usr/bin/env python3
"""Load the State Department's Global Visa Wait Times table, one reading a month.

WHAT IT IS. For each U.S. embassy and consulate ("City/Post") State prints how
long a NONIMMIGRANT visa applicant waits for an interview, one column per visa
class: B1/B2 (visitors) twice, as last month's average wait and as the next
available appointment, then F, M, J (students and exchange visitors), H, L, O,
P, Q (petition-based workers) and C, D, C1/D (crew and transit) as the next
available appointment. In State's own words on the page (read Oct 28 2026):

  * "We update visa wait time information monthly."
  * "We calculate months in 30-day increments and half months in 15-day
    increments. This includes weekends and holidays when embassies close."
  * The average is "measured from fee payment to visa interview date" over the
    previous month, and is "provided for B1/B2 visas only in cases where the
    next available appointment is more than three months away".
  * Interview waivers "are not reflected in the table".

It's not the immigrant visa (green card) interview: that's State's separate IV
Scheduling Status Tool, which this doesn't read.

WHERE. travel.state.gov refuses scripts. State serves the same page from
adoption.state.gov, whose robots.txt is a 404 (no rules), and the table is in
the page's own HTML: no data file, no endpoint. The per-post tool State links
(wait-times.html) holds no table any more; it points back to this page.
Measured Oct 28 2026, 8:06 PM EDT: HTTP 200, text/html, 244 table rows,
"Last updated: 21-OCT-2026". Some adoption.state.gov servers are still on
State's old site and answer 404 (ingest_state_news.py's docstring), so the page
is asked again a few seconds apart until a new-site server answers.

Every request names this site (`UA`), reads robots.txt first with the same
name, and waits POLITE_PAUSE_S between requests. No browser, no challenge.

HOW A CELL IS STORED. Every cell as State printed it (`wait_text`), and what it
reads as:

  kind      'value' (a number), 'na' (State's "NA"), 'same_day', 'blank' (an
            empty cell), 'unread' (anything else, kept as printed)
  amount    the number as printed (0.5 for "< 0.5 Month"); 0 only for
            same_day; NULL for na, blank and unread. A blank is never 0.
  unit      'month' or 'day'
  bound     'under' when State prints "<" ("< 0.5 Month" is under half a month)
  unit_printed  0 when State printed a bare number ("7.5", Dhaka, in the
            14-JANUARY-2026 reading), read as months like every other cell
  days      State's own arithmetic: a month is 30 days, so "1.5 Months" is 45

A reading is keyed by State's "Last updated" date, so each month's table is
kept beside the earlier ones and an unchanged page writes nothing. A cell State
changes without moving its date is rewritten in place, and the earlier value
isn't kept. A page served with an older date than one held (a stale server)
re-reads that older reading and never moves the freshness row back.

WHAT IS REFUSED, with nothing written: a page with no "Last updated" date or no
City/Post table; a header that names no interview type, visa class or measure
(a column read by position could be any column); a row whose cell count
differs from the header's; the same post twice; fewer than MIN_POSTS posts; or
more than MAX_UNREAD_SHARE of the cells unreadable.

Writes `visa_wait_times`, a `data_freshness` row (`visa-wait-times`) and a run
row. The freshness row needs a line in src/lib/datasetCoverage.ts first (the
health check fails a registered dataset it doesn't describe), so until the page
that shows this ships, run with --no-stamp.

Usage:
    python3 scripts/ingest_visa_wait_times.py                    # read State's page, load it
    python3 scripts/ingest_visa_wait_times.py --dry-run          # read and print; no database
    python3 scripts/ingest_visa_wait_times.py --from-file a.html [b.html ...]   # saved copies
    python3 scripts/ingest_visa_wait_times.py --no-stamp         # load without the freshness row

Tests: python3 scripts/test_visa_wait_times.py
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import html
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_state_news import OldSite, ask  # noqa: E402
from lib_db import Database, et_today, query_rows, record_run, stamp_freshness  # noqa: E402
from lib_gov_data import POLITE_PAUSE_S, parse_robots, rules_allow  # noqa: E402
from lib_reference import sync_rows  # noqa: E402

SCRIPT = "ingest_visa_wait_times.py"
HOST = "https://adoption.state.gov"
PAGE = HOST + "/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html"
# What the site prints as the source line: a readable name, never a bare URL.
SOURCE = "State Department Global Visa Wait Times (state.gov)"
DATASET = "visa-wait-times"
TABLE = "visa_wait_times"
UA = "PERMTracker/1.0 (+https://permtracker.app; support@permtracker.app)"
TIMEOUT_S = 60
PAGE_TRIES = 6

# State's own "Last updated" dates, read from the Internet Archive's copies of
# travel.state.gov's page (Oct 28 2026) and adoption.state.gov's live page:
#   2025-11-20, 2025-12-12, 2026-01-14, 2026-02-13, 2026-03-27, 2026-04-15,
#   2026-05-18, 2026-06-18, then 2026-10-21 live.
# The gaps run 19 to 42 days (Feb 13 to Mar 27 the longest). The Archive holds
# no copy after Jul 9 2026, so July to September is unmeasured. The budget is
# the longest gap plus a week, the WARN states' rule.
MAX_AGE_DAYS = 49

# Every reading held, Nov 2025 to Oct 2026, listed 241 to 243 posts (241 once
# State's two placeholder rows named "NA" are dropped). Fewer than this is a
# truncated or different table, not a month State closed a few posts.
MIN_POSTS = 200
# One odd cell (a word State has never printed before) is kept as printed; a
# new format would fail most of them.
MAX_UNREAD_SHARE = 0.05

NA_TOKENS = {"na", "n/a"}
SAME_DAY = re.compile(r"^same[\s-]*day$", re.I)
# "9 Months", "1 Month", "11 Month", "7.5 months", "< 0.5 Month", "<0.5 months"
# (Nov 2025), a bare "7.5" (Feb 2026); "N Days" and "N Calendar Days" are read
# too, the unit State's table used before months.
VALUE = re.compile(r"^(<)?\s*(\d+(?:\.\d+)?)\s*(months?|(?:calendar\s+)?days?)?\.?$", re.I)
STAMP = re.compile(r"Last\s+updated\s*:?\s*(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s,-]+(\d{4})", re.I)
MONTHS = {m: i for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), start=1)}

KEY = ("reading", "post_key", "interview", "visa_class", "measure")
COLS = KEY + ("post", "country", "column_label", "wait_text", "kind", "amount", "unit", "bound",
              "unit_printed", "days")
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        reading TEXT NOT NULL,       -- State's "Last updated" date, YYYY-MM-DD
        post_key TEXT NOT NULL,      -- the post's name folded for joins across readings
        interview TEXT NOT NULL,     -- 'required' or 'waiver', from the column's header
        visa_class TEXT NOT NULL,    -- as the header prints it in parentheses: B1/B2, "F,M,J", ...
        measure TEXT NOT NULL,       -- 'average' (last month's wait) or 'next' (next appointment)
        post TEXT NOT NULL,          -- as printed: "Chennai (Madras)", "N`Djamena"
        country TEXT,                -- NULL: State's table names the post only
        column_label TEXT NOT NULL,  -- the header as printed
        wait_text TEXT NOT NULL,     -- the cell as printed; '' for a blank cell
        kind TEXT NOT NULL,          -- value | na | same_day | blank | unread
        amount REAL,                 -- the number as printed; NULL unless value or same_day
        unit TEXT,                   -- month | day
        bound TEXT,                  -- 'under' for "< 0.5 Month"
        unit_printed INTEGER,        -- 0 when the unit was left off and read as months
        days INTEGER,                -- State's arithmetic: a month is 30 days
        PRIMARY KEY (reading, post_key, interview, visa_class, measure))""",
    # One post over time, the other read a page would make.
    f"CREATE INDEX IF NOT EXISTS {TABLE}_post ON {TABLE} (post_key, visa_class, measure, reading)",
]


class Refusal(Exception):
    """A page that must not be written, with the reason."""


def log(msg: str) -> None:
    print(msg, flush=True)


# --- reading State's page ---------------------------------------------------------

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # an old-site server redirects to its 404 page
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def get_text(url: str) -> str:
    """One GET under this site's own name, no redirect followed."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    with _OPENER.open(req, timeout=TIMEOUT_S) as r:
        return r.read().decode("utf-8", errors="replace")


def robots_ok(url: str, fetch=get_text) -> bool:
    """Whether the host's robots.txt, read under the same name, lets us read `url`.

    A robots.txt that answers 4xx counts as no rules (adoption.state.gov's is a
    404), as lib_gov_data reads it.
    """
    parts = urllib.parse.urlsplit(url)
    try:
        text = fetch(f"{parts.scheme}://{parts.netloc}/robots.txt")
    except urllib.error.HTTPError as e:
        if 400 <= e.code < 500:
            return True
        raise
    path = parts.path + (f"?{parts.query}" if parts.query else "")
    return rules_allow(parse_robots(text), path or "/")


def _new_site(text: str) -> None:
    """Raise OldSite for State's old-site 404 page served with a 200."""
    if re.search(r"<title>\s*404\b", text[:20000], re.I):
        raise OldSite("State's 404 page")


def read_page(fetch=get_text, sleep=time.sleep) -> str:
    """State's page, after robots.txt, past the servers still on the old site."""
    if not robots_ok(PAGE, fetch):
        raise Refusal(f"{PAGE} is a path the host's robots.txt asks automated clients not to read")
    sleep(POLITE_PAUSE_S)
    text, why = ask(PAGE, PAGE_TRIES, fetch, sleep, _new_site)
    if text is None:
        raise Refusal(f"no new-site server answered: {why}")
    return text


# --- parsing --------------------------------------------------------------------

def clean(fragment: str) -> str:
    """A cell's text as a reader sees it: tags and line breaks gone, entities read."""
    text = re.sub(r"<br\s*/?>", " ", fragment, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text).strip()


def post_key(name: str) -> str:
    """One key per post across State's spellings: N`Djamena and N'Djamena are one place."""
    name = unicodedata.normalize("NFKC", name)
    name = re.sub(r"[`‘’´]", "'", name)
    return re.sub(r"\s+", " ", name).strip().casefold()


def reading_of(page: str, today: str | None = None) -> str:
    """State's "Last updated" date as YYYY-MM-DD ("21-OCT-2026", "27-MARCH-2026")."""
    m = STAMP.search(clean(page))
    if not m:
        raise Refusal("no 'Last updated' date on the page")
    month = MONTHS.get(m.group(2)[:3].lower())
    try:
        day = dt.date(int(m.group(3)), month or 0, int(m.group(1)))
    except ValueError:
        raise Refusal(f"'Last updated: {m.group(0)}' isn't a date") from None
    limit = dt.date.fromisoformat(today or et_today()) + dt.timedelta(days=1)
    if day > limit:
        raise Refusal(f"'Last updated' is {day}, after today")
    return day.isoformat()


def table_rows(page: str) -> list[list[str]]:
    """The City/Post table's rows as lists of cell text, header first.

    Found by its "City/Post" header cell, never as the page's first table: the
    Internet Archive's copies open with a calendar table of their own. A cell,
    not the words: prose naming the column isn't the table.
    """
    head = re.search(r"<t[hd]\b[^>]*>\s*City\s*/\s*Post\s*</t[hd]>", page, re.I)
    if not head:
        raise Refusal("no City/Post table on the page")
    start = page.rfind("<table", 0, head.start())
    end = page.find("</table>", head.end())
    if start < 0 or end < 0:
        raise Refusal("the City/Post heading isn't inside a table")
    body = page[start:end]
    return [[clean(c) for c in re.findall(r"<t[dh]\b[^>]*>([\s\S]*?)</t[dh]>", row, re.I)]
            for row in re.findall(r"<tr\b[^>]*>([\s\S]*?)</tr>", body, re.I)]


def column_of(label: str) -> tuple[str, str, str]:
    """(interview, visa_class, measure) from one header: "Interview Required
    (B1/B2) Next available appointment" is ('required', 'B1/B2', 'next')."""
    kind = re.search(r"Interview\s+(Required|Waiver)", label, re.I)
    cls = re.search(r"\(([^)]+)\)", label)
    if re.search(r"\baverage\b", label, re.I):
        measure = "average"
    elif re.search(r"next\s+available", label, re.I):
        measure = "next"
    else:
        measure = ""
    if not kind or not cls or not measure:
        raise Refusal(f"a column header names no interview type, visa class or measure: {label!r}")
    return kind.group(1).lower(), re.sub(r"\s+", "", cls.group(1)), measure


def read_value(text: str) -> dict:
    """What one printed cell says. A blank is never 0, and never "NA"."""
    out = {"kind": "unread", "amount": None, "unit": None, "bound": None, "unit_printed": None, "days": None}
    if text == "":
        return {**out, "kind": "blank"}
    if text.casefold() in NA_TOKENS:
        return {**out, "kind": "na"}
    if SAME_DAY.match(text):
        return {**out, "kind": "same_day", "amount": 0.0, "unit": "day", "unit_printed": 1, "days": 0}
    m = VALUE.match(text)
    if not m:
        return out
    amount = float(m.group(2))
    word = (m.group(3) or "").lower()
    unit = "day" if "day" in word else "month"
    days = amount if unit == "day" else amount * 30
    return {"kind": "value", "amount": amount, "unit": unit, "bound": "under" if m.group(1) else None,
            "unit_printed": 1 if word else 0, "days": int(round(days))}


def parse(page: str, today: str | None = None) -> dict:
    """One reading: {"reading", "rows" (one per cell), "posts", "columns", "skipped", "unread"}.

    Raises Refusal for a page that mustn't be written (see the docstring).
    """
    reading = reading_of(page, today)
    rows = table_rows(page)
    if not rows or not rows[0] or not re.fullmatch(r"City\s*/\s*Post", rows[0][0], re.I):
        raise Refusal("the table's first row isn't its City/Post header")
    header = rows[0]
    columns = [column_of(label) for label in header[1:]]
    if len(set(columns)) != len(columns):
        raise Refusal(f"two columns read as the same visa class and measure: {columns}")
    out: list[dict] = []
    seen: dict[str, str] = {}
    skipped = 0
    unread: list[str] = []
    for cells in rows[1:]:
        if not cells:
            continue
        if len(cells) != len(header):
            raise Refusal(f"a row has {len(cells)} cells where the header has {len(header)}: {cells[:2]}")
        post = cells[0]
        # State's Oct 2026 table carries two rows named "NA" with NA in every
        # cell, between N`Djamena and Naha: placeholders, not posts.
        if post == "" or post.casefold() in NA_TOKENS:
            if any(read_value(c)["kind"] not in ("na", "blank") for c in cells[1:]):
                log(f"  a row with no post name holds figures, skipped: {cells}")
            skipped += 1
            continue
        key = post_key(post)
        if key in seen:
            raise Refusal(f"{post!r} is listed twice (as {seen[key]!r} too)")
        seen[key] = post
        for (interview, cls, measure), label, text in zip(columns, header[1:], cells[1:]):
            v = read_value(text)
            if v["kind"] == "unread":
                unread.append(f"{post}: {text!r}")
            out.append({"reading": reading, "post_key": key, "interview": interview, "visa_class": cls,
                        "measure": measure, "post": post, "country": None, "column_label": label,
                        "wait_text": text, **v})
    if len(seen) < MIN_POSTS:
        raise Refusal(f"only {len(seen)} posts; every reading since Nov 2025 listed 241 or more")
    if out and len(unread) / len(out) > MAX_UNREAD_SHARE:
        raise Refusal(f"{len(unread)} of {len(out)} cells unreadable, e.g. {unread[:3]}")
    return {"reading": reading, "rows": out, "posts": len(seen), "columns": columns,
            "skipped": skipped, "unread": unread}


# --- writing --------------------------------------------------------------------

def write(db, got: dict) -> dict[str, int]:
    """This reading's rows, written where they differ from what's held for it."""
    db.script(DDL)
    return sync_rows(db, TABLE, KEY, COLS, [tuple(r[c] for c in COLS) for r in got["rows"]],
                     scope_sql="reading = ?", scope_args=[got["reading"]])


def newest_held(db) -> str | None:
    rows = query_rows(db, f"SELECT max(reading) FROM {TABLE}")
    return str(rows[0][0]) if rows and rows[0][0] else None


def describe(got: dict) -> str:
    kinds = collections.Counter(r["kind"] for r in got["rows"])
    cols = ", ".join(f"{c} {m}" if c == "B1/B2" else c for _i, c, m in got["columns"])
    return (f"reading {got['reading']}: {got['posts']} posts, {len(got['rows'])} cells ({cols}); "
            f"{dict(sorted(kinds.items()))}; {got['skipped']} placeholder rows skipped")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--from-file", nargs="+", help="Pages saved from State's site or the Internet Archive")
    ap.add_argument("--dry-run", action="store_true", help="Read and print; no database")
    ap.add_argument("--no-stamp", action="store_true", help="Load without the freshness row")
    args = ap.parse_args()
    started = time.time()

    pages: list[tuple[str, str]] = []
    try:
        if args.from_file:
            pages = [(p, open(p, encoding="utf-8", errors="replace").read()) for p in args.from_file]
        else:
            pages = [(PAGE, read_page())]
        readings = [parse(text) for _src, text in pages]
    except (Refusal, urllib.error.URLError, TimeoutError, OSError) as exc:
        # A refusal and an unreachable State both write no rows and leave the
        # freshness row to age; the run row says which it was.
        log(f"{'REFUSED' if isinstance(exc, Refusal) else 'UNREACHABLE'} {exc}")
        if not args.dry_run:
            record_run(Database(), SCRIPT, status="failed", rows_written=0, note=str(exc)[:500],
                       started_at=started)
        return 1

    for (src, _), got in zip(pages, readings):
        log(f"{src}\n  {describe(got)}")
        for u in got["unread"][:5]:
            log(f"  unread, kept as printed: {u}")
    if args.dry_run:
        sample = readings[0]["rows"]
        for post in sorted({r["post"] for r in sample})[:3]:
            for r in (r for r in sample if r["post"] == post):
                log(f"  {post:<12} {r['visa_class']:<10} {r['measure']:<8} {r['wait_text']!r:<16} "
                    f"{r['kind']:<8} amount={r['amount']} unit={r['unit']} bound={r['bound']} days={r['days']}")
        return 0

    db = Database()
    written = 0
    for got in readings:
        res = write(db, got)
        written += res["written"] + res["deleted"]
        log(f"  {got['reading']}: {res}")
    newest = newest_held(db)
    latest = max(g["reading"] for g in readings)
    if newest and latest < newest:
        log(f"  State's page served the {latest} reading; {newest} is already held")
    if not args.no_stamp and newest:
        stamp_freshness(db, DATASET, as_of=newest, source=SOURCE, cadence="monthly, read daily",
                        note=f"newest reading {newest}, {readings[-1]['posts']} posts",
                        max_age_days=MAX_AGE_DAYS)
    record_run(db, SCRIPT, status="ok", rows_written=written,
               note="; ".join(describe(g) for g in readings)[:500], started_at=started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
