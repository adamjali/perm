#!/usr/bin/env python3
"""DOL's own notice on FLAG (a maintenance window, an outage), as the site shows it.

    python3 scripts/ingest_flag_notice.py [--dry-run] [--from-file saved.html]

FLAG prints a notice in the header area of every page (the "region-header-top"
block): on Oct 27 2026 a heading, "Scheduled Maintenance", and a paragraph
saying maintenance starts that evening at 7:00 PM Eastern and case statuses may
change late. The area is empty when there's no notice.

Writes perm_docs['flag_notice']: {active, heading, body, firstSeenAt, checkedAt,
source}. `checkedAt` moves every run, so the site can tell a stale reading from
a current one and hide the banner when this job stops. A notice is kept word
for word, DOL's words; nothing is reworded or guessed.

A run that can't read the page writes nothing and records the failure: the
last reading ages out on the site by its checkedAt rather than reading as "no
notice".
"""
from __future__ import annotations

import argparse
import html
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_db import Database, read_doc, record_run, write_doc  # noqa: E402
from lib_gov_data import fetch, log  # noqa: E402

URL = "https://flag.dol.gov/"
KEY = "flag_notice"
SCRIPT = "ingest_flag_notice.py"


def _text(fragment: str) -> str:
    fragment = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", fragment)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", fragment)).split())


def parse_notice(page: str) -> dict | None:
    """The notice in FLAG's header area as {heading, body}, or None when there is none.

    The area is a Drupal region; a notice is a block inside it with a heading
    and paragraphs. Only that region is read, so a heading elsewhere on the
    page (the site's own "Announcements") can't be taken for a notice.
    """
    m = re.search(r'<div class="region region-header-top">([\s\S]*?)</section>', page)
    if not m:
        return None
    region = m.group(1)
    heading = re.search(r"<h[1-4][^>]*>([\s\S]*?)</h[1-4]>", region)
    paragraphs = [_text(p) for p in re.findall(r"<p[^>]*>([\s\S]*?)</p>", region)]
    body = " ".join(p for p in paragraphs if p)
    head = _text(heading.group(1)) if heading else ""
    if not head and not body:
        return None
    return {"heading": head, "body": body}


def next_doc(previous: dict | None, notice: dict | None, now_ms: int) -> dict:
    """The document to store: the notice, when it was first seen, and when it was checked."""
    if notice is None:
        return {"active": False, "heading": "", "body": "", "firstSeenAt": None, "checkedAt": now_ms, "source": URL}
    same = bool(previous and previous.get("active") and previous.get("heading") == notice["heading"]
                and previous.get("body") == notice["body"])
    first = previous.get("firstSeenAt") if same and previous else now_ms
    return {"active": True, **notice, "firstSeenAt": first, "checkedAt": now_ms, "source": URL}


def run(db: Database | None, *, from_file: str | None = None) -> int:
    started = time.time()
    try:
        page = open(from_file, encoding="utf8", errors="ignore").read() if from_file else fetch(URL).decode("utf8", "ignore")
    except Exception as exc:  # noqa: BLE001 - a refusal is recorded, never a crash
        log(f"::warning::couldn't read {URL}: {exc}")
        if db is not None:
            record_run(db, SCRIPT, status="partial", rows_written=0, note=f"couldn't read FLAG: {str(exc)[:160]}", started_at=started)
        return 0
    notice = parse_notice(page)
    previous = read_doc(db, KEY) if db is not None else None
    doc = next_doc(previous, notice, int(time.time() * 1000))
    log(f"FLAG notice: {'ACTIVE: ' + doc['heading'] if doc['active'] else 'none'}")
    if db is None:
        log(f"dry run: {doc}")
        return 0
    write_doc(db, KEY, doc)
    record_run(db, SCRIPT, status="ok", rows_written=1, note=doc["heading"] if doc["active"] else "no notice", started_at=started)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from-file", help="a saved copy of flag.dol.gov's homepage")
    args = ap.parse_args()
    return run(None if args.dry_run else Database(), from_file=args.from_file)


if __name__ == "__main__":
    sys.exit(main())
