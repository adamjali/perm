#!/usr/bin/env python3
"""BALCA's decisions on PERM, prevailing wages, H-2A and H-2B, into the policy feed.

    python3 scripts/ingest_balca.py                      # discover the caselists, fetch and write
    python3 scripts/ingest_balca.py --all                # every H-2A year page since FY2025 too
    python3 scripts/ingest_balca.py --dry-run            # fetch and print, write nothing
    python3 scripts/ingest_balca.py --from-dir DIR       # parse saved pages (LIBINA.html, PWD_DECISIONS.html ...)
    python3 scripts/ingest_balca.py --held               # list captions held for review
    python3 scripts/ingest_balca.py --release balca-... --as person   # rule on a held caption

WHAT THIS IS. The Board of Alien Labor Certification Appeals (BALCA) decides
appeals of DOL's labor certification denials, and DOL's Office of
Administrative Law Judges (OALJ) lists them on www.dol.gov, one caselist page
per docket type. The pages are found from OALJ's immigration library
(LIBINA), never built from a guessed address:

| caselist | what it lists | read |
|---|---|---|
| BALCA_DECISIONS_PERM | BALCA's en banc PERM decisions, 2006 on, each with OALJ's headnote | all |
| PWD_DECISIONS | appeals of prevailing wage determinations for PERM, H-1B and H-2B (the page: BALCA is "the final agency level of review", 20 CFR 656.41) | FY2025 on |
| TLN_DECISIONS | H-2B labor certification appeals (the page cites 20 CFR Part 655, Subpart A) | FY2025 on |
| TLC_DECISIONS_FY<year> | H-2A appeals (Part 655, Subpart B), decided by BALCA or an ALJ, so the row names OALJ | the newest two years; --all from FY2025 |

Each decision becomes a row in `policy_notices`: type "BALCA decision",
source `balca`, the decision's own date, the caption and docket as OALJ prints
them ("Genetic Reflections, LLC, 2026-TLC-00002"), the kind of decision as the
action ("Decision and Order Affirming Denial of Certification"), the docket as
the citation, the caselist page as the link and the decision's PDF beside it.
An en banc decision's abstract is OALJ's headnote.

WHAT IT CAN'T SEE. OALJ keeps no caselist of BALCA's ordinary three-judge
PERM decisions: the en banc list above is the only PERM list, and OALJ's own
keyword search says decisions after Oct 21 2024 aren't in it yet. So an
ordinary PERM denial appeal is not here. PED_DECISIONS (debarment) mixes ALJ
and ARB decisions and isn't read.

PRIVACY. The same rule as the court reader (`lib_case_captions`), read for
employer captions: a sole proprietor's name becomes initials ("Philip
Johnson" becomes "P.J."), a business stays as printed, and a caption the rule
can't settle is held for review. A PDF's file name carries the parties'
names, the worker's in some PERM appeals ("EMPLOYER_v_WORKER_NAME"), so the
PDF is linked only when every name in its file name is the employer's or
DOL's; otherwise the row links the caselist alone.

WHERE IT RUNS. GitHub's runners, with the OFLC reader's browser header set:
www.dol.gov refuses this Mac and the server. The parser and its fixtures were
built from the Internet Archive's copies of the pages (Mar to Aug 2026), so
the live pages are unverified until the first GitHub run. www.oalj.dol.gov,
where the PDFs are, asks robots off every path: it's linked, never read.

TROUBLE. A refusal or an outage (403, 429, 5xx, a timeout) is a warning: the
run is recorded ok with it in its note, and the dataset's freshness row is
the alarm. A caselist that reads as no decisions, or a library page that
names none of the caselists, exits 1 after writing what did read. A defect
crashes.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html as htmllib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_case_captions as cc  # noqa: E402
from ingest_oflc_news import BROWSER_HEADERS  # noqa: E402
from ingest_uscis_news import LostStructure, listing_text, plausible_day  # noqa: E402
from lib_db import Database, et_today, record_run, stamp_freshness  # noqa: E402
from lib_gov_data import RobotsDisallowed, robots_allowed  # noqa: E402
from lib_policy_feed import expire_policy_page, record_quiet_run, topics_of, write_notices  # noqa: E402
from lib_warn import is_unreachable  # noqa: E402

SCRIPT = "ingest_balca.py"
HOST = "https://www.dol.gov"
LIBRARY = f"{HOST}/agencies/oalj/topics/libraries/LIBINA"
CASELISTS = "/agencies/oalj/PUBLIC/INA/REFERENCES/CASELISTS/"
DATASET = "policy-notices-balca"
SOURCE = "balca"
TYPE = "BALCA decision"
LABEL = "OALJ's BALCA caselists"
CADENCE = "Daily"
# The program caselists go back to 2008; the feed lists the last two fiscal
# years of them (about 300 decisions on the Archive's copies) and the en banc
# PERM list in full. Older decisions are on OALJ's pages.
SINCE = "2024-10-01"
NEWEST_TLC_YEARS = 2    # a FY2025 docket decided in FY2026 is listed on the FY2025 page
PAGE_GAP_S = 5          # between pages: www.dol.gov refuses sustained traffic
RETRY_WAITS = (20,)     # a 429 or 503 is asked once more, 20 s later

# BUDGET. OALJ adds decisions to these pages in batches, weeks or months
# after they're issued. Measured on the Internet Archive's copies: the H-2A
# page for FY2026, copied Jun 16 2026, ended at a decision of Jan 29 2026
# (138 days); the H-2B page, copied Mar 6 2026, also at Jan 29; the wage page,
# copied Mar 7, at Jan 15 (51 days). The longest gap between two decisions on
# the three pages together from FY2024 to FY2026 was 44 days (Sep 30 to Nov
# 13 2025, the shutdown).
# A freshness row can't tell OALJ's lag from a broken reader, so the budget
# is the longest lag seen plus a month: 170 days, warning past it and failing
# at three times it.
MAX_AGE_DAYS = 170

LISTS = {
    "BALCA_DECISIONS_PERM": {"kind": "PER", "court": "Board of Alien Labor Certification Appeals",
                             "about": "labor certification (PERM)", "since": None},
    "PWD_DECISIONS": {"kind": "PWD", "court": "Board of Alien Labor Certification Appeals",
                      "about": "prevailing wage", "since": SINCE},
    "TLN_DECISIONS": {"kind": "TLN", "court": "Board of Alien Labor Certification Appeals",
                      "about": "H-2B", "since": SINCE},
    "TLC": {"kind": "TLC", "court": "Office of Administrative Law Judges", "about": "H-2A", "since": SINCE},
}

MONTHS = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9,
          "oct": 10, "nov": 11, "dec": 12}
DATE = re.compile(r"\((?:ALJ\s+|ARB\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\)",
                  re.I)
DOCKET = re.compile(r"\b(\d{4})-(PER|PWD|TLC|TLN|INA)-0*(\d{1,5})\b")
DECISION_WORDS = re.compile(r"Decision|Order|Dismiss|Remand|Affirm|Revers|Vacat|Approv|Grant|Den(y|ial|ied)|en banc", re.I)
# A PDF file name's sides that are DOL itself.
DOL_FILE_SIDES = ("EMPLOYMENTANDTRAIN", "CERTIFYINGOFFICER", "ADMINISTRATOR", "USDOL", "WAGEANDHOUR",
                  "OFFICEOFFOREIGN", "OFLC", "DOLWASHINGTON", "DOL", "ETA")


def log(msg: str) -> None:
    print(f"[balca] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Parsers (pure)
# ---------------------------------------------------------------------------

def original_url(href: str) -> str:
    """An address as DOL printed it: the Archive's prefix and tracking query
    taken off, a relative path put on www.dol.gov."""
    h = htmllib.unescape(href.strip())
    h = re.sub(r"^(?:https?://web\.archive\.org)?/web/\d+[a-z_]*/", "", h)
    h = re.sub(r"\?_ga=.*$", "", h)
    if h.startswith("/"):
        h = HOST + h
    return h.replace("http://", "https://", 1)


def discover(library_html: str) -> dict[str, str]:
    """The caselists OALJ's immigration library links: name to address."""
    out: dict[str, str] = {}
    for m in re.finditer(r'href="([^"]*' + re.escape(CASELISTS) + r'([A-Z0-9_]+))"', library_html):
        out[m.group(2)] = original_url(m.group(1))
    wanted = [n for n in out if n in LISTS or re.fullmatch(r"TLC_DECISIONS_FY\d{4}", n)]
    if not wanted:
        raise LostStructure("OALJ's immigration library names none of the BALCA caselists")
    return {n: out[n] for n in wanted}


