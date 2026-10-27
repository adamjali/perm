#!/usr/bin/env python3
"""Rules on their way: White House review, public inspection, the Register.

    python3 scripts/ingest_rule_pipeline.py            # read and write
    python3 scripts/ingest_rule_pipeline.py --dry-run  # read, print, write nothing

WHAT THIS IS. A rule an agency proposes passes through three public records
before anyone can read it, and each has a date:

  1. OIRA's review. A significant rule goes to the White House Office of
     Information and Regulatory Affairs first. OIRA publishes two lists as
     XML on reginfo.gov: the rules under review now, and the reviews completed
     in the last 30 days, each with the date OIRA received the draft, the date
     it finished, and its decision as it prints it ("Consistent with Change").
  2. Public inspection. The day before (or a few days before) a document is
     published, the Office of the Federal Register files it for public
     inspection. Its API lists today's filings.
  3. The Register itself. The proposal, its comment deadline, and later the
     final rule, each naming the rule's RIN (Regulation Identifier Number).

The RIN ties the three together. This reads all three and keeps one row per
rule (`rule_pipeline`) and one row per step a rule took (`rule_pipeline_events`).

WHAT IT KEEPS. Rules from USCIS (every one), and rules from DOL's Employment
and Training Administration and Wage and Hour Division, the State Department and
the rest of DHS whose title names an immigration program. ETA also writes
apprenticeship and unemployment rules, and State writes arms-export rules; those
aren't this site's subject.

WHAT IT NEVER DOES. Clear a fact. OIRA's completed list forgets a review after
30 days and the public inspection list forgets a document once it's published,
so a rule absent from a feed today keeps what was read before. A row is written
only when a fact changed, and a second run on the same day writes nothing.

HEALTH. Freshness is stamped with OIRA's own run date (the RUNDATE on its XML),
so a list OIRA stopped regenerating reads as stale even while our run is fine.
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
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_db import Database, et_today, query_dicts, record_run, stamp_freshness  # noqa: E402
from lib_gov_data import RobotsDisallowed, robots_allowed  # noqa: E402
from ingest_policy_notices import API as REGISTER_DOCS, UA, keep  # noqa: E402

EASTERN = ZoneInfo("America/New_York")

OIRA_UNDER_REVIEW = "https://www.reginfo.gov/public/do/XMLViewFileAction?f=EO_RULES_UNDER_REVIEW.xml"
OIRA_COMPLETED = "https://www.reginfo.gov/public/do/XMLViewFileAction?f=EO_RULE_COMPLETED_30_DAYS.xml"
PUBLIC_INSPECTION = "https://www.federalregister.gov/api/v1/public-inspection-documents/current.json"
REGINFO_RULE = "https://www.reginfo.gov/public/do/eAgendaViewRule?RIN={rin}"

DATASET = "rule-pipeline"
SCRIPT = "ingest_rule_pipeline.py"
SOURCE = "OIRA (reginfo.gov) and the Federal Register"
# OIRA regenerates its lists every day, weekends included; four days covers a
# long weekend where the file stood still.
MAX_AGE_DAYS = 4

# Agency codes are the first four digits of a RIN. USCIS writes only
# immigration rules; the others write many kinds, so their rules need a title
# that names an immigration program.
ALWAYS = {"1615": "USCIS"}
BY_TITLE = {
    "1205": "DOL's Employment and Training Administration",
    "1235": "DOL's Wage and Hour Division",
    "1400": "State Department",
    "1601": "DHS",
    "1651": "U.S. Customs and Border Protection",
    "1653": "U.S. Immigration and Customs Enforcement",
}
DHS_PREFIX = "16"  # every DHS component's code starts 16
DHS_NAME = "Homeland Security Department"

IMMIGRATION_TITLE = re.compile(
    r"\b(?:H-1B1?|H-2A|H-2B|E-3|CW-1|L-1|O-1|EB-[1-5]|PERM|labor certification|"
    r"immigra\w*|nonimmigra\w*|aliens?|foreign (?:workers?|nationals?|labor)|visas?|"
    r"green cards?|adjustment of status|employment authorization|work authorization|"
    r"prevailing wages?|practical training|asylum|refugees?|parole|naturaliz\w*|"
    r"citizenship|deferred action|DACA|temporary protected status|students?|"
    r"exchange visitors?|premium processing)\b",
    re.I,
)

# OIRA's STAGE values that are the rule's final form. Everything else (a
# proposal, a notice, a prerule) is the first phase.
FINAL_STAGES = {"Final Rule", "Interim Final Rule", "Direct Final Rule"}

RIN_RE = re.compile(r"\b\d{4}-[A-Z]{2}\d{2}\b")
RIN_LINE = re.compile(r"\bRINs?\b[:.\s]*([^\n]{0,80})")

# One row per rule. Every fact column is nullable and never set back to NULL.
COLUMNS = {
    "rin": "TEXT PRIMARY KEY",
    "agency": "TEXT", "title": "TEXT",
    # The review of the proposal (or of a notice or prerule), and the review of
    # the final rule, kept apart: OIRA reviews a rule twice, and the second
    # review must not erase the first.
    "p_stage": "TEXT", "p_received": "TEXT", "p_completed": "TEXT", "p_decision": "TEXT",
    "f_stage": "TEXT", "f_received": "TEXT", "f_completed": "TEXT", "f_decision": "TEXT",
    "major": "TEXT", "significant": "TEXT",
    "pi_document": "TEXT", "pi_type": "TEXT", "pi_filed": "TEXT", "pi_scheduled": "TEXT", "pi_url": "TEXT",
    "proposed_document": "TEXT", "proposed_published": "TEXT", "proposed_url": "TEXT",
    "proposed_citation": "TEXT", "comments_close": "TEXT",
    "final_document": "TEXT", "final_published": "TEXT", "final_url": "TEXT",
    "final_citation": "TEXT", "effective_on": "TEXT",
    "first_seen": "INTEGER", "updated_at": "INTEGER",
}
FACTS = [c for c in COLUMNS if c not in ("rin", "first_seen", "updated_at")]
SET_ONCE = {"title", "agency"}

# The facts that are a step: when one is set or moves, the step is recorded.
STEP_FIELDS = (
    ("p_received", "oira-received", "p_stage"),
    ("p_completed", "oira-completed", "p_decision"),
    ("f_received", "oira-received", "f_stage"),
    ("f_completed", "oira-completed", "f_decision"),
    ("pi_filed", "public-inspection", "pi_type"),
    ("proposed_published", "proposed-published", "proposed_document"),
    ("final_published", "final-published", "final_document"),
)

DDL = [
    "CREATE TABLE IF NOT EXISTS rule_pipeline ("
    + ", ".join(f"{k} {v}" for k, v in COLUMNS.items()) + ")",
    """CREATE TABLE IF NOT EXISTS rule_pipeline_events (
        rin TEXT NOT NULL, kind TEXT NOT NULL, on_date TEXT NOT NULL,
        detail TEXT, seen_at INTEGER NOT NULL,
        PRIMARY KEY (rin, kind, on_date))""",
    "CREATE INDEX IF NOT EXISTS rule_events_on ON rule_pipeline_events (on_date)",
    "CREATE INDEX IF NOT EXISTS rule_events_seen ON rule_pipeline_events (seen_at)",
]


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# Which rules
# ---------------------------------------------------------------------------

def agency_name(rin: str) -> str | None:
    code = rin[:4]
    if code in ALWAYS:
        return ALWAYS[code]
    if code in BY_TITLE:
        return BY_TITLE[code]
    if code.startswith(DHS_PREFIX):
        return DHS_NAME
    return None


def relevant(rin: str, title: str) -> bool:
    """A rule this site follows: any USCIS rule, or an immigration rule from
    DOL's ETA or WHD, State, or another part of DHS."""
    code = (rin or "")[:4]
    if code in ALWAYS:
        return True
    if code in BY_TITLE or code.startswith(DHS_PREFIX):
        return bool(IMMIGRATION_TITLE.search(title or ""))
    return False


