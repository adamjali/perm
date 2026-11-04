#!/usr/bin/env python3
"""The filings in a few court cases this site follows by name, into the policy feed.

    python3 scripts/ingest_court_dockets.py              # each followed case's newest entries
    python3 scripts/ingest_court_dockets.py --all        # every entry (a first run, or after an outage)
    python3 scripts/ingest_court_dockets.py --dry-run    # fetch and print, write nothing
    python3 scripts/ingest_court_dockets.py --from-file entries.json --docket 72218277   # parse a saved answer

WHY A SECOND COURT READER. ingest_court_opinions.py searches CourtListener's collection of court OPINIONS. A
district court's ruling often never reaches that collection: on Nov 3 2026 it held 38 opinions in cases brought
by the Catholic Legal Immigration Network and not the Aug 21 2026 ruling in CLINIC v. Rubio (S.D.N.Y.), which
struck down the 75-country immigrant visa pause. That ruling, and State's sworn reports on the interview pause,
are entries in the case's own docket, which CourtListener's RECAP archive holds. So the cases that matter to
this site most are followed by name: scripts/data/court_dockets.json lists each with why it matters, and this
reads each one's docket entries (CourtListener's REST API, with COURTLISTENER_TOKEN; its docket endpoints answer
only a client with a token).

WHAT IT KEEPS. Opinions, judgments, rulings on a stay, an injunction or the enforcement of a judgment, notices
of appeal, and the government's status reports and declarations: the entries that say what the court decided or
what the government told it. Letters, scheduling and extensions, transcripts, appearances and clerk's notes are
left out (`kind_of`).

PRIVACY. A docket entry's own words name people, plaintiffs among them ("Document filed by" a list of names), so
they are never stored or shown. Each row is titled from the followed case's own short name and the entry's kind
("CLINIC v. Rubio: the government's status report"), with the case's fixed description as its abstract. The link
is the entry's own PDF on CourtListener's storage when RECAP has it, else the docket.

HOW OFTEN. CourtListener allows 5 requests a minute, 50 an hour and 125 a day to a client with a token. A run asks
for each case's newest 50 entries (one request a case, 15 s apart), and every page only with --all or for a case
never read before. A run within MIN_GAP_HOURS of the last does nothing.

TROUBLE. A refusal or an outage is a warning, the run recorded ok with it in its note; the dataset's freshness
row is the alarm. No token is a warning too (the docket endpoints refuse without one). An answer missing what
every answer has writes nothing and exits 1.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest_court_opinions import TokenRefused, describe, fetch_url, trouble  # noqa: E402
from lib_db import Database, et_today, query_dicts, record_run, stamp_freshness  # noqa: E402
from lib_policy_feed import expire_policy_page, record_quiet_run, topics_of, write_notices  # noqa: E402

SCRIPT = "ingest_court_dockets.py"
API = "https://www.courtlistener.com/api/rest/v4/docket-entries/"
SITE = "https://www.courtlistener.com"
STORAGE = "https://storage.courtlistener.com/"
DATASET = "policy-notices-dockets"
SOURCE = "courtlistener-dockets"
TYPE = "Court filing"
LABEL = "CourtListener's RECAP archive (Free Law Project)"
CADENCE = "Every 6 hours"
PAGE_SIZE = 50
REQUEST_GAP_S = 15
MIN_GAP_HOURS = 6
# The followed cases move every week or two; State's status reports in CLINIC v. Rubio came about monthly
# (Aug 28, Sep 8, Oct 5 2026). Sixty days, so a quiet month in court isn't an alarm.
MAX_AGE_DAYS = 60
DOCKETS_FILE = Path(__file__).resolve().parent / "data" / "court_dockets.json"


def log(msg: str) -> None:
    print(f"[dockets] {msg}", flush=True)


def followed() -> list[dict]:
    return [d for d in json.loads(DOCKETS_FILE.read_text(encoding="utf8"))["dockets"] if not d.get("stopped")]


# What an entry is, from the first words of its own description. Order matters: the first match wins.
KINDS: tuple[tuple[str, str], ...] = (
    (r"^(memorandum\s+)?opinion\b|^opinion\s+and\s+order\b|^memorandum\s+(and\s+)?order\b|^memorandum\s+decision\b", "opinion"),
    (r"^(final\s+)?judgment\b|^clerk'?s\s+judgment\b", "judgment"),
    (r"^notice\s+of\s+(interlocutory\s+)?appeal\b", "notice of appeal"),
    (r"^(joint\s+)?status\s+report\b", "status report"),
    (r"^declaration\b", "declaration"),
    # State's sworn accounts came as attachments: "RESPONSE ... (Attachments: # 1 Exhibit - Armstrong Declaration)".
    (r"^(response|brief|memorandum\s+of\s+law|reply|letter)\b.*\battachments?:.*\b(declaration|affidavit)\b", "filing with a declaration"),
    (r"^notice\s+of\s+.*\bstay\b", "notice of a stay"),
    (r"^(motion\s+)?order\b.*\b(stay|injunction|enjoin|vacat|enforce|summary\s+judgment|dismiss|class)", "order"),
    (r"^mandate\b", "mandate"),
)
# Entries that start like a kept kind but are scheduling, not substance.
SKIP = re.compile(r"\b(extension\s+of\s+time|adjourn|leave\s+to\s+file|pro\s+hac\s+vice|page\s+limit|seal|"
                  r"scheduling|briefing\s+schedule|appearance|transcript)\b", re.I)
GOVERNMENT = re.compile(r"\bfiled\s+by\b.*\b(United\s+States|Department\s+of|Rubio|Secretary|Noem|Edlow|Mullin)\b", re.I)
KIND_LABEL = {
    "opinion": "the court's opinion",
    "judgment": "the judgment",
    "notice of appeal": "a notice of appeal",
    "status report": "a status report",
    "declaration": "a declaration",
    "filing with a declaration": "the government's filing, with a sworn declaration",
    "notice of a stay": "notice of a stay",
    "order": "an order",
    "mandate": "the appeals court's mandate",
}


def kind_of(description: str) -> str | None:
    """The entry's kind, or None for one this feed leaves out. A declaration or status report is kept only when
    the government filed it: that's where State says what it is doing."""
    text = re.sub(r"\s+", " ", (description or "").strip())
    if not text or SKIP.search(text[:160]):
        return None
    for pattern, kind in KINDS:
        if re.search(pattern, text, re.I):
            if kind in ("declaration", "status report", "filing with a declaration") and not GOVERNMENT.search(text):
                return None
            return kind
    return None