def tlc_years(found: dict[str, str], every: bool) -> list[str]:
    years = sorted((n for n in found if re.fullmatch(r"TLC_DECISIONS_FY\d{4}", n)), reverse=True)
    if every:
        return [n for n in years if int(n[-4:]) >= int(SINCE[:4]) + 1]
    return years[:NEWEST_TLC_YEARS]


def _body(page: str) -> str:
    """The caselist itself: the article of the caselist node, else <main>."""
    m = re.search(r'(?is)<article[^>]*about="[^"]*CASELISTS[^"]*"[^>]*>(.*?)</article>', page)
    if m:
        return m.group(1)
    m = re.search(r"(?is)<main[^>]*>(.*?)</main>", page)
    return m.group(1) if m else page


def _docket(m: re.Match) -> str:
    return f"{m.group(1)}-{m.group(2)}-{int(m.group(3)):05d}"


def _day(m: re.Match) -> str | None:
    try:
        return dt.date(int(m.group(3)), MONTHS[m.group(1).lower()[:3]], int(m.group(2))).isoformat()
    except (ValueError, KeyError):
        return None


def _file_day(url: str) -> str | None:
    """The decision's date as its PDF file name carries it: "(OCT_26_2023)"."""
    m = re.search(r"(?:\(|%28)([A-Z]{3})_(\d{2})_(\d{4})(?:\)|%29)", url, re.I)
    if not m:
        return None
    try:
        return dt.date(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2))).isoformat()
    except (ValueError, KeyError):
        return None