# ---------------------------------------------------------------------------
# OIRA
# ---------------------------------------------------------------------------

def _date(s: str | None) -> str | None:
    s = (s or "").strip()
    return s if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s) else None


def _yes_no(s: str | None) -> str | None:
    s = (s or "").strip()
    return s if s in ("Yes", "No") else None


@dataclass
class OiraList:
    rundate: str | None
    reviews: list[dict] = field(default_factory=list)


def parse_oira(blob: bytes) -> OiraList:
    """One of OIRA's XML lists, as one dict per review. Raises on a file that
    isn't OIRA's: an error page parsed as an empty list would read as "nothing
    under review" and look healthy."""
    # OIRA's lists carry no DOCTYPE; one that does is not OIRA's, and refusing
    # it keeps entity expansion out of the parser.
    if b"<!DOCTYPE" in blob[:4096] or b"<!ENTITY" in blob:
        raise ValueError("an OIRA list with a DOCTYPE or an entity declaration")
    root = ET.fromstring(blob)
    if root.tag != "OIRA_DATA":
        raise ValueError(f"not an OIRA list (root element {root.tag})")
    out = OiraList(rundate=_date(root.get("RUNDATE")))
    for ra in root.iter("REGACT"):
        def text(tag: str) -> str:
            return " ".join((ra.findtext(tag) or "").split())
        rin = text("RIN")
        if not RIN_RE.fullmatch(rin):
            continue
        out.reviews.append({
            "rin": rin,
            "title": text("TITLE"),
            "stage": text("STAGE"),
            "received": _date(text("DATE_RECEIVED")),
            "completed": _date(text("DATE_COMPLETED")),
            "decision": text("DECISION") or None,
            "published": _date(text("DATE_PUBLISHED")),
            "major": _yes_no(text("MAJOR")),
            "significant": _yes_no(text("ECONOMICALLY_SIGNIFICANT")),
        })
    return out


