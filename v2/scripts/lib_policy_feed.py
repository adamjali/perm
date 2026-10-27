"""One writer for `policy_notices`, the table every policy source shares.

Six sources write here: the Federal Register (published documents, and the
public inspection list a day or more before), the White House's presidential
actions, OFLC's announcements, USCIS's newsroom and Policy Manual updates, and
DOL's newsroom. They used to write the table their own way, and two of them
with `INSERT OR REPLACE`, which deletes the row first: a source that didn't
know a column wiped it. So every writer goes through `write_notices` now.

THE RULES IT KEEPS.
- A fact is never cleared. A column the incoming row leaves empty keeps what
  was stored, so the published Register document doesn't erase the day it was
  filed for public inspection, and a source that knows four columns can't wipe
  the other twelve.
- `first_seen_at` is set once, the first time any source writes the row, and
  never moved. It's when this site first knew of the document; the newsworthy
  check reads it.
- A row is written only when something it holds changed. A second run with
  nothing new writes nothing.
- Topics are a union: a document that matched "H-1B" yesterday and "PERM"
  today carries both.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import time
import unicodedata
from dataclasses import dataclass, field
from zoneinfo import ZoneInfo

from lib_db import Database, add_missing_columns, query_dicts

ET = ZoneInfo("America/New_York")

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

# Columns added after the table existed. All nullable.
EXTRA_COLUMNS: dict[str, str] = {
    # The Register's own dates and record (Sep 16 2026).
    "effective_on": "TEXT", "comments_close_on": "TEXT", "comment_url": "TEXT",
    "citation": "TEXT", "action": "TEXT", "dates": "TEXT",
    "correction_of": "TEXT", "pdf_url": "TEXT",
    # Oct 27 2026: one writer for every source.
    "first_seen_at": "INTEGER",  # ms; when this site first held the row
    "source": "TEXT",            # SOURCES below
    "status": "TEXT",            # STATUSES below; NULL for a source with no stages
    "pi_filed": "TEXT",          # Eastern day the Register filed it for public inspection
    "signing_date": "TEXT",      # a presidential document's signing day
    "superseded_by": "TEXT",     # a White House row's Register document, once published
}

# Every policy source's freshness row. The health check warns on one that has
# never loaded (it has no row to go stale), and the policy page names each in
# its sources; test_policy_feed.py holds the page to this list.
POLICY_DATASETS = (
    "policy-notices",           # the Federal Register, published (ingest_policy_notices.py)
    "policy-notices-pi",        # its public inspection list (the same, --inspection)
    "policy-notices-wh",        # the White House (ingest_white_house.py)
    "policy-notices-uscis",     # USCIS's newsroom (ingest_uscis_news.py)
    "policy-notices-uscis-pm",  # USCIS's Policy Manual updates (the same)
    "policy-notices-state",     # the State Department's newsroom (ingest_state_news.py)
    "policy-notices-dol",       # DOL's newsroom (ingest_dol_news.py)
    "policy-notices-oflc",      # OFLC's announcements (ingest_oflc_news.py)
    "policy-notices-congress",  # congress.gov bills (ingest_congress_bills.py)
    "policy-comments",          # regulations.gov comment counts on open proposals (ingest_regulations_gov.py)
    "policy-notices-courts",    # federal court opinions, from CourtListener (ingest_court_opinions.py)
    "policy-notices-balca",     # BALCA's decisions, from OALJ's caselists (ingest_balca.py)
    "rule-pipeline",            # OIRA, public inspection and the Register by RIN (ingest_rule_pipeline.py)
    "rule-pipeline-agenda",     # the Unified Agenda (the same)
)

# Where a row came from. Stored, so the page and the checks never guess from a type.
SOURCES = ("federal-register", "public-inspection", "white-house", "oflc", "uscis-news",
           "uscis-policy-manual", "dol-news", "state-news", "congress", "courtlistener", "balca")
# A Register document's stage: on public inspection, published, or taken off
# public inspection without being published.
STATUSES = ("public-inspection", "published", "withdrawn")

BASE = ["document_number", "publication_date", "type", "title", "abstract", "html_url", "agencies", "topics"]
LISTS = ("agencies", "topics")
# Compared to decide whether a row changed. `fetched_at` and `first_seen_at`
# are bookkeeping.
CONTENT = [c for c in BASE if c != "document_number"] + [
    c for c in EXTRA_COLUMNS if c != "first_seen_at"]
# A status only moves forward: published beats public inspection, and nothing
# moves a row back to public inspection once the Register published it.
STATUS_RANK = {None: 0, "public-inspection": 1, "withdrawn": 2, "published": 3}


@dataclass
class WriteResult:
    written: int = 0
    new: list[str] = field(default_factory=list)  # document numbers first seen this run
    unchanged: int = 0


def ensure_table(db: Database) -> list[str]:
    """The table and every column, and the bookkeeping rows written before
    Oct 27 2026 lack: their first sighting is their last write (the best
    record there is, and old enough that no check reads it as news), their
    source follows from their type, and a Register row was published."""
    db.script(DDL)
    added = add_missing_columns(db, "policy_notices", EXTRA_COLUMNS)
    db.execute("UPDATE policy_notices SET first_seen_at = fetched_at WHERE first_seen_at IS NULL")
    db.execute("UPDATE policy_notices SET source = CASE WHEN type = 'OFLC announcement' THEN 'oflc' "
               "ELSE 'federal-register' END WHERE source IS NULL")
    db.execute("UPDATE policy_notices SET status = 'published' WHERE source = 'federal-register' AND status IS NULL")
    return added


def _norm_list(v) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return []
    return [x for x in v if isinstance(x, str) and x]


def _blank(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def merge(stored: dict | None, incoming: dict) -> dict:
    """The row as it should stand after this write. Pure, so a test can drive it.

    Lists are unions in first-seen order. A status moves only forward
    (STATUS_RANK). Every other column takes the incoming value when it has one
    and keeps the stored value otherwise.
    """
    out: dict = {}
    s = stored or {}
    for c in BASE + list(EXTRA_COLUMNS):
        if c in LISTS:
            merged = _norm_list(s.get(c))
            for x in _norm_list(incoming.get(c)):
                if x not in merged:
                    merged.append(x)
            out[c] = merged
        elif c == "status":
            a, b = s.get(c), incoming.get(c)
            out[c] = b if STATUS_RANK.get(b, 0) >= STATUS_RANK.get(a, 0) and not _blank(b) else a
        elif c == "first_seen_at":
            out[c] = s.get(c) if s.get(c) is not None else incoming.get(c)
        else:
            v = incoming.get(c)
            out[c] = s.get(c) if _blank(v) else v
    return out


def _comparable(r: dict) -> tuple:
    return tuple(json.dumps(_norm_list(r.get(c))) if c in LISTS else r.get(c) for c in CONTENT)


def write_notices(db: Database, rows: list[dict], *, source: str, now_ms: int | None = None) -> WriteResult:
    """Upsert `rows` (dicts with at least BASE's keys) from one source."""
    if source not in SOURCES:
        raise ValueError(f"unknown policy source {source!r}")
    ensure_table(db)
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    nums = [r["document_number"] for r in rows if r.get("document_number")]
    stored: dict[str, dict] = {}
    cols = BASE + list(EXTRA_COLUMNS)
    for i in range(0, len(nums), 400):
        chunk = nums[i:i + 400]
        for d in query_dicts(db, f"SELECT {', '.join(cols)} FROM policy_notices WHERE document_number IN "
                                 f"({', '.join('?' * len(chunk))})", chunk, typed=True):
            stored[d["document_number"]] = d
    res = WriteResult()
    names = cols + ["fetched_at"]
    for r in rows:
        num = r.get("document_number")
        if not num:
            continue
        inc = dict(r)
        inc.setdefault("source", source)
        inc["first_seen_at"] = now
        prev = stored.get(num)
        row = merge(prev, inc)
        for c in ("publication_date", "type", "title", "html_url"):
            if _blank(row.get(c)):
                raise ValueError(f"{source}: {num} has no {c}")
        if prev is not None and _comparable(merge(prev, {})) == _comparable(row):
            res.unchanged += 1
            continue
        vals = [json.dumps(row[c]) if c in LISTS else row[c] for c in cols] + [now]
        updates = ", ".join(f"{c} = excluded.{c}" for c in names if c not in ("document_number", "first_seen_at"))
        db.execute(
            f"INSERT INTO policy_notices ({', '.join(names)}) VALUES ({', '.join('?' * len(names))}) "
            f"ON CONFLICT(document_number) DO UPDATE SET {updates}",
            vals)
        res.written += 1
        if prev is None:
            res.new.append(num)
        stored[num] = row
    return res


# ---------------------------------------------------------------------------
# Shared reading helpers
# ---------------------------------------------------------------------------

def eastern_day(value) -> str | None:
    """An Eastern calendar day from an ISO timestamp, an RFC 822 date, or ms."""
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return dt.datetime.fromtimestamp(value / 1000, ET).date().isoformat()
        s = str(value).strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
            return s
        try:
            t = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            from email.utils import parsedate_to_datetime
            t = parsedate_to_datetime(s)
        if t.tzinfo is None:
            t = t.replace(tzinfo=ET)
        return t.astimezone(ET).date().isoformat()
    except (ValueError, TypeError, OverflowError):
        return None


def title_key(title: str | None) -> str:
    """A title reduced to its words, for matching one document across two sources."""
    t = unicodedata.normalize("NFKD", title or "").encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return " ".join(t.split())


def title_overlap(a: str | None, b: str | None) -> float:
    """Share of words two titles have in common (Jaccard), on their keys."""
    x, y = set(title_key(a).split()), set(title_key(b).split())
    return len(x & y) / len(x | y) if x and y else 0.0


# A White House title and the Register's for the same order differ by a typo
# now and then ("Enhancing Program Integrity and Integrity and Interagency
# Coordination", Sep 18 2026): the same signing week and this much overlap is
# the same document.
LINK_WITHIN_DAYS = 4
LINK_MIN_OVERLAP = 0.75


def link_presidential(db: Database) -> int:
    """Mark each White House row whose presidential document the Register has
    published, so the page shows the one document once. Matched by a signing
    day within LINK_WITHIN_DAYS of the White House's posting day, and the same
    title, or failing that the closest title at LINK_MIN_OVERLAP or more."""
    ensure_table(db)
    wh = query_dicts(db, "SELECT document_number, title, publication_date FROM policy_notices "
                         "WHERE source = 'white-house' AND superseded_by IS NULL")
    if not wh:
        return 0
    fr = query_dicts(db, "SELECT document_number, title, signing_date, publication_date FROM policy_notices "
                         "WHERE type = 'Presidential Document'")
    linked = 0
    for w in wh:
        near = []
        for d in fr:
            signed = d.get("signing_date") or d.get("publication_date")
            try:
                gap = abs((dt.date.fromisoformat(signed) - dt.date.fromisoformat(w["publication_date"])).days)
            except (TypeError, ValueError):
                continue
            if gap <= LINK_WITHIN_DAYS:
                near.append((1.0 if title_key(d["title"]) == title_key(w["title"]) else title_overlap(d["title"], w["title"]), d))
        best = max(near, key=lambda x: x[0], default=None)
        if best and best[0] >= LINK_MIN_OVERLAP:
            db.execute("UPDATE policy_notices SET superseded_by = ? WHERE document_number = ?",
                       [best[1]["document_number"], w["document_number"]])
            linked += 1
    return linked


# What a title or text must mention for a source that isn't immigration-only
# (the White House, DHS, State, DOL) to be kept. Broad on purpose: a missed
# document is worse than one extra row a reader can skip.
IMMIGRATION = re.compile(
    r"\bimmigra|\bnonimmigrant|\bvisas?\b|\bH-?1B\b|\bH-?2A\b|\bH-?2B\b|\bCW-?1\b|\bE-3\b|\bH-1B1\b|\bL-1\b|\bO-1\b"
    r"|labor certification|\bPERM\b|prevailing wage|foreign labor|foreign workers?|guest workers?"
    r"|employment authori[sz]ation|green cards?|lawful permanent|adjustment of status|\bUSCIS\b"
    r"|citizenship and immigration|entry of (?:certain )?(?:aliens|foreign nationals|nonimmigrants)"
    r"|\baliens?\b|temporary protected status|\bEB-[1-5]\b|employment-based|work permits?",
    re.I,
)


def mentions_immigration(*texts: str | None) -> bool:
    return any(t and IMMIGRATION.search(t) for t in texts)


# Topic tags shared by every source, so a document from any of them sorts
# under the same words on the page.
TOPIC_PATTERNS: dict[str, str] = {
    "PERM": r"labor certification|\bPERM\b|ETA[- ]?9089",
    "Prevailing wage": r"prevailing wage|ETA[- ]?9141|wage level|adverse effect wage",
    "H-1B": r"\bH-?1B\b|specialty occupation|labor condition application|\bLCA\b",
    "H-2A": r"\bH-?2A\b",
    "H-2B": r"\bH-?2B\b",
    "CW-1": r"\bCW-?1\b|CNMI",
    "I-140": r"\bI-140\b|immigrant petition for alien worker",
    "Adjustment of status": r"adjustment of status|\bI-485\b|green cards?",
    "Visa bulletin": r"visa bulletin|priority date",
    "EB-5": r"\bEB-5\b|immigrant investor",
    "Work permits": r"employment authori[sz]ation|\bI-765\b|\bEAD\b",
    "Fees": r"\bfees?\b",
}


def topics_of(*texts: str | None) -> list[str]:
    hay = "\n".join(t for t in texts if t)
    return [t for t, rx in TOPIC_PATTERNS.items() if re.search(rx, hay, flags=re.I)]


# A source read every 30 minutes would write 48 "ok, nothing new" rows a day to
# the run log. A quiet run is recorded at most this often; a run that wrote
# something, warned or failed is always recorded.
QUIET_RUN_HOURS = 3


def record_quiet_run(db: Database, script: str, *, written: int, note: str = "",
                     started_at: float | None = None, now_ms: int | None = None) -> bool:
    """`record_run` for a frequent job: an ok run with nothing written is
    skipped when the script's newest ok row is under QUIET_RUN_HOURS old.
    Returns True when a row was written or deliberately skipped."""
    from lib_db import record_run  # late: keeps this module importable by the page tests
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    if written == 0:
        try:
            newest = db.scalar("SELECT MAX(finished_at) FROM ingest_runs WHERE script = ? AND status = 'ok'", [script])
            if newest is not None and now - int(newest) < QUIET_RUN_HOURS * 3600 * 1000:
                return True
        except Exception:  # noqa: BLE001 - no table yet, or unreadable: record the run
            pass
    return record_run(db, script, status="ok", rows_written=written, note=note, started_at=started_at)


def expire_policy_page(log=print) -> bool | None:
    """Ask the site to rebuild the policy page now, after a write.

    Reads REVALIDATE_SECRET and REVALIDATE_BASE (default https://permtracker.app;
    the server sets http://127.0.0.1:8081, nginx, which sends the call to both
    web copies). None when no secret is set (a local run), True on 200, False on
    any other answer, which the caller names in its run note. A 404 is the route
    not yet live (a push builds by day and ships at night): a warning, not a
    failure, since the page's own window still refreshes it."""
    import os
    import urllib.error
    import urllib.request
    secret = os.environ.get("REVALIDATE_SECRET", "").strip()
    if not secret:
        return None
    base = os.environ.get("REVALIDATE_BASE", "https://permtracker.app").rstrip("/")
    headers = {"x-revalidate-secret": secret, "User-Agent": "permtracker policy feed"}
    if "127.0.0.1" in base or "localhost" in base:
        headers["Host"] = "permtracker.app"
    req = urllib.request.Request(base + "/api/revalidate-policy", data=b"", method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            ok = r.status == 200
    except urllib.error.HTTPError as e:
        if e.code == 404:
            log("::warning::revalidate-policy answered 404; the route isn't live yet")
            return True
        log(f"::warning::revalidate-policy answered HTTP {e.code}")
        return False
    except Exception as e:  # noqa: BLE001
        log(f"::warning::revalidate-policy unreachable ({type(e).__name__})")
        return False
    if not ok:
        log("::warning::revalidate-policy did not answer 200")
    return ok
