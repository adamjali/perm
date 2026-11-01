#!/usr/bin/env python3
"""The Justice Department's actions against work-visa sponsors, for the policy feed.

    python3 scripts/ingest_doj_enforcement.py              # newest releases, and the two lists when due
    python3 scripts/ingest_doj_enforcement.py --dry-run    # read and decide, write nothing
    python3 scripts/ingest_doj_enforcement.py --backfill   # every matching release since 2025, by title

WHY. DOJ settled with 15 work-visa sponsors from June 2025 to October 2026, sued Cloudera, and with DOL
barred Cloudera from PERM for 24 months, and none of it reached this site: no source here read DOJ, DOL put
out no release of its own on the settlement, and DOL's debarment lists hold formal notices only. This
reader is the first look; each action it finds is checked in its agreement and added to
src/lib/enforcement/actions.ts by hand (a wrong link names the wrong company).

THREE SOURCES, all www.justice.gov, whose robots.txt allows them and asks 10 seconds between requests
(CRAWL_DELAY_S), read Nov 1 2026:
  1. The press-release API, /api/v1/press_releases.json, newest first, 50 a page. Its body and component
     filters are ignored (they return all 275,000), so the component is checked here: Civil Rights
     Division only. That's where the Immigrant and Employee Rights Section's releases sit, and it keeps out
     the U.S. Attorneys' criminal releases, which name people (the Kalder sentencing, an O-1A visa fraud,
     Oct 30 2026, is one). Every run reads the newest page; --backfill asks the title filter, which works,
     for the words the initiative's releases carry (BACKFILL_TITLES) back to SINCE.
  2. IER's settlements list, /crt/settlements-and-lawsuits: one page, every IER settlement since 2006 as
     runs of <p>: a bold header "NAME (CATEGORY) MONTH YEAR", a summary opening "On MONTH D, YYYY", and
     links. Six of the 15 settlements have no release; this list is where they are. An entry with a
     "Settlement Press Release" link is left to the API.
  3. OCAHO's decisions, /eoir/listing-volume-22-decisions: one table of orders. Only "United States v. ..."
     cases with a B case number (citizenship-status discrimination; Cloudera's is 2026B00044), and only
     for a company the IER list names, so a document-fraud or I-9 case doesn't come in. One row per case,
     dated by its newest order.
The two lists change a few times a month, so they're read at most every LIST_EVERY_HOURS (perm_docs
['doj_lists_read']); the API every run.

WHAT IS KEPT. The text must name a work-visa program or the initiative (WORK): PERM (as a capital word),
labor certification, H-1B, H-2A, H-2B, LCA, prevailing wage, temporary or employment-based visas, or
"Protecting U.S. Workers". Settlements over document demands on non-citizens (Whirlpool) don't, and stay out.

ROWS. type "Justice Department action", agencies ["Justice Department"], source "doj". document_number
"doj-<release number>", "ier-<agreement media id>" or "ocaho-<case number>"; publication_date the release's
posted day (Eastern), the settlement's finalized day, or the newest order's day.

HEALTH. Freshness ("policy-notices-doj") is the newest kept item's day, never past today. A refusal or an
outage writes nothing and warns; a page that doesn't look like itself exits 1 and writes nothing.
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
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_db import Database, et_today, read_doc, record_run, stamp_freshness, write_doc  # noqa: E402
from lib_gov_data import robots_allowed  # noqa: E402
from lib_policy_feed import eastern_day, expire_policy_page, record_quiet_run, topics_of, write_notices  # noqa: E402
from lib_warn import is_unreachable  # noqa: E402

SCRIPT = "ingest_doj_enforcement.py"
SOURCE = "doj"
DATASET = "policy-notices-doj"
LABEL = "Justice Department releases, IER's settlements and OCAHO's orders"
CADENCE = "Every 30 minutes (the two lists every 6 hours)"
TYPE = "Justice Department action"
AGENCIES = ["Justice Department"]
HOST = "https://www.justice.gov"
API = f"{HOST}/api/v1/press_releases.json"
IER_LIST = f"{HOST}/crt/settlements-and-lawsuits"
OCAHO_LIST = f"{HOST}/eoir/listing-volume-22-decisions"
UA = "permtracker.app policy feed (support@permtracker.app)"
CRAWL_DELAY_S = 10
TIMEOUT_S = 60
LIST_EVERY_HOURS = 6
LISTS_DOC = "doj_lists_read"
MEDIA_DOC = "doj_release_media"  # agreement media ids DOJ's kept releases link; IER's list skips those
SINCE = "2025-01-01"
PAGE_SIZE = 50
ABSTRACT_CHARS = 600
BACKFILL_TITLES = ("U.S. Workers", "H-1B", "Visa", "PERM")
BACKFILL_PAGES = 4
# The newest DOJ release kept on Nov 1 2026 was Oct 20 (Instacart); the gaps between the initiative's
# releases ran up to about 80 days (Apr 28 to Aug 4 2026, no release between). 100 days, so a quiet stretch
# warns rather than fails.
MAX_AGE_DAYS = 100

WORK = re.compile(
    r"\bPERM\b|labor certification|\bH-?1B\b|\bH-?2[AB]\b|\bLCAs?\b|prevailing wage"
    r"|temporary (?:employment-based |work )?visas?|employment-based visas?|Protecting U\.S\. Workers")
MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], 1)}


def log(msg: str) -> None:
    print(msg, flush=True)


class LostStructure(ValueError):
    """A page answered and didn't look like itself."""