def review_facts(r: dict) -> dict:
    """A review as the row's columns: the proposal's or the final rule's."""
    p = "f" if r["stage"] in FINAL_STAGES else "p"
    return {
        "title": r["title"] or None,
        f"{p}_stage": r["stage"] or None,
        f"{p}_received": r["received"],
        f"{p}_completed": r["completed"],
        f"{p}_decision": r["decision"],
        "major": r["major"],
        "significant": r["significant"],
    }


# ---------------------------------------------------------------------------
# Public inspection
# ---------------------------------------------------------------------------

def rins_in(text: str) -> list[str]:
    """The RINs a document names on its RIN line, near its head."""
    head = text[:6000]
    found: list[str] = []
    for m in RIN_LINE.finditer(head):
        for rin in RIN_RE.findall(m.group(1)):
            if rin not in found:
                found.append(rin)
    return found


def eastern_day(iso: str | None) -> str | None:
    if not iso:
        return None
    try:
        return datetime.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(EASTERN).date().isoformat()
    except ValueError:
        return None


def inspection_candidates(listing: dict) -> list[dict]:
    """Today's public inspection filings that could be a step of a rule: a rule
    or proposed rule the policy feed's own rules keep, with a filing time (a
    filing withdrawn after placement has none)."""
    out = []
    for r in listing.get("results") or []:
        if r.get("type") not in ("Rule", "Proposed Rule") or not r.get("filed_at"):
            continue
        agencies = [a.get("name") for a in (r.get("agencies") or []) if isinstance(a, dict) and a.get("name")]
        if not keep({"agencies": agencies or r.get("agency_names") or [], "title": r.get("title") or "", "abstract": ""}):
            continue
        out.append(r)
    return out


def inspection_facts(r: dict) -> dict:
    return {
        "title": " ".join((r.get("title") or "").split()) or None,
        "pi_document": r.get("document_number"),
        "pi_type": r.get("type"),
        "pi_filed": eastern_day(r.get("filed_at")),
        "pi_scheduled": _date(r.get("publication_date")),
        "pi_url": r.get("html_url"),
    }


# ---------------------------------------------------------------------------
# The Register
# ---------------------------------------------------------------------------

REGISTER_FIELDS = ["document_number", "regulation_id_numbers", "type", "publication_date",
                   "comments_close_on", "html_url", "effective_on", "correction_of",
                   "citation", "title"]


def register_query(rin: str) -> str:
    params = [("conditions[term]", f'"{rin}"'), ("order", "oldest"), ("per_page", "100")]
    params += [("fields[]", f) for f in REGISTER_FIELDS]
    return REGISTER_DOCS + "?" + urllib.parse.urlencode(params)


def register_facts(rin: str, answer: dict) -> dict:
    """The proposal and the final rule the Register holds under `rin`.

    The search matches any text naming the RIN (the Unified Agenda names
    hundreds), so only documents whose own RIN list carries it count, and a
    correction never stands for the document it corrects. The proposal is the
    first proposed rule; its comment deadline is the latest one any proposed
    rule under the RIN sets, because an extension is filed as a proposed rule
    too. The final rule is the newest: a RIN can carry more than one (USCIS
    finished 1615-AC70 in two final rules, Feb and Dec 2024).
    """
    docs = [d for d in answer.get("results") or []
            if rin in (d.get("regulation_id_numbers") or []) and not d.get("correction_of")]
    proposed = sorted((d for d in docs if d.get("type") == "Proposed Rule"),
                      key=lambda d: (d.get("publication_date") or "", d.get("document_number") or ""))
    final = sorted((d for d in docs if d.get("type") == "Rule"),
                   key=lambda d: (d.get("publication_date") or "", d.get("document_number") or ""))
    out: dict = {}
    if proposed:
        p = proposed[0]
        closes = [c for c in (_date(d.get("comments_close_on")) for d in proposed) if c]
        out.update({
            "proposed_document": p.get("document_number"),
            "proposed_published": _date(p.get("publication_date")),
            "proposed_url": p.get("html_url"),
            "proposed_citation": p.get("citation"),
            "title": " ".join((p.get("title") or "").split()) or None,
            "comments_close": max(closes) if closes else None,
        })
    if final:
        f = final[-1]
        out.update({
            "final_document": f.get("document_number"),
            "final_published": _date(f.get("publication_date")),
            "final_url": f.get("html_url"),
            "final_citation": f.get("citation"),
            "title": " ".join((f.get("title") or "").split()) or None,
            "effective_on": _date(f.get("effective_on")),
        })
    return out


