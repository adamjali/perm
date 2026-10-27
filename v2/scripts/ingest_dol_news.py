#!/usr/bin/env python3
"""DOL's news releases on foreign labor and work visas, into the policy feed.

    python3 scripts/ingest_dol_news.py                          # fetch and write
    python3 scripts/ingest_dol_news.py --dry-run                # fetch and print, write nothing
    python3 scripts/ingest_dol_news.py --from-file page.html    # parse a saved page, then write

WHAT THIS IS. The Labor Department's newsroom list, `www.dol.gov/newsroom/releases`,
twenty releases a page, newest first. Each release this site's readers would
want (H-1B, PERM, H-2A, H-2B and CW-1 enforcement and rules, Project Firewall,
foreign workers) becomes a row in `policy_notices`: type "DOL news release",
source `dol-news`, the release's own date and title, and DOL's own summary from
the list, verbatim, as the abstract. Everything else DOL announces (weekly
unemployment claims, workplace safety citations, Davis-Bacon wage surveys) is
left out by `keep_release`, a pure rule with its own test.

Page 0 is read every run. Older pages are read while the oldest release on the
page is newer than the newest this site already holds, up to MAX_PAGES, so a
first run or a run after an outage catches up, and an ordinary run asks once.

DOL serves no RSS feed of its releases (`www.dol.gov/rss.xml` is a node feed of
another office's items), so the HTML list is read.

WHERE IT RUNS. GitHub's runners: www.dol.gov answers them with a full browser
header set (the OFLC reader's, imported) and refuses residential addresses. The
parser and its fixture were built from the Internet Archive's plain copy of the
list (`web.archive.org/web/20261008164428/https://www.dol.gov/newsroom/releases`),
because this Mac can't read www.dol.gov: the live page is unverified until the
first GitHub run. The Archive copy differs from the live page only in its link
addresses, and the parser keys on each release's `about` path, which the Archive
leaves alone.

TROUBLE. A refusal or an outage (403, 429, 5xx, a timeout) is a warning: nothing
is written, the run is recorded ok with the refusal in its note, and the
dataset's freshness row is the alarm. A list that reads as nothing or changed
shape writes nothing and exits 1 naming what was missing. A defect here crashes.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_oflc_news import BROWSER_HEADERS  # noqa: E402
from ingest_uscis_news import (  # noqa: E402
    LostStructure, check_rows, cut_at_word, drop_implausible, listing_text,
)
from lib_db import Database, et_today, query_dicts, record_run, stamp_freshness  # noqa: E402
from lib_gov_data import RobotsDisallowed, robots_allowed  # noqa: E402
from lib_policy_feed import expire_policy_page, record_quiet_run, topics_of, write_notices  # noqa: E402
from lib_warn import is_unreachable  # noqa: E402

SCRIPT = "ingest_dol_news.py"
HOST = "https://www.dol.gov"
LIST_URL = f"{HOST}/newsroom/releases"
DATASET = "policy-notices-dol"
SOURCE = "dol-news"
TYPE = "DOL news release"
LABEL = "DOL newsroom"
CADENCE = "Hourly on weekdays, and daily"
MAX_PAGES = 4        # 80 releases, about three months of DOL's pace
PAGE_GAP_S = 5       # between pages: www.dol.gov refuses sustained traffic
RETRY_WAITS = (20,)  # a 429 or 503 is asked once more, 20 s later

# BUDGET. DOL posts releases most weekdays. Measured over the Internet Archive's
# eleven copies of the list from Oct 2025 to Oct 2026 (217 releases; the copy of
# Nov 13 2025 was an empty redirect): the longest gap inside a copy is 7 days
# (May 14 to 21 and Aug 27 to Sep 3 2026), so the rule's longest gap plus a week
# is 14. The copies don't meet end to end (none covers Jun 5 to Jun 29 2026, for
# one), so a week more is added for the gaps they can't show: 21. The rule's
# floor (the newest item's age plus 14) can't be measured until a live read: the
# Archive's newest copy is Oct 8, which would make it 33. DOL posted nothing
# from Sep 30 to about Nov 13 2025 (the shutdown); at 21 days that reads as
# "source not republished" and warns, and fails only past three times it.
MAX_AGE_DAYS = 21

# DOL's offices, by the path segment a release sits under.
OFFICES = {
    "eta": "Employment and Training Administration",
    "whd": "Wage and Hour Division",
    "osec": None,  # the Secretary's office: the department itself
    "ofccp": "Office of Federal Contract Compliance Programs",
    "ilab": "Bureau of International Labor Affairs",
    "sol": "Office of the Solicitor",
}

MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"


def log(msg: str) -> None:
    print(f"[dol-news] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Parser and keep rule (pure)
# ---------------------------------------------------------------------------

def _day(text: str) -> str | None:
    m = re.fullmatch(rf"\s*({MONTHS})\.? (\d{{1,2}}), (\d{{4}})\s*", text or "")
    if not m:
        return None
    try:
        return dt.datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", "%B %d %Y").date().isoformat()
    except ValueError:
        return None


def _summary(fragment: str) -> str:
    """DOL's summary from the list. DOL cuts some mid-sentence; those end with
    " ..." so the cut shows."""
    s = listing_text(fragment)
    if s and not re.search(r"[.?!:;\"”’)\]]$", s):
        s = s.rstrip(" ,") + " ..."
    return s


def parse_releases(text: str) -> list[dict]:
    """Every release on a list page: its path, day, title and summary."""
    starts = list(re.finditer(r'about="(/newsroom/releases/([a-z0-9-]+)/([A-Za-z0-9-]+))"', text))
    items: list[dict] = []
    for n, m in enumerate(starts):
        end = starts[n + 1].start() if n + 1 < len(starts) else min(len(text), m.end() + 8000)
        block = text[m.end():end]
        day = re.search(r'(?is)class="dol-date-text">\s*([^<]+?)\s*<', block)
        title = re.search(r"(?is)<h3[^>]*>(.*?)</h3>", block)
        if not (day and title):
            continue
        body = re.search(r'(?is)field--name-field-press-body[^>]*>(.*?)</div>', block)
        items.append({
            "path": m.group(1),
            "office": m.group(2),
            "id": m.group(3),
            "day": _day(listing_text(day.group(1))),
            "title": listing_text(title.group(1)),
            "summary": _summary(body.group(1)) if body else "",
        })
    items = drop_implausible(items, "DOL releases")
    check_rows(len(starts), items, "DOL releases", "a date and a title")
    return items


# What a release must name to be kept: a work-visa program or DOL's foreign
# labor work. Prevailing wage alone isn't enough: DOL's Davis-Bacon surveys
# ("prevailing wage rates" for highway construction) are a different program.
WORK = re.compile(
    r"\bH-?1B1?\b|\bH-?2[AB]?\b|\bCW-?1\b|\bE-3\b|\bPERM\b|labor certification|foreign labor"
    r"|foreign workers?|guest ?workers?|Project Firewall|Immigration and Nationality Act|visa programs?"
    r"|nonimmigrant|\bimmigra|labor condition application|\bLCA\b|seasonal (?:agricultural )?workers? program",
    re.I,
)


def keep_release(title: str, summary: str = "") -> bool:
    """A release is kept when its title or its summary names a work-visa
    program or DOL's foreign labor work."""
    return bool(WORK.search(title) or WORK.search(summary or ""))


