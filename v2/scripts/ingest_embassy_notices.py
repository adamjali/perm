#!/usr/bin/env python3
"""The visa notices of the U.S. embassies that issue the most employment-based immigrant visas.

    python3 scripts/ingest_embassy_notices.py --bundle embassies.json            # load a copy made in a browser
    python3 scripts/ingest_embassy_notices.py --bundle embassies.json --dry-run  # read and decide, write nothing

WHERE IT COMES FROM (Nov 4 2026). Each embassy's site is WordPress, and WordPress serves a feed of every
category: /category/visas/feed/ is the site's Visas posts, newest ten first, each with its title, link,
date, categories and an excerpt. The 20 embassies (scripts/data/embassy_feeds.json) are the consulates that
issued the most employment-based immigrant visas from March 2025 to February 2026 in State's own monthly
files, Manila first. Every usembassy.gov site answers scripts with CloudFront's 403 ("Technical
Difficulties") from this Mac and the server, so the feeds are read in the owner's Chrome, where they load
like any page: the session timer `embassy-read` fetches each feed and its robots.txt from the embassy's
own origin, carries the copies across the visits in the tab's window.name, and hands the lot over in one
clipboard copy:

    {"copiedAt": ISO, "feeds": {host: {"status": n, "text": rss}}, "robots": {host: {"status": n, "text": ...}}}

Nothing is solved or worked around: the feeds are public pages read at a person's pace, once a day, and a
feed whose robots.txt asks robots off is skipped.

WHAT IT KEEPS. An embassy's Visas category holds two kinds of post: dated notices (an operations update,
appointments cancelled for a protest, routine services resuming, a new appointment system) and evergreen
pages filed as posts (document checklists, fraud warnings, how to visit). Only the first is news, and only
a recent one (KEEP_DAYS). The rule, in order (`decide`), on the title alone (the body only supplies the
excerpt a reader sees, from content:encoded, since WordPress's description is just "The post X appeared first
on Y"):
  1. Older than KEEP_DAYS before the copy: dropped (a first load would otherwise add 2020's COVID notices).
  2. An evergreen page's title (a checklist, samples, fraud, an FAQ, required documents, a page about
     visiting): dropped, unless it also names an operations change ("closed", "resumption").
  3. A message for U.S. citizens, a health or travel alert: dropped (not a visa matter).
  4. Visitor, student or exchange visas only, naming no immigrant or work visa: dropped.
  5. Names immigrant visas, NVC or a work visa: kept. Or names consular operations (an update, a notice,
     interviews or appointments paused, cancelled, rescheduled or resumed, a closure or holiday schedule,
     a new system or requirement, processing or issuance): kept.
  6. Anything else: dropped.

ROWS. type "Embassy notice", agencies [the embassy's name], the post's link, its excerpt cut at a word as
the abstract, and its day in the embassy's own time zone (WordPress dates its feed in UTC, and a Manila
morning is the evening before in UTC). The number is embassy-<code>-<the post's slug>, so the consulate
pages find an embassy's notices by that prefix.

HEALTH. Freshness ("policy-notices-embassies") is the newest post on any of the feeds, a day the embassies
set: they post visa news unevenly, so a quiet month reads as the source not republishing, and the timer's
own heartbeat (the health check's check_browser_timers) says whether the read ran. A feed that didn't
answer or doesn't parse is named in the run's note; when none parses, the run fails and writes nothing.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_db import Database, et_today, record_run, stamp_freshness  # noqa: E402
from lib_gov_data import log, parse_robots, rules_allow  # noqa: E402
from lib_policy_feed import expire_policy_page, record_quiet_run, topics_of, write_notices  # noqa: E402

SCRIPT = "ingest_embassy_notices.py"
SOURCE = "embassies"
# The consulate pages show each embassy's newest notices (src/lib/db/consularPosts.ts).
CONSULAR_ROUTE = "/api/revalidate-consular"
DATASET = "policy-notices-embassies"
TYPE = "Embassy notice"
LABEL = "U.S. embassies' visa news (their sites' Visas feeds)"
CADENCE = "Daily, read in a browser"
MAX_AGE_DAYS = 45            # the 20 feeds' newest post; on Nov 4 2026 the gaps between notices ran to weeks
KEEP_DAYS = 365              # a notice older than this before the copy is history, not news
STALE_COPY_DAYS = 3          # a copy older than this is loaded but named in the note
ABSTRACT_CHARS = 600
FEEDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "embassy_feeds.json")

EVERGREEN = re.compile(
    r"\b(checklists?|samples?|navigator|report(ing)? fraud|prevent fraud|fraud information|combating fraud|"
    r"frequently asked|faqs?|myths|contact us|instructions|required documents|supporting documentation|"
    r"panel physicians|lost (and|or) stolen|visiting the embassy|check your case|abandonment|returning resident|"
    r"boarding foil|birth abroad|crba|scams?|refused|approved|next steps|reasonable accommodation|"
    r"re-?entry permits?|travel resource|courier|schedule of fees|fees? increase)\b", re.I)
NOT_VISAS = re.compile(r"\b(message (for|to) u\.?s\.? citizens|health alert|travel alert|voting)\b", re.I)
VISITOR_ONLY = re.compile(
    r"\b(b-?1\s*/\s*b-?2|visitor visas?|tourist|students?|exchange visitors?|j-?1|j visa|f-?1|esta|"
    r"visa waiver program|diplomatic|birth tourism)\b", re.I)
WORK_OR_IMMIGRANT = re.compile(
    r"\b(immigrant visas?|iv\b|nvc|national visa center|public charge|h-?1b|h-?2[ab]?|l-?1|e-?[123]\b|o-?1|"
    r"employment[- ]based|work visas?|petition)", re.I)
NONIMMIGRANT = re.compile(r"\bnon-?immigrant", re.I)
OPERATIONS = re.compile(
    r"\b(operations?|updates?|notice|announcement|important|closed|closures?|holiday schedule|calendar|"
    r"resum\w*|paus\w*|postpon\w*|suspen\w*|cancel\w*|reschedul\w*|appointments?|interviews?|"
    r"registration|requirements?|transition|maintenance|issuance|screening|vetting|delays?|processing)\b", re.I)


def embassies(path: str = FEEDS) -> list[dict]:
    return json.loads(open(path, encoding="utf-8").read())["embassies"]


def text_of(fragment: str | None) -> str:
    """An excerpt as a reader sees it: tags, entities and WordPress's "appeared first on" line gone."""
    t = html.unescape(re.sub(r"<[^>]+>", " ", fragment or ""))
    t = re.sub(r"The post .{0,300}? appeared first on .*$", "", t, flags=re.S)
    t = " ".join(t.split())
    return re.sub(r"\s+([,.;:)])", r"\1", t)


