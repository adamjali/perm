#!/usr/bin/env python3
"""USCIS's newsroom and Policy Manual updates, into the policy feed.

    python3 scripts/ingest_uscis_news.py                        # fetch and write
    python3 scripts/ingest_uscis_news.py --dry-run              # fetch and print, write nothing
    python3 scripts/ingest_uscis_news.py --from-file feed.rss   # parse a saved copy, then write

WHAT THIS IS. Two USCIS lists, read whole, one request each:
- The All News feed, `www.uscis.gov/news/rss-feed/59144`, the RSS the newsroom
  page itself links to: its newest 250 news releases and alerts, back to late
  2024 when read on Oct 27 2026. If the feed is gone or reads as nothing, the
  newsroom page (`/newsroom/all-news`, ten a page) is read instead. Type "USCIS
  announcement", source `uscis-news`, action USCIS's own kind ("News release",
  "Alert").
- The Policy Manual's updates page, `www.uscis.gov/policy-manual/updates`,
  which lists every policy alert and technical update since January 2013 on one
  page (355 on Oct 27 2026). Type "Policy Manual update", source
  `uscis-policy-manual`, action "Policy alert" or "Technical update", the
  citation the affected sections (`1 USCIS-PM B.6`).

Only work-based immigration is kept (`keep_news`, `keep_policy_manual`): PERM,
wages, the work visas, employment-based green cards, adjustment of status, work
permits, fees and premium processing, and the forms those run on. USCIS's fraud
cases, naturalization, and family-only or humanitarian-only items are left out.
A missed item is the cost of a rule; the rule is in the code and tested.

WHAT IT IS NOT. A summary. The abstract is USCIS's own summary from the list,
verbatim, cut at a word near 600 characters. A row links to USCIS's own page
(for a Policy Manual update, the alert's PDF or the first section it changed).

WHERE IT RUNS. The Oracle server: www.uscis.gov serves its residential and
datacenter addresses alike most days, and GitHub's runners are refused on some.
robots.txt asks for ten seconds between requests (Crawl-delay: 10), so the two
lists are read ten seconds apart, and never one request per item.

TROUBLE. A refusal or an outage (403, 429, 5xx, a timeout) is a warning: that
list writes nothing, the run is recorded ok with the refusal in its note, and the
list's freshness row is the alarm. A list that reads as nothing, or whose shape
changed, writes nothing and exits 1 naming what was missing. A defect in this
code crashes.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html as htmllib
import json
import os
import re
import sys
import time
import urllib.error
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_db import Database, et_today, record_run, stamp_freshness  # noqa: E402
from lib_gov_data import RobotsDisallowed, fetch as gov_fetch  # noqa: E402
from lib_policy_feed import eastern_day, expire_policy_page, record_quiet_run, topics_of, write_notices  # noqa: E402
from lib_warn import is_unreachable  # noqa: E402

SCRIPT = "ingest_uscis_news.py"
HOST = "https://www.uscis.gov"
FEED_URL = f"{HOST}/news/rss-feed/59144"
NEWS_URL = f"{HOST}/newsroom/all-news"
PM_URL = f"{HOST}/policy-manual/updates"
AGENCIES = ["U.S. Citizenship and Immigration Services"]
CRAWL_DELAY_S = 10  # robots.txt, read Oct 27 2026
FETCH_ATTEMPTS = 2  # lib_gov_data waits 20 s before the second

NEWS_DATASET = "policy-notices-uscis"
PM_DATASET = "policy-notices-uscis-pm"
NEWS_TYPE = "USCIS announcement"
PM_TYPE = "Policy Manual update"
CADENCE = "Every 30 minutes"

# BUDGETS, FROM USCIS'S OWN POSTING GAPS (measured Oct 27 2026 on the lists
# above, the twelve months to Oct 26 2026). Each is the longest gap plus a week,
# and never under the newest item's age that day plus 14 days.
# - News: 94 posting days in the year; the longest gap 17 days (Mar 2 to Mar 19
#   2026), the next 15. 17 + 7 = 24 (the floor, 1 + 14 = 15, is lower).
# - Policy Manual: 26 update days in the year; the longest gap 94 days (Feb 3
#   to May 8 2026). 94 + 7 = 101 (the floor, 4 + 14 = 18, is lower).
NEWS_MAX_AGE_DAYS = 24
PM_MAX_AGE_DAYS = 101

ABSTRACT_CHARS = 600
# Nothing on either list is older than 2013 or dated ahead of today by more
# than a day or two; a year outside that is a typo, dropped and named.
EARLIEST = dt.date(2000, 1, 1)
DATE_SLACK_DAYS = 3
# A list whose rows parse this badly has changed shape: write nothing.
MIN_PARSED_SHARE = 0.9


class LostStructure(ValueError):
    """A list read fine and didn't look like itself: no rows, or rows missing
    what every row has. Names what was missing."""


def log(msg: str) -> None:
    print(f"[uscis-news] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Text helpers (the DOL reader uses these too)
# ---------------------------------------------------------------------------

def listing_text(fragment: str) -> str:
    """A list's HTML fragment as one line of text: tags dropped, entities
    decoded (twice, for a feed that escapes its HTML), spaces closed."""
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", fragment or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = htmllib.unescape(htmllib.unescape(s)) if "&amp;" in s else htmllib.unescape(s)
    s = re.sub(r"<[^>]+>", " ", s)  # a feed's escaped markup, now unescaped
    s = s.replace("\xa0", " ").replace("​", "")
    return re.sub(r"\s+", " ", s).strip()


def cut_at_word(text: str | None, limit: int = ABSTRACT_CHARS) -> str | None:
    """The text whole when it fits; else cut at the last space before `limit`,
    with " ..." to say so."""
    if not text:
        return None
    if len(text) <= limit:
        return text
    cut = text[:limit]
    space = cut.rfind(" ")
    return (cut[:space] if space > limit // 2 else cut).rstrip(" ,;:") + " ..."


def plausible_day(day: str | None, today: dt.date | None = None) -> bool:
    if not day:
        return False
    try:
        d = dt.date.fromisoformat(day)
    except ValueError:
        return False
    today = today or dt.date.fromisoformat(et_today())
    return EARLIEST <= d <= today + dt.timedelta(days=DATE_SLACK_DAYS)


def check_rows(found: int, parsed: list, what: str, needs: str) -> None:
    """Refuse a list that read as nothing or parsed badly (LostStructure)."""
    if found == 0:
        raise LostStructure(f"{what}: no rows at all (looked for {needs})")
    if not parsed:
        raise LostStructure(f"{what}: {found} rows, none with {needs}")
    if len(parsed) < MIN_PARSED_SHARE * found:
        raise LostStructure(f"{what}: only {len(parsed)} of {found} rows had {needs}")


def drop_implausible(items: list[dict], what: str) -> list[dict]:
    bad = [i for i in items if not plausible_day(i["day"])]
    if bad:
        print(f"::warning::{what}: dropped {len(bad)} with an implausible date: "
              + "; ".join(f"{i['day']} {i['title'][:60]!r}" for i in bad[:5]), flush=True)
    return [i for i in items if plausible_day(i["day"])]


# ---------------------------------------------------------------------------
# Parsers (pure)
# ---------------------------------------------------------------------------

def _kind_of(url: str) -> str:
    """USCIS's own kind, from the newsroom section the item sits in."""
    m = re.search(r"/newsroom/([^/]+)/[^/]+/?$", url)
    if not m:
        return "News"
    section = m.group(1)
    return {"alerts": "Alert", "news-releases": "News release"}.get(section, section.replace("-", " ").capitalize())


