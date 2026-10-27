#!/usr/bin/env python3
"""Federal court opinions on this site's programs, into the policy feed.

    python3 scripts/ingest_court_opinions.py                    # newest page, more only on a first run
    python3 scripts/ingest_court_opinions.py --pages 5          # a deeper walk (the weekly one)
    python3 scripts/ingest_court_opinions.py --dry-run          # fetch and print, write nothing
    python3 scripts/ingest_court_opinions.py --dry-run --save-to DIR   # and keep the raw answers
    python3 scripts/ingest_court_opinions.py --from-file p.json # parse a saved answer, then write
    python3 scripts/ingest_court_opinions.py --held             # list captions held for review
    python3 scripts/ingest_court_opinions.py --release cl-123 --as person   # rule on a held caption

WHAT THIS IS. CourtListener (the Free Law Project's archive of court
opinions) answers a search over every opinion it holds through its REST API,
newest first. One query asks for the words this site's programs are written
in (QUERY), and a pure keep rule (`keep_result`) takes what's left: federal
courts only, no criminal case, no petition for review of a removal order,
and a match on the work-visa words themselves (the highlighted words in the
answer, read strictly). What it keeps: suits over PERM labor certification,
H-1B, H-2A and H-2B, I-140 and employment-based green cards, and mandamus
suits over USCIS, State or DOL delays, which name those same forms.

Each opinion becomes a row in `policy_notices`: type "Court opinion", source
`courtlistener`, the day the court filed it, its caption, the court's name as
the agency, the highlighted passage as the abstract, the docket number as the
citation, and a link to the opinion on CourtListener.

PRIVACY. A person's name in a caption becomes their initials
(`lib_case_captions`): "K. v. U.S. Department of State". Organizations,
agencies and officials sued in office stay as printed. A caption the rule
can't classify is held in `policy_held` for a person to rule on (--held,
--release) and never reaches the page. The abstract is redacted the same way
and dropped when a capitalised word is left that might be a name. The link
carries the opinion's number and the redacted caption, never the original
caption: CourtListener reads only the number.

HOW OFTEN, AND HOW MUCH. CourtListener allows 5 API requests a minute, 50 an
hour and 125 a day to a client with a token (its API help page, read Oct 27
2026), and documents no figure for a client without one. A run asks for one
page of 20 answers, newest first; it asks for more (up to CATCHUP_PAGES) only
when nothing on the page is already stored, which is a first run or a run
after a long outage. A run within MIN_GAP_HOURS of the last one does nothing,
so the server's 30-minute job asks about 8 times a day. COURTLISTENER_TOKEN,
when set, is sent as CourtListener asks ("Authorization: Token ..."); a token
refused is dropped for the rest of the run and named in the note.

robots.txt. CourtListener's asks every crawler off its pages and points to
this API instead ("We also have an extensive REST API"). This reader asks the
API only, never a page.

TROUBLE. A refusal or an outage (403, 429, 5xx, a timeout) is a warning: the
run is recorded ok with it in its note, and the dataset's freshness row is
the alarm. An answer with no results, or results missing what every result
has, writes nothing and exits 1. A defect here crashes.
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
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_case_captions as cc  # noqa: E402
from ingest_uscis_news import LostStructure, check_rows, plausible_day  # noqa: E402
from lib_db import Database, et_today, query_dicts, record_run, stamp_freshness  # noqa: E402
from lib_policy_feed import expire_policy_page, record_quiet_run, topics_of, write_notices  # noqa: E402
from lib_warn import is_unreachable  # noqa: E402

SCRIPT = "ingest_court_opinions.py"
API = "https://www.courtlistener.com/api/rest/v4/search/"
SITE = "https://www.courtlistener.com"
DATASET = "policy-notices-courts"
SOURCE = "courtlistener"
TYPE = "Court opinion"
LABEL = "CourtListener (Free Law Project)"
CADENCE = "Every 3 hours"
UA = "permtracker.app policy feed (support@permtracker.app)"
CATCHUP_PAGES = 3    # a first run, or one after an outage: 60 answers
# The search asks only for opinions filed in the last WINDOW_DAYS (WALK_DAYS
# on a --pages walk): a smaller set for CourtListener to sort, and nothing
# older than the feed shows.
WINDOW_DAYS = 120
WALK_DAYS = 365
PAGE_GAP_S = 15      # between pages: CourtListener's 5 a minute
RETRY_WAITS = (20,)  # a 429 or 5xx is asked once more (a 500 from CourtListener cleared in 15 s, Oct 27 2026)
# CourtListener's search is slow. On Oct 27 2026 it answered in 116 s (this
# query unbounded), 57 s (bounded to four months) and 42 s (one phrase, one
# result), and three asks didn't answer within 120 to 150 s. Three minutes,
# then a warning: the next run asks again.
READ_TIMEOUT_S = 180
MIN_GAP_HOURS = 3

# BUDGET. Measured over the two answers read on Oct 27 2026 (40 results, 13
# kept, filed Jul 14 to Oct 26 2026): the longest gap between two kept
# opinions was 16 days (Aug 12 to Aug 28). Two weeks more: one for the courts'
# late-December recess, one for CourtListener posting an opinion days after
# it's filed. 30.
MAX_AGE_DAYS = 30

# The words a kept opinion is about. Each quoted, so CourtListener matches the
# phrase (the module test has the precision measured on Oct 27 2026). Left
# out: "prevailing wage determination", measured (its one hit in 20 was a
# state attorney general on public-works wages); and, by reasoning rather than
# measurement, "CW-1" (criminal opinions name cooperating witnesses that way)
# and "I-485" alone (family and asylum adjustment suits), since an
# employment-based I-485 suit names the I-140 or says "employment-based".
TERMS = ("labor certification", "H-1B", "H-2A", "H-2B", "I-140", "ETA 9089", "ETA-9089",
         "employment-based", "EB-2", "EB-3", "visa bulletin")
QUERY = "(" + " OR ".join(f'"{t}"' for t in TERMS) + ")"

# What a highlighted passage must say, word for word, for the match to count:
# CourtListener's phrase match ignores punctuation, so "labor, certification"
# (a contract's line items) and "D.I. 140" (a Delaware docket entry) match the
# query and fail here.
STRICT = re.compile(
    r"^(labor certification|H-1B|H-2A|H-2B|I-140|ETA[- ]9089|employment-based|EB-[23]|visa bulletin)$", re.I)

FEDERAL_JURISDICTIONS = {"F", "FD"}  # appellate and district (CourtListener's codes); FS is a board
FEDERAL_COURT = re.compile(
    r"^(Supreme Court of the United States|Court of Appeals for the (First|Second|Third|Fourth|Fifth|Sixth"
    r"|Seventh|Eighth|Ninth|Tenth|Eleventh|D\.C\.|Federal) Circuit|District Court, .+)$")
CRIMINAL_DOCKET = re.compile(r"\bcr(im(inal)?)?\b|-cr-|\bCR\b", re.I)
# A removal case reaches a court of appeals as a petition for review against
# the Attorney General; the visa words in one are about a past application.
ATTORNEYS_GENERAL = frozenset(
    "blanche bondi garland wilkinson rosen barr whitaker sessions lynch holder mukasey gonzales ashcroft".split())


def log(msg: str) -> None:
    print(f"[courts] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Parser and keep rule (pure)
# ---------------------------------------------------------------------------

def parse_answer(text: str) -> tuple[list[dict], str | None, int]:
    """(results, the next page's address, total) from one search answer."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise LostStructure(f"CourtListener's answer isn't JSON ({e})") from e
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise LostStructure("CourtListener's answer has no results list")
    raw = data["results"]
    items = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        name, day, court, cid = r.get("caseName"), r.get("dateFiled"), r.get("court"), r.get("cluster_id")
        if not (name and court and cid and isinstance(day, str) and plausible_day(day[:10])):
            continue
        ops = r.get("opinions") or []
        snippet = " ".join(str(o.get("snippet") or "") for o in ops if isinstance(o, dict))
        items.append({
            "id": int(cid),
            "name": " ".join(str(name).split()),
            "day": day[:10],
            "court": str(court),
            "jurisdiction": r.get("court_jurisdiction"),
            "docket": " ".join(str(r.get("docketNumber") or "").split()),
            "citations": [str(c) for c in (r.get("citation") or []) if c],
            "snippet": snippet,
        })
    check_rows(len(raw), items, "CourtListener results", "a caption, a court, a filing date and an id")
    return items, data.get("next"), int(data.get("count") or 0)


def marks(snippet: str) -> list[str]:
    return [" ".join(m.split()) for m in re.findall(r"(?is)<mark>(.*?)</mark>", snippet or "")]


# "employment-based" is also how courts describe discrimination and benefit
# claims: on its own it counts only beside an immigration word in the passage.
IMMIGRATION_NEARBY = re.compile(
    r"\bvisas?\b|immigra|preference|petition|green card|adjustment|\bI-1[34]0\b|\bI-485\b|\bEB-\d|"
    r"labor certification|\bUSCIS\b|priority date", re.I)


def keep_result(item: dict) -> tuple[bool, str]:
    """(kept, why not). Pure, with its own test."""
    juris = item.get("jurisdiction")
    if juris not in (None, "") and juris not in FEDERAL_JURISDICTIONS:
        return False, "not a federal court"
    if not FEDERAL_COURT.match(item["court"]):
        return False, "not a federal court"
    name = item["name"]
    first, _, rest = name.partition(" v. ")
    if CRIMINAL_DOCKET.search(item.get("docket") or ""):
        return False, "a criminal case"
    if re.match(r"^(United States|USA|U\.S\.)$", first.strip()) and rest:
        kind, _ = cc.classify(rest, context="court", year=int(item["day"][:4]), position=1)
        if kind != "keep":
            return False, "a criminal case"
    if item["court"].startswith("Court of Appeals") and rest:
        last = cc._bare(cc._words(rest)[-1]) if cc._words(rest) else ""
        if last in ATTORNEYS_GENERAL:
            return False, "a petition for review of a removal order"
    hits = [m for m in marks(item["snippet"]) if STRICT.match(m)]
    if not hits:
        return False, "the visa words aren't in the matched passage"
    if all(h.lower() == "employment-based" for h in hits) and not IMMIGRATION_NEARBY.search(excerpt(item["snippet"])):
        return False, "employment-based, not about immigration"
    return True, ""


def excerpt(snippet: str) -> str:
    """The highlighted passage as text, marked as an excerpt."""
    s = re.sub(r"(?is)</?mark>", "", snippet or "")
    s = " ".join(s.replace("\xa0", " ").split())
    if s and not re.match(r"^[A-Z“\"(]", s):
        s = "... " + s
    if s and not re.search(r"[.?!”\"]$", s):
        s += " ..."
    return s


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80] or "opinion"


