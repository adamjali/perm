#!/usr/bin/env python3
"""How many comments each open proposed rule has on regulations.gov.

    python3 scripts/ingest_regulations_gov.py            # read and write
    python3 scripts/ingest_regulations_gov.py --dry-run  # read and print, write nothing

WHICH RULES. Every proposed rule the policy feed holds whose comment period is
still open (`policy_notices`, type "Proposed Rule", comments_close_on today or
later, Eastern), and every proposal the rule watch follows that is still open
(`rule_pipeline.proposed_document`, `comments_close`). Nothing else: a closed
docket's count stops moving.

WHAT IT READS (measured Oct 27 2026, regulations.gov API v4 through
api.data.gov, lib_data_gov):
- `GET /v4/documents?filter[frDocNum]=<Federal Register number>`: the
  regulations.gov document (id, objectId, docketId, commentEndDate). Read once
  per rule; its ids are kept.
- `GET /v4/comments?filter[commentOnId]=<objectId>&page[size]=5`:
  `meta.totalElements` is the number of comments POSTED on the document. That is
  the number this stores. An agency posts a comment after it screens it, so the
  count can trail what was submitted; the API publishes no received count. On
  Oct 27 2026 the 60-day grace period rule (2026-18631) read 26,697 posted, and
  the same count over its whole docket (filter[docketId]) was the same 26,697.

So a run costs one request per open rule, plus one for a rule seen for the
first time.

THE FALLBACK. The Federal Register's own API, which needs no key, carries a
copy of regulations.gov's figures for each document (`regulations_dot_gov_info`:
docket_id, document_id, comments_count, checked_regulationsdotgov_at). It read
26,704 for the same rule, checked 25 minutes before regulations.gov's 26,697:
not the same number, so the two never share a row's count. The Register's copy
fills a rule only while regulations.gov has given it no count at all (DEMO_KEY
spent, the gateway down), and regulations.gov's own count replaces it the first
time it answers (`counted_by`). A count is never moved from regulations.gov's
back to the Register's.

TROUBLE. A spent budget, a 429, a 5xx or an outage is a stop: what was read is
written, the run is recorded ok with the reason in its note. A key the gateway
refuses, or an answer that has lost its shape, writes nothing and exits 1. A
defect in this code crashes.

WRITES. `policy_comment_counts`, one row per Federal Register document number,
written only when the count, the ids, the end date or the source changed.
Freshness row `policy-comments`, stamped whenever the run read its rules (or
found none open).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_data_gov import Client, KeyRefused, Stopped, UA  # noqa: E402
from lib_db import Database, et_today, query_dicts, record_run, stamp_freshness  # noqa: E402
from lib_policy_feed import expire_policy_page, record_quiet_run  # noqa: E402

SCRIPT = "ingest_regulations_gov.py"
DATASET = "policy-comments"
SOURCE_LABEL = "regulations.gov comment counts"
API = "https://api.regulations.gov/v4"
FR_API = "https://www.federalregister.gov/api/v1/documents"
ET = ZoneInfo("America/New_York")
# Counts move every day a docket is open; three days without a reading is a
# reader that stopped.
MAX_AGE_DAYS = 3

DDL = [
    """CREATE TABLE IF NOT EXISTS policy_comment_counts (
        document_number TEXT PRIMARY KEY,
        regs_document_id TEXT,
        object_id TEXT,
        docket_id TEXT,
        comments INTEGER,
        comment_end TEXT,
        counted_by TEXT,
        source_checked_at TEXT,
        counted_at INTEGER,
        url TEXT,
        comment_url TEXT,
        title TEXT)""",
]
# Compared to decide whether a row changed. `counted_at` is bookkeeping.
CONTENT = ["regs_document_id", "object_id", "docket_id", "comments", "comment_end", "counted_by", "url",
           "comment_url", "title"]


class LostStructure(ValueError):
    """An answer that read fine and didn't look like itself."""


def log(msg: str) -> None:
    print(msg, flush=True)


def eastern_day_of(iso: str | None) -> str | None:
    """regulations.gov's end date is the last second of the day in UTC
    ("2026-11-11T04:59:59Z" is Nov 10, 11:59:59 PM Eastern)."""
    if not iso:
        return None
    try:
        t = dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    return t.astimezone(ET).date().isoformat()


def docket_urls(docket_id: str | None, document_id: str | None) -> tuple[str | None, str | None]:
    """The docket's posted comments, and the form to comment on the document."""
    url = f"https://www.regulations.gov/docket/{docket_id}/comments" if docket_id else None
    form = f"https://www.regulations.gov/commenton/{document_id}" if document_id else None
    return url, form


# ---------------------------------------------------------------------------
# Which rules
# ---------------------------------------------------------------------------

def _table_columns(db, table: str) -> set[str]:
    try:
        return {r["name"] for r in query_dicts(db, f"PRAGMA table_info({table})")}
    except Exception:  # noqa: BLE001 - a missing table is no columns
        return set()