def label_of(kind: str, description: str) -> str:
    if kind in ("declaration", "status report") and GOVERNMENT.search(description or ""):
        return f"the government's {kind}"
    return KIND_LABEL[kind]


def build(entry: dict, docket: dict) -> dict | None:
    kind = kind_of(entry.get("description") or "")
    day = (entry.get("date_filed") or "")[:10]
    if not kind or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        return None
    docs = entry.get("recap_documents") or []
    pdf = next((STORAGE + d["filepath_local"] for d in docs if d.get("filepath_local")), None)
    number = entry.get("entry_number")
    title = f"{docket['short']}: {label_of(kind, entry.get('description') or '')}"
    return {
        "document_number": f"docket-{docket['id']}-{entry['id']}",
        "publication_date": day,
        "type": TYPE,
        "title": title[0].upper() + title[1:],
        "abstract": docket["about"],
        "html_url": pdf or f"{SITE}{docket['path']}",
        "agencies": [docket["court"]],
        "topics": topics_of(docket["about"], docket.get("topicsText", "")),
        "citation": f"No. {docket['number']}" + (f", ECF {number}" if number else ""),
    }


class LostStructure(Exception):
    pass


def parse_page(text: str) -> tuple[list[dict], str | None]:
    data = json.loads(text)
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise LostStructure("no results list")
    for e in data["results"]:
        if not isinstance(e, dict) or "id" not in e or "date_filed" not in e:
            raise LostStructure("an entry without its id or date")
    return data["results"], data.get("next")


def entries_url(docket_id: int) -> str:
    return API + "?" + urllib.parse.urlencode({"docket": docket_id, "order_by": "-date_filed", "page_size": PAGE_SIZE})


@dataclass
class Read:
    status: str = "ok"   # ok, refused, broken
    note: str = ""
    rows: list[dict] = field(default_factory=list)
    entries: int = 0
    requests: int = 0


def read_dockets(dockets: list[dict], fetch=fetch_url, sleep=time.sleep, *, token: str | None,
                 walk_all: set[int] | None = None) -> Read:
    got = Read()
    if not token:
        got.status, got.note = "refused", "no COURTLISTENER_TOKEN: CourtListener's docket endpoints answer only a client with one"
        return got
    for i, d in enumerate(dockets):
        url: str | None = entries_url(d["id"])
        while url:
            if got.requests:
                sleep(REQUEST_GAP_S)
            try:
                got.requests += 1
                entries, nxt = parse_page(fetch(url, sleep, token=token))
            except TokenRefused:
                got.status, got.note = "refused", "CourtListener refused the token"
                return got
            except LostStructure as e:
                got.status, got.note = "broken", f"{d['short']}: {e}"
                return got
            except Exception as e:  # noqa: BLE001 - sorted by `trouble`
                why = trouble(e)
                if why is None:
                    raise
                got.status = "refused" if why == "refused" else "broken"
                got.note = f"{d['short']}: {describe(e)}"
                return got
            got.entries += len(entries)
            got.rows.extend(r for r in (build(e, d) for e in entries) if r)
            url = nxt if walk_all is not None and d["id"] in walk_all else None
    return got


