#!/usr/bin/env python3
"""Rules on their way: the Unified Agenda, White House review, public inspection, the Register.

    python3 scripts/ingest_rule_pipeline.py            # read and write
    python3 scripts/ingest_rule_pipeline.py --dry-run  # read, print, write nothing
    python3 scripts/ingest_rule_pipeline.py --agenda   # read the agenda's file even if it's unchanged

WHAT THIS IS. A rule an agency proposes passes through four public records
before anyone can read it, and each has a date:

  0. The Unified Agenda. Each agency lists the rules it plans, with its own
     timetable for the next step ("NPRM 07/00/2026"), months before a draft
     reaches the White House. reginfo.gov publishes each edition as one XML
     file (REGINFO_RIN_DATA_<id>.xml), linked from its XML reports page.
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

THE AGENDA, ITS OWN WAY. The agenda's facts move together: a new edition
replaces the last one's listing (its stage, its next action, its date), never
a newer one with an older one, and inside one edition a fact is never cleared.
A step (kind `agenda`, dated by the edition) is written the first time a rule
is listed and whenever its printed next action or date changes. A rule only the
agenda names becomes a row while it's active (prerule, proposed or final rule
stage, or long-term with a next action named); completed actions don't.

The reports page is read on every run (about 64 KB); the edition's file (about
18 MB) only on a new edition, once a week to catch a reissued file, or with
--agenda. A rule only the agenda names is asked of the Register once a day,
not every run: OIRA and public inspection are where its next step shows.
reginfo refusing or not answering is a warning and the run stays ok; a file
that reads but holds none of an agency's rules exits 1 and names it, after
everything else the run read is written.

HEALTH. Freshness is stamped with OIRA's own run date (the RUNDATE on its XML),
so a list OIRA stopped regenerating reads as stale even while our run is fine.
The agenda's row (`rule-pipeline-agenda`) is stamped with its edition's date.
"""
from __future__ import annotations

import argparse
import datetime
import html as htmllib
import io
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
from lib_db import (  # noqa: E402
    Database, add_missing_columns, et_date, et_today, query_dicts, read_doc, record_run,
    stamp_freshness, write_doc,
)
from lib_gov_data import RobotsDisallowed, robots_allowed  # noqa: E402
from ingest_policy_notices import API as REGISTER_DOCS, UA, keep  # noqa: E402

EASTERN = ZoneInfo("America/New_York")

OIRA_UNDER_REVIEW = "https://www.reginfo.gov/public/do/XMLViewFileAction?f=EO_RULES_UNDER_REVIEW.xml"
OIRA_COMPLETED = "https://www.reginfo.gov/public/do/XMLViewFileAction?f=EO_RULE_COMPLETED_30_DAYS.xml"
PUBLIC_INSPECTION = "https://www.federalregister.gov/api/v1/public-inspection-documents/current.json"
REGINFO_RULE = "https://www.reginfo.gov/public/do/eAgendaViewRule?RIN={rin}"
# The Unified Agenda: the page listing every edition's XML, each edition's
# file, and one rule's entry in one edition.
AGENDA_REPORTS = "https://www.reginfo.gov/public/do/eAgendaXmlReport"
AGENDA_FILE = "https://www.reginfo.gov/public/do/XMLViewFileAction?f=REGINFO_RIN_DATA_{pub}.xml"
AGENDA_RULE = "https://www.reginfo.gov/public/do/eAgendaViewRule?pubId={pub}&RIN={rin}"

DATASET = "rule-pipeline"
SCRIPT = "ingest_rule_pipeline.py"
SOURCE = "OIRA (reginfo.gov) and the Federal Register"
# OIRA regenerates its lists every day, weekends included; four days covers a
# long weekend where the file stood still.
MAX_AGE_DAYS = 4

