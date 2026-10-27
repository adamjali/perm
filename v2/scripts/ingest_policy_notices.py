#!/usr/bin/env python3
"""Federal Register notices that touch the PERM, H-1B and green-card process.

    python3 scripts/ingest_policy_notices.py            # last 180 days
    python3 scripts/ingest_policy_notices.py --days 30  # a shorter window
    python3 scripts/ingest_policy_notices.py --dry-run  # print, write nothing

WHAT THIS IS. The Federal Register is the primary record of a rule, a
proposed rule or a notice from DOL, USCIS, DHS and State. Its public API
(https://www.federalregister.gov/developers/documentation/api/v1) serves the
title, type, agencies, publication date, abstract and canonical URL of every
document, with no key and no challenge, so this reads the documents
themselves and links to them.

WHAT IT IS NOT. A summary, an opinion, or a prediction of effect. The
abstract shown on the site is the Register's own abstract, verbatim and
attributed. Nothing here is written by us except the topic tags, which are
the search terms a document matched.

HOW IT SELECTS. One query per topic term over the window, unioned by
document number, so a document that matches two topics carries both tags.
Two classes are dropped by rule: the Unified Agenda omnibus notices (they
list every planned rule of every agency and match every term) and paperwork
notices ("Agency Information Collection Activities") unless the title names
one of the forms the site is about, since a form revision is worth knowing
and a generic burden estimate is not.

PUBLIC INSPECTION (Oct 27 2026). The Office of the Federal Register files a
document for public inspection the business day before it's published, and
sometimes weeks before (a "special filing"). `--inspection` reads that list
and keeps what the same rules keep, by title (the list has no abstract), so a
filed rule, notice or presidential document reaches the page a day early. Each
filed document is then followed: once its publication day passes, the
Register's own record of it is read, and it becomes the published document,
or, if the Register never published it, it's marked withdrawn. Nothing is
cleared on the way (lib_policy_feed.py).

PRESIDENTIAL DOCUMENTS (Oct 27 2026). Executive orders, proclamations and
memoranda are filed by the Executive Office of the President, which the
agency list had left out: the Sep 23 2026 H-1B proclamation and executive
order never reached the page. They're kept now when the title names an
immigration subject.

HEALTH. The run stamps freshness only when the API answered and its newest
document (any agency, unfiltered) is recent: a month of "0 matches" is a
plausible outcome for a narrow topic and must not read as a dead feed, but a
newest-document date that stops moving is one. The public inspection list has
its own row, dated by the list's own "regular filings updated" stamp.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_db import (  # noqa: E402
    Database, et_today, query_dicts, record_run, stamp_freshness,
)
from lib_policy_feed import (  # noqa: E402
    EXTRA_COLUMNS, eastern_day, ensure_table, expire_policy_page, link_presidential,
    mentions_immigration, record_quiet_run, topics_of, write_notices,
)

API = "https://www.federalregister.gov/api/v1/documents.json"
UA = "permtracker.app policy feed (support@permtracker.app)"

# Topic -> the search term the Register is asked for. Quoted phrases are
# exact; a bare token matches the document text.
TOPICS: dict[str, str] = {
    "PERM": '"labor certification"',
    "Prevailing wage": '"prevailing wage"',
    "H-1B": "H-1B",
    "I-140": "I-140",
    "Adjustment of status": '"adjustment of status"',
    "Visa bulletin": '"visa bulletin"',
    "EB-5": "EB-5",
    # Oct 27 2026: the site covers H-2A, H-2B and CW-1, and none of them was a
    # term, so DOL's seasonal rules and wage notices never reached the page.
    "H-2A": "H-2A",
    "H-2B": "H-2B",
    "CW-1": '"CW-1"',
    "Premium processing": '"premium processing"',
}

# Forms whose paperwork notices are worth listing.
FORMS_OF_INTEREST = re.compile(
    r"\b(ETA[- ]?9089|ETA[- ]?9141|ETA[- ]?9035|I-140|I-485|I-765|I-131|I-129|I-693|G-28)\b"
)

FIELDS = ["title", "type", "abstract", "document_number", "html_url",
          "publication_date", "agencies", "excerpts",
          # The dates a reader actually needs, from the Register's own record:
          # when a rule takes effect, when comments on a proposal close and
          # where to file one, the citation, and the DATES paragraph verbatim
          # for the documents whose effective date is stated in words.
          "effective_on", "comments_close_on", "comment_url", "citation",
          "action", "dates", "correction_of", "pdf_url",
          # A presidential document: "Proclamation", "Executive Order", and the day it was signed.
          "subtype", "signing_date"]

DATASET = "policy-notices"
INSPECTION_DATASET = "policy-notices-pi"
PUBLIC_INSPECTION = "https://www.federalregister.gov/api/v1/public-inspection-documents/current.json"
DOCUMENT = "https://www.federalregister.gov/api/v1/documents/{number}.json"
# Filings are made every business day; Friday's to Tuesday's after a Monday
# holiday is four days, and a fifth covers the list's update landing late.
INSPECTION_MAX_AGE_DAYS = 5
# A filed document the Register hasn't published this many days after its
# publication day was taken off public inspection.
WITHDRAWN_AFTER_DAYS = 3
# The Register publishes every business day; a newest document older than
# this means the API, not the topics, has gone quiet.
MAX_AGE_DAYS = 5


def log(msg: str) -> None:
    print(msg, flush=True)


def fetch_json(url: str, retries: int = 3) -> dict:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as exc:  # noqa: BLE001 - the retry is the point
            last = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"federalregister.gov did not answer: {last}")


def query(term: str, since: str, page: int = 1) -> dict:
    params = [
        ("per_page", "100"), ("page", str(page)), ("order", "newest"),
        ("conditions[publication_date][gte]", since),
        ("conditions[term]", term),
    ] + [("fields[]", f) for f in FIELDS]
    return fetch_json(API + "?" + urllib.parse.urlencode(params))


# The agencies whose documents can touch this process. A "prevailing wage"
# term also matches Treasury's clean-energy tax credit notices and the
# Wage and Hour Division's Davis-Bacon determinations; an "adjustment of
# status" term matches the immigration courts' fee notices. None of those is
# a rule a PERM or H-1B filing runs under, so the agency list decides.
AGENCIES_OF_INTEREST = (
    "U.S. Citizenship and Immigration Services",
    "Homeland Security Department",
    "State Department",
    "Employment and Training Administration",
    "Labor Department",
    # Executive orders, proclamations and memoranda (Oct 27 2026). Kept only
    # when the title or abstract names an immigration subject (keep()).
    "Executive Office of the President",
)
# Agencies whose documents matching a topic term are immigration documents.
IMMIGRATION_AGENCIES = (
    "U.S. Citizenship and Immigration Services",
    "Homeland Security Department",
    "State Department",
    "Employment and Training Administration",
)

# Omnibus listings that match every term and say nothing specific.
OMNIBUS = re.compile(r"unified agenda|regulatory agenda|agenda of regulations|semiannual regulatory", re.I)

# Agency housekeeping that matches a term by accident (a notice appointing a
# Performance Review Board matches "labor certification"). Board appointments
# and meeting notices change nothing a filing runs under.
PERSONNEL = re.compile(
    r"senior executive service|performance review board|appointment of members"
    r"|membership of the|notice of (?:a |an )?(?:open |public |closed )?meeting|advisory (?:committee|council|board)",
    re.I,
)


def keep(doc: dict) -> bool:
    """The exclusion rules, and nothing else: no judgement of importance."""
    title = doc.get("title") or ""
    agencies = doc.get("agencies") or []
    if not any(a in AGENCIES_OF_INTEREST for a in agencies):
        return False
    # The President and the Labor Department as a whole write on every subject:
    # a holiday proclamation shares the President with the H-1B one, and an
    # employee-benefits rule that says "prevailing wage" ("Transparency in
    # Coverage", Oct 6 2026) shares DOL with a labor certification rule. Without
    # an immigration agency beside them, the title or abstract must name an
    # immigration subject.
    if not any(a in IMMIGRATION_AGENCIES for a in agencies):
        if not mentions_immigration(title, doc.get("abstract")):
            return False
    if OMNIBUS.search(title):
        return False
    if PERSONNEL.search(title):
        return False
    if title.lower().startswith("agency information collection"):
        return bool(FORMS_OF_INTEREST.search(title) or FORMS_OF_INTEREST.search(doc.get("abstract") or ""))
    return True


def shape(d: dict) -> dict:
    """One Register document as the row the table holds. Pure, so a test can drive it.

    `correction_of` arrives as the parent document's API URL; the row keeps
    the parent's NUMBER, which is what the page joins on. Empty strings from
    the API become NULL so a stored row and a freshly shaped one compare
    equal in `write()`.
    """
    def opt(key: str) -> str | None:
        v = d.get(key)
        return v if isinstance(v, str) and v.strip() else None
    parent = opt("correction_of")
    return {
        "document_number": d.get("document_number") or "",
        "title": d.get("title") or "",
        "type": d.get("type") or "",
        "abstract": d.get("abstract") or "",
        "html_url": d.get("html_url") or "",
        "publication_date": d.get("publication_date") or "",
        "agencies": [a.get("name") for a in (d.get("agencies") or []) if a.get("name")],
        "topics": [],
        "effective_on": opt("effective_on"),
        "comments_close_on": opt("comments_close_on"),
        "comment_url": opt("comment_url"),
        "citation": opt("citation"),
        "action": opt("action"),
        "dates": opt("dates"),
        "correction_of": parent.rstrip("/").rsplit("/", 1)[-1] if parent else None,
        "pdf_url": opt("pdf_url"),
        "signing_date": opt("signing_date"),
        "status": "published",
    } | ({"action": opt("subtype")} if not opt("action") and opt("subtype") else {})


def collect(days: int) -> tuple[list[dict], str | None]:
    since = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
    by_number: dict[str, dict] = {}
    for topic, term in TOPICS.items():
        page = 1
        while True:
            res = query(term, since, page)
            for d in res.get("results", []):
                num = d.get("document_number")
                if not num:
                    continue
                row = by_number.setdefault(num, shape(d))
                if topic not in row["topics"]:
                    row["topics"].append(topic)
            total_pages = int(res.get("total_pages") or 1)
            if page >= total_pages or page >= 5:
                break
            page += 1
            time.sleep(0.5)
        time.sleep(0.5)
    kept = [r for r in by_number.values() if keep(r)]
    kept.sort(key=lambda r: r["publication_date"], reverse=True)
    # The liveness probe: the newest document the Register holds at all.
    probe = fetch_json(API + "?" + urllib.parse.urlencode([("per_page", "1"), ("order", "newest"), ("fields[]", "publication_date")]))
    newest = (probe.get("results") or [{}])[0].get("publication_date")
    log(f"  {len(by_number)} matched, {len(kept)} kept after the two exclusions; newest Register document {newest}")
    return kept, newest


EXTRA_NAMES = list(EXTRA_COLUMNS)


def write(db: Database, rows: list[dict]) -> int:
    """Published Register documents, through the one writer every source uses."""
    return write_notices(db, rows, source="federal-register").written


def presidential(days: int) -> list[dict]:
    """Presidential documents on an immigration subject that no topic term
    matched (a proclamation suspending entry names no form). The term search
    already catches the ones that name H-1B or a labor certification."""
    since = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
    params = [("per_page", "200"), ("order", "newest"), ("conditions[publication_date][gte]", since),
              ("conditions[type][]", "PRESDOCU")] + [("fields[]", f) for f in FIELDS]
    res = fetch_json(API + "?" + urllib.parse.urlencode(params))
    out = []
    for d in res.get("results", []):
        row = shape(d)
        if row["document_number"] and keep(row):
            row["topics"] = topics_of(row["title"], row["abstract"])
            out.append(row)
    return out


# ---------------------------------------------------------------------------
# Public inspection
# ---------------------------------------------------------------------------

def inspection_rows(listing: dict) -> list[dict]:
    """Today's public inspection filings, kept by the same rules as a published
    document, judged on the title alone (the list carries no abstract). An
    agency that writes on more than immigration (DHS, State, DOL) must name an
    immigration subject; USCIS's are all kept. A filing withdrawn after
    placement has no filing time and is skipped. Pure, so a test can drive it."""
    out = []
    for r in listing.get("results") or []:
        num = r.get("document_number")
        if not num or not r.get("filed_at"):
            continue
        agencies = [a.get("name") for a in (r.get("agencies") or []) if isinstance(a, dict) and a.get("name")]
        agencies = agencies or [a for a in (r.get("agency_names") or []) if isinstance(a, str)]
        title = " ".join((r.get("title") or "").split())
        if not title:
            continue
        doc = {"title": title, "agencies": agencies, "abstract": ""}
        if not keep(doc):
            continue
        uscis = "U.S. Citizenship and Immigration Services" in agencies
        if not uscis and not mentions_immigration(title, r.get("toc_subject"), r.get("toc_doc")):
            continue
        scheduled = r.get("publication_date")
        out.append({
            "document_number": num,
            "publication_date": scheduled if isinstance(scheduled, str) and scheduled else eastern_day(r.get("filed_at")),
            "type": r.get("type") or "Notice",
            "title": title,
            "abstract": None,
            "html_url": r.get("html_url") or f"https://www.federalregister.gov/public-inspection/{num}",
            "agencies": agencies,
            "topics": topics_of(title, r.get("toc_subject"), r.get("toc_doc")),
            "pdf_url": r.get("pdf_url"),
            "pi_filed": eastern_day(r.get("filed_at")),
            "status": "public-inspection",
        })
    return out


def read_inspection() -> tuple[list[dict], str | None, str | None]:
    """(rows kept, the list's own regular-filings day, a warning or None).
    A list that doesn't answer is a warning, never a crash: its freshness row
    is the alarm, and the next run reads it again."""
    try:
        listing = fetch_json(PUBLIC_INSPECTION)
    except Exception as exc:  # noqa: BLE001
        return [], None, f"public inspection unread ({type(exc).__name__})"
    if not isinstance(listing.get("results"), list):
        return [], None, "public inspection answered without a results list"
    stamp = eastern_day(listing.get("regular_filings_updated_at"))
    return inspection_rows(listing), stamp, None


def follow_filed(db: Database, today: str) -> tuple[int, int, list[str]]:
    """Every document still on public inspection whose publication day has
    come: read the Register's record of it. Published: the full document is
    written. Not there WITHDRAWN_AFTER_DAYS after its day: marked withdrawn.
    Returns (published, withdrawn, problems)."""
    ensure_table(db)
    filed = query_dicts(db, "SELECT document_number, publication_date, type, title, html_url, agencies FROM policy_notices "
                            "WHERE status = 'public-inspection' AND publication_date <= ?", [today])
    published: list[dict] = []
    withdrawn: list[dict] = []
    problems: list[str] = []
    for f in filed:
        num = f["document_number"]
        url = DOCUMENT.format(number=urllib.parse.quote(num)) + "?" + urllib.parse.urlencode([("fields[]", x) for x in FIELDS])
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                age = (datetime.date.fromisoformat(today) - datetime.date.fromisoformat(f["publication_date"])).days
                if age >= WITHDRAWN_AFTER_DAYS:
                    withdrawn.append({**f, "agencies": json.loads(f["agencies"] or "[]"), "topics": [],
                                      "status": "withdrawn"})
                continue
            problems.append(f"{num}: HTTP {e.code}")
            continue
        except Exception as exc:  # noqa: BLE001
            problems.append(f"{num}: {type(exc).__name__}")
            continue
        if d.get("document_number") == num and d.get("publication_date"):
            row = shape(d)
            row["topics"] = topics_of(row["title"], row["abstract"])
            published.append(row)
        time.sleep(0.3)
    if published:
        write_notices(db, published, source="federal-register")
    if withdrawn:
        write_notices(db, withdrawn, source="public-inspection")
    return len(published), len(withdrawn), problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=180)
    ap.add_argument("--inspection", action="store_true",
                    help="also read today's public inspection list and follow every filed document")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    log(f"Federal Register, last {args.days} days, {len(TOPICS)} topics")
    rows, newest = collect(args.days)
    have = {r["document_number"] for r in rows}
    pres = [r for r in presidential(args.days) if r["document_number"] not in have]
    rows += pres
    log(f"  {len(pres)} more presidential documents on an immigration subject")
    for r in rows[:8]:
        log(f"  {r['publication_date']}  {r['type']:14s} {', '.join(r['topics'])}: {r['title'][:80]}")
    filed: list[dict] = []
    filed_day = warning = None
    if args.inspection:
        filed, filed_day, warning = read_inspection()
        if warning:
            log(f"::warning::{warning}")
        log(f"  {len(filed)} kept on today's public inspection list (regular filings of {filed_day})")
        for r in filed[:8]:
            log(f"    filed {r['pi_filed']}, publishes {r['publication_date']}: {r['type']}: {r['title'][:80]}")
    if args.dry_run:
        log("DRY RUN, nothing written")
        return 0
    db = Database()
    ensure_table(db)
    today = et_today()
    written = write(db, rows)
    pi = write_notices(db, filed, source="public-inspection") if filed else None
    published, withdrawn, problems = follow_filed(db, today) if args.inspection else (0, 0, [])
    linked = link_presidential(db)
    held = int(db.scalar("SELECT count(*) FROM policy_notices") or 0)
    changed = written + (pi.written if pi else 0) + published + withdrawn + linked
    log(f"  wrote {written} published, {pi.written if pi else 0} filed for public inspection "
        f"({len(pi.new) if pi else 0} new), {published} filed then published, {withdrawn} withdrawn, "
        f"{linked} White House actions linked; {held} held")
    for p in problems:
        log(f"::warning::following a filed document: {p}")
    # Freshness is the Register's own clock, not ours: `as_of` is the newest
    # document it holds, so a feed that keeps running against a stalled API
    # goes stale on the health check instead of looking alive. Never past
    # today: the Register lists a Monday's documents on the Friday before, and
    # the pages printed "data through" tomorrow's date (Oct 18 2026).
    if newest:
        stamp_freshness(db, DATASET, source="federalregister.gov API",
                        cadence="Every 30 minutes", note=f"{held} notices held; newest Register document {newest}",
                        max_age_days=MAX_AGE_DAYS, as_of=min(newest, today))
    if args.inspection and filed_day:
        stamp_freshness(db, INSPECTION_DATASET, source="federalregister.gov public inspection API",
                        cadence="Every 30 minutes",
                        note=f"{len(filed)} kept from the list of {filed_day}",
                        max_age_days=INSPECTION_MAX_AGE_DAYS, as_of=min(filed_day, today))
    refreshed = expire_policy_page(log) if changed else None
    notes = [f"{len(rows)} in window, newest {newest}"]
    if args.inspection:
        notes.append(f"{len(filed)} on public inspection, {published} published, {withdrawn} withdrawn")
    if warning:
        notes.append(warning)
    if problems:
        notes.append(f"{len(problems)} filed documents unread")
    if refreshed is False:
        notes.append("the page refresh call failed")
    note = "; ".join(notes)
    if changed == 0 and not warning and not problems:
        record_quiet_run(db, "ingest_policy_notices.py", written=0, note=note, started_at=started)
    else:
        record_run(db, "ingest_policy_notices.py", status="ok", rows_written=changed, note=note, started_at=started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