def release_rows(items: list[dict]) -> list[dict]:
    rows = []
    for i in items:
        if not keep_release(i["title"], i["summary"]):
            continue
        office = OFFICES.get(i["office"])
        rows.append({
            "document_number": f"dol-{i['office']}-{i['id']}",
            "publication_date": i["day"],
            "type": TYPE,
            "title": i["title"],
            "abstract": cut_at_word(i["summary"]),
            "html_url": HOST + i["path"],
            "agencies": ["Labor Department"] + ([office] if office else []),
            "topics": topics_of(i["title"], i["summary"]),
        })
    return rows


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------

def fetch_url(url: str, sleep=time.sleep) -> str:
    """GET with the OFLC reader's browser header set, after robots.txt."""
    if not robots_allowed(url):
        raise RobotsDisallowed(f"{url} is a path the host's robots.txt asks automated clients not to read")
    for attempt in range(len(RETRY_WAITS) + 1):
        try:
            req = urllib.request.Request(url, headers=dict(BROWSER_HEADERS))
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == len(RETRY_WAITS):
                raise
            log(f"HTTP {e.code}; asking again in {RETRY_WAITS[attempt]} s")
            sleep(RETRY_WAITS[attempt])
    raise AssertionError("unreachable")


def page_url(n: int) -> str:
    return LIST_URL if n == 0 else f"{LIST_URL}?page={n}"


def trouble(exc: BaseException) -> str | None:
    if isinstance(exc, RobotsDisallowed) or is_unreachable(exc):
        return "refused"
    if isinstance(exc, urllib.error.HTTPError):
        return "broken"
    return None


def describe(exc: BaseException) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, RobotsDisallowed):
        return "robots.txt disallows it"
    return f"{type(exc).__name__}: {str(exc)[:120]}"