AGENDA_DATASET = "rule-pipeline-agenda"
AGENDA_SOURCE = "The Unified Agenda (reginfo.gov)"
AGENDA_DOC = "rule_agenda"
# Measured from the editions' own run dates: spring and fall most years, and
# the longest wait between two, Spring 2025 to the 2026 edition, was 302 days.
AGENDA_MAX_AGE_DAYS = 310
# The edition's file is read again after a week, so a file reginfo reissues
# under the same id (or a read that failed half way) heals itself.
AGENDA_REREAD_DAYS = 7
# The 2026 edition's file is 17.6 MB; a file past this isn't one to parse.
AGENDA_MAX_BYTES = 100_000_000
# An edition lists 2,500 to 4,000 rules; one listing fewer than this is cut short.
AGENDA_MIN_ENTRIES = 1000
# Agencies with entries in every edition. A file missing one is a broken file.
AGENDA_REQUIRED = {"1615": "USCIS", "1205": "DOL's Employment and Training Administration",
                   "1400": "State Department"}
# Seconds between requests to one host, so a run of 60 rules is polite.
REGISTER_PAUSE_S = 1.0
AGENDA_PAUSE_S = 2.0
# A rule only the agenda names (months from a proposal, usually) is asked of
# the Register once a day; OIRA and public inspection, read every run, are
# where its first real step shows. The day it was last asked is kept here.
QUIET_DOC = "rule_pipeline_quiet"
# The dated facts that make a rule more than an agenda listing.
STEP_DATES = ("p_received", "p_completed", "f_received", "f_completed", "pi_filed",
              "proposed_published", "final_published")

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
# The Unified Agenda's listing, as the newest edition that lists the rule
# printed it. Added to a live table by add_missing_columns.
AGENDA_COLUMNS = {
    "a_pub_id": "TEXT",       # reginfo's id for the edition: 202510
    "a_edition": "TEXT",      # the edition as reginfo names it: "2026", "Spring 2025"
    "a_published": "TEXT",    # the edition's date: the RUN_DATE on its file
    "a_agency": "TEXT",       # as printed: "DOL/ETA", "DHS/USCIS", "STATE"
    "a_stage": "TEXT",        # as printed: "Proposed Rule Stage"
    "a_priority": "TEXT",     # as printed: "Other Significant"
    "a_next_action": "TEXT",  # the timetable's next action, as printed: "NPRM"
    "a_next_date": "TEXT",    # its date, as printed: "07/00/2026", "To Be Determined"
    "a_abstract": "TEXT",     # the agency's abstract, as plain text
    "a_url": "TEXT",          # the rule's entry in that edition
    "a_listed": "TEXT",       # the edition date of the newest listing that changed
}
COLUMNS.update(AGENDA_COLUMNS)
FACTS = [c for c in COLUMNS if c not in ("rin", "first_seen", "updated_at")]
AGENDA_FACTS = list(AGENDA_COLUMNS)
SET_ONCE = {"title", "agency"}
AGENDA_KIND = "agenda"

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
    # Where the agenda's last read is kept (AGENDA_DOC); every other job's table too.
    "CREATE TABLE IF NOT EXISTS perm_docs (key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)",
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
# The Unified Agenda
# ---------------------------------------------------------------------------

class AgendaUnreachable(RuntimeError):
    """reginfo refused or didn't answer: a warning, read again next run."""


class AgendaFormatError(ValueError):
    """reginfo answered with something that isn't a whole agenda: the run fails."""


# Stages whose rules become rows on the agenda's word alone. Long-term actions
# join only with a next action named; completed actions never do.
ACTIVE_STAGES = {"Prerule Stage", "Proposed Rule Stage", "Final Rule Stage"}
LONG_TERM = "Long-Term Actions"
UNDETERMINED = re.compile(r"^next action undetermined$", re.I)
# Timetable lines that follow from a published document rather than being one
# to publish: a comment period closing, a rule taking effect. "Delay of
# Effective Date" is a document, so it isn't one of these.
NOT_AN_ACTION = re.compile(
    r"(?:comment period\b.*\bend|(?<!delay of )\beffective(?: date)?(?: delayed until)?)\s*$", re.I)
# ETA's and WHD's agenda titles can miss the immigration word OIRA's carry
# (2026: "Certain Foreign Nations" for "Nationals", 1205-AC30), and their
# abstracts don't name immigration unless the rule is about it, so for DOL the
# abstract counts too. Other agencies' abstracts name aliens for port and
# passport rules, so theirs don't.
DOL_CODES = ("1205", "1235")


