#!/usr/bin/env python3
"""The State Department's visa news, from its own newsroom.

    python3 scripts/ingest_state_news.py              # read the newsroom, write what's kept
    python3 scripts/ingest_state_news.py --dry-run    # read and decide, write nothing
    python3 scripts/ingest_state_news.py --from-file results.json

WHERE IT COMES FROM (measured Oct 27 2026). travel.state.gov answers scripts
with 403, and its old "Visas News" page now redirects to a new newsroom at
travel.state.gov/en/newsroom.html. State serves the same site from its second
host, adoption.state.gov (the bulletin reader's source since Sep 26), and the
newsroom's own data endpoint there answers plain JSON:

    https://adoption.state.gov/en/newsroom/_jcr_content/root/container-main/
        container-content/newsroom.results.json

It holds the newsroom's newest 10 items, every tag (Visas, Adoption, Passports,
International Travel; 1,069 items in all, 155 of them Visas). Paging doesn't
work: offset, limit, facet and the page's own offsetTSGSearch parameters are
either ignored (the same 10 come back) or answered with a redirect to a 404.
So the newest 10 is the record. On Oct 27 they ran from Aug 5 to Oct 20, and
the newest Visas item was Oct 2: read every 30 minutes, ten items never miss one.

TWO SITES BEHIND ONE NAME. adoption.state.gov resolves to about a dozen
servers, and on Oct 27 some were still on State's old site: they answer the
endpoint with a redirect to /content/travel/en/404.html and a news page with
HTTP 404 and a "404 - Page Not Found" body. Of 8 spaced requests to the
endpoint, 3 answered the JSON; of 4 to a page, 1 answered the page. So every
request is asked again, a few seconds apart, until a server on the new site
answers. Only when no try in LISTING_TRIES reaches one is the run a refusal: a
warning and an ok run row, and the freshness row is the alarm. No redirect is
followed (they all lead to the 404 page), no other host is asked, and no
server is picked by address.

WHAT IT KEEPS. Visas items on this site's subject, decided on the item's own
text (its title and article body), because a title alone misleads: the
"Nonimmigrant Visa Expedited Appointment Pilot Program" of Aug 18 2026 is about
B (visitor) visas only. The rule, in order (`decide`):
  1. Not tagged Visas (adoption, passports, travel): dropped, no page read.
  2. A title naming the diversity lottery, adoption, passports, the visa
     waiver, ESTA or tourism: dropped, no page read.
  3. The text names a work visa or the employment-based line (H-1B, H-2A,
     H-2B, H-3, L-1, O-1, E-3, TN, CW-1, EB-1 to EB-5, PERM, labor
     certification, temporary or skilled workers, the visa bulletin, priority
     dates) or immigrant visas: kept. Immigrant visa processing is how every
     employment-based green card abroad ends.
  4. The text is about visitor visas only (B visas, B1/B2, tourism): dropped.
  5. The text applies to visa applicants generally (screening, vetting,
     appointments, fees, entry restrictions): kept, because workers are visa
     applicants too.
  6. Anything else: dropped.
On the Oct 27 list: kept "Announcement of Expanded Screening and Vetting for
Visa Applicants" (TN, H-1B), "Immigrant Visa Processing Updates for
Nationalities at High Risk of Public Benefits Usage" and "Public Charge Bonds
for Immigrant Visa Applicants"; dropped "Countries Subject to Visa Bonds"
(B1/B2 only), "Diversity Visa Issuance Updated Guidance" and the B-visa
appointment pilot.

A decided item is remembered (perm_docs['state_news_seen']), so its page is
read once, kept or dropped. A kept item whose page no server on the new site
served this run is decided next run; it's named in the run note.

ROWS. type "State Department visa news", agencies ["State Department"], the
travel.state.gov address (the one a reader's browser opens), document_number
"state-<year folder>-<slug>" (the year is in the address; it keeps two years'
items with the same slug apart), the publication day State prints, the
article's first paragraph as the abstract.

HEALTH. Freshness ("policy-notices-state") is the newest item of any tag,
never past today. A refusal or an outage writes nothing and stamps nothing. A
JSON answer that doesn't look like the newsroom's (no results, rows without a
title, address or date) exits 1 and writes nothing. Our own defect crashes.
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
import urllib.error
import urllib.request
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_db import Database, et_today, query_dicts, read_doc, record_run, stamp_freshness, write_doc  # noqa: E402
from lib_gov_data import robots_allowed  # noqa: E402
from lib_policy_feed import (  # noqa: E402
    eastern_day, ensure_table, expire_policy_page, record_quiet_run, topics_of, write_notices,
)
from lib_warn import is_unreachable  # noqa: E402

SCRIPT = "ingest_state_news.py"
SOURCE = "state-news"
HOST = "https://adoption.state.gov"
READER_HOST = "https://travel.state.gov"
LISTING_URL = f"{HOST}/en/newsroom/_jcr_content/root/container-main/container-content/newsroom.results.json"
UA = "permtracker.app policy feed (support@permtracker.app)"
TYPE = "State Department visa news"
AGENCIES = ["State Department"]
DATASET = "policy-notices-state"
LABEL = "State Department newsroom"
CADENCE = "Every 30 minutes"
SEEN_DOC = "state_news_seen"
SEEN_KEEP = 300          # decisions remembered; the list only ever shows 10

# BUDGET. The newest 10 items on Oct 27 2026 (every tag; nothing older can be
# read, see above) were posted Aug 5, 18, 24, 28, 31, Sep 4, 18, Oct 2, 13 and
# 20: the longest gap 14 days (Sep 4 to 18, Sep 18 to Oct 2), the newest 7 days
# old. Longest gap plus a week is 21; the newest age plus 14 is 21. Ten items is
# a thin sample, so this is the budget to revisit first if it ever fires.
MAX_AGE_DAYS = 21

# Asking past the servers still on the old site (see the docstring).
LISTING_TRIES = 8
PAGE_TRIES = 6
RETRY_PAUSE_S = 4
PAGE_PAUSE_S = 2         # between two items' pages
PAGES_PER_RUN = 4        # new items read in one run; the rest wait for the next
TIMEOUT_S = 45
ABSTRACT_CHARS = 600
MIN_PARSED_SHARE = 0.9   # rows that parse, or the list has changed shape

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], 1)}

TITLE_OFF = re.compile(r"\bdiversity\b|\badopt|\bpassports?\b|visa waiver|\bESTA\b|\btouris[mt]\b|intercountry", re.I)
# Codes are matched with their case: "TN" and "PERM" are words in lower case.
WORK_CODES = re.compile(r"\b(?:H-?1B1?|H1-B|H-?2A|H-?2B|H-?3|L-?1[AB]?|O-?1[AB]?|E-?3|TN|CW-?1|EB-?[1-5]|PERM)\b")
WORK_WORDS = re.compile(
    r"employment-based|labor certification|petition-based|temporary (?:and seasonal )?workers?|skilled workers?"
    r"|work visas?|visa bulletin|priority dates?|\bimmigrant visas?\b", re.I)
TOURIST = re.compile(r"\bB-?1\s*/\s*B-?2\b|\bB visas?\b|visitor visas?|\btouris[mt]\b", re.I)
GENERAL = re.compile(
    r"\bnonimmigrant visas?\b|\bvisa applicants?\b|\ball visas?\b"
    r"|\bvisa (?:applications?|issuances?|processing|interviews?|appointments?|fees?|screening|vetting)\b"
    r"|entry of (?:certain )?(?:aliens|foreign nationals|nonimmigrants|immigrants)|\bproclamation\b", re.I)


class LostStructure(ValueError):
    """The newsroom answered and didn't look like itself. Names what was missing."""