# WordPress puts the post itself in content:encoded; its description is only "The post X appeared first on Y".
CONTENT_NS = "{http://purl.org/rss/1.0/modules/content/}encoded"
# The embassy theme opens each post with a title block (`ga-title`) that repeats the heading and the date.
TITLE_BLOCK = re.compile(r'<section[^>]*class="[^"]*\bga-title\b[^"]*"[^>]*>[\s\S]*?</section>', re.I)


def body_text(encoded: str | None, title: str) -> str:
    """The post's own words: content:encoded without its scripts, styles and title block, and without the
    heading again at its start (the posts with no title block repeat it as their first line)."""
    if not encoded:
        return ""
    t = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", encoded, flags=re.I)
    t = text_of(TITLE_BLOCK.sub(" ", t, count=1))
    if title and t.casefold().startswith(title.casefold()):
        t = t[len(title):].lstrip(" :.-")
    return t


def cut_at_word(t: str, n: int = ABSTRACT_CHARS) -> str | None:
    if not t:
        return None
    if len(t) <= n:
        return t
    head = t[:n].rsplit(" ", 1)[0].rstrip(" ,;:")
    return head + "..."


def decide(title: str) -> tuple[bool, str]:
    """(kept, why) for one post, on its title. See the module's docstring.

    The title alone decides: a post's body (the excerpt readers see) names appointments, interviews and
    petitions on almost every visa page, so a rule that read it kept the evergreen family-visa pages too
    (Nov 4 2026: an I-130 filing page, an I-730 page and a widow's visa page)."""
    ops_in_title = OPERATIONS.search(title)
    if EVERGREEN.search(title) and not re.search(r"\b(closed|closures?|resum\w*|paus\w*|suspen\w*)\b", title, re.I):
        return False, "an evergreen page, not a notice"
    if NOT_VISAS.search(title):
        return False, "a message for U.S. citizens or a travel alert, not a visa matter"
    work = WORK_OR_IMMIGRANT.search(NONIMMIGRANT.sub("", title))
    if VISITOR_ONLY.search(title) and not work:
        return False, "visitor, student or exchange visas only"
    if work and ops_in_title:
        return True, f"names {work.group(0)}"
    if ops_in_title:
        return True, f"consular operations ({ops_in_title.group(0).lower()})"
    return False, "names no consular operation or immigrant or work visa"