def build(item: dict, ruling: str | None = None) -> tuple[dict, cc.Caption, list[str]]:
    """The row, its caption after the name rule, and any words that cost it
    its abstract."""
    cap = cc.caption_rule(item["name"], context="court", year=int(item["day"][:4]), ruling=ruling)
    abstract, unsafe = cc.safe_abstract(excerpt(item["snippet"]), cap)
    docket = re.sub(r"^(Civil Action|Civil|Case|Docket)\s+No\.?\s*", "", item.get("docket") or "", flags=re.I)
    citation = item["citations"][0] if item.get("citations") else (f"No. {docket}" if docket else None)
    row = {
        "document_number": f"cl-{item['id']}",
        "publication_date": item["day"],
        "type": TYPE,
        "title": cap.text,
        "abstract": abstract,
        "html_url": f"{SITE}/opinion/{item['id']}/{slug(cap.text)}/",
        "agencies": [item["court"]],
        "topics": topics_of(cap.text, excerpt(item["snippet"])),
        "citation": citation,
    }
    return row, cap, unsafe


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------

def search_url(today: str, days: int = WINDOW_DAYS) -> str:
    after = (dt.date.fromisoformat(today) - dt.timedelta(days=days)).isoformat()
    return API + "?" + urllib.parse.urlencode(
        {"q": QUERY, "type": "o", "order_by": "dateFiled desc", "highlight": "on", "filed_after": after})