def _slug(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1]


def _cdata(s: str) -> str:
    return re.sub(r"(?s)^\s*<!\[CDATA\[(.*)\]\]>\s*$", r"\1", s)


def parse_rss(text: str) -> list[dict]:
    """The All News feed's items: title, link, the day (Eastern), summary, kind."""
    if "<rss" not in text[:2000] and "<channel" not in text:
        raise LostStructure("feed: not an RSS document")
    blocks = re.findall(r"(?is)<item\b[^>]*>(.*?)</item>", text)
    items: list[dict] = []
    for b in blocks:
        title = re.search(r"(?is)<title>(.*?)</title>", b)
        link = re.search(r"(?is)<link>(.*?)</link>", b)
        when = re.search(r"(?is)<pubDate>(.*?)</pubDate>", b)
        if not (title and link and when):
            continue
        url = listing_text(link.group(1))
        if "/newsroom/" not in url:
            continue
        desc = re.search(r"(?is)<description>(.*?)</description>", b)
        items.append({
            "title": listing_text(_cdata(title.group(1))),
            "url": url,
            "day": eastern_day(listing_text(when.group(1))),
            "summary": listing_text(_cdata(desc.group(1))) if desc else "",
            "kind": _kind_of(url),
        })
    items = drop_implausible(items, "feed")
    check_rows(len(blocks), items, "feed", "a title, a newsroom link and a plausible date")
    return items