def agenda_active(row: dict) -> bool:
    """The agenda says the rule is still on its way: at the prerule, proposed
    or final rule stage, or long-term with a next action named. A rule whose
    first form was an interim final rule is final in the Register and still
    active here until its final rule is out."""
    stage, action = norm(row.get("a_stage")), norm(row.get("a_next_action"))
    return stage in ACTIVE_STAGES or (stage == LONG_TERM and bool(action) and not UNDETERMINED.match(action or ""))


def pub_key(pub: str | None) -> int:
    """An edition id as a number that sorts: 202510, and the single 2012 edition as 201200."""
    s = re.sub(r"\D", "", pub or "")
    return int(s.ljust(6, "0")) if s else 0


@dataclass
class Edition:
    pub_id: str
    label: str  # "2026", "Spring 2025"


REPORT_LINK = re.compile(r"""href=["'][^"']*XMLViewFileAction\?f=REGINFO_RIN_DATA_(\d{4,6})\.xml["'][^>]*>\s*([^<]+?)\s*</a>""",
                         re.I)


def parse_reports(page: bytes) -> list[Edition]:
    """Every edition reginfo's XML reports page links, newest first.

    A page that isn't the reports page (a maintenance page, a block page) is
    reginfo not answering; the reports page with no agenda links is a page
    whose shape changed, and that fails the run rather than reading as "no
    new edition" for ever."""
    text = page.decode("utf-8", "replace")
    if not re.search(r"XML\s+Reports", text, re.I):
        raise AgendaUnreachable("reginfo answered with a page that isn't its XML reports list")
    found: dict[str, Edition] = {}
    for m in REPORT_LINK.finditer(text):
        label = re.sub(r"\s+Data$", "", " ".join(htmllib.unescape(m.group(2)).split()), flags=re.I)
        found.setdefault(m.group(1), Edition(m.group(1), label))
    if not found:
        raise AgendaFormatError("reginfo's XML reports page links no Unified Agenda file")
    return sorted(found.values(), key=lambda e: pub_key(e.pub_id), reverse=True)


def plain_text(s: str | None, limit: int = 6000) -> str | None:
    """An abstract as words: reginfo stores it as an HTML page, entities and all."""
    s = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", s or "")
    s = " ".join(htmllib.unescape(re.sub(r"<[^>]+>", " ", s)).split())
    if len(s) > limit:
        s = s[:limit].rsplit(" ", 1)[0] + " ..."
    return s or None


def us_date(s: str) -> str | None:
    """reginfo's MM/DD/YYYY as ISO, or None for a month-only or unset date."""
    m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", s)
    if not m or m.group(2) == "00":
        return None
    try:
        return datetime.date(int(m.group(3)), int(m.group(1)), int(m.group(2))).isoformat()
    except ValueError:
        return None


def next_action(timetable: list[tuple[str, str, str]], edition_date: str) -> tuple[str | None, str | None]:
    """The timetable's next step as printed: the first line with no Federal
    Register citation that is a document to publish and is dated to be
    determined, by month only, or on or after the edition's own date. A line
    with a full date before the edition with no citation is a step that came
    and went (a withdrawal, a comment period) and isn't next."""
    for action, date, cite in timetable:
        if cite or not action or NOT_AN_ACTION.search(action):
            continue
        if re.fullmatch(r"to be determined", date, re.I) or re.fullmatch(r"\d{2}/00/\d{4}", date):
            return action, date
        day = us_date(date)
        if day and day >= edition_date:
            return action, date
    return None, None


@dataclass
class Agenda:
    edition: Edition
    run_date: str
    entries: int
    # Every entry from an agency this watch reads, as row facts, by RIN.
    listings: dict[str, dict] = field(default_factory=dict)
    # The entries in scope on their own, and of those the ones that become a
    # row with no other source.
    followed: set[str] = field(default_factory=set)
    creates: set[str] = field(default_factory=set)
    # Entries in scope, by agency code, for the next read to compare against.
    counts: dict[str, int] = field(default_factory=dict)