def local_day(pub: str, tz: str) -> str | None:
    """The day a feed's RFC 822 date falls on in the embassy's own time zone."""
    try:
        when = parsedate_to_datetime(pub)
    except (TypeError, ValueError):
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=dt.timezone.utc)
    return when.astimezone(ZoneInfo(tz)).date().isoformat()


def slug_of(link: str) -> str | None:
    m = re.search(r"/([a-z0-9][a-z0-9-]*)/?$", link.lower().split("?")[0].split("#")[0])
    return m.group(1)[:120] if m else None


def parse_feed(text: str) -> list[dict]:
    """Every post on one feed: {title, link, pub, excerpt, categories}. Raises ValueError.

    An RSS feed never needs a document type or entity declarations, and a feed carrying one is refused
    before it's parsed: the standard parser expands declared entities, which a hostile copy could use to
    blow up its size."""
    if re.search(r"<!(DOCTYPE|ENTITY)", text if isinstance(text, str) else text.decode("utf-8", "replace"), re.I):
        raise ValueError("a document type or entity declaration")
    root = ET.fromstring(text.encode("utf-8") if isinstance(text, str) else text)
    channel = root.find("channel")
    if channel is None:
        raise ValueError("no RSS channel")
    out = []
    for it in channel.findall("item"):
        title = " ".join(html.unescape(it.findtext("title") or "").split())
        link = (it.findtext("link") or "").strip()
        if not title or not link:
            continue
        out.append({
            "title": title, "link": link, "pub": it.findtext("pubDate") or "",
            "excerpt": body_text(it.findtext(CONTENT_NS), title) or text_of(it.findtext("description")),
            "categories": [c.text.strip() for c in it.findall("category") if c.text],
        })
    return out


def robots_ok(robots: dict | None, path: str) -> bool:
    """A robots.txt that didn't answer 200 counts as no rules, as lib_gov_data reads one."""
    if not robots or robots.get("status") != 200:
        return True
    return rules_allow(parse_robots(str(robots.get("text") or "")), path)


def read(bundle: dict, *, today: str, path: str, plan: list[dict]) -> tuple[list[dict], dict]:
    """(rows to write, a report) from a copied bundle."""
    feeds = bundle.get("feeds") or {}
    robots = bundle.get("robots") or {}
    floor = (dt.date.fromisoformat(today) - dt.timedelta(days=KEEP_DAYS)).isoformat()
    rows: dict[str, dict] = {}
    report = {"read": 0, "posts": 0, "kept": 0, "newest": None, "missing": [], "unreadable": [], "robots": [], "why": {}}
    for e in plan:
        host = e["host"]
        got = feeds.get(host)
        if not isinstance(got, dict) or got.get("status") != 200 or not got.get("text"):
            report["missing"].append(e["code"])
            continue
        if not robots_ok(robots.get(host), path):
            report["robots"].append(e["code"])
            continue
        try:
            posts = parse_feed(got["text"])
        except (ET.ParseError, ValueError):
            report["unreadable"].append(e["code"])
            continue
        report["read"] += 1
        for p in posts:
            day = local_day(p["pub"], e["tz"])
            slug = slug_of(p["link"])
            if not day or not slug:
                continue
            report["posts"] += 1
            if not report["newest"] or day > report["newest"]:
                report["newest"] = day
            if day < floor:
                continue
            kept, why = decide(p["title"])
            report["why"][f"{e['code']} {day} {p['title'][:70]}"] = ("kept: " if kept else "dropped: ") + why
            if not kept:
                continue
            num = f"embassy-{e['code']}-{slug}"
            rows[num] = {
                "document_number": num,
                "publication_date": day,
                "type": TYPE,
                "title": p["title"],
                "abstract": cut_at_word(p["excerpt"]),
                "html_url": p["link"],
                "agencies": [e["name"]],
                "topics": sorted(set(topics_of(p["title"], p["excerpt"])) | {"consular"}),
            }
    report["kept"] = len(rows)
    return list(rows.values()), report