def parse_listing_html(text: str) -> list[dict]:
    """The newsroom page (`/newsroom/all-news`): ten rows a page, the same fields."""
    blocks = re.split(r'<div class="views-row[ "]', text)[1:]
    items: list[dict] = []
    for b in blocks:
        a = re.search(r'(?is)<h3[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)</a>', b)
        when = re.search(r'<time datetime="([^"]+)"', b)
        if not (a and when):
            continue
        href = htmllib.unescape(a.group(1))
        url = href if href.startswith("http") else HOST + href
        if "/newsroom/" not in url:
            continue
        body = re.search(r'(?is)views-field-body">\s*<div class="field-content">(.*?)</div>', b)
        items.append({
            "title": listing_text(a.group(2)),
            "url": url,
            "day": eastern_day(when.group(1)),
            "summary": listing_text(body.group(1)) if body else "",
            "kind": _kind_of(url),
        })
    items = drop_implausible(items, "newsroom page")
    check_rows(len(blocks), items, "newsroom page", "a linked title and a plausible date")
    return items


PM_KINDS = {"policy alert": "Policy alert", "technical update": "Technical update"}


def parse_policy_manual(text: str) -> list[dict]:
    """Every row of the updates page: kind, title, day, summary, the PDF if
    there is one, and the affected sections as (volume, part, citation, url)."""
    blocks = re.split(r'<div class="views-row[ "]', text)[1:]
    items: list[dict] = []
    for b in blocks:
        head = re.search(r'(?is)pm-resource__update_header">(.*?)</div>', b)
        when = re.search(r'<time datetime="([^"]+)"', b)
        if not (head and when):
            continue
        kind_raw, sep, title = listing_text(head.group(1)).partition(" - ")
        kind = PM_KINDS.get(kind_raw.strip().lower())
        if not sep or not kind or not title.strip():
            continue
        body = re.search(r'(?is)field--name-body field__item">(.*?)</div>', b)
        pdf = re.search(r'(?is)<a href="([^"]+\.pdf)"[^>]*>\s*Read More', b)
        sections = []
        for href, cit in re.findall(
                r'(?is)<a href="(/policy-manual/volume-[^"]+)"[^>]*>\s*<span class="citation">([^<]+)</span>', b):
            m = re.match(r"\s*(\d+) USCIS-PM ([A-Z]+)", cit)
            if m:
                sections.append((int(m.group(1)), m.group(2), cit.strip(), HOST + href))
        pdf_url = None
        if pdf:
            pdf_url = pdf.group(1) if pdf.group(1).startswith("http") else HOST + pdf.group(1)
        items.append({
            "title": title.strip(),
            "kind": kind,
            "day": eastern_day(when.group(1)),
            "summary": listing_text(body.group(1)) if body else "",
            "pdf_url": pdf_url,
            "sections": sections,
        })
    items = drop_implausible(items, "Policy Manual updates")
    check_rows(len(blocks), items, "Policy Manual updates", "a policy alert or technical update header and a plausible date")
    return items