def parse_agenda(blob: bytes, edition: Edition) -> Agenda:
    """One edition's XML as row facts for every rule from the agencies followed.

    The abstracts are whole HTML pages, many inside CDATA with their own
    `<!DOCTYPE html>`, so only the prolog before the root element is checked
    for a DOCTYPE: there an entity could be declared, inside CDATA it's text.
    """
    root_at = blob.find(b"<REGINFO_RIN_DATA", 0, 4096)
    if root_at < 0:
        head = blob[:512].lower()
        if b"<html" in head or b"<!doctype html" in head:
            raise AgendaUnreachable("reginfo answered with a web page, not the agenda's file")
        raise AgendaFormatError("the agenda's file has no REGINFO_RIN_DATA root")
    if b"<!DOCTYPE" in blob[:root_at] or b"<!ENTITY" in blob[:root_at]:
        raise AgendaFormatError("the agenda's file declares a DOCTYPE")
    run_date: str | None = None
    out: Agenda | None = None
    total = missing = 0
    present: dict[str, int] = {}
    for ev, el in ET.iterparse(io.BytesIO(blob), events=("start", "end")):
        if ev == "start":
            if el.tag == "REGINFO_RIN_DATA":
                run_date = _date((el.get("RUN_DATE") or "")[:10])
                if run_date is None:
                    raise AgendaFormatError("the agenda's file carries no RUN_DATE")
                out = Agenda(edition=edition, run_date=run_date, entries=0)
            continue
        if el.tag != "RIN_INFO" or out is None:
            continue

        def text(tag: str) -> str:
            return " ".join((el.findtext(tag) or "").split())
        total += 1
        rin, title, stage = text("RIN"), text("RULE_TITLE"), text("RULE_STAGE")
        if not RIN_RE.fullmatch(rin) or not title or not stage:
            missing += 1
            el.clear()
            continue
        code = rin[:4]
        present[code] = present.get(code, 0) + 1
        if agency_name(rin) is None:
            el.clear()
            continue
        abstract = plain_text(el.findtext("ABSTRACT"))
        timetable = [tuple(" ".join((t.findtext(tag) or "").split())
                           for tag in ("TTBL_ACTION", "TTBL_DATE", "FR_CITATION"))
                     for t in el.findall("TIMETABLE_LIST/TIMETABLE")]
        action, date = next_action(timetable, run_date or "")
        parent, acronym = text("PARENT_AGENCY/ACRONYM"), text("AGENCY/ACRONYM")
        out.listings[rin] = {
            "title": title, "agency": agency_name(rin),
            "a_pub_id": edition.pub_id, "a_edition": edition.label, "a_published": run_date,
            "a_agency": f"{parent}/{acronym}" if parent and acronym else (acronym or parent or None),
            "a_stage": stage, "a_priority": text("PRIORITY_CATEGORY") or None,
            "a_next_action": action, "a_next_date": date,
            "a_abstract": abstract, "a_url": AGENDA_RULE.format(pub=edition.pub_id, rin=rin),
        }
        if relevant(rin, title) or (code in DOL_CODES and IMMIGRATION_TITLE.search(abstract or "")):
            out.followed.add(rin)
            out.counts[code] = out.counts.get(code, 0) + 1
            if agenda_active(out.listings[rin]):
                out.creates.add(rin)
        el.clear()
    if out is None:
        raise AgendaFormatError("the agenda's file has no REGINFO_RIN_DATA root")
    out.entries = total
    if total < AGENDA_MIN_ENTRIES:
        raise AgendaFormatError(f"the agenda's file lists {total} rules, too few for a whole edition")
    if missing > total * 0.05:
        raise AgendaFormatError(f"{missing} of {total} agenda entries have no RIN, title or stage")
    # Every USCIS entry is in scope, so USCIS present means some rule is followed.
    for code, name in AGENDA_REQUIRED.items():
        if not present.get(code):
            raise AgendaFormatError(f"the agenda's file holds no {name} rules ({code})")
    return out


