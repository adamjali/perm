#!/usr/bin/env python3
"""The White House's presidential actions on immigration, the day they're posted.

    python3 scripts/ingest_white_house.py              # the feed's newest 30
    python3 scripts/ingest_white_house.py --pages 20   # 20 pages back (a backfill)
    python3 scripts/ingest_white_house.py --dry-run
    python3 scripts/ingest_white_house.py --from-file feed.xml

WHAT THIS IS. Executive orders, proclamations and memoranda reach the Federal
Register days after they're signed: the H-1B entry proclamation was posted on
whitehouse.gov on Fri Sep 18 2026 and published in the Register on Wed Sep 23.
whitehouse.gov serves its presidential actions as an RSS feed
(https://www.whitehouse.gov/presidential-actions/feed/, 30 items a page, full
text included; robots.txt asks scripts to stay off its search pages only), so
this reads the feed and keeps the actions on an immigration subject.

WHAT IT KEEPS. An action whose title names an immigration subject, or whose
text names a work-visa subject (H-1B, H-2A, H-2B, labor certification,
prevailing wage, nonimmigrant workers, green cards, USCIS) at least BODY_MIN
times. Not "aliens" or "visas" in the text alone: sanctions orders carry a
sentence suspending entry of the people they sanction, and that isn't
immigration policy. And not one mention: the Labor Day 2026 proclamation names
H-1B once, in passing; the H-1B proclamation names its subjects 31 times.

The feed is parsed with the standard library's expat parser, which reads no
external entities; the source is whitehouse.gov over TLS.

ONE DOCUMENT, ONCE. When the Register publishes the action, its presidential
document is matched to this row (lib_policy_feed.link_presidential: the same
signing week and the same, or nearly the same, title) and the page shows the
Register's. Until then this row is the record.

HEALTH. Freshness is the feed's own lastBuildDate, which moves whenever the
White House posts any action, kept or not. A feed that doesn't answer is a
warning and the run is recorded as such; its freshness row is the alarm.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_db import Database, et_today, record_run, stamp_freshness  # noqa: E402
from lib_gov_data import RobotsDisallowed, robots_allowed  # noqa: E402
from lib_policy_feed import (  # noqa: E402
    eastern_day, expire_policy_page, link_presidential, mentions_immigration, record_quiet_run,
    topics_of, write_notices,
)

FEED = "https://www.whitehouse.gov/presidential-actions/feed/"
UA = "permtracker.app policy feed (support@permtracker.app)"
TYPE = "Presidential action"
AGENCIES = ["Executive Office of the President"]
DATASET = "policy-notices-wh"
SCRIPT = "ingest_white_house.py"
CONTENT_NS = "{http://purl.org/rss/1.0/modules/content/}encoded"
ABSTRACT_CHARS = 600
# The longest stretch the feed went without a new action, Jun 12 to Oct 23
# 2026 (90 actions over three pages), was 9 days (Oct 8 to Oct 17). Three
# weeks covers a holiday recess on top of that.
MAX_AGE_DAYS = 21

# The words that make an action's TEXT count. Narrower than the title test.
WORK_VISA = re.compile(
    r"\bH-?1B\b|\bH-?2A\b|\bH-?2B\b|labor certification|\bPERM\b|prevailing wage|nonimmigrant workers?"
    r"|foreign workers?|employment-based|green cards?|\bUSCIS\b|Citizenship and Immigration Services"
    r"|\bL-1\b|\bO-1\b|\bE-3\b|\bCW-1\b|guest workers?|labor condition application",
    re.I,
)
# Mentions of WORK_VISA an action's text needs when its title names none.
BODY_MIN = 3
CATEGORY = {
    "Executive Orders": "Executive order",
    "Proclamations": "Proclamation",
    "Presidential Memoranda": "Memorandum",
}
PREAMBLE = re.compile(
    r"^(by the (authority|president)|by the president of the united states|a proclamation|memorandum for"
    r"|the white house|subject:|executive order)", re.I)
SMALL = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "into", "from"}


def log(msg: str) -> None:
    print(msg, flush=True)


def readable_title(t: str) -> str:
    """The White House prints some titles in capitals ("RESTORING AMERICAN
    SALTWATER ANGLING"). Those become title case; every other title is kept as
    printed. Pure."""
    t = " ".join(html.unescape(t or "").split())
    letters = [c for c in t if c.isalpha()]
    if not letters or not all(c.isupper() for c in letters):
        return t
    words = t.lower().split()
    out = []
    for i, w in enumerate(words):
        if i and w in SMALL:
            out.append(w)
        elif re.fullmatch(r"(u\.s\.|h-\d+[a-z]*|[a-z]-\d+[a-z]*)", w):
            out.append(w.upper())
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


def paragraphs(body: str) -> list[str]:
    text = re.sub(r"(?i)</p>|<br\s*/?>", "\n", body or "")
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return [" ".join(p.split()) for p in text.split("\n") if p.strip()]


def abstract_of(body: str) -> str | None:
    """The first paragraph after the formal opening, the action's own words,
    cut at a word near ABSTRACT_CHARS. Pure."""
    for p in paragraphs(body):
        if PREAMBLE.match(p) or len(p) < 60:
            continue
        p = re.sub(r"^(Section|Sec\.)\s*1\.\s*(Purpose( and Policy)?\.\s*)?", "", p)
        if len(p) > ABSTRACT_CHARS:
            cut = p[:ABSTRACT_CHARS]
            p = cut[: cut.rfind(" ")] + " ..."
        return p
    return None


def parse_feed(xml_bytes: bytes) -> tuple[list[dict], str | None, int]:
    """(rows kept, the feed's own last-build day, items read). Pure."""
    root = ET.fromstring(xml_bytes)
    ch = root.find("channel")
    if ch is None:
        raise ValueError("the feed has no channel")
    built = eastern_day(ch.findtext("lastBuildDate"))
    items = ch.findall("item")
    out = []
    for it in items:
        link = (it.findtext("link") or "").strip()
        title = readable_title(it.findtext("title") or "")
        day = eastern_day(it.findtext("pubDate"))
        if not link or not title or not day:
            continue
        body = it.findtext(CONTENT_NS) or it.findtext("description") or ""
        text = "\n".join(paragraphs(body))
        if not (mentions_immigration(title) or len(WORK_VISA.findall(text)) >= BODY_MIN):
            continue
        cats = [c.text for c in it.findall("category") if c.text]
        kind = next((CATEGORY[c] for c in cats if c in CATEGORY), None)
        m = re.search(r"/presidential-actions/(\d{4})/(\d{2})/([^/?#]+)/?$", link)
        num = f"wh-{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else "wh-" + re.sub(r"[^a-z0-9]+", "-", link.lower()).strip("-")[-80:]
        out.append({
            "document_number": num,
            "publication_date": day,
            "type": TYPE,
            "title": title,
            "abstract": abstract_of(body),
            "html_url": link,
            "agencies": AGENCIES,
            "topics": topics_of(title, text),
            "action": kind,
            "signing_date": day,
        })
    return out, built, len(items)


def fetch(url: str, retries: int = 3) -> bytes:
    if not robots_allowed(url):
        raise RobotsDisallowed(url)
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            last = e
        except Exception as e:  # noqa: BLE001 - the retry is the point
            last = e
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"whitehouse.gov did not answer: {last}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pages", type=int, default=1)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from-file")
    args = ap.parse_args()
    started = time.time()
    rows: list[dict] = []
    built = None
    read = 0
    warning = None
    try:
        for page in range(1, max(1, args.pages) + 1):
            if args.from_file:
                blob = open(args.from_file, "rb").read()
            else:
                try:
                    blob = fetch(FEED if page == 1 else f"{FEED}?paged={page}")
                except urllib.error.HTTPError as e:
                    if e.code == 404 and page > 1:
                        break  # past the feed's oldest page
                    raise
            got, b, n = parse_feed(blob)
            built = built or b
            read += n
            rows += got
            if args.from_file or n == 0:
                break
            time.sleep(1)
    except ET.ParseError as e:
        log(f"the White House feed isn't readable XML ({e}); writing nothing")
        return 1
    except Exception as e:  # noqa: BLE001 - an outage or refusal is a warning; the freshness row is the alarm
        warning = f"whitehouse.gov unread ({type(e).__name__}: {str(e)[:120]})"
        log(f"::warning::{warning}")
    if warning is None and read == 0:
        log("the White House feed held no actions; its shape may have changed. Writing nothing.")
        return 1
    log(f"read {read} actions, kept {len(rows)} on an immigration subject; feed built {built}")
    for r in rows[:10]:
        log(f"  {r['publication_date']}  {r['action'] or 'Action'}: {r['title'][:90]}")
    if args.dry_run:
        return 0
    db = Database()
    if warning:
        record_run(db, SCRIPT, status="ok", rows_written=0, note=warning, started_at=started)
        return 0
    res = write_notices(db, rows, source="white-house")
    linked = link_presidential(db)
    if built:
        stamp_freshness(db, DATASET, source="whitehouse.gov presidential actions feed",
                        cadence="Every 30 minutes",
                        note=f"{len(rows)} actions on immigration among the {read} read",
                        max_age_days=MAX_AGE_DAYS, as_of=min(built, et_today()))
    changed = res.written + linked
    refreshed = expire_policy_page(log) if changed else None
    note = f"{read} read, {len(rows)} kept, {res.written} written ({len(res.new)} new), {linked} linked to the Register"
    if refreshed is False:
        note += "; the page refresh call failed"
    log(note)
    if changed:
        record_run(db, SCRIPT, status="ok", rows_written=changed, note=note, started_at=started)
    else:
        record_quiet_run(db, SCRIPT, written=0, note=note, started_at=started)
    print(json.dumps({"new": res.new}) if res.new else "", end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