def _clean(text: str) -> str:
    return " ".join(listing_text(text).replace(" ,", ",").split()).strip(" ,;")


def _kind(segment: str) -> str | None:
    """The kind of decision: OALJ's parenthesised phrase, or the words before
    the date."""
    for p in re.findall(r"\(([^()]{6,200})\)", segment):
        if DECISION_WORDS.search(p) and not DATE.search(f"({p})"):
            return _clean(p)
    lead = DATE.split(segment)[0] if DATE.search(segment) else segment
    lead = _clean(re.sub(r"\([^()]*\)", " ", lead))
    return lead if lead and DECISION_WORDS.search(lead) and len(lead) <= 200 else None


def parse_caselist(page: str, name: str) -> list[dict]:
    """Every decision on a caselist page, as dicts with docket, caption, day,
    kind, pdf, and an en banc decision's headnote."""
    body = _body(page)
    blocks = [(m.group(1).lower(), m.group(2)) for m in re.finditer(r"(?is)<(h[1-6]|p|li)\b[^>]*>(.*?)</\1>", body)]
    out: list[dict] = []
    pending: tuple[str, str] | None = None   # an H-2A page names the case in its own paragraph
    for tag, inner in blocks:
        text = listing_text(inner)
        links = [(m.start(), m.end(), original_url(m.group(1)), listing_text(m.group(2)))
                 for m in re.finditer(r'(?is)<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', inner)]
        pdfs = [x for x in links if re.search(r"\.pdf(\?|$)", x[2], re.I) and "/ARB/" not in x[2]]
        dockets = list(DOCKET.finditer(text))
        if name == "BALCA_DECISIONS_PERM" and not tag.startswith("h"):
            # The en banc list names each decision in a heading; the list
            # items under it are OALJ's headnotes, whose links are cases cited.
            pdfs = []
        if not pdfs:
            if dockets and len(text) < 300 and not DATE.search(text) and text.startswith(dockets[0].group(0)):
                pending = (_docket(dockets[0]), _clean(text[dockets[0].end():]))
            elif name == "BALCA_DECISIONS_PERM" and out and tag == "li":
                strong = " ".join(listing_text(s) for s in re.findall(r"(?is)<strong>(.*?)</strong>", inner))
                if strong and not out[-1].get("headnote"):
                    out[-1]["headnote"] = _clean(strong)
            continue
        if dockets and not text.startswith(dockets[0].group(0)):
            docket = _docket(dockets[0])
            caption = _clean(text[: dockets[0].start()])
        elif dockets:
            docket = _docket(dockets[0])
            caption = _clean(text[dockets[0].end():].split("(")[0])
        elif pending:
            docket, caption = pending
        else:
            continue
        # A case's later decisions can sit in list items of their own, under
        # the item that names it (the H-2B list nests them).
        pending = (docket, caption)
        # Each PDF, with the words between it and the one before.
        html_marks = []
        cursor = 0
        plain = inner
        for start, end, url, label in pdfs:
            html_marks.append((listing_text(plain[cursor:start]), url, label, listing_text(plain[end:])))
            cursor = end
        for seg, url, label, after in html_marks:
            d = DATE.search(seg) or (DATE.search(after) if label.upper().strip() != "PDF" else None)
            day = (_day(d) if d else None) or _file_day(url) or (_day(DATE.search(text)) if DATE.search(text) else None)
            if not day:
                continue
            last = list(DOCKET.finditer(seg))
            kind = _kind(re.sub(r"^[\s,\-0-9]+", "", seg[last[-1].end():]) if last else seg)
            if not kind and label.upper().strip() != "PDF" and re.search(r"\(en banc\)", after, re.I):
                kind = "En banc decision"
            out.append({"docket": docket, "caption": caption, "day": day, "kind": kind, "pdf": url,
                        "list": name})
    return out