def check_agenda(agenda: Agenda, doc: dict | None) -> None:
    """A second read of the same edition that lost every rule of an agency it
    had: the file changed shape, not the agency's plans."""
    if not doc or doc.get("pub_id") != agenda.edition.pub_id:
        return
    before = doc.get("counts") or {}
    for code, n in sorted(before.items()):
        if int(n or 0) > 0 and not agenda.counts.get(code):
            name = agency_name(code) or code
            raise AgendaFormatError(
                f"the {agenda.edition.label} agenda's {name} rules are gone: {n} read before, none now")


def read_agenda(get, doc: dict | None, now_ms: int, force: bool = False, sleep=time.sleep) -> Agenda | None:
    """The newest edition, read when it's new to this record, a week has
    passed, or `force`; None when the last read still stands.

    Raises AgendaUnreachable when reginfo refused or didn't answer, and
    AgendaFormatError when it answered with something that isn't a whole
    agenda. Anything else is a defect here and propagates."""
    try:
        page = get(AGENDA_REPORTS, "text/html")
    except TooLarge as exc:
        raise AgendaFormatError(f"reginfo's reports page is too large to read ({exc})") from exc
    except (RuntimeError, OSError) as exc:
        raise AgendaUnreachable(f"reginfo's reports page unread ({exc})") from exc
    newest = parse_reports(page)[0]
    read_at = int((doc or {}).get("read_at") or 0)
    fresh = now_ms - read_at < AGENDA_REREAD_DAYS * 86_400_000
    if doc and doc.get("pub_id") == newest.pub_id and fresh and not force:
        return None
    sleep(AGENDA_PAUSE_S)
    try:
        blob = get(AGENDA_FILE.format(pub=newest.pub_id), "application/xml")
    except TooLarge as exc:
        raise AgendaFormatError(f"the {newest.label} agenda's file is too large to read ({exc})") from exc
    except (RuntimeError, OSError) as exc:
        raise AgendaUnreachable(f"the {newest.label} agenda's file unread ({exc})") from exc
    agenda = parse_agenda(blob, newest)
    check_agenda(agenda, doc)
    return agenda


def agenda_doc(agenda: Agenda, now_ms: int) -> dict:
    """What perm_docs[AGENDA_DOC] keeps: which edition was read, when, and
    its counts, for the next run to decide whether to read again."""
    return {"pub_id": agenda.edition.pub_id, "edition": agenda.edition.label, "run_date": agenda.run_date,
            "entries": agenda.entries, "followed": len(agenda.followed), "counts": agenda.counts,
            "read_at": now_ms, "checked_at": now_ms}


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


def merge_agenda(old: dict | None, facts: dict) -> dict:
    """The row after an agenda listing. Its title and agency merge like any
    fact. Its listing moves as one: a newer edition replaces the older one's
    stage, next action and date (a next action it no longer names included),
    an older edition never replaces a newer one, and a second read of the same
    edition never clears a fact. `a_listed` moves to the edition's date when
    the rule is first listed or its next action or date changed."""
    new = merge(old, {k: v for k, v in facts.items() if not k.startswith("a_")})
    old_pub, pub = norm((old or {}).get("a_pub_id")), norm(facts.get("a_pub_id"))
    if pub is None or (old_pub and pub_key(pub) < pub_key(old_pub)):
        return new
    listing = {k: norm(facts.get(k)) for k in AGENDA_FACTS if k != "a_listed"}
    if pub == old_pub:
        new.update({k: v for k, v in listing.items() if v is not None})
    else:
        new.update(listing)
    if old_pub is None or listing_of(new) != listing_of(old):
        new["a_listed"] = new["a_published"]
    return new


def listing_of(row: dict | None) -> tuple:
    """What an agenda step records changing: the printed next action and date."""
    return (norm((row or {}).get("a_next_action")), norm((row or {}).get("a_next_date")))


def changed(old: dict | None, new: dict) -> bool:
    if old is None:
        return True
    return any(norm(old.get(k)) != new[k] for k in FACTS)


def agenda_detail(row: dict) -> str:
    """An agenda step's detail: the edition and what it lists, as printed."""
    return json.dumps({"edition": row.get("a_edition"), "stage": row.get("a_stage"),
                       "action": row.get("a_next_action"), "date": row.get("a_next_date")},
                      separators=(",", ":"), sort_keys=True)