def run(db, bundle_path: str, *, dry_run: bool = False, plan: list[dict] | None = None, today: str | None = None) -> int:
    started = time.time()
    plan = plan if plan is not None else embassies()
    path = json.loads(open(FEEDS, encoding="utf-8").read())["path"]
    today = today or et_today()
    try:
        bundle = json.loads(open(bundle_path, encoding="utf-8").read())
        if not isinstance(bundle, dict) or not isinstance(bundle.get("feeds"), dict):
            raise ValueError("the copy has no feeds")
    except (OSError, ValueError) as e:
        log(f"::error::the embassies' copy can't be read: {e}. Nothing was written.")
        if db is not None and not dry_run:
            record_run(db, SCRIPT, status="failed", rows_written=0, note=f"the copy can't be read: {e}", started_at=started)
        return 1
    rows, rep = read(bundle, today=today, path=path, plan=plan)
    parts = [f"{rep['read']} of {len(plan)} feeds read, {rep['posts']} posts, {rep['kept']} kept"]
    for key, label in (("missing", "no copy or no answer"), ("unreadable", "didn't parse"), ("robots", "robots.txt asks robots off")):
        if rep[key]:
            parts.append(f"{label}: {', '.join(rep[key])}")
    copied = str(bundle.get("copiedAt") or "")[:10]
    if copied and copied < (dt.date.fromisoformat(today) - dt.timedelta(days=STALE_COPY_DAYS)).isoformat():
        parts.append(f"the copy is from {copied}")
    if rep["read"] == 0:
        note = "; ".join(parts)
        log(f"::error::no embassy feed could be read ({note}). Nothing was written.")
        if db is not None and not dry_run:
            record_run(db, SCRIPT, status="failed", rows_written=0, note=note, started_at=started)
        return 1
    if dry_run or db is None:
        for k, v in sorted(rep["why"].items(), key=lambda kv: kv[0].split(" ", 2)[1], reverse=True):
            verdict, why = v.split(": ", 1)
            print(f"  {verdict:7} {k}  ({why})")
        log("; ".join(parts))
        return 0
    res = write_notices(db, rows, source=SOURCE)
    parts[0] += f", {res.written} written ({len(res.new)} new)"
    stamp_freshness(db, DATASET, as_of=min(rep["newest"] or today, today), source=LABEL, cadence=CADENCE,
                    note=parts[0], max_age_days=MAX_AGE_DAYS)
    # The notices show on the policy page and on each embassy's consulate pages, so both refresh.
    if res.written and False in (expire_policy_page(log), expire_policy_page(log, route=CONSULAR_ROUTE)):
        parts.append("a page refresh call failed")
    note = "; ".join(parts)
    log(note)
    if res.written:
        record_run(db, SCRIPT, status="ok", rows_written=res.written, note=note, started_at=started)
    else:
        record_quiet_run(db, SCRIPT, written=0, note=note, started_at=started)
    print(json.dumps({"new": res.new}) if res.new else "", end="")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bundle", required=True, help="the copy made in a browser")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    return run(None if args.dry_run else Database(), args.bundle, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