def pdf_names_safe(pdf: str, caption: cc.Caption) -> bool:
    """True when every party in the PDF's file name is DOL or the employer the
    caption prints: no worker's or proprietor's name in the address."""
    if caption.people:
        return False
    base = re.sub(r"(?i)\.pdf$", "", pdf.rsplit("/", 1)[-1])
    m = re.match(r"(?i)^(.+?)_\d{4}(?:PER|PWD|TLC|TLN|PED|INA)\d+", base)
    if not m:
        return False
    parties = re.sub(r"(?i)^In_re_", "", m.group(1))
    printed = re.sub(r"[^A-Z0-9]", "", caption.text.upper())
    for side in re.split(r"(?i)_v_", parties):
        s = re.sub(r"[^A-Z0-9]", "", side.upper().replace("_AND_", "AND"))
        if not s:
            return False
        if any(s.startswith(d) for d in DOL_FILE_SIDES):
            continue
        if not printed.startswith(s[: max(6, min(len(s), 12))]):
            return False
    return True


def decision_rows(decisions: list[dict], list_urls: dict[str, str], rulings: dict[str, str]):
    """(rows for the page, rows to hold with caption and reason)."""
    rows, held = [], []
    seen: set[tuple] = set()
    per_day: dict[str, int] = {}
    for d in sorted(decisions, key=lambda x: (x["day"], x["docket"], x["pdf"])):
        spec = LISTS["TLC" if d["list"].startswith("TLC_") else d["list"]]
        if spec["since"] and d["day"] < spec["since"]:
            continue
        if not plausible_day(d["day"]) or (d["docket"], d["day"], d["pdf"]) in seen:
            continue
        seen.add((d["docket"], d["day"], d["pdf"]))
        # Two documents on one case in one day (an order and its errata) are two rows.
        num = f"balca-{d['docket']}-{d['day'].replace('-', '')}"
        per_day[num] = per_day.get(num, 0) + 1
        if per_day[num] > 1:
            num += f"-{per_day[num]}"
        cap = cc.caption_rule(d["caption"], context="employer", year=int(d["day"][:4]), ruling=rulings.get(num))
        abstract, _unsafe = cc.safe_abstract(d.get("headnote"), cap, exempt_first=True)
        row = {
            "document_number": num,
            "publication_date": d["day"],
            "type": TYPE,
            "title": f"{cap.text}, {d['docket']}" if cap.text else d["docket"],
            "abstract": abstract,
            "html_url": list_urls.get(d["list"]) or f"{HOST}{CASELISTS}{d['list']}",
            "agencies": [spec["court"]],
            "topics": topics_of(spec["about"], d.get("kind") or "", d.get("headnote") or ""),
            "action": d.get("kind"),
            "citation": d["docket"],
            "pdf_url": d["pdf"] if pdf_names_safe(d["pdf"], cap) else None,
        }
        if cap.held or not cap.text:
            held.append((row, d["caption"], cap.held or "no caption on the caselist"))
        else:
            rows.append(row)
    return rows, held


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------