def steps(rin: str, old: dict | None, new: dict, seen_at: int) -> list[dict]:
    """The steps this run learned of: each dated fact that is new or moved,
    and an agenda listing that is new or lists a different next step."""
    out = []
    for date_field, kind, detail_field in STEP_FIELDS:
        date = new.get(date_field)
        if date and date != norm((old or {}).get(date_field)):
            out.append({"rin": rin, "kind": kind, "on_date": date,
                        "detail": new.get(detail_field), "seen_at": seen_at})
    if new.get("a_published") and (norm((old or {}).get("a_pub_id")) is None
                                   or listing_of(new) != listing_of(old)):
        out.append({"rin": rin, "kind": AGENDA_KIND, "on_date": new["a_published"],
                    "detail": agenda_detail(new), "seen_at": seen_at})
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
            new = merge_agenda(new, f) if "a_pub_id" in f else merge(new, f)
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
        # An edition reissued under the same date that lists a different next
        # step replaces its own step's words; every other step is written once.
        sql = ("INSERT INTO rule_pipeline_events (rin, kind, on_date, detail, seen_at) VALUES (?, ?, ?, ?, ?) "
               "ON CONFLICT (rin, kind, on_date) DO UPDATE SET detail = excluded.detail, seen_at = excluded.seen_at"
               if e["kind"] == AGENDA_KIND else
               "INSERT OR IGNORE INTO rule_pipeline_events (rin, kind, on_date, detail, seen_at) VALUES (?, ?, ?, ?, ?)")
        reqs.append((sql, [e["rin"], e["kind"], e["on_date"], e["detail"], e["seen_at"]]))
    for sql, args in reqs:
        db.execute(sql, args)
    return len(p.writes) + len(p.events)


def stored_rows(db) -> dict[str, dict]:
    return {r["rin"]: r for r in query_dicts(db, "SELECT * FROM rule_pipeline")}


# ---------------------------------------------------------------------------
# Reading the sources
# ---------------------------------------------------------------------------

class TooLarge(ValueError):
    """An answer past the size this reader accepts; never retried."""


def http_get(url: str, accept: str = "*/*", retries: int = 3, limit: int = AGENDA_MAX_BYTES) -> bytes:
    """GET as the policy feed does, after the host's robots.txt allows it, and
    never more than `limit` bytes. A refusal or no answer raises RuntimeError."""
    if not robots_allowed(url):
        raise RobotsDisallowed(url)
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
            # The agenda's 18 MB file takes longer than a list does.
            with urllib.request.urlopen(req, timeout=180) as r:
                blob = r.read(limit + 1)
            if len(blob) > limit:
                raise TooLarge(f"{urllib.parse.urlsplit(url).netloc} sent more than {limit:,} bytes")
            return blob
        except TooLarge:
            raise
        except Exception as exc:  # noqa: BLE001 - the retry is the point
            last = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{urllib.parse.urlsplit(url).netloc} did not answer: {last}")


class OiraUnreachable(RuntimeError):
    """reginfo refused or didn't answer for OIRA's lists (a 502, a timeout, a
    maintenance page): a warning, read again next run. The rule watch's own
    freshness row still ages as the alarm when the outage lasts."""


def oira_list(get, url: str):
    """One of OIRA's lists, or OiraUnreachable when reginfo is down. A file
    that answers but isn't OIRA's list still raises ValueError: that is a
    change at OIRA, and the run fails on it."""
    try:
        blob = get(url, "application/xml")
    except RobotsDisallowed:
        raise
    except RuntimeError as exc:  # http_get: refused, or no answer after its retries
        raise OiraUnreachable(f"OIRA's list unread ({exc})") from exc
    if re.match(rb"\s*(<!doctype\s+html|<html)", blob[:300], re.I):
        raise OiraUnreachable("reginfo answered with a web page, not OIRA's list")
    return parse_oira(blob)


@dataclass
class Read:
    facts: dict[str, list[dict]]
    rundate: str | None
    notes: list[str]