def stored_dockets(db) -> set[int]:
    """The followed cases already read once: their next runs read only the newest page."""
    if db is None:
        return set()
    try:
        rows = query_dicts(db, "SELECT document_number FROM policy_notices WHERE source = ?", [SOURCE])
    except Exception:  # noqa: BLE001 - no table yet: a first run
        return set()
    return {int(m.group(1)) for r in rows if (m := re.match(r"docket-(\d+)-", r["document_number"]))}


def ran_recently(db, now: float | None = None) -> bool:
    """True when a run finished within MIN_GAP_HOURS."""
    try:
        newest = db.scalar("SELECT MAX(finished_at) FROM ingest_runs WHERE script = ?", [SCRIPT])
    except Exception:  # noqa: BLE001 - no table yet
        return False
    now_ms = (now if now is not None else time.time()) * 1000
    return newest is not None and now_ms - int(newest) < MIN_GAP_HOURS * 3600 * 1000


def finish(db, got: Read, started: float, dry_run: bool) -> int:
    rows = sorted(got.rows, key=lambda r: r["publication_date"], reverse=True)
    if got.status == "refused":
        log(f"::warning::{got.note}")
    elif got.status == "broken":
        print(f"::error::CourtListener dockets: {got.note}. Nothing was written.", flush=True)
    else:
        log(f"{got.entries} entries read ({got.requests} requests), {len(rows)} kept")
    if dry_run:
        for r in rows[:40]:
            log(f"  {r['publication_date']}  {r['title'][:90]}")
        return 1 if got.status == "broken" else 0
    written = 0
    if got.status == "ok":
        res = write_notices(db, rows, source=SOURCE)
        written = res.written
        if rows:
            stamp_freshness(db, DATASET, as_of=min(rows[0]["publication_date"], et_today()), source=LABEL,
                            cadence=CADENCE, note=f"{got.entries} entries read, {len(rows)} kept",
                            max_age_days=MAX_AGE_DAYS)
    note = f"{len(rows)} kept of {got.entries}, {written} written" if got.status == "ok" else got.note
    if written and expire_policy_page(log) is False:
        note += "; policy page refresh refused"
    if got.status == "broken":
        record_run(db, SCRIPT, status="failed", rows_written=0, note=note, started_at=started)
        return 1
    if got.status == "refused":
        record_run(db, SCRIPT, status="ok", rows_written=0, note=note, started_at=started)
        return 0
    record_quiet_run(db, SCRIPT, written=written, note=note, started_at=started)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--all", action="store_true", help="every entry of every followed case")
    ap.add_argument("--dry-run", action="store_true", help="fetch and print, write nothing")
    ap.add_argument("--force", action="store_true", help=f"run even within {MIN_GAP_HOURS} hours of the last run")
    ap.add_argument("--from-file", help="a saved docket-entries answer")
    ap.add_argument("--docket", type=int, help="with --from-file: the followed case it belongs to")
    a = ap.parse_args()
    started = time.time()
    dockets = followed()
    if a.from_file:
        d = next((x for x in dockets if x["id"] == a.docket), None)
        if not d:
            print("--from-file needs --docket naming a followed case", file=sys.stderr)
            return 2
        entries, _ = parse_page(Path(a.from_file).read_text(encoding="utf8"))
        got = Read(rows=[r for r in (build(e, d) for e in entries) if r], entries=len(entries))
        return finish(None if a.dry_run else Database(), got, started, a.dry_run)
    db = None if a.dry_run else Database()
    if db and not a.force and ran_recently(db):
        log(f"ran within {MIN_GAP_HOURS} hours; nothing to do")
        return 0
    token = (os.environ.get("COURTLISTENER_TOKEN") or "").strip() or None
    known = stored_dockets(db) if db else set()
    walk = {d["id"] for d in dockets} if a.all else {d["id"] for d in dockets if d["id"] not in known}
    got = read_dockets(dockets, token=token, walk_all=walk)
    return finish(db, got, started, a.dry_run)


if __name__ == "__main__":
    sys.exit(main())