def targets(db, today: str) -> list[dict]:
    """Open proposed rules, by Federal Register number, soonest-closing first."""
    out: dict[str, dict] = {}
    cols = _table_columns(db, "policy_notices")
    if {"type", "comments_close_on", "document_number"} <= cols:
        status = "AND (status IS NULL OR status = 'published') " if "status" in cols else ""
        for r in query_dicts(
                db, "SELECT document_number, title, comments_close_on FROM policy_notices "
                    f"WHERE type = 'Proposed Rule' AND comments_close_on >= ? {status}", [today]):
            out[r["document_number"]] = {"document_number": r["document_number"], "title": r["title"],
                                         "closes": r["comments_close_on"]}
    rp = _table_columns(db, "rule_pipeline")
    if {"proposed_document", "comments_close"} <= rp:
        for r in query_dicts(
                db, "SELECT proposed_document, title, comments_close FROM rule_pipeline "
                    "WHERE proposed_document IS NOT NULL AND proposed_document <> '' AND comments_close >= ?",
                [today]):
            num = r["proposed_document"]
            out.setdefault(num, {"document_number": num, "title": r.get("title"), "closes": r["comments_close"]})
    return sorted(out.values(), key=lambda t: (t["closes"] or "", t["document_number"]))


def stored(db) -> dict[str, dict]:
    db.script(DDL)
    return {r["document_number"]: r for r in query_dicts(db, "SELECT * FROM policy_comment_counts", typed=True)}


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------

def find_document(client: Client, fr_number: str) -> dict | None:
    """The regulations.gov proposed rule for a Federal Register number, or None
    when regulations.gov holds none (an agency that takes comments elsewhere)."""
    d = client.get_json(f"{API}/documents", {"filter[frDocNum]": fr_number})
    if not isinstance(d, dict) or not isinstance(d.get("data"), list):
        raise LostStructure("documents?filter[frDocNum] answered without a data list")
    docs = [x for x in d["data"] if isinstance(x, dict) and isinstance(x.get("attributes"), dict)]
    exact = [x for x in docs if x["attributes"].get("frDocNum") == fr_number and not x["attributes"].get("withdrawn")]
    exact.sort(key=lambda x: (x["attributes"].get("documentType") != "Proposed Rule", x.get("id") or ""))
    if not exact:
        return None
    a = exact[0]["attributes"]
    if not a.get("objectId") or not exact[0].get("id"):
        raise LostStructure(f"{fr_number}: the regulations.gov document has no id or objectId")
    return {"regs_document_id": exact[0]["id"], "object_id": a["objectId"], "docket_id": a.get("docketId"),
            "comment_end": eastern_day_of(a.get("commentEndDate"))}


def posted_comments(client: Client, object_id: str) -> int:
    d = client.get_json(f"{API}/comments", {"filter[commentOnId]": object_id, "page[size]": 5})
    total = (d.get("meta") or {}).get("totalElements") if isinstance(d, dict) else None
    if not isinstance(total, int) or total < 0:
        raise LostStructure("comments?filter[commentOnId] answered without meta.totalElements")
    return total


def fr_copy(numbers: list[str], fetch=None) -> dict[str, dict]:
    """The Federal Register's copy of regulations.gov's figures, one keyless
    request for every number. {} when the Register can't be read."""
    if not numbers:
        return {}
    fetch = fetch or _fr_fetch
    try:
        d = fetch(f"{FR_API}/{','.join(numbers)}.json?fields[]=document_number&fields[]=regulations_dot_gov_info")
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError, ValueError) as e:
        log(f"::warning::the Federal Register's copy unread ({type(e).__name__})")
        return {}
    results = d.get("results") if isinstance(d, dict) else None
    if results is None and isinstance(d, dict) and d.get("document_number"):
        results = [d]  # one number answers as the document itself
    out = {}
    for r in results or []:
        info = r.get("regulations_dot_gov_info") or {}
        count = info.get("comments_count")
        if isinstance(count, int) and r.get("document_number"):
            out[r["document_number"]] = {"comments": count, "docket_id": info.get("docket_id"),
                                         "regs_document_id": info.get("document_id"),
                                         "source_checked_at": info.get("checked_regulationsdotgov_at")}
    return out


def _fr_fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read())


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------

def _same(a: dict | None, b: dict) -> bool:
    return a is not None and all(a.get(c) == b.get(c) for c in CONTENT)


def write_row(db, prev: dict | None, row: dict, now_ms: int) -> bool:
    """Upsert one row; False when nothing it holds changed."""
    merged = dict(prev or {})
    for k, v in row.items():
        if v is not None:
            merged[k] = v
    merged["document_number"] = row["document_number"]
    if _same(prev, merged):
        return False
    merged["counted_at"] = now_ms
    cols = ["document_number"] + CONTENT + ["source_checked_at", "counted_at"]
    db.execute(
        f"INSERT INTO policy_comment_counts ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))}) "
        f"ON CONFLICT(document_number) DO UPDATE SET "
        + ", ".join(f"{c} = excluded.{c}" for c in cols if c != "document_number"),
        [merged.get(c) for c in cols])
    return True