def collect(get, stored: dict[str, dict], today: str, follow: tuple[str, ...] = (),
            agenda: Agenda | None = None, sleep=time.sleep, ask_quiet: bool = True) -> Read:
    """Every fact the sources hold today about the rules this site follows.

    `get(url, accept)` returns bytes; tests pass one that serves fixtures.
    OIRA is required: without its lists nothing is read (OiraUnreachable when
    reginfo is down, ValueError when its file changed). Public inspection and
    the Register are read after it, and a failure there is a note, because the
    rows they would have added are still right without them. `agenda` is an
    edition `read_agenda` read this run, or None when the last read stands:
    its listing reaches every rule already followed or named by OIRA or public
    inspection, and its active rules become rules of their own. A rule known
    only from the agenda is asked of the Register only when `ask_quiet`.
    """
    facts: dict[str, list[dict]] = {}
    notes: list[str] = []
    under = oira_list(get, OIRA_UNDER_REVIEW)
    done = oira_list(get, OIRA_COMPLETED)
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

    if agenda is not None:
        for rin, listing in agenda.listings.items():
            if rin in agenda.creates or rin in facts or rin in stored or rin in follow:
                facts.setdefault(rin, []).append(listing)

    # The Register, for every rule followed and not finished long ago.
    horizon = (datetime.date.fromisoformat(today) - datetime.timedelta(days=90)).isoformat()
    asked = 0
    for rin in sorted(set(facts) | set(stored) | set(follow)):
        row = {**(stored.get(rin) or {}), **((agenda.listings.get(rin) or {}) if agenda else {})}
        done_on = norm(row.get("final_published"))
        # A rule finished long ago is left alone, unless an agenda dated after
        # its final rule still lists it (an interim final rule awaiting its final).
        if done_on and done_on < horizon and not (agenda_active(row) and (norm(row.get("a_published")) or "") > done_on):
            continue
        quiet = (rin not in follow and not any(norm(row.get(k)) for k in STEP_DATES)
                 and all("a_pub_id" in f for f in facts.get(rin, [])))
        if quiet and not ask_quiet:
            continue
        if asked:
            sleep(REGISTER_PAUSE_S)
        asked += 1
        try:
            answer = json.loads(get(register_query(rin), "application/json"))
        except Exception as exc:  # noqa: BLE001
            notes.append(f"Register unread for {rin} ({type(exc).__name__})")
            continue
        found = register_facts(rin, answer)
        if found:
            facts.setdefault(rin, []).append(found)
    return Read(facts, under.rundate, notes)