class TokenRefused(Exception):
    pass


def fetch_url(url: str, sleep=time.sleep, token: str | None = None) -> str:
    """GET one API answer. The token, when there is one, never leaves the
    header."""
    for attempt in range(len(RETRY_WAITS) + 1):
        headers = {"User-Agent": UA, "Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Token {token}"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=READ_TIMEOUT_S) as r:
                return r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 401 and token:
                raise TokenRefused() from None
            if (e.code != 429 and e.code < 500) or attempt == len(RETRY_WAITS):
                raise
            log(f"HTTP {e.code}; asking again in {RETRY_WAITS[attempt]} s")
            sleep(RETRY_WAITS[attempt])
    raise AssertionError("unreachable")


def trouble(exc: BaseException) -> str | None:
    if is_unreachable(exc):
        return "refused"
    if isinstance(exc, urllib.error.HTTPError):
        return "broken"
    if isinstance(exc, OSError):  # a read that timed out (socket.timeout is an OSError before Python 3.10)
        return "refused"
    return None


def describe(exc: BaseException) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code}"
    return f"{type(exc).__name__}: {str(exc)[:120]}"


@dataclass
class Read:
    status: str = "ok"   # ok, refused, broken
    note: str = ""
    warned: bool = False  # a later page failed: the first still counts
    items: list[dict] = field(default_factory=list)
    pages: int = 0
    requests: int = 0