# ---------------------------------------------------------------------------
# What's kept (pure)
# ---------------------------------------------------------------------------

# USCIS's fraud, voting and removal cases: always out, whatever program they name.
CRIME = re.compile(
    r"\bcharged\b|\bcharges (?:for|against)\b|\bindict|\bconvict|\bsentenc|\bguilty\b|\badmits\b|\barrest|denaturaliz"
    r"|strip (?:u\.s\. )?citizenship|revoke (?:u\.s\. )?citizenship|apprehend|racketeering|smuggl|traffick"
    r"|unlawful(?:ly)? vot|illegal(?:ly)? vot|\bvoter\b|\bvoting\b|takedown|\bfugitive\b|terroris"
    r"|fraud (?:ring|scheme|operation|investigation)s?\b|crackdown|removal proceedings",
    re.I,
)
# A term that's only about work-based immigration: kept even beside a
# humanitarian word ("International Entrepreneur Parole").
SPECIFIC_WORK = re.compile(
    r"\bH-?1B1?\b|\bH-?2[AB]?\b|\bH-?4\b|\bCW-?1\b|\bE-[1-3]\b|\bL-[12][AB]?\b|\bO-1[AB]?\b|\bEB-?[1-5]\b"
    r"|employment-based|national interest waiver|\bPERM\b|labor certification|prevailing wage"
    r"|premium processing|nonimmigrant workers?|religious workers?|\bathletes?\b|international entrepreneur"
    r"|specialty occupation|cap[- ]subject|immigrant investor"
    r"|\bI-(?:129|140|907|526|956)\b|agricultural workers?|returning workers?|visa bulletin|Child Status Protection Act|\bCSPA\b",
    re.I,
)
# Work-based too, but shared with humanitarian and family filings: kept unless
# the title names a humanitarian or family group.
BROAD_WORK = re.compile(
    r"adjustment of status|adjust(?:ing)? status|green cards?|employment authori[sz]ation|\bEADs?\b"
    r"|work permits?|public charge|\bI-(?:485|765|131|693|539)\b|priority date|medical exam",
    re.I,
)
# Procedure every filer meets: kept when the title names one and nothing
# humanitarian or family-only.
GENERAL = re.compile(
    r"\bfees?\b|\bfiling\b|electronic|e-?filing|\bpayments?\b|biometrics|\bevidence\b|offices? (?:are )?closed"
    r"|\boutage\b|\bphotos?\b|screening and vetting|online account|processing times?|\bforms?\b",
    re.I,
)
HUMANITARIAN_FAMILY = re.compile(
    r"\bTPS\b|temporary protected status|asylum|asylee|refugee|\bparole|\bVAWA\b|\b[UT] visas?\b"
    r"|\b[UT] nonimmigrant|special immigrant juvenile|\bSIJ\b|diversity (?:immigrant )?visa|naturaliz"
    r"|citizenship (?:test|interview|ceremon)|oath of allegiance|family-based|family reunification|\bCHNV\b"
    r"|deferred action|\bDACA\b|\bCBP One\b|\bAfghan|\bUkrain|humanitarian|detainees?|\bI-(?:730|134A?|821D?)\b"
    r"|adopt(?:ion|ed|ive)|\bspousal\b|victims? of|8 U\.S\.C\. 1367|aliens in custody|certificates? of citizenship|U\.S\. citizens? at birth",
    re.I,
)