def run(db, get, today: str, follow: tuple[str, ...] = (), force_agenda: bool = False, sleep=time.sleep) -> int:
    """One run: read every source, write what changed, stamp and record it.
    `db` None is a dry run. Returns the exit code."""
    started = time.time()
    if db is not None:
        for sql in DDL:
            db.execute(sql)
        add_missing_columns(db, "rule_pipeline", COLUMNS)
    stored = stored_rows(db) if db is not None else {}
    doc = read_doc(db, AGENDA_DOC) if db is not None else None

    # The agenda first, so the Register is asked about the rules it adds. Its
    # trouble is kept apart from the other sources': unreachable is a warning,
    # a file that isn't a whole agenda fails the run once everything else is written.
    agenda: Agenda | None = None
    agenda_checked = False
    agenda_error: str | None = None
    agenda_notes: list[str] = []
    try:
        agenda = read_agenda(get, doc, int(time.time() * 1000), force=force_agenda, sleep=sleep)
        agenda_checked = True
    except AgendaUnreachable as exc:
        last = et_date((doc or {}).get("checked_at"))
        agenda_notes.append(f"Unified Agenda unread: {exc}" + (f" (last checked {last})" if last else ""))
    except AgendaFormatError as exc:
        agenda_error = f"Unified Agenda refused: {exc}"

    ask_quiet = db is None or (read_doc(db, QUIET_DOC) or {}).get("day") != today
    try:
        read = collect(get, stored, today, follow, agenda=agenda, sleep=sleep, ask_quiet=ask_quiet)
    except OiraUnreachable as exc:
        # reginfo down (owner, Oct 30 2026: a warning, not a red health email).
        # Nothing is written or stamped: OIRA's lists come first, and the rule
        # watch's freshness row ages into the health check's warning, then its
        # failure, if the outage outlasts its budget.
        note = f"OIRA unread, read again next run: {exc}"
        print(f"::warning::{note}", flush=True)
        if agenda_error:
            print(f"::error::{agenda_error}", flush=True)
        if db is not None:
            record_run(db, SCRIPT, status="partial" if agenda_error else "ok", rows_written=0,
                       note=note + (f"; {agenda_error}" if agenda_error else ""), started_at=started)
        out = os.environ.get("GITHUB_OUTPUT")
        if out:
            with open(out, "a") as fh:
                fh.write("rules_changed=false\n")
        return 1 if agenda_error else 0
    now_ms = int(time.time() * 1000)
    p = plan(stored, read.facts, now_ms)
    for rin, row, is_new in p.writes:
        log(f"  {'new' if is_new else 'moved'} {rin}: {row.get('title')}")
    for e in p.events:
        log(f"  step {e['rin']} {e['kind']} {e['on_date']} ({e['detail'] or ''})")
    if agenda is not None:
        agenda_line = (f"the {agenda.edition.label} agenda read ({agenda.entries} entries, "
                       f"{len(agenda.followed)} rules in scope)")
    elif agenda_checked:
        agenda_line = f"the {(doc or {}).get('edition')} agenda is still the newest"
    else:
        agenda_line = agenda_error or "the agenda unread"
    notes = read.notes + agenda_notes
    note = (f"{len(read.facts)} rules read, {len(p.writes)} rows and {len(p.events)} steps written; {agenda_line}"
            + (f"; {'; '.join(notes)}" if notes else ""))
    log(note)
    if db is None:
        if agenda_error:
            print(f"::error::{agenda_error}", flush=True)
        return 1 if agenda_error else 0
    written = write(db, p, now_ms)
    if ask_quiet:
        write_doc(db, QUIET_DOC, {"day": today})
    as_of = min(read.rundate or today, today)
    stamp_freshness(db, DATASET, as_of=as_of, source=SOURCE, cadence="Weekdays, morning and afternoon",
                    note=note, max_age_days=MAX_AGE_DAYS)
    if agenda_checked:
        # Read or not, a run that reached the reports page checked the agenda:
        # the row's date is the edition's, its stamp time says this ran.
        kept = agenda_doc(agenda, now_ms) if agenda is not None else {**(doc or {}), "checked_at": now_ms}
        write_doc(db, AGENDA_DOC, kept)
        if kept.get("run_date"):
            stamp_freshness(db, AGENDA_DATASET, as_of=min(str(kept["run_date"]), today), source=AGENDA_SOURCE,
                            cadence="Spring and fall editions, checked with every run",
                            note=f"the {kept.get('edition')} edition, {kept.get('followed')} rules in scope",
                            max_age_days=AGENDA_MAX_AGE_DAYS)
    # A source after OIRA that didn't answer costs this run its facts and is
    # read again on the next; the rows written are right without it, so it is
    # a warning on the run, never a failed ingest (the WARN states' rule).
    for n in notes:
        print(f"::warning::{n}", flush=True)
    if agenda_error:
        print(f"::error::{agenda_error}", flush=True)
    record_run(db, SCRIPT, status="partial" if agenda_error else "ok", rows_written=written, note=note,
               started_at=started)
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as fh:
            fh.write(f"rules_changed={'true' if written else 'false'}\n")
    return 1 if agenda_error else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--follow", nargs="*", default=[], metavar="RIN",
                    help="also follow these RINs (a rule already past OIRA, read from the Register)")
    ap.add_argument("--agenda", action="store_true",
                    help="read the Unified Agenda's edition file even if it was read in the last week")
    args = ap.parse_args()
    follow = tuple(r for r in args.follow if RIN_RE.fullmatch(r))
    return run(None if args.dry_run else Database(), http_get, et_today(), follow, force_agenda=args.agenda)


if __name__ == "__main__":
    sys.exit(main())