def fetch_url(url: str, sleep=time.sleep) -> str:
    """GET with the OFLC reader's browser header set, after robots.txt."""
    if not robots_allowed(url):
        raise RobotsDisallowed(f"{url} is a path the host's robots.txt asks automated clients not to read")
    for attempt in range(len(RETRY_WAITS) + 1):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=dict(BROWSER_HEADERS)), timeout=90) as r:
                return r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == len(RETRY_WAITS):
                raise
            log(f"HTTP {e.code}; asking again in {RETRY_WAITS[attempt]} s")
            sleep(RETRY_WAITS[attempt])
    raise AssertionError("unreachable")


def trouble(exc: BaseException) -> str | None:
    if isinstance(exc, RobotsDisallowed) or is_unreachable(exc):
        return "refused"
    if isinstance(exc, urllib.error.HTTPError):
        return "broken"
    if isinstance(exc, OSError):  # a read that timed out (socket.timeout before Python 3.10)
        return "refused"
    return None


def describe(exc: BaseException) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, RobotsDisallowed):
        return "robots.txt disallows it"
    return f"{type(exc).__name__}: {str(exc)[:120]}"


@dataclass
class Read:
    status: str = "ok"   # ok, refused, broken
    notes: list[str] = field(default_factory=list)
    warned: bool = False  # one caselist refused: the others still count
    broken: list[str] = field(default_factory=list)  # caselists that read as nothing
    decisions: list[dict] = field(default_factory=list)
    urls: dict[str, str] = field(default_factory=dict)
    pages: int = 0


def read_all(fetch=fetch_url, sleep=time.sleep, *, every: bool = False) -> Read:
    out = Read()
    try:
        found = discover(fetch(LIBRARY, sleep))
        out.pages += 1
    except LostStructure as e:
        out.status, out.notes = "broken", [str(e)]
        return out
    except Exception as e:  # noqa: BLE001 - sorted below; a defect re-raises
        kind = trouble(e)
        if kind is None:
            raise
        out.status, out.notes = kind, [f"OALJ's immigration library unread ({describe(e)})"]
        return out
    names = [n for n in ("BALCA_DECISIONS_PERM", "PWD_DECISIONS", "TLN_DECISIONS") if n in found]
    missing = [n for n in ("BALCA_DECISIONS_PERM", "PWD_DECISIONS", "TLN_DECISIONS") if n not in found]
    names += tlc_years(found, every)
    if missing:
        out.warned = True
        out.notes.append(f"the library no longer links {', '.join(missing)}")
    for n in names:
        sleep(PAGE_GAP_S)
        url = found[n]
        out.urls[n] = url
        try:
            got = parse_caselist(fetch(url, sleep), n)
        except Exception as e:  # noqa: BLE001 - sorted below; a defect re-raises
            kind = trouble(e)
            if kind is None:
                raise
            out.warned = True
            out.notes.append(f"{n} unread ({describe(e)})")
            continue
        out.pages += 1
        if not got:
            out.broken.append(n)
            continue
        out.decisions.extend(got)
    if out.broken:
        out.notes.append(f"no decisions read on {', '.join(out.broken)}")
    return out


def read_dir(path: str) -> Read:
    out = Read()
    files = {os.path.splitext(f)[0]: os.path.join(path, f) for f in os.listdir(path) if f.endswith(".html")}
    if "LIBINA" in files:
        try:
            found = discover(open(files["LIBINA"], encoding="utf-8", errors="replace").read())
        except LostStructure as e:
            out.status, out.notes = "broken", [str(e)]
            return out
        out.urls = found
    for n, f in sorted(files.items()):
        if n == "LIBINA" or not (n in LISTS or n.startswith("TLC_DECISIONS_FY")):
            continue
        got = parse_caselist(open(f, encoding="utf-8", errors="replace").read(), n)
        out.pages += 1
        if not got:
            out.broken.append(n)
        out.decisions.extend(got)
    if out.broken:
        out.notes.append(f"no decisions read on {', '.join(out.broken)}")
    return out


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