def run(db=None, *, client: Client | None = None, fr_fetch=None, dry_run: bool = False,
        numbers: list[str] | None = None, today: str | None = None, now_ms: int | None = None) -> int:
    """`numbers` names the rules instead of reading them from the database (a
    dry run from a machine with no database)."""
    started = time.time()
    today = today or et_today()
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    if numbers is None or not dry_run:
        db = db if db is not None else Database()
    if numbers is not None:
        open_rules = [{"document_number": n, "title": None, "closes": None} for n in numbers]
    else:
        open_rules = targets(db, today)
    have = stored(db) if db is not None and not dry_run else {}
    client = client or Client(log=log)
    log(f"{len(open_rules)} proposed rules open for comment ({client.key_note})")

    results: dict[str, dict] = {}
    stop_note = ""
    try:
        for t in open_rules:
            num = t["document_number"]
            prev = have.get(num) or {}
            ids = {k: prev.get(k) for k in ("regs_document_id", "object_id", "docket_id", "comment_end")}
            if not ids.get("object_id"):
                found = find_document(client, num)
                if found is None:
                    log(f"  {num}: not on regulations.gov")
                    continue
                ids = found
            count = posted_comments(client, ids["object_id"])
            url, form = docket_urls(ids.get("docket_id"), ids.get("regs_document_id"))
            results[num] = {**ids, "document_number": num, "comments": count, "counted_by": "regulations.gov",
                            "source_checked_at": None, "url": url, "comment_url": form, "title": t.get("title")}
            log(f"  {num}: {count:,} comments posted ({ids.get('docket_id')})")
    except Stopped as e:
        stop_note = str(e)
        log(f"::warning::regulations.gov stopped: {e}")
    except KeyRefused as e:
        print(f"::error::{e}. Nothing was written.", flush=True)
        if not dry_run:
            record_run(db, SCRIPT, status="failed", rows_written=0, note=str(e), started_at=started)
        return 1
    except LostStructure as e:
        print(f"::error::regulations.gov changed shape: {e}. Nothing was written.", flush=True)
        if not dry_run:
            record_run(db, SCRIPT, status="failed", rows_written=0, note=str(e), started_at=started)
        return 1

    # The Register's copy, only for open rules regulations.gov has never
    # counted: a count is never moved from regulations.gov's back to the copy.
    missing = [t["document_number"] for t in open_rules if t["document_number"] not in results
               and (have.get(t["document_number"]) or {}).get("counted_by") != "regulations.gov"]
    fallback = 0
    if stop_note and missing:
        copy = fr_copy(missing, fr_fetch)
        for num in missing:
            info = copy.get(num)
            if info is None:
                continue
            url, form = docket_urls(info.get("docket_id"), info.get("regs_document_id"))
            title = next((t.get("title") for t in open_rules if t["document_number"] == num), None)
            results[num] = {**info, "document_number": num, "counted_by": "federalregister.gov",
                            "url": url, "comment_url": form, "title": title}
            fallback += 1
            log(f"  {num}: {info['comments']:,} comments (the Federal Register's copy)")

    if dry_run:
        for r in list(results.values())[:5]:
            print(json.dumps(r, indent=2))
        return 0

    written = 0
    for num, row in results.items():
        if write_row(db, have.get(num), row, now):
            written += 1
    read_all = not stop_note
    if read_all or results:
        stamp_freshness(db, DATASET, as_of=today, source=SOURCE_LABEL, cadence="Several times a day",
                        note=f"{len(open_rules)} open, {len(results)} counted, {written} changed",
                        max_age_days=MAX_AGE_DAYS)
    note = (f"{len(open_rules)} open, {len(results)} counted ({fallback} from the Federal Register's copy), "
            f"{written} written, {client.used} requests {client.key_note}")
    if stop_note:
        note += f"; stopped: {stop_note}"
    if written and expire_policy_page(log) is False:
        note += "; policy page refresh refused"
    log(note)
    if stop_note:
        record_run(db, SCRIPT, status="ok", rows_written=written, note=note, started_at=started)
    else:
        record_quiet_run(db, SCRIPT, written=written, note=note, started_at=started)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="read and print, write nothing")
    ap.add_argument("--numbers", help="with --dry-run: Federal Register numbers to count, comma-separated, "
                                      "instead of the open rules in the database")
    a = ap.parse_args()
    if a.numbers and not a.dry_run:
        ap.error("--numbers is for --dry-run")
    nums = [n.strip() for n in a.numbers.split(",") if n.strip()] if a.numbers else None
    return run(dry_run=a.dry_run, numbers=nums)


if __name__ == "__main__":
    sys.exit(main())