def keep_news(title: str, summary: str = "") -> bool:
    """A newsroom item is kept when it's about work-based immigration."""
    if CRIME.search(title):
        return False
    if SPECIFIC_WORK.search(title):
        return True
    if HUMANITARIAN_FAMILY.search(title):
        return False
    if BROAD_WORK.search(title):
        return True
    if HUMANITARIAN_FAMILY.search(summary or ""):
        return False
    return bool(SPECIFIC_WORK.search(summary or "") or BROAD_WORK.search(summary or "") or GENERAL.search(title))


# The Policy Manual's volumes and parts that are about work-based immigration
# or apply to every filer (None means the whole volume). Read from the manual's
# own table of contents on Oct 27 2026: 1 general policies (all but Part I,
# deferred action); 2 nonimmigrants; 6 immigrants, Parts A (general), E
# (employment-based), F (employment classifications), G (investors) and H
# (special immigrants, religious workers among them); 7 adjustment of status,
# Parts A, B, C (245(i)), E (employment-based), F (special immigrant) and G
# (investor); 8 admissibility, Parts B (health, the I-693), C (civil surgeons)
# and G (public charge); 10 employment authorization; 11 travel and identity
# documents, Parts A and F. Out: 3 humanitarian, 4 refugees and asylees, 5
# adoptions, 9 waivers, 12 citizenship, and the family and humanitarian parts.
PM_WORK_PARTS: dict[int, set[str] | None] = {
    1: set("ABCDEFGH"),
    2: None,
    6: set("AEFGH"),
    7: set("ABCEFG"),
    8: set("BCG"),
    10: None,
    11: set("AF"),
}


def keep_policy_manual(title: str, summary: str = "", sections: list | None = None) -> bool:
    """A Policy Manual update is kept when its title is work-based, or it
    changed a work-based part of the manual and isn't titled for a
    humanitarian or family group."""
    if SPECIFIC_WORK.search(title):
        return True
    if HUMANITARIAN_FAMILY.search(title):
        return False
    if sections:
        for vol, part, *_ in sections:
            if vol in PM_WORK_PARTS and (PM_WORK_PARTS[vol] is None or part in PM_WORK_PARTS[vol]):
                return True
        return bool(BROAD_WORK.search(title))
    return bool(BROAD_WORK.search(title) or SPECIFIC_WORK.search(summary or "")
                or (BROAD_WORK.search(summary or "") and not HUMANITARIAN_FAMILY.search(summary or "")))


# ---------------------------------------------------------------------------
# Rows for the shared writer
# ---------------------------------------------------------------------------

def news_rows(items: list[dict]) -> list[dict]:
    rows = []
    for i in items:
        if not keep_news(i["title"], i["summary"]):
            continue
        abstract = cut_at_word(i["summary"])
        rows.append({
            "document_number": f"uscis-{_slug(i['url'])}",
            "publication_date": i["day"],
            "type": NEWS_TYPE,
            "title": i["title"],
            "abstract": abstract,
            "html_url": i["url"],
            "agencies": AGENCIES,
            "topics": topics_of(i["title"], i["summary"]),
            "action": i["kind"],
        })
    return rows


def pm_rows(items: list[dict]) -> list[dict]:
    rows = []
    for i in items:
        if not keep_policy_manual(i["title"], i["summary"], i["sections"]):
            continue
        # A stable id for a public notice, not a security hash; another hash would re-key every held row.
        # nosemgrep: python.lang.security.insecure-hash-algorithms.insecure-hash-algorithm-sha1
        digest = hashlib.sha1(f"{i['kind']}|{i['title']}".encode()).hexdigest()[:8]
        citations = list(dict.fromkeys(s[2] for s in i["sections"]))
        url = i["pdf_url"] or (i["sections"][0][3] if i["sections"] else PM_URL)
        rows.append({
            "document_number": f"uscis-pm-{i['day']}-{digest}",
            "publication_date": i["day"],
            "type": PM_TYPE,
            "title": i["title"],
            "abstract": cut_at_word(i["summary"]),
            "html_url": url,
            "agencies": AGENCIES,
            "topics": topics_of(i["title"], i["summary"]),
            "action": i["kind"],
            "citation": "; ".join(citations) or None,
            "pdf_url": i["pdf_url"],
        })
    return rows