class OldSite(Exception):
    """A server still on State's old site answered (a redirect to its 404 page, or the 404 page)."""


def log(msg: str) -> None:
    print(msg, flush=True)


# --- reading -------------------------------------------------------------------

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # every redirect here leads to State's 404 page
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def fetch_url(url: str) -> str:
    """One GET, no redirects followed. A redirect raises HTTPError like any other non-200."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, text/html"})
    with _OPENER.open(req, timeout=TIMEOUT_S) as r:
        return r.read().decode("utf-8", errors="replace")


def _old_site(exc: BaseException) -> bool:
    if isinstance(exc, OldSite):
        return True
    if isinstance(exc, urllib.error.HTTPError):
        if exc.code in (301, 302, 303, 307, 308):
            return "404" in str(exc.headers.get("Location", "") if exc.headers else "")
        return exc.code == 404
    return False


def ask(url: str, tries: int, fetch, sleep, accept) -> tuple[str | None, str]:
    """Ask `url` up to `tries` times until a server on the new site answers.
    (text, "") on success; (None, why) when no try reached one, `why` naming
    what came back. A code defect raises."""
    old = 0
    last = ""
    for attempt in range(tries):
        if attempt:
            sleep(RETRY_PAUSE_S)
        try:
            text = fetch(url)
            accept(text)
            return text, ""
        except Exception as e:  # noqa: BLE001 - sorted here; anything else re-raises
            if _old_site(e):
                old += 1
                continue
            if is_unreachable(e):
                last = describe(e)
                continue
            raise
    why = f"{old} of {tries} answers came from servers still on the old site"
    return None, why + (f", the rest {last}" if last else "")


def describe(exc: BaseException) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code}"
    return f"{type(exc).__name__}: {str(exc)[:120]}"


def _listing_shape(text: str) -> None:
    """Raise OldSite for an answer that isn't JSON (an old server's page), and
    LostStructure for JSON that isn't the newsroom's."""
    try:
        d = json.loads(text)
    except ValueError:
        raise OldSite("not JSON") from None
    if not isinstance(d, dict) or not isinstance(d.get("results"), list) or "resultTotal" not in d:
        raise LostStructure("the newsroom answered JSON without its results list")


def _page_shape(text: str) -> None:
    if "404 - Page Not Found" in text[:20000] or "usa-prose" not in text:
        raise OldSite("not the article")


def _day(props: dict) -> str | None:
    ms = props.get("newsroomPublishEpoch")
    if isinstance(ms, (int, float)) and ms > 0:
        return eastern_day(int(ms))  # State stamps midnight Eastern of the day it prints
    m = re.fullmatch(r"\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*", str(props.get("newsroomPublish") or ""))
    if m and m.group(1).lower() in MONTHS:
        return dt.date(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2))).isoformat()
    return None


def parse_listing(text: str) -> list[dict]:
    """Every item on the list, any tag: {num, title, path, tags, day, meta}. Raises LostStructure."""
    d = json.loads(text)
    results = d.get("results") if isinstance(d, dict) else None
    if not isinstance(results, list) or not results:
        raise LostStructure("the newsroom's results list is empty")
    out = []
    for r in results:
        if not isinstance(r, dict):
            continue
        title = " ".join(html.unescape(str(r.get("title") or "")).split())
        path = str(r.get("url") or "")
        props = r.get("properties") or {}
        day = _day(props) if isinstance(props, dict) else None
        m = re.fullmatch(r"/en/newsroom/[a-z-]+/(?:(\d{4})/)?([a-z0-9-]+)\.html", path)
        if not title or not m or not day:
            continue
        year, slug = m.group(1), m.group(2)
        tags = [t.get("title") for t in (r.get("tags") or []) if isinstance(t, dict) and t.get("title")]
        meta = props.get("metaDescription") if isinstance(props, dict) else None
        out.append({
            "num": f"state-{year}-{slug}" if year else f"state-{slug}",
            "title": title, "path": path, "tags": tags, "day": day,
            "meta": " ".join(str(meta).split()) if meta else None,
        })
    if len(out) < MIN_PARSED_SHARE * len(results):
        raise LostStructure(f"only {len(out)} of the newsroom's {len(results)} rows have a title, an address and a date")
    return out


def article(text: str) -> tuple[str, str | None]:
    """(the article's whole text, its first real paragraph) from an item page."""
    start = text.find('class="prose text"')
    if start < 0:
        start = text.find("usa-prose")
    end = min([i for i in (text.find("tags__last-updated", start), text.find("cmp-ownership-footer", start)) if i > 0],
              default=len(text))
    body = text[start:end]
    paras = []
    for p in re.findall(r"<(?:p|li)[^>]*>(.*?)</(?:p|li)>", body, re.S):
        t = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", p)).split())
        t = re.sub(r"\s+([,.;:)])", r"\1", t)
        if t:
            paras.append(t)
    whole = " ".join(paras)
    first = None
    for t in paras:
        if re.match(r"(published|last updated)\s*:", t, re.I) or len(t) < 60:
            continue
        first = t
        break
    return whole, cut_at_word(first)


def cut_at_word(text: str | None, limit: int = ABSTRACT_CHARS) -> str | None:
    if not text:
        return None
    if len(text) <= limit:
        return text
    cut = text[:limit]
    space = cut.rfind(" ")
    return (cut[:space] if space > limit // 2 else cut).rstrip(" ,;:") + " ..."


def title_decision(item: dict) -> tuple[bool, str] | None:
    """The decision a title alone can make (rules 1 and 2), or None when the text is needed."""
    if "Visas" not in item["tags"]:
        return False, "not tagged Visas"
    m = TITLE_OFF.search(item["title"])
    if m:
        return False, f"the title names {m.group(0).lower()}"
    return None


def decide(title: str, body: str) -> tuple[bool, str]:
    """Rules 3 to 6 on the item's own text. Pure."""
    text = f"{title} {body}"
    m = WORK_CODES.search(text) or WORK_WORDS.search(text)
    if m:
        return True, f"names {m.group(0)}"
    m = TOURIST.search(text)
    if m:
        return False, f"visitor visas only ({m.group(0)})"
    m = GENERAL.search(text)
    if m:
        return True, f"applies to every visa applicant ({m.group(0)})"
    return False, "nothing on work or immigrant visas"


# --- the run -------------------------------------------------------------------

@dataclass
class Run:
    status: str = "ok"            # ok, refused, broken
    note: str = ""
    items: list[dict] = field(default_factory=list)
    rows: list[dict] = field(default_factory=list)
    decided: dict = field(default_factory=dict)   # num -> {kept, why, day}, decided this run
    waiting: list[str] = field(default_factory=list)
    pages_read: int = 0


def row_of(item: dict, abstract: str | None, body: str) -> dict:
    return {
        "document_number": item["num"],
        "publication_date": item["day"],
        "type": TYPE,
        "title": item["title"],
        "abstract": abstract or item.get("meta"),
        "html_url": READER_HOST + item["path"],
        "agencies": AGENCIES,
        "topics": topics_of(item["title"], body),
    }


def stored_rows(db, nums: list[str]) -> dict[str, dict]:
    if db is None or not nums:
        return {}
    ensure_table(db)
    return {d["document_number"]: d for d in query_dicts(
        db, f"SELECT document_number, abstract FROM policy_notices WHERE document_number IN ({', '.join('?' * len(nums))})",
        nums, typed=True)}


def seen_doc(db) -> dict:
    if db is None:
        return {}
    db.execute("CREATE TABLE IF NOT EXISTS perm_docs (key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)")
    doc = read_doc(db, SEEN_DOC) or {}
    return doc.get("decided", {}) if isinstance(doc.get("decided"), dict) else {}


def decide_items(run: Run, db, fetch, sleep) -> None:
    visas = [i for i in run.items if "Visas" in i["tags"]]
    stored = stored_rows(db, [i["num"] for i in visas])
    seen = seen_doc(db)
    for item in run.items:
        num = item["num"]
        if num in stored and (stored[num].get("abstract") or seen.get(num, {}).get("kept")):
            run.rows.append(row_of(item, None, ""))   # the writer keeps the stored abstract
            continue
        if num not in stored and num in seen:
            continue                                   # decided before (dropped, or kept and stored)
        quick = title_decision(item)
        if quick is not None:
            if quick[0] is False and "Visas" in item["tags"]:
                run.decided[num] = {"kept": False, "why": quick[1], "day": item["day"]}
            continue
        if run.pages_read >= PAGES_PER_RUN:
            run.waiting.append(item["title"])
            continue
        if run.pages_read:
            sleep(PAGE_PAUSE_S)
        run.pages_read += 1
        text, why = ask(HOST + item["path"], PAGE_TRIES, fetch, sleep, _page_shape)
        if text is None:
            run.waiting.append(item["title"])
            log(f"::warning::{item['title'][:80]}: page unread ({why}); decided next run")
            continue
        body, abstract = article(text)
        kept, reason = decide(item["title"], body)
        run.decided[num] = {"kept": kept, "why": reason, "day": item["day"]}
        log(f"  {'kept' if kept else 'dropped'}  {item['day']}  {item['title'][:80]}  ({reason})")
        if kept:
            run.rows.append(row_of(item, abstract, body))


def save_seen(db, decided: dict) -> None:
    if db is None or not decided:
        return
    doc = read_doc(db, SEEN_DOC) or {}
    prev = doc.get("decided", {}) if isinstance(doc.get("decided"), dict) else {}
    merged = {**prev, **decided}
    if merged == prev:
        return
    newest = sorted(merged.items(), key=lambda kv: (kv[1].get("day") or "", kv[0]), reverse=True)[:SEEN_KEEP]
    write_doc(db, SEEN_DOC, {"decided": dict(newest)})


def run(db=None, *, fetch=fetch_url, sleep=time.sleep, robots=robots_allowed, dry_run: bool = False,
        from_file: str | None = None) -> int:
    started = time.time()
    r = Run()
    if from_file:
        text = open(from_file, encoding="utf-8").read()
    elif not robots(LISTING_URL):
        r.status, r.note, text = "refused", "robots.txt disallows the newsroom endpoint", None
    else:
        text, why = None, ""
        try:
            text, why = ask(LISTING_URL, LISTING_TRIES, fetch, sleep, _listing_shape)
        except LostStructure as e:
            r.status, r.note = "broken", str(e)
        if text is None and r.status == "ok":
            r.status, r.note = "refused", f"newsroom unread ({why})"
    if text is not None:
        try:
            r.items = parse_listing(text)
        except (LostStructure, ValueError) as e:
            r.status, r.note = "broken", str(e)
    if r.status == "ok":
        decide_items(r, None if dry_run else db, fetch, sleep)
    return finish(None if dry_run else db, r, started, dry_run)


def finish(db, r: Run, started: float, dry_run: bool) -> int:
    if r.status == "broken":
        print(f"::error::State newsroom: {r.note}. Nothing was written.", flush=True)
        if db is not None:
            record_run(db, SCRIPT, status="failed", rows_written=0, note=r.note, started_at=started)
        return 1
    if r.status == "refused":
        log(f"::warning::{r.note}")
        if db is not None:
            record_run(db, SCRIPT, status="ok", rows_written=0, note=r.note, started_at=started)
        return 0
    newest = max(i["day"] for i in r.items)
    visas = sum("Visas" in i["tags"] for i in r.items)
    log(f"{len(r.items)} on the list ({visas} tagged Visas), newest {newest}; {len(r.rows)} kept rows, "
        f"{len(r.waiting)} waiting for their page")
    if dry_run or db is None:
        for row in r.rows:
            print(json.dumps(row, indent=1)[:900])
        return 0
    res = write_notices(db, r.rows, source=SOURCE)
    save_seen(db, r.decided)
    stamp_freshness(db, DATASET, as_of=min(newest, et_today()), source=LABEL, cadence=CADENCE,
                    note=f"{len(r.items)} on the list, {visas} tagged Visas, {res.written} written",
                    max_age_days=MAX_AGE_DAYS)
    parts = [f"{len(r.items)} read ({visas} Visas), {len(r.rows)} kept, {res.written} written ({len(res.new)} new)"]
    if r.waiting:
        parts.append(f"{len(r.waiting)} waiting for a page from a server on the new site")
    if res.written and expire_policy_page(log) is False:
        parts.append("the page refresh call failed")
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
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from-file", help="a saved copy of the newsroom's results JSON")
    args = ap.parse_args()
    return run(None if args.dry_run else Database(), dry_run=args.dry_run, from_file=args.from_file)


if __name__ == "__main__":
    sys.exit(main())