def read_pages(fetch=fetch_url, sleep=time.sleep, *, stored: set[str] | None = None,
               pages: int | None = None, token: str | None = None, save_to: str | None = None) -> Read:
    """Newest first. Stops at a page holding an opinion already stored,
    after `pages` when given, else after one page (CATCHUP_PAGES while
    nothing on them is stored)."""
    out = Read()
    stored = stored or set()
    limit = pages if pages else CATCHUP_PAGES
    url: str | None = search_url(et_today(), WALK_DAYS if pages else WINDOW_DAYS)
    notes = []
    while url and out.pages < limit:
        if out.pages:
            sleep(PAGE_GAP_S)
        try:
            out.requests += 1
            try:
                text = fetch(url, sleep, token)
            except TokenRefused:
                notes.append("the token was refused, asked without it")
                token = None
                out.requests += 1
                text = fetch(url, sleep, None)
            if save_to:
                os.makedirs(save_to, exist_ok=True)
                with open(os.path.join(save_to, f"page{out.pages + 1}.json"), "w", encoding="utf-8") as f:
                    f.write(text)
            items, nxt, _ = parse_answer(text)
        except LostStructure as e:
            if out.pages == 0:
                out.status, out.note = "broken", str(e)
            else:
                out.warned, out.note = True, f"page {out.pages + 1} unread ({e})"
            break
        except Exception as e:  # noqa: BLE001 - sorted below; a defect re-raises
            kind = trouble(e)
            if kind is None:
                raise
            if out.pages == 0:
                out.status = kind
                out.note = f"CourtListener unread ({describe(e)})"
            else:
                out.warned, out.note = True, f"page {out.pages + 1} unread ({describe(e)})"
            break
        out.pages += 1
        out.items.extend(items)
        url = nxt
        if not pages and any(f"cl-{i['id']}" in stored for i in items):
            break
    out.note = "; ".join(x for x in [out.note, *notes] if x)
    return out


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

def stored_ids(db) -> set[str]:
    if db is None:
        return set()
    try:
        got = {r["document_number"] for r in query_dicts(
            db, "SELECT document_number FROM policy_notices WHERE source = ?", [SOURCE])}
    except Exception:  # noqa: BLE001 - no table yet: a first run
        got = set()
    return got | set(cc.held_rows(db, SOURCE))


def ran_recently(db, now: float | None = None) -> bool:
    """True when a run finished within MIN_GAP_HOURS."""
    try:
        newest = db.scalar("SELECT MAX(finished_at) FROM ingest_runs WHERE script = ?", [SCRIPT])
    except Exception:  # noqa: BLE001 - no table yet
        return False
    now_ms = (now if now is not None else time.time()) * 1000
    return newest is not None and now_ms - int(newest) < MIN_GAP_HOURS * 3600 * 1000


def sort_items(items: list[dict], rulings: dict[str, str]) -> tuple[list[dict], list[tuple[dict, str, str]], dict]:
    """(rows for the page, rows to hold with caption and reason, counts)."""
    rows, held = [], []
    counts: dict = {"read": len(items), "kept": 0, "held": 0, "dropped": {}, "abstracts_dropped": 0}
    seen = set()
    for i in items:
        if i["id"] in seen:
            continue
        seen.add(i["id"])
        ok, why = keep_result(i)
        if not ok:
            counts["dropped"][why] = counts["dropped"].get(why, 0) + 1
            continue
        row, cap, unsafe = build(i, rulings.get(f"cl-{i['id']}"))
        if unsafe:
            counts["abstracts_dropped"] += 1
        if cap.held:
            held.append((row, i["name"], cap.held))
            counts["held"] += 1
        else:
            rows.append(row)
            counts["kept"] += 1
    return rows, held, counts