# --- reading -------------------------------------------------------------------

def fetch_url(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, text/html"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
        return r.read().decode("utf-8", errors="replace")


def text_of(fragment: str) -> str:
    """HTML to plain words, entities decoded, spaces collapsed."""
    t = re.sub(r"<(script|style)\b.*?</\1>", " ", fragment or "", flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t).replace("\xa0", " ")).strip()


def clip(t: str, n: int = ABSTRACT_CHARS) -> str:
    if len(t) <= n:
        return t
    cut = t[:n]
    sp = cut.rfind(" ")
    return (cut[:sp] if sp > n // 2 else cut).rstrip(" ,;:") + " ..."


def first_paragraph(body: str) -> str:
    m = re.search(r"<p\b[^>]*>(.*?)</p>", body or "", flags=re.S | re.I)
    return clip(text_of(m.group(1) if m else body))


def iso_from_words(s: str) -> str | None:
    m = re.match(r"([A-Za-z]+)\.? (\d{1,2}), (\d{4})", s.strip())
    if not m or m.group(1).lower() not in MONTHS:
        return None
    return f"{m.group(3)}-{MONTHS[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"


def posted_day(result: dict) -> str | None:
    """The release's posted day, Eastern, from `created` (`<time datetime=...>`), else its `date` epoch."""
    m = re.search(r'datetime="([^"]+)"', str(result.get("created") or ""))
    if m:
        return eastern_day(m.group(1))
    try:
        return eastern_day(int(result.get("date")) * 1000)
    except (TypeError, ValueError):
        return None


# --- 1. the press-release API ----------------------------------------------------

def is_civil_rights(result: dict) -> bool:
    return any("Civil Rights" in str(c.get("name", "")) for c in (result.get("component") or []) if isinstance(c, dict))


def media_ids(body: str) -> set[str]:
    """The /crt/media/<id> documents a release links (its agreement, usually)."""
    return set(re.findall(r"/media/(\d+)/", body or ""))


def api_rows(payload: dict, media: set[str] | None = None) -> list[dict]:
    """Kept rows from one API page. Pure. Raises LostStructure on a page that isn't the API's."""
    results = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(results, list):
        raise LostStructure("the press-release API answered without a results list")
    rows = []
    for r in results:
        title = html.unescape(str(r.get("title") or "")).strip()
        url = str(r.get("url") or "")
        number = str(r.get("number") or "").strip()
        day = posted_day(r)
        if not (title and url.startswith(HOST) and day):
            continue
        if not is_civil_rights(r):
            continue
        body = str(r.get("body") or "")
        if not WORK.search(f"{title} {text_of(body)}"):
            continue
        if media is not None:
            media |= media_ids(body)
        rows.append({
            "document_number": f"doj-{number}" if number else "doj-" + url.rstrip("/").rsplit("/", 1)[-1][:80],
            "publication_date": day,
            "type": TYPE,
            "title": title,
            "abstract": first_paragraph(body),
            "html_url": url,
            "agencies": AGENCIES,
            "topics": topics_of(title, text_of(body)),
        })
    return rows


# --- 2. IER's settlements list -----------------------------------------------------

HEADER = re.compile(r"^(?P<name>.+?)\s*\((?P<category>[^()]*)\)\s*(?P<month>[A-Z][a-z]+)\s+(?P<year>\d{4})$")


def ier_entries(page: str) -> list[dict]:
    """Every entry on IER's list: name, finalized day, summary and links. Pure."""
    m = re.search(r'<div[^>]*class="[^"]*field_body[^"]*"[^>]*>(.*)', page, flags=re.S)
    if not m:
        raise LostStructure("IER's list has no field_body block")
    paras = re.findall(r"<p\b[^>]*>(.*?)</p>", m.group(1), flags=re.S | re.I)
    entries: list[dict] = []
    cur: dict | None = None
    for p in paras:
        strong = re.fullmatch(r"\s*<strong>(.*?)</strong>\s*", p, flags=re.S)
        head = HEADER.match(text_of(strong.group(1))) if strong else None
        if head:
            cur = {"name": head.group("name").strip(), "category": head.group("category").strip(), "summary": "", "links": []}
            entries.append(cur)
            continue
        if cur is None:
            continue
        t = text_of(p)
        if t and not cur["summary"] and not re.fullmatch(r"(Settlement .*|Complaint.*|Press Release.*)", t):
            cur["summary"] = t
        for href, label in re.findall(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', p, flags=re.S | re.I):
            cur["links"].append({"url": urllib.parse.urljoin(HOST, html.unescape(href)), "label": text_of(label)})
    for e in entries:
        d = re.match(r"On ([A-Z][a-z]+ \d{1,2}, \d{4})", e["summary"])
        e["day"] = iso_from_words(d.group(1)) if d else None
    if len(entries) < 50:
        raise LostStructure(f"IER's list held {len(entries)} entries; it holds about 320")
    return entries


def ier_rows(entries: list[dict], since: str = SINCE, released: set[str] = frozenset()) -> list[dict]:
    """The visa-sponsor settlements with no press release, since `since`. Pure. `released` holds the
    agreement ids DOJ's releases link: IER's list links OpenAI's agreement and not its release, which the
    API carries, so the same settlement would otherwise be two rows."""
    rows = []
    for e in entries:
        if not e["day"] or e["day"] < since or not WORK.search(e["summary"]):
            continue
        if any("press release" in l["label"].lower() for l in e["links"]):
            continue  # the release is the API's row
        agreement = next((l for l in e["links"] if "/media/" in l["url"]), e["links"][0] if e["links"] else None)
        if not agreement:
            continue
        media = re.search(r"/media/(\d+)", agreement["url"])
        if media and media.group(1) in released:
            continue
        rows.append({
            "document_number": f"ier-{media.group(1)}" if media else "ier-" + re.sub(r"[^a-z0-9]+", "-", e["name"].lower())[:60],
            "publication_date": e["day"],
            "type": TYPE,
            "title": f"Settlement with {e['name']}",
            "abstract": clip(e["summary"]),
            "html_url": agreement["url"],
            "agencies": AGENCIES,
            "topics": topics_of(e["summary"]),
        })
    return rows


def company_key(name: str) -> str:
    """A company name reduced to its words, form words and "d/b/a" tails dropped, for matching across lists."""
    n = re.split(r"\b(?:d/?b/?a|dba)\b", name, flags=re.I)[0]
    n = re.sub(r"\b(inc|llc|l\.l\.c|corp|corporation|company|co|ltd|lp|llp|pllc)\b\.?", " ", n, flags=re.I)
    return re.sub(r"[^a-z0-9]+", " ", n.lower()).strip()


# --- 3. OCAHO's orders --------------------------------------------------------------

CASE_NO = re.compile(r"^\d{4}[A-C]\d{5}$")


def ocaho_cases(page: str) -> list[dict]:
    """Every case on the listing: caption, case number, orders (day, reference, link). Pure.

    Rows span unevenly: a case's first row carries its caption (rowspan) and usually its number; a follow-on
    row holds the rest, and may start with the number again. Each row is read by what its cells hold."""
    table = re.search(r'<table[^>]*class="table"[^>]*>(.*?)</table>', page, flags=re.S | re.I)
    if not table:
        raise LostStructure("OCAHO's listing has no table")
    cases: list[dict] = []
    cur: dict | None = None
    for tr in re.findall(r"<tr\b[^>]*>(.*?)</tr>", table.group(1), flags=re.S | re.I):
        cells = re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", tr, flags=re.S | re.I)
        texts = [text_of(c) for c in cells]
        if not texts or texts[0].upper() == "CASE NAME":
            continue
        date_i = next((i for i, t in enumerate(texts) if re.fullmatch(r"\d{2}/\d{2}/\d{4}", t)), None)
        if date_i is None:
            continue
        before = texts[:date_i]
        if before and not CASE_NO.match(before[0]):
            cur = {"caption": before[0], "number": next((t for t in before[1:] if CASE_NO.match(t)), None), "orders": []}
            cases.append(cur)
        elif before and cur is not None and CASE_NO.match(before[0]) and not cur["number"]:
            cur["number"] = before[0]
        if cur is None:
            continue
        mo, da, yr = texts[date_i].split("/")
        link = re.search(r'href="([^"]+)"', cells[date_i + 1]) if date_i + 1 < len(cells) else None
        ref = texts[date_i + 1].replace("(PDF)", "").strip() if date_i + 1 < len(texts) else ""
        cur["orders"].append({"day": f"{yr}-{mo}-{da}", "ref": ref, "url": urllib.parse.urljoin(HOST, html.unescape(link.group(1))) if link else None})
    if len(cases) < 10:
        raise LostStructure(f"OCAHO's listing held {len(cases)} cases; it holds about 60")
    return cases


def ocaho_rows(cases: list[dict], companies: set[str]) -> list[dict]:
    """The government's citizenship-status (B) cases against a company IER's list names. Pure."""
    rows = []
    for c in cases:
        m = re.match(r"United States v\.?\s+(.+)$", c["caption"])
        if not m or not c["number"] or c["number"][4] != "B" or not c["orders"]:
            continue
        if company_key(m.group(1)) not in companies:
            continue
        newest = max(c["orders"], key=lambda o: o["day"])
        n = len(c["orders"])
        rows.append({
            "document_number": f"ocaho-{c['number']}",
            "publication_date": newest["day"],
            "type": TYPE,
            "title": f"{c['caption']} (OCAHO case {c['number']})",
            "abstract": f"The case before DOJ's administrative immigration court: {n} order{'s' if n != 1 else ''}, the newest {newest['ref']} on {newest['day']}.",
            "html_url": newest["url"] or OCAHO_LIST,
            "agencies": AGENCIES,
            "topics": [],
        })
    return rows


# --- the run ---------------------------------------------------------------------------

def lists_due(db, now: dt.datetime) -> bool:
    if db is None:
        return True
    doc = read_doc(db, LISTS_DOC) or {}
    at = doc.get("at")
    return not isinstance(at, (int, float)) or (now.timestamp() * 1000 - at) >= LIST_EVERY_HOURS * 3_600_000


def run(db=None, *, fetch=fetch_url, sleep=time.sleep, robots=robots_allowed, dry_run=False,
        backfill=False, lists=None, now: dt.datetime | None = None) -> int:
    started = time.time()
    now = now or dt.datetime.now(dt.timezone.utc)
    rows: list[dict] = []
    notes: list[str] = []
    asked = 0
    if db is not None and not dry_run:
        db.execute("CREATE TABLE IF NOT EXISTS perm_docs (key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)")
    released: set[str] = set(((read_doc(db, MEDIA_DOC) or {}).get("ids") or []) if db is not None and not dry_run else [])
    known = set(released)

    def ask(url: str) -> str:
        nonlocal asked
        if asked:
            sleep(CRAWL_DELAY_S)
        asked += 1
        return fetch(url)

    try:
        if not robots(API + "?page=0"):
            notes.append("robots.txt disallows the press-release API")
        else:
            titles = BACKFILL_TITLES if backfill else (None,)
            for title in titles:
                for page in range(BACKFILL_PAGES if backfill else 1):
                    q = {"sort": "date", "direction": "DESC", "pagesize": str(PAGE_SIZE), "page": str(page)}
                    if title:
                        q["parameters[title]"] = title
                    payload = json.loads(ask(f"{API}?{urllib.parse.urlencode(q)}"))
                    got = api_rows(payload, released)
                    rows.extend(r for r in got if r["publication_date"] >= SINCE)
                    days = [posted_day(r) for r in payload.get("results") or []]
                    if not payload.get("results") or min(d for d in days if d) < SINCE:
                        break
        read_lists = lists if lists is not None else (backfill or lists_due(None if dry_run else db, now))
        if read_lists:
            entries = ier_entries(ask(IER_LIST))
            rows.extend(ier_rows(entries, released=released))
            companies = {company_key(e["name"]) for e in entries if e["day"] and e["day"] >= SINCE and WORK.search(e["summary"])}
            rows.extend(ocaho_rows(ocaho_cases(ask(OCAHO_LIST)), companies))
            notes.append(f"lists read ({len(entries)} IER entries)")
    except LostStructure as e:
        print(f"::error::DOJ: {e}. Nothing was written.", flush=True)
        if db is not None and not dry_run:
            record_run(db, SCRIPT, status="failed", rows_written=0, note=str(e), started_at=started)
        return 1
    except Exception as e:  # noqa: BLE001 - an outage or a refusal is a warning; a code defect re-raises
        if not is_unreachable(e) and not isinstance(e, (urllib.error.URLError, TimeoutError, json.JSONDecodeError)):
            raise
        log(f"::warning::www.justice.gov didn't answer ({type(e).__name__}: {str(e)[:120]}); nothing written, next run tries again")
        if db is not None and not dry_run:
            record_run(db, SCRIPT, status="ok", rows_written=0, note=f"unreachable: {type(e).__name__}", started_at=started)
        return 0

    unique = {r["document_number"]: r for r in rows}
    rows = sorted(unique.values(), key=lambda r: r["publication_date"], reverse=True)
    log(f"{asked} requests, {len(rows)} kept: " + "; ".join(f"{r['publication_date']} {r['title'][:70]}" for r in rows[:6]))
    if dry_run or db is None:
        for r in rows:
            print(json.dumps(r)[:700])
        return 0
    res = write_notices(db, rows, source=SOURCE)
    if released != known:
        write_doc(db, MEDIA_DOC, {"ids": sorted(released)})
    if notes and any(n.startswith("lists read") for n in notes):
        write_doc(db, LISTS_DOC, {"at": int(now.timestamp() * 1000)})
    newest = max((r["publication_date"] for r in rows), default=None)
    if newest:
        stamp_freshness(db, DATASET, as_of=min(newest, et_today()), source=LABEL, cadence=CADENCE,
                        note=f"{len(rows)} kept, {res.written} written", max_age_days=MAX_AGE_DAYS)
    note = f"{asked} requests, {len(rows)} kept, {res.written} written ({len(res.new)} new)" + ("; " + "; ".join(notes) if notes else "")
    if res.written and expire_policy_page(log) is False:
        note += "; the page refresh call failed"
    log(note)
    if res.written:
        record_run(db, SCRIPT, status="ok", rows_written=res.written, note=note, started_at=started)
    else:
        record_quiet_run(db, SCRIPT, written=0, note=note, started_at=started)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--backfill", action="store_true", help="title searches back to 2025, and both lists")
    args = ap.parse_args()
    return run(None if args.dry_run else Database(), dry_run=args.dry_run, backfill=args.backfill)


if __name__ == "__main__":
    sys.exit(main())