def finish(db, got: Read, started: float, dry_run: bool) -> int:
    rulings = ({k: v["decision"] for k, v in cc.held_rows(db, SOURCE).items() if v.get("decision")} if db else {})
    rows, held = decision_rows(got.decisions, got.urls, rulings) if got.status == "ok" else ([], [])
    note = "; ".join(got.notes)
    if got.status == "refused":
        log(f"::warning::{note}")
    elif got.status == "broken":
        print(f"::error::BALCA: {note}. Nothing was written.", flush=True)
    else:
        log(f"{len(got.decisions)} decisions on {got.pages} page(s), {len(rows)} for the page, {len(held)} held"
            + (f", newest {max(r['publication_date'] for r in rows)}" if rows else "") + (f"; {note}" if note else ""))
    if dry_run:
        for r in sorted(rows, key=lambda x: x["publication_date"], reverse=True)[:12]:
            log(f"  {r['publication_date']}  {r['title'][:70]}  | {(r['action'] or '')[:60]}")
        for row, _c, why in held:
            log(f"  HELD {row['publication_date']}  {row['citation']}  {why}")
        return 1 if got.status == "broken" or got.broken else 0

    written = held_written = 0
    if got.status == "ok":
        written = write_notices(db, rows, source=SOURCE).written
        held_written = sum(cc.hold(db, SOURCE, row, cap, why) for row, cap, why in held)
        days = [r["publication_date"] for r in rows] + [r["publication_date"] for r, _c, _w in held]
        if days:
            stamp_freshness(
                db, DATASET, as_of=min(max(days), et_today()), source=LABEL, cadence=CADENCE,
                note=f"{len(got.decisions)} decisions read on {got.pages} pages, {len(rows)} listed, {len(held)} held",
                max_age_days=MAX_AGE_DAYS,
            )
        note = (f"{len(rows)} listed, {len(held)} held of {len(got.decisions)} on {got.pages} page(s), "
                f"{written} written" + (f", {held_written} newly held" if held_written else "")
                + (f"; {note}" if note else ""))
    if written and expire_policy_page(log) is False:
        note += "; policy page refresh refused"
    if got.status == "broken" or got.broken:
        record_run(db, SCRIPT, status="failed", rows_written=written, note=note, started_at=started)
        return 1
    if got.status == "refused" or got.warned or held_written:
        if got.warned:
            log(f"::warning::{note}")
        if held_written:
            log(f"::warning::{held_written} caption(s) held for review (--held)")
        record_run(db, SCRIPT, status="ok", rows_written=written, note=note, started_at=started)
        return 0
    record_quiet_run(db, SCRIPT, written=written, note=note, started_at=started)
    return 0


def run(db=None, *, fetch=fetch_url, sleep=time.sleep, dry_run: bool = False, from_dir: str | None = None,
        every: bool = False) -> int:
    started = time.time()
    if not dry_run and db is None:
        db = Database()
    got = read_dir(from_dir) if from_dir else read_all(fetch, sleep, every=every)
    return finish(None if dry_run else db, got, started, dry_run)


def show_held(db) -> int:
    for k, v in sorted(cc.held_rows(db, SOURCE).items()):
        print(f"{k}\t{v.get('decision') or 'waiting'}\t{v['reason']}")
    return 0


def release(db, document_number: str, ruling: str) -> int:
    row = cc.rule_on(db, SOURCE, document_number, ruling)
    if row is None:
        print(f"nothing held under {document_number}")
        return 1
    stored = json.loads(row["row_json"])
    cap = cc.caption_rule(row["caption"], context="employer", year=int(stored["publication_date"][:4]), ruling=ruling)
    stored["title"] = f"{cap.text}, {stored['citation']}"
    if stored.get("pdf_url") and not pdf_names_safe(stored["pdf_url"], cap):
        stored["pdf_url"] = None
    if stored.get("abstract"):
        stored["abstract"], _ = cc.safe_abstract(stored["abstract"], cap, exempt_first=True)
    res = write_notices(db, [stored], source=SOURCE)
    print(f"{document_number}: ruled {ruling}, written as {stored['title']!r} ({res.written} written)")
    if res.written:
        expire_policy_page(log)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="fetch and print, write nothing")
    ap.add_argument("--from-dir", help="saved pages: LIBINA.html and the caselists by name")
    ap.add_argument("--all", action="store_true", help="every H-2A year page since FY2025")
    ap.add_argument("--held", action="store_true", help="list captions held for review")
    ap.add_argument("--release", metavar="DOCUMENT", help="rule on a held caption")
    ap.add_argument("--as", dest="ruling", choices=("person", "organization"))
    a = ap.parse_args()
    if a.held:
        return show_held(Database())
    if a.release:
        if not a.ruling:
            ap.error("--release needs --as person or --as organization")
        return release(Database(), a.release, a.ruling)
    return run(dry_run=a.dry_run, from_dir=a.from_dir, every=a.all)


if __name__ == "__main__":
    sys.exit(main())