# ---------------------------------------------------------------------------
# Reading, with trouble sorted
# ---------------------------------------------------------------------------

def fetch_url(url: str) -> str:
    return gov_fetch(url, attempts=FETCH_ATTEMPTS).decode("utf-8", errors="replace")


def trouble(exc: BaseException) -> str | None:
    """'refused' (the host's bad day or its robots.txt: a warning), 'broken'
    (an answer that says the page moved: exit 1), None (our own defect)."""
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


@dataclass
class Outcome:
    name: str            # how the note names this list
    dataset: str
    status: str = "ok"   # ok, refused, broken
    note: str = ""
    items: list[dict] = field(default_factory=list)  # everything parsed
    rows: list[dict] = field(default_factory=list)   # what's kept
    written: int = 0


def read_news(fetch=fetch_url, sleep=time.sleep) -> Outcome:
    out = Outcome("news", NEWS_DATASET)
    problems: list[str] = []
    try:
        out.items = parse_rss(fetch(FEED_URL))
        return out
    except LostStructure as e:
        problems.append(str(e))
    except Exception as e:  # noqa: BLE001 - sorted below; a defect re-raises
        kind = trouble(e)
        if kind is None:
            raise
        if kind == "refused":
            out.status, out.note = "refused", f"news feed unread ({describe(e)})"
            return out
        problems.append(f"feed answered {describe(e)}")
    # The feed is gone or reads as nothing: the newsroom page has the newest ten.
    log(f"::warning::{problems[-1]}; reading the newsroom page instead")
    sleep(CRAWL_DELAY_S)
    try:
        out.items = parse_listing_html(fetch(NEWS_URL))
        out.note = f"feed unread ({problems[-1]}), newsroom page read"
        return out
    except LostStructure as e:
        problems.append(str(e))
    except Exception as e:  # noqa: BLE001
        kind = trouble(e)
        if kind is None:
            raise
        problems.append(f"newsroom page answered {describe(e)}")
        if kind == "refused":
            out.status, out.note = "refused", "; ".join(problems)
            return out
    out.status, out.note = "broken", "; ".join(problems)
    return out


def read_pm(fetch=fetch_url) -> Outcome:
    out = Outcome("Policy Manual", PM_DATASET)
    try:
        out.items = parse_policy_manual(fetch(PM_URL))
    except LostStructure as e:
        out.status, out.note = "broken", str(e)
    except Exception as e:  # noqa: BLE001
        kind = trouble(e)
        if kind is None:
            raise
        out.status = "refused" if kind == "refused" else "broken"
        out.note = f"Policy Manual updates unread ({describe(e)})"
    return out


def build_rows(o: Outcome) -> None:
    if o.status == "ok":
        o.rows = news_rows(o.items) if o.dataset == NEWS_DATASET else pm_rows(o.items)


def detect(raw: str) -> str:
    """Which list a saved copy is: 'feed', 'page' (the newsroom page) or 'pm'."""
    head = raw[:3000]
    if "<rss" in head or ("<channel" in raw and "<item" in raw):
        return "feed"
    if "pm-resource__update_header" in raw:
        return "pm"
    if "views-field-title" in raw or "/newsroom/" in raw:
        return "page"
    raise LostStructure("the file is not the USCIS feed, newsroom page or Policy Manual updates page")


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

SOURCE_OF = {NEWS_DATASET: "uscis-news", PM_DATASET: "uscis-policy-manual"}
LABEL_OF = {NEWS_DATASET: "USCIS newsroom", PM_DATASET: "USCIS Policy Manual updates"}
BUDGET_OF = {NEWS_DATASET: NEWS_MAX_AGE_DAYS, PM_DATASET: PM_MAX_AGE_DAYS}


