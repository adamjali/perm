#!/usr/bin/env python3
"""OFLC's own announcements, into the policy feed.

    python3 scripts/ingest_oflc_news.py                       # fetch and write
    python3 scripts/ingest_oflc_news.py --dry-run             # print, write nothing
    python3 scripts/ingest_oflc_news.py --from-file page.html # parse a saved page

WHAT THIS IS. The Office of Foreign Labor Certification posts its operating
notices on one page: disclosure-data releases, webinar dates, filing-system
changes, court-order compliance notices, wage-rate updates. None of it is in
the Federal Register, which the policy feed already reads, and most of it
matters more to a filer than a rule does. Each announcement becomes one row in
`policy_notices` with type "OFLC announcement", the announcement's own date,
its title, its first paragraph verbatim as the abstract, and topic tags from
the same vocabulary the Federal Register feed uses.

WHERE IT RUNS. www.dol.gov answers GitHub's runners with a full browser header
set and refuses residential addresses, so this runs on the runner beside the
debarment ingest. From a laptop, `--from-file` parses a page saved by a
browser (HTML or the page's text); the parser accepts either because the
fixture that proves it was captured as text.

WHAT IT IS NOT. A summary or an opinion. The abstract is OFLC's first
paragraph, verbatim; a row's URL is the announcements page, because OFLC gives
its notices no address of their own.

DOL OIG was considered for this feed and left out: its site exposes a search
page rather than a parseable list of reports, and the audits that touch
foreign labor are rare PDFs. Revisit if OIG ever publishes a feed.
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
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_turso import Turso, record_run, stamp_freshness  # noqa: E402

URL = "https://www.dol.gov/agencies/eta/foreign-labor/news"
DATASET = "policy-notices-oflc"
TYPE = "OFLC announcement"
AGENCIES = ["Office of Foreign Labor Certification"]
MAX_AGE_DAYS = 10
ABSTRACT_CHARS = 600

# The same topic vocabulary the Federal Register feed tags with, matched on
# the title and the first paragraph. A term is a regex; case-insensitive.
TOPICS: dict[str, str] = {
    "perm": r"\bPERM\b|permanent labor certification|ETA[- ]9089",
    "prevailing-wage": r"prevailing wage|ETA[- ]9141|\bPWD\b|wage determination",
    "h-1b": r"\bH-1B\b|labor condition application|\bLCA\b",
    "h-2a": r"\bH-2A\b",
    "h-2b": r"\bH-2B\b",
    "disclosure-data": r"disclosure data|program statistics",
    "flag": r"\bFLAG\b|Foreign Labor Application Gateway",
}

MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
HEAD = re.compile(rf"^(?P<month>{MONTHS}) (?P<day>\d{{1,2}}), (?P<year>\d{{4}})\.\s+(?P<title>\S.*)$")

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Ch-Ua": '"Chromium";v="128", "Google Chrome";v="128", "Not;A=Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
}


def log(msg: str) -> None:
    print(f"[oflc-news] {msg}", flush=True)


def html_to_text(page: str) -> str:
    """Block tags to newlines, everything else stripped, entities decoded.

    Good enough for a page of headings and paragraphs; the announcement head
    is a whole line ("September 2, 2026. Title") in both the rendered page and
    this output, which is what the parser keys on.
    """
    s = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", page)
    s = re.sub(r"(?i)<br\s*/?>", "\n", s)
    s = re.sub(r"(?i)</?(p|div|h[1-6]|li|ul|ol|section|article|header|footer|tr|table)[^>]*>", "\n", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = htmllib.unescape(s)
    s = s.replace(" ", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in s.splitlines()]
    return "\n".join(lines)


def parse_announcements(text: str) -> list[dict]:
    """Every "Month D, YYYY. Title" head with the paragraphs under it."""
    lines = text.splitlines()
    heads: list[tuple[int, dict]] = []
    for i, ln in enumerate(lines):
        m = HEAD.match(ln.strip())
        if not m:
            continue
        try:
            date = dt.datetime.strptime(f"{m['month']} {m['day']} {m['year']}", "%B %d %Y").date()
        except ValueError:
            continue
        heads.append((i, {"date": date.isoformat(), "title": m["title"].strip().rstrip(".") + ("." if m["title"].strip().endswith(".") else "")}))
    out: list[dict] = []
    for n, (i, head) in enumerate(heads):
        end = heads[n + 1][0] if n + 1 < len(heads) else len(lines)
        body = [ln.strip() for ln in lines[i + 1 : end] if ln.strip()]
        # The archive's own navigation ("Archive", "Calendar Year 2026") is
        # not part of any announcement.
        body = [b for b in body if not re.fullmatch(r"(Archive|Announcements|Calendar Year \d{4})", b)]
        abstract = body[0] if body else None
        if abstract and len(abstract) > ABSTRACT_CHARS:
            cut = abstract[:ABSTRACT_CHARS]
            abstract = cut[: cut.rfind(" ")] + " ..."
        title = head["title"].rstrip(".")
        haystack = f"{title}\n{abstract or ''}"
        topics = [t for t, rx in TOPICS.items() if re.search(rx, haystack, flags=re.I)]
        digest = hashlib.sha1(f"{head['date']}|{title}".encode()).hexdigest()[:8]
        out.append(
            {
                "document_number": f"oflc-{head['date']}-{digest}",
                "publication_date": head["date"],
                "type": TYPE,
                "title": title,
                "abstract": abstract,
                "html_url": URL,
                "agencies": AGENCIES,
                "topics": topics,
            }
        )
    return out


def fetch_page(retries: int = 3) -> str:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(URL, headers=BROWSER_HEADERS)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001
            last = e
            log(f"fetch attempt {attempt + 1} failed: {e}")
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"could not fetch {URL}: {last}")


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


def write(db: Turso, rows: list[dict]) -> int:
    """Upsert only the rows that are new or changed; the Federal Register feed's rows are untouched."""
    db.script(DDL)
    res = db.execute("SELECT document_number, title, abstract, topics FROM policy_notices WHERE type = ?", [TYPE])
    have = {}
    for r in res["response"]["result"]["rows"]:
        vals = [None if c["type"] == "null" else c["value"] for c in r]
        have[vals[0]] = (vals[1], vals[2], vals[3])
    now = int(time.time() * 1000)
    written = 0
    for row in rows:
        key = (row["title"], row["abstract"], json.dumps(row["topics"]))
        if have.get(row["document_number"]) == key:
            continue
        db.execute(
            "INSERT OR REPLACE INTO policy_notices VALUES (?,?,?,?,?,?,?,?,?)",
            [
                row["document_number"], row["publication_date"], row["type"], row["title"], row["abstract"],
                row["html_url"], json.dumps(row["agencies"]), json.dumps(row["topics"]), now,
            ],
        )
        written += 1
    return written


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from-file", help="a saved copy of the announcements page (HTML or text)")
    a = ap.parse_args()
    started = time.time()

    if a.from_file:
        raw = open(a.from_file, encoding="utf-8", errors="replace").read()
    else:
        raw = fetch_page()
    text = html_to_text(raw) if "<" in raw[:2000] else raw
    rows = parse_announcements(text)
    log(f"parsed {len(rows)} announcements" + (f"; newest {rows[0]['publication_date']}" if rows else ""))
    if not rows:
        log("no announcements parsed; the page's shape may have changed. Refusing to write.")
        return 1

    if a.dry_run:
        for r in rows[:5]:
            print(json.dumps(r, indent=2)[:900])
        return 0

    db = Turso()
    written = write(db, rows)
    newest = max(r["publication_date"] for r in rows)
    stamp_freshness(
        db, DATASET, as_of=newest, source=URL, cadence="Daily",
        note=f"{len(rows)} OFLC announcements, {written} written", max_age_days=MAX_AGE_DAYS,
    )
    record_run(db, "ingest_oflc_news.py", status="ok", rows_written=written, note=f"{len(rows)} parsed", started_at=started)
    log(f"wrote {written} of {len(rows)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
