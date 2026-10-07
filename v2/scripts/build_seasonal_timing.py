#!/usr/bin/env python3
"""How long DOL takes on H-2A, H-2B and CW-1 applications, measured.

Writes perm_docs['seasonal_timing'] from DOL's own quarterly files
(`seasonal_cases`, every H-2A, H-2B and CW-1 file loaded), one block per visa:

    daysToDecision  received to decided, certifications only
    leadDays        decided to the first day of work (begin_date), certifications only
    onTime          H-2A only: the share decided at least 30 days before the
                    first date of need, the deadline 20 CFR 655.160 sets

Each a set of percentiles (nearest rank) with its count. A visa under
MIN_N certifications gets no block, so a page never quotes a percentile
over a handful of cases.

    seasons         the same two clocks per calendar quarter of RECEIPT
                    ("2025-Q1"), each quarter with MIN_N certifications
    useSeason       H-2B only: the case page reads the quarter a year before
                    the case's own instead of every quarter pooled

WHY H-2B READS ITS SEASON (Oct 7 2026, scripts/backtest_seasonal.py). Pooled,
the H-2B middle-half range held 21% of the next quarter's real decisions
where it should hold half, typically 21 days off: the cap seasons (filings
for April and October starts) run on their own clock. The same quarter a
year earlier had the smaller typical miss in every quarter it could be
tested on (12, 5 and 28 days against 22, 21 and 40). H-2A and CW-1 did best
pooled and stay pooled.

Certifications only, because they are what a person waiting is waiting for:
a withdrawal's date is the employer's, and a denial follows its own notices.
The window (the files and the decided range) rides in the doc, so a page
can say what the numbers cover.

Rebuilt after every H-2A, H-2B or CW-1 load (flag-disclosure-ingest.yml);
check_ingest_health.py's PRECOMPUTED_DOCS fails when it is missing or stale.

Usage:
    python3 scripts/build_seasonal_timing.py            # rebuild the doc
    python3 scripts/build_seasonal_timing.py --dry-run  # read and print only
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, query_rows, record_run, write_doc  # noqa: E402

DOC_KEY = "seasonal_timing"
MIN_N = 50
PCTS = (10, 25, 50, 75, 90)
H2A_DEADLINE_DAYS = 30
VISAS = ("H-2A", "H-2B", "CW-1")
GRANTED = "case_status LIKE '%CERTIFICATION%' AND case_status NOT LIKE '%WITHDRAWN%'"


def percentiles(hist: dict[int, int]) -> dict | None:
    """Nearest-rank percentiles of a {value: count} histogram, with its n.

    Nearest rank, not interpolation: every figure is a day some case
    actually took, which is what a page quoting it can stand behind.
    """
    n = sum(hist.values())
    if n < MIN_N:
        return None
    out: dict = {"n": n}
    ordered = sorted(hist.items())
    for p in PCTS:
        rank = max(1, -(-p * n // 100))  # ceil(p * n / 100), at least 1
        seen = 0
        for value, count in ordered:
            seen += count
            if seen >= rank:
                out[f"p{p}"] = value
                break
    return out


# Visas whose case page reads the receipt quarter a year earlier (see above).
SEASON_VISAS = ("H-2B",)
WAITED = "julianday(decision_date) - julianday(received_date)"
LEAD = "julianday(begin_date) - julianday(decision_date)"
QUARTER = ("substr(received_date, 1, 4) || '-Q' || "
           "((CAST(substr(received_date, 6, 2) AS INTEGER) + 2) / 3)")


def histogram(db: Turso, expr: str, visa: str) -> dict[int, int]:
    rows = query_rows(
        db,
        f"SELECT CAST({expr} AS INTEGER) AS d, COUNT(*) FROM seasonal_cases "
        f"WHERE visa_class = ? AND {GRANTED} AND d IS NOT NULL GROUP BY d",
        [visa],
    )
    return {int(d): int(n) for d, n in rows if d is not None}


def season_blocks(db: Turso, visa: str) -> dict[str, dict]:
    """Both clocks per calendar quarter of receipt, for quarters at the floor."""
    out: dict[str, dict] = {}
    for clock, expr in (("daysToDecision", WAITED), ("leadDays", LEAD)):
        hists: dict[str, dict[int, int]] = {}
        for q, d, n in query_rows(
            db,
            f"SELECT {QUARTER} AS q, CAST({expr} AS INTEGER) AS d, COUNT(*) FROM seasonal_cases "
            f"WHERE visa_class = ? AND {GRANTED} AND d IS NOT NULL AND received_date IS NOT NULL "
            f"GROUP BY q, d",
            [visa],
        ):
            if q and d is not None:
                hists.setdefault(str(q), {})[int(d)] = int(n)
        for q, h in hists.items():
            pct = percentiles(h)
            if pct:
                out.setdefault(q, {})[clock] = pct
    return dict(sorted(out.items()))


def build(db: Turso) -> dict:
    doc: dict = {"asOf": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "minN": MIN_N}
    for visa in VISAS:
        waited = histogram(db, WAITED, visa)
        lead = histogram(db, LEAD, visa)
        window = query_rows(
            db,
            f"SELECT MIN(decision_date), MAX(decision_date), COUNT(DISTINCT source_file) "
            f"FROM seasonal_cases WHERE visa_class = ? AND {GRANTED}",
            [visa],
        )
        first, last, files = (window[0] if window else (None, None, 0))
        block: dict = {
            "daysToDecision": percentiles(waited),
            "leadDays": percentiles(lead),
            "decidedFrom": first,
            "decidedTo": last,
            "files": int(files or 0),
        }
        seasons = season_blocks(db, visa)
        if seasons:
            block["seasons"] = seasons
        if visa in SEASON_VISAS:
            block["useSeason"] = True
        if visa == "H-2A" and lead:
            n = sum(lead.values())
            on_time = sum(c for d, c in lead.items() if d >= H2A_DEADLINE_DAYS)
            block["onTime"] = {"n": n, "share": round(on_time / n, 4), "deadlineDays": H2A_DEADLINE_DAYS}
        if block["daysToDecision"] or block["leadDays"]:
            doc[visa] = block
    return doc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true", help="read and print, write nothing")
    args = ap.parse_args()
    db = Turso()
    doc = build(db)
    print(json.dumps(doc, indent=2))
    if args.dry_run:
        return 0
    if not any(v in doc for v in VISAS):
        print("no visa reached the floor; the previous doc is left in place")
        record_run(db, "build_seasonal_timing.py", status="partial", note="no visa reached the floor")
        return 1
    text = write_doc(db, DOC_KEY, doc)
    got = query_rows(db, "SELECT length(json) FROM perm_docs WHERE key = ?", [DOC_KEY])
    if not got or int(got[0][0] or 0) != len(text):
        print(f"MISMATCH perm_docs[{DOC_KEY}] did not read back")
        return 1
    record_run(db, "build_seasonal_timing.py", status="ok",
               note=", ".join(f"{v} {doc[v]['daysToDecision']['n'] if doc[v].get('daysToDecision') else 0}" for v in VISAS if v in doc))
    print(f"ok perm_docs[{DOC_KEY}]  {len(text):,}B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