def store(db, o: Outcome) -> None:
    """Write one list's kept rows and stamp its freshness from the newest item
    on the whole list (the source is alive whatever this site keeps)."""
    res = write_notices(db, o.rows, source=SOURCE_OF[o.dataset])
    o.written = res.written
    newest = max((i["day"] for i in o.items), default=None)
    if newest:
        stamp_freshness(
            db, o.dataset, as_of=min(newest, et_today()), source=LABEL_OF[o.dataset], cadence=CADENCE,
            note=f"{len(o.items)} on the list, {len(o.rows)} kept, {res.written} written",
            max_age_days=BUDGET_OF[o.dataset],
        )


def finish(db, outcomes: list[Outcome], started: float, dry_run: bool) -> int:
    for o in outcomes:
        if o.status == "refused":
            log(f"::warning::{o.note}")
        elif o.status == "broken":
            print(f"::error::{o.name}: {o.note}. Nothing from it was written.", flush=True)
        else:
            log(f"{o.name}: {len(o.items)} on the list, {len(o.rows)} kept"
                + (f", newest {max(i['day'] for i in o.items)}" if o.items else ""))
    if dry_run:
        for o in outcomes:
            for r in o.rows[:5]:
                print(json.dumps(r, indent=2)[:900])
        return 1 if any(o.status == "broken" for o in outcomes) else 0

    for o in outcomes:
        if o.status == "ok":
            store(db, o)
    written = sum(o.written for o in outcomes)
    parts = [f"{o.name}: {len(o.rows)} kept of {len(o.items)}, {o.written} written" + (f" ({o.note})" if o.note else "")
             if o.status == "ok" else f"{o.name}: {o.note}" for o in outcomes]
    if written:
        if expire_policy_page(log) is False:
            parts.append("policy page refresh refused")
    note = "; ".join(parts)
    broken = [o for o in outcomes if o.status == "broken"]
    refused = [o for o in outcomes if o.status == "refused"]
    if broken:
        status = "partial" if any(o.status == "ok" for o in outcomes) else "failed"
        record_run(db, SCRIPT, status=status, rows_written=written, note=note, started_at=started)
        return 1
    if refused:
        record_run(db, SCRIPT, status="ok", rows_written=written, note=note, started_at=started)
    else:
        record_quiet_run(db, SCRIPT, written=written, note=note, started_at=started)
    log(f"wrote {written}")
    return 0


def run(db=None, *, fetch=fetch_url, sleep=time.sleep, dry_run: bool = False,
        from_file: str | None = None, only: str | None = None) -> int:
    started = time.time()
    outcomes: list[Outcome] = []
    if from_file:
        raw = open(from_file, encoding="utf-8", errors="replace").read()
        kind = detect(raw)
        o = Outcome("Policy Manual" if kind == "pm" else "news", PM_DATASET if kind == "pm" else NEWS_DATASET)
        try:
            o.items = {"feed": parse_rss, "page": parse_listing_html, "pm": parse_policy_manual}[kind](raw)
        except LostStructure as e:
            o.status, o.note = "broken", str(e)
        outcomes.append(o)
    else:
        if only in (None, "news"):
            outcomes.append(read_news(fetch, sleep))
        if only in (None, "pm"):
            if outcomes:
                sleep(CRAWL_DELAY_S)
            outcomes.append(read_pm(fetch))
    for o in outcomes:
        build_rows(o)
    return finish(None if dry_run else (db if db is not None else Database()), outcomes, started, dry_run)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="fetch and print, write nothing")
    ap.add_argument("--from-file", help="a saved copy of the feed, the newsroom page or the Policy Manual updates page")
    ap.add_argument("--only", choices=["news", "pm"], help="read one list")
    a = ap.parse_args()
    return run(dry_run=a.dry_run, from_file=a.from_file, only=a.only)


if __name__ == "__main__":
    sys.exit(main())
