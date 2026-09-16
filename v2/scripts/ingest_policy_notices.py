#!/usr/bin/env python3
"""Federal Register notices that touch the PERM, H-1B and green-card process.

    python3 scripts/ingest_policy_notices.py            # last 180 days, to Turso
    python3 scripts/ingest_policy_notices.py --days 30  # a shorter window
    python3 scripts/ingest_policy_notices.py --dry-run  # print, write nothing

WHAT THIS IS. The Federal Register is the primary record of a rule, a
proposed rule or a notice from DOL, USCIS, DHS and State. Its public API
(https://www.federalregister.gov/developers/documentation/api/v1) serves the
title, type, agencies, publication date, abstract and canonical URL of every
document, with no key and no challenge. A rival's "policy alerts" page is 15
of 20 items reposted from one law firm's blog; this reads the documents
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

HEALTH. The run stamps freshness only when the API answered and its newest
document (any agency, unfiltered) is recent: a month of "0 matches" is a
plausible outcome for a narrow topic and must not read as a dead feed, but a
newest-document date that stops moving is one.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_turso import Turso, record_run, stamp_freshness  # noqa: E402

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
          "action", "dates", "correction_of", "pdf_url"]

# Columns added 2026-09-16, after the table already existed in production.
# `CREATE TABLE IF NOT EXISTS` can never ADD a column, so `ensure_columns`
# runs before every write. All nullable: the OFLC feed shares this table and
# writes none of them.
EXTRA_COLUMNS = [
    ("effective_on", "TEXT"), ("comments_close_on", "TEXT"), ("comment_url", "TEXT"),
    ("citation", "TEXT"), ("action", "TEXT"), ("dates", "TEXT"),
    ("correction_of", "TEXT"), ("pdf_url", "TEXT"),
]

DATASET = "policy-notices"
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
)

# Omnibus listings that match every term and say nothing specific.
OMNIBUS = re.compile(r"unified agenda|regulatory agenda|agenda of regulations|semiannual regulatory", re.I)

# Agency housekeeping that matches a term by accident. A Labor Department
# notice appointing members to its Performance Review Board matched "labor
# certification" on 2026-09-10 and sat beside the H-1B fee rule for six days.
# Board appointments and meeting notices change nothing a filing runs under.
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
    }


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


DDL = [
    """CREATE TABLE IF NOT EXISTS policy_notices (
        document_number TEXT PRIMARY KEY,
        publication_date TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        abstract TEXT,
        html_url TEXT NOT NULL,
        agencies TEXT NOT NULL,
        topics TEXT NOT NULL,
        fetched_at INTEGER NOT NULL)""",
    "CREATE INDEX IF NOT EXISTS policy_notices_date ON policy_notices (publication_date DESC)",
]


EXTRA_NAMES = [name for name, _ in EXTRA_COLUMNS]


def ensure_columns(db: Turso) -> list[str]:
    """Add any column the live table lacks. Returns the names added."""
    res = db.execute("PRAGMA table_info(policy_notices)")
    have = set()
    for r in res["response"]["result"]["rows"]:
        vals = [None if c["type"] == "null" else c["value"] for c in r]
        have.add(vals[1])
    added = []
    for name, typ in EXTRA_COLUMNS:
        if name not in have:
            db.execute(f"ALTER TABLE policy_notices ADD COLUMN {name} {typ}")
            added.append(name)
    return added


def signature(r: dict) -> tuple:
    """What a row is compared on. A changed effective date or a new
    correction is a change worth writing, not only a changed title."""
    return (r["title"], r["abstract"], json.dumps(r["topics"])) + tuple(r.get(n) for n in EXTRA_NAMES)


def write(db: Turso, rows: list[dict]) -> int:
    """Upsert, writing only rows that are new or changed."""
    db.script(DDL)
    added = ensure_columns(db)
    if added:
        log(f"  added columns: {', '.join(added)}")
    res = db.execute(
        "SELECT document_number, title, abstract, topics, " + ", ".join(EXTRA_NAMES) + " FROM policy_notices"
    )
    have = {}
    for r in res["response"]["result"]["rows"]:
        vals = [None if c["type"] == "null" else c["value"] for c in r]
        have[vals[0]] = tuple(vals[1:])
    now = int(time.time() * 1000)
    written = 0
    cols = ["document_number", "publication_date", "type", "title", "abstract", "html_url",
            "agencies", "topics", "fetched_at"] + EXTRA_NAMES
    for r in rows:
        if have.get(r["document_number"]) == signature(r):
            continue
        db.execute(
            f"INSERT OR REPLACE INTO policy_notices ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
            [r["document_number"], r["publication_date"], r["type"], r["title"], r["abstract"],
             r["html_url"], json.dumps(r["agencies"]), json.dumps(r["topics"]), now]
            + [r.get(n) for n in EXTRA_NAMES])
        written += 1
    return written


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=180)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    log(f"Federal Register, last {args.days} days, {len(TOPICS)} topics")
    rows, newest = collect(args.days)
    for r in rows[:8]:
        log(f"  {r['publication_date']}  {r['type']:14s} {', '.join(r['topics'])}: {r['title'][:80]}")
    if args.dry_run:
        log("DRY RUN, nothing written")
        return 0
    db = Turso()
    written = write(db, rows)
    held = int(db.scalar("SELECT count(*) FROM policy_notices") or 0)
    log(f"  wrote {written} new or changed rows; {held} held")
    # Freshness is the Register's own clock, not ours: `as_of` is the newest
    # document it holds, so a feed that keeps running against a stalled API
    # goes stale on the health check instead of looking alive.
    if newest:
        stamp_freshness(db, DATASET, source="federalregister.gov API",
                        cadence="Daily", note=f"{held} notices held; newest Register document {newest}",
                        max_age_days=MAX_AGE_DAYS, as_of=newest)
    record_run(db, "ingest_policy_notices.py", status="ok", rows_written=written,
               note=f"{len(rows)} in window, newest {newest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