# ---------------------------------------------------------------------------
# Merging and change detection
# ---------------------------------------------------------------------------

def norm(v):
    """One shape for a stored value and a fresh one: libSQL returns every
    value as a string, and an empty string means nothing was read."""
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def merge(old: dict | None, facts: dict) -> dict:
    """The row after this run: every fact read now, and every fact read before
    that this run didn't see. A fact is never cleared."""
    new = {k: norm((old or {}).get(k)) for k in FACTS}
    for k, v in facts.items():
        if k not in new or norm(v) is None:
            continue
        # The first title read stays: OIRA's and the public inspection list's
        # wording differ slightly, and alternating between them would rewrite
        # the row on every run.
        if k in SET_ONCE and new[k] is not None:
            continue
        new[k] = norm(v)
    return new


def changed(old: dict | None, new: dict) -> bool:
    if old is None:
        return True
    return any(norm(old.get(k)) != new[k] for k in FACTS)


def steps(rin: str, old: dict | None, new: dict, seen_at: int) -> list[dict]:
    """The steps this run learned of: each dated fact that is new or moved."""
    out = []
    for date_field, kind, detail_field in STEP_FIELDS:
        date = new.get(date_field)
        if date and date != norm((old or {}).get(date_field)):
            out.append({"rin": rin, "kind": kind, "on_date": date,
                        "detail": new.get(detail_field), "seen_at": seen_at})
    return out


@dataclass
class Plan:
    rows: dict[str, dict]
    writes: list[tuple[str, dict, bool]]  # (rin, row, is_new)
    events: list[dict]


def plan(stored: dict[str, dict], facts_by_rin: dict[str, list[dict]], now_ms: int) -> Plan:
    """What to write: the rows whose facts changed, and the steps they took."""
    rows = {rin: {k: norm(v) for k, v in r.items()} for rin, r in stored.items()}
    writes: list[tuple[str, dict, bool]] = []
    events: list[dict] = []
    for rin, parts in facts_by_rin.items():
        old = stored.get(rin)
        new = {k: norm(old.get(k)) for k in FACTS} if old else None
        for f in parts:
            new = merge(new, f)
        assert new is not None
        if new.get("agency") is None:
            new["agency"] = agency_name(rin)
        if not changed(old, new):
            continue
        events.extend(steps(rin, old, new, now_ms))
        writes.append((rin, new, old is None))
        rows[rin] = new
    return Plan(rows, writes, events)


def write(db, p: Plan, now_ms: int) -> int:
    """Rows and steps, in one request. Returns the number of rows written."""
    reqs = []
    for rin, row, is_new in p.writes:
        if is_new:
            cols = ["rin", *FACTS, "first_seen", "updated_at"]
            vals = [rin, *[row[k] for k in FACTS], now_ms, now_ms]
            reqs.append((f"INSERT INTO rule_pipeline ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", vals))
        else:
            sets = ", ".join(f"{k} = ?" for k in FACTS)
            reqs.append((f"UPDATE rule_pipeline SET {sets}, updated_at = ? WHERE rin = ?",
                         [*[row[k] for k in FACTS], now_ms, rin]))
    for e in p.events:
        reqs.append(("INSERT OR IGNORE INTO rule_pipeline_events (rin, kind, on_date, detail, seen_at) "
                     "VALUES (?, ?, ?, ?, ?)", [e["rin"], e["kind"], e["on_date"], e["detail"], e["seen_at"]]))
    for sql, args in reqs:
        db.execute(sql, args)
    return len(p.writes) + len(p.events)


def stored_rows(db) -> dict[str, dict]:
    return {r["rin"]: r for r in query_dicts(db, "SELECT * FROM rule_pipeline")}