def held_newest(db) -> str | None:
    """The newest release day this site holds, from the dataset's own stamp."""
    if db is None:
        return None
    try:
        rows = query_dicts(db, "SELECT as_of FROM data_freshness WHERE dataset = ?", [DATASET])
    except Exception:  # noqa: BLE001 - no table yet: a first run
        return None
    return str(rows[0]["as_of"]) if rows and rows[0].get("as_of") else None


@dataclass
class Read:
    status: str = "ok"   # ok, refused, broken
    note: str = ""
    warned: bool = False  # an older page refused or unreadable: page 0 still counts
    items: list[dict] = field(default_factory=list)
    pages: int = 0


def read_pages(fetch=fetch_url, sleep=time.sleep, newest_held: str | None = None) -> Read:
    out = Read()
    seen: set[str] = set()
    for n in range(MAX_PAGES):
        if n:
            sleep(PAGE_GAP_S)
        try:
            items = parse_releases(fetch(page_url(n)))
        except LostStructure as e:
            if n == 0:
                out.status, out.note = "broken", str(e)
            else:  # an older page that won't read: keep what the newer pages gave
                out.note, out.warned = f"page {n + 1} unread ({e})", True
            return out
        except Exception as e:  # noqa: BLE001 - sorted below; a defect re-raises
            kind = trouble(e)
            if kind is None:
                raise
            if n == 0:
                out.status = "refused" if kind == "refused" else "broken"
                out.note = f"www.dol.gov unread ({describe(e)})"
            else:
                out.note, out.warned = f"page {n + 1} unread ({describe(e)})", True
            return out
        out.pages += 1
        fresh = [i for i in items if i["path"] not in seen]
        seen.update(i["path"] for i in items)
        out.items.extend(fresh)
        oldest = min(i["day"] for i in items)
        if not fresh or (newest_held and oldest <= newest_held):
            return out
    out.note = f"stopped at {MAX_PAGES} pages"
    return out


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

def finish(db, got: Read, started: float, dry_run: bool) -> int:
    rows = release_rows(got.items) if got.status == "ok" else []
    if got.status == "refused":
        log(f"::warning::{got.note}")
    elif got.status == "broken":
        print(f"::error::DOL releases: {got.note}. Nothing was written.", flush=True)
    else:
        log(f"{len(got.items)} releases on {got.pages} page(s), {len(rows)} kept"
            + (f", newest {max(i['day'] for i in got.items)}" if got.items else ""))
    if dry_run:
        for r in rows[:5]:
            print(json.dumps(r, indent=2)[:900])
        return 1 if got.status == "broken" else 0

    written = 0
    if got.status == "ok":
        res = write_notices(db, rows, source=SOURCE)
        written = res.written
        newest = max(i["day"] for i in got.items)
        stamp_freshness(
            db, DATASET, as_of=min(newest, et_today()), source=LABEL, cadence=CADENCE,
            note=f"{len(got.items)} releases read, {len(rows)} kept, {written} written",
            max_age_days=MAX_AGE_DAYS,
        )
    if got.status == "ok":
        note = f"{len(rows)} kept of {len(got.items)} on {got.pages} page(s), {written} written"
        if got.note:
            note += f"; {got.note}"
    else:
        note = got.note
    if written and expire_policy_page(log) is False:
        note += "; policy page refresh refused"
    if got.status == "broken":
        record_run(db, SCRIPT, status="failed", rows_written=0, note=note, started_at=started)
        return 1
    if got.status == "refused" or got.warned:
        if got.warned:
            log(f"::warning::{got.note}")
        record_run(db, SCRIPT, status="ok", rows_written=written, note=note, started_at=started)
        return 0
    record_quiet_run(db, SCRIPT, written=written, note=note, started_at=started)
    log(f"wrote {written}")
    return 0


def run(db=None, *, fetch=fetch_url, sleep=time.sleep, dry_run: bool = False,
        from_file: str | None = None) -> int:
    started = time.time()
    if not dry_run and db is None:
        db = Database()
    if from_file:
        got = Read(pages=1)
        try:
            got.items = parse_releases(open(from_file, encoding="utf-8", errors="replace").read())
        except LostStructure as e:
            got.status, got.note = "broken", str(e)
    else:
        got = read_pages(fetch, sleep, held_newest(None if dry_run else db))
    return finish(None if dry_run else db, got, started, dry_run)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="fetch and print, write nothing")
    ap.add_argument("--from-file", help="a saved copy of the releases list (the live page or the Archive's)")
    a = ap.parse_args()
    return run(dry_run=a.dry_run, from_file=a.from_file)


if __name__ == "__main__":
    sys.exit(main())
