#!/usr/bin/env python3
"""Where and when PERM employers recruit, from DOL's own Form 9089 Section H.

Writes `perm_docs['recruitment_summary']`, for a national recruitment page and
the filing-window guides (neither reads it yet): how many cases carry the
record, the share using each additional step and each notice method, the
newspapers that carry the most Sunday ads (nationally and in each state), and
how long before filing the recruiting began and ended. Each employer's, law firm's and occupation's own
figures are facets, built by build_entity_detail.py in the same pass as their
others.

Every figure counts decided cases DOL published (`perm_cases`), and only the
new form (filed from June 2023) carries the record; the old form's columns are
named differently and aren't read. Percentiles are the ingest's own
(`ingest_perm_disclosure.percentile`), so a median here is computed exactly as
every other median on the site.

Usage:
    python3 scripts/build_recruitment.py            # rebuild the doc
    python3 scripts/build_recruitment.py --dry-run  # read and report only
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from ingest_perm_disclosure import percentile  # noqa: E402
from lib_db import Database, record_run, rows_of, write_doc  # noqa: E402
from lib_recruitment import LEAD_BANDS, NOTICE, STEPS, case_papers, lead_band, step_starts, steps_of  # noqa: E402

DOC_KEY = "recruitment_summary"
COLS = ["case_number", "received_date", "decision_date", "state", "job_order_start", "job_order_end",
        "ad1", "ad2", "paper1", "paper2", "ad_type", "sunday_edition", "recr_steps", "notice"]
PAGE = 50_000
# Newspapers listed nationally, and in each state.
TOP_PAPERS = 25
TOP_STATE_PAPERS = 10
# The percentiles each lead-time figure prints.
POINTS = (10, 25, 50, 75, 90)


def log(msg: str) -> None:
    print(msg, flush=True)


def read(db: Database):
    """Every case with a recruitment record, in pages of case number."""
    after = ""
    while True:
        page = rows_of(db.execute(
            f"SELECT {','.join(COLS)} FROM perm_cases WHERE case_number > ? "
            "AND (job_order_start IS NOT NULL OR paper1 IS NOT NULL OR recr_steps IS NOT NULL) "
            "ORDER BY case_number LIMIT ?", [after, PAGE]))
        for r in page:
            yield dict(zip(COLS, r))
        if len(page) < PAGE:
            return
        after = str(page[-1][0])


def days_between(a: str | None, b: str | None) -> int | None:
    if not a or not b:
        return None
    return (dt.date.fromisoformat(str(b)[:10]) - dt.date.fromisoformat(str(a)[:10])).days


def summarise(rows) -> dict:
    """The doc, from an iterable of rows. Pure, for the test."""
    n = 0
    steps, notice, ad_types, sunday = Counter(), Counter(), Counter(), Counter()
    papers, votes = Counter(), defaultdict(Counter)
    by_state: dict[str, Counter] = defaultdict(Counter)
    lead = {"firstStep": [], "lastStep": [], "secondAd": [], "jobOrderEnd": []}
    bands = Counter()
    newest = ""
    for r in rows:
        n += 1
        newest = max(newest, str(r.get("decision_date") or "")[:10])
        for s in steps_of(r.get("recr_steps")):
            steps[s] += 1
        for m in (r.get("notice") or "").split(","):
            if m:
                notice[m] += 1
        if r.get("ad_type"):
            ad_types[r["ad_type"]] += 1
        if r.get("sunday_edition"):
            sunday[r["sunday_edition"]] += 1
        for k, raw in case_papers(r).items():
            papers[k] += 1
            votes[k][raw] += 1
            if r.get("state"):
                by_state[r["state"]][k] += 1
        starts = step_starts(r)
        received = r.get("received_date")
        if starts:
            lead["firstStep"].append(days_between(starts[0], received))
            lead["lastStep"].append(days_between(starts[-1], received))
            b = lead_band(received, starts[0])
            if b:
                bands[b] += 1
        lead["secondAd"].append(days_between(r.get("ad2"), received))
        lead["jobOrderEnd"].append(days_between(r.get("job_order_end"), received))

    def label(k: str) -> str:
        return votes[k].most_common(1)[0][0]

    def ranked(c: Counter, top: int) -> list[dict]:
        return [{"key": k, "label": label(k), "n": v} for k, v in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:top]]

    def spread(values: list) -> dict | None:
        vals = [v for v in values if v is not None]
        return {"n": len(vals), **{f"p{p}": percentile(vals, p) for p in POINTS}} if vals else None

    return {
        "asOf": newest or None,
        "cases": n,
        "steps": [{"id": s["id"], "n": steps[s["id"]]} for s in STEPS],
        "notice": [{"id": m["id"], "n": notice[m["id"]]} for m in NOTICE],
        "adTypes": [{"label": k, "n": v} for k, v in ad_types.most_common()],
        "sundayEdition": dict(sunday),
        "lead": {k: spread(v) for k, v in lead.items()},
        "leadBands": [{"id": b["id"], "n": bands[b["id"]]} for b in LEAD_BANDS],
        "papers": ranked(papers, TOP_PAPERS),
        "paperSpellings": sum(len(v) for v in votes.values()),
        "byState": {st: ranked(c, TOP_STATE_PAPERS) for st, c in sorted(by_state.items())},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    db = Database()
    doc = summarise(read(db))
    first = doc["lead"]["firstStep"] or {}
    log(f"cases with a recruitment record {doc['cases']:,}; papers {len(doc['papers'])} of "
        f"{doc['paperSpellings']:,} spellings; first step to filing median {first.get('p50')} days")
    if args.dry_run:
        log(json.dumps({k: doc[k] for k in ("steps", "leadBands")})[:600])
        return 0
    if not doc["cases"]:
        # Nothing to say until the disclosure load carries Section H; leave any
        # earlier doc in place rather than replacing it with zeros.
        log("  no case carries a recruitment record yet; doc left as it was")
        record_run(db, "build_recruitment.py", status="ok", rows_written=0,
                   note="no recruitment record loaded yet", started_at=started)
        return 0
    # check_precomputed_docs in check_ingest_health.py watches a doc only once a
    # page reads it; add this key there with the page that does.
    write_doc(db, DOC_KEY, doc)
    record_run(db, "build_recruitment.py", status="ok", rows_written=1,
               note=f"{doc['cases']:,} cases summarised", started_at=started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