# ---------------------------------------------------------------------------
# Reading the sources
# ---------------------------------------------------------------------------

def http_get(url: str, accept: str = "*/*", retries: int = 3) -> bytes:
    """GET as the policy feed does, after the host's robots.txt allows it."""
    if not robots_allowed(url):
        raise RobotsDisallowed(url)
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as exc:  # noqa: BLE001 - the retry is the point
            last = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{urllib.parse.urlsplit(url).netloc} did not answer: {last}")


@dataclass
class Read:
    facts: dict[str, list[dict]]
    rundate: str | None
    notes: list[str]


def collect(get, stored: dict[str, dict], today: str, follow: tuple[str, ...] = ()) -> Read:
    """Every fact the three sources hold today about the rules this site follows.

    `get(url, accept)` returns bytes; tests pass one that serves fixtures.
    OIRA is required: without its lists the run fails. Public inspection and
    the Register are read after it, and a failure there is a note, because the
    rows they would have added are still right without them.
    """
    facts: dict[str, list[dict]] = {}
    notes: list[str] = []
    under = parse_oira(get(OIRA_UNDER_REVIEW, "application/xml"))
    done = parse_oira(get(OIRA_COMPLETED, "application/xml"))
    if not under.reviews:
        raise ValueError("OIRA's under-review list holds no reviews")
    for r in under.reviews + done.reviews:
        if relevant(r["rin"], r["title"]):
            facts.setdefault(r["rin"], []).append(review_facts(r))

    try:
        listing = json.loads(get(PUBLIC_INSPECTION, "application/json"))
        for r in inspection_candidates(listing):
            text = get(r["raw_text_url"], "text/plain").decode("utf-8", "replace") if r.get("raw_text_url") else ""
            for rin in rins_in(text):
                if rin in facts or rin in stored or relevant(rin, r.get("title") or ""):
                    facts.setdefault(rin, []).append(inspection_facts(r))
    except Exception as exc:  # noqa: BLE001 - one source failing costs its facts, not the run
        notes.append(f"public inspection unread ({type(exc).__name__})")

    # The Register, for every rule followed and not finished long ago.
    horizon = (datetime.date.fromisoformat(today) - datetime.timedelta(days=90)).isoformat()
    for rin in sorted(set(facts) | set(stored) | set(follow)):
        done_on = norm((stored.get(rin) or {}).get("final_published"))
        if done_on and done_on < horizon:
            continue
        try:
            answer = json.loads(get(register_query(rin), "application/json"))
        except Exception as exc:  # noqa: BLE001
            notes.append(f"Register unread for {rin} ({type(exc).__name__})")
            continue
        found = register_facts(rin, answer)
        if found:
            facts.setdefault(rin, []).append(found)
    return Read(facts, under.rundate, notes)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--follow", nargs="*", default=[], metavar="RIN",
                    help="also follow these RINs (a rule already past OIRA, read from the Register)")
    args = ap.parse_args()
    started = time.time()
    today = et_today()
    db = None if args.dry_run else Database()
    if db is not None:
        for sql in DDL:
            db.execute(sql)
    stored = stored_rows(db) if db is not None else {}
    follow = tuple(r for r in args.follow if RIN_RE.fullmatch(r))
    read = collect(http_get, stored, today, follow)
    now_ms = int(time.time() * 1000)
    p = plan(stored, read.facts, now_ms)
    for rin, row, is_new in p.writes:
        log(f"  {'new' if is_new else 'moved'} {rin}: {row.get('title')}")
    for e in p.events:
        log(f"  step {e['rin']} {e['kind']} {e['on_date']} ({e['detail'] or ''})")
    note = (f"{len(read.facts)} rules read, {len(p.writes)} rows and {len(p.events)} steps written"
            + (f"; {'; '.join(read.notes)}" if read.notes else ""))
    log(note)
    if db is None:
        return 0
    written = write(db, p, now_ms)
    as_of = min(read.rundate or today, today)
    stamp_freshness(db, DATASET, as_of=as_of, source=SOURCE, cadence="Weekdays, morning and afternoon",
                    note=note, max_age_days=MAX_AGE_DAYS)
    # A source after OIRA that didn't answer costs this run its facts and is
    # read again on the next; the rows written are right without it, so it is
    # a warning on the run, never a failed ingest (the WARN states' rule).
    for n in read.notes:
        print(f"::warning::{n}", flush=True)
    record_run(db, SCRIPT, status="ok", rows_written=written, note=note, started_at=started)
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as fh:
            fh.write(f"rules_changed={'true' if written else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