def finish(db, got: Read, started: float, dry_run: bool) -> int:
    rulings = {k: v["decision"] for k, v in cc.held_rows(db, SOURCE).items() if v.get("decision")} if db else {}
    rows, held, counts = sort_items(got.items, rulings) if got.status == "ok" else ([], [], {})
    if got.status == "refused":
        log(f"::warning::{got.note}")
    elif got.status == "broken":
        print(f"::error::CourtListener: {got.note}. Nothing was written.", flush=True)
    else:
        log(f"{counts['read']} opinions on {got.pages} page(s) ({got.requests} requests): {counts['kept']} kept, "
            f"{counts['held']} held for review, dropped {counts['dropped'] or 'none'}; "
            f"{counts['abstracts_dropped']} abstracts dropped as possibly naming someone"
            + (f"; {got.note}" if got.note else ""))
    if dry_run:
        for r in rows[:30]:
            log(f"  {r['publication_date']}  {r['agencies'][0][:40]:40}  {r['title'][:70]}")
        for row, _cap, why in held:
            log(f"  HELD {row['publication_date']}  {why}")
        return 1 if got.status == "broken" else 0

    written = held_written = 0
    if got.status == "ok":
        res = write_notices(db, rows, source=SOURCE)
        written = res.written
        held_written = sum(cc.hold(db, SOURCE, row, cap, why) for row, cap, why in held)
        days = [r["publication_date"] for r in rows] + [row["publication_date"] for row, _c, _w in held]
        if days:
            stamp_freshness(
                db, DATASET, as_of=min(max(days), et_today()), source=LABEL, cadence=CADENCE,
                note=f"{counts['read']} opinions read, {counts['kept']} kept, {counts['held']} held for review",
                max_age_days=MAX_AGE_DAYS,
            )
    note = got.note
    if got.status == "ok":
        note = (f"{counts['kept']} kept, {counts['held']} held of {counts['read']} on {got.pages} page(s), "
                f"{written} written" + (f", {held_written} newly held" if held_written else "")
                + (f"; {got.note}" if got.note else ""))
    if written and expire_policy_page(log) is False:
        note += "; policy page refresh refused"
    if got.status == "broken":
        record_run(db, SCRIPT, status="failed", rows_written=0, note=note, started_at=started)
        return 1
    if got.status == "refused" or got.warned or held_written:
        if got.warned:
            log(f"::warning::{got.note}")
        if held_written:
            log(f"::warning::{held_written} caption(s) held for review (--held)")
        record_run(db, SCRIPT, status="ok", rows_written=written, note=note, started_at=started)
        return 0
    record_quiet_run(db, SCRIPT, written=written, note=note, started_at=started)
    return 0


def run(db=None, *, fetch=fetch_url, sleep=time.sleep, dry_run: bool = False, from_file: str | None = None,
        pages: int | None = None, force: bool = False, token: str | None = None, save_to: str | None = None) -> int:
    started = time.time()
    if not dry_run and db is None:
        db = Database()
    if not dry_run and not from_file and not force and not pages and ran_recently(db):
        log(f"ran within the last {MIN_GAP_HOURS} hours; nothing asked")
        return 0
    if from_file:
        got = Read(pages=1)
        try:
            got.items = parse_answer(open(from_file, encoding="utf-8").read())[0]
        except LostStructure as e:
            got.status, got.note = "broken", str(e)
    else:
        got = read_pages(fetch, sleep, stored=stored_ids(None if dry_run else db), pages=pages, token=token,
                         save_to=save_to)
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
    cap = cc.caption_rule(row["caption"], context="court", year=int(stored["publication_date"][:4]), ruling=ruling)
    stored["title"] = cap.text
    stored["html_url"] = f"{SITE}/opinion/{document_number.removeprefix('cl-')}/{slug(cap.text)}/"
    if stored.get("abstract"):
        stored["abstract"], _ = cc.safe_abstract(stored["abstract"], cap)
    res = write_notices(db, [stored], source=SOURCE)
    print(f"{document_number}: ruled {ruling}, written as {cap.text!r} ({res.written} written)")
    if res.written:
        expire_policy_page(log)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="fetch and print, write nothing")
    ap.add_argument("--from-file", help="a saved API answer")
    ap.add_argument("--pages", type=int, help="read this many pages, whatever is stored")
    ap.add_argument("--force", action="store_true", help=f"run even within {MIN_GAP_HOURS} hours of the last run")
    ap.add_argument("--save-to", metavar="DIR", help="keep each raw answer there (for a test fixture)")
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
    token = (os.environ.get("COURTLISTENER_TOKEN") or "").strip() or None
    return run(dry_run=a.dry_run, from_file=a.from_file, pages=a.pages, force=a.force, token=token,
               save_to=a.save_to)


if __name__ == "__main__":
    sys.exit(main())
