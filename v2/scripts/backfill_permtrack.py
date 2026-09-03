#!/usr/bin/env python3
"""Backfill from permtrack.app's public API, with provenance on every row.

APPROVED EXPLICITLY by Adam (and requested by the reviewing attorney) on
2026-08-26, after the concern was raised and reaffirmed. The line held here:
we take FACTUAL, DOL/State-originated records only - visa bulletin cutoffs
and daily decision counts, which are facts about government processes - and
never their derived products (risk scores, prose, formulas). Every imported
row carries its source, and first-party collection replaces this over time.

WHAT MEASUREMENT SHOWED BEFORE WRITING ANY OF THIS:
- Their disclosure data ends 2026-03-31; ours runs to 2026-06-30. Their case
  browser has nothing we lack.
- Their decisions-per-day series ALSO ends 2026-03-31 and their daily-scan
  feature flag is off: it is file-derived, not live. So we derive our OWN
  daily series from our own corpus (26 months vs their 3) and keep theirs
  purely as cross-validation.
- The one real asset: their visa-bulletin mirror runs 2023-10 through
  2026-09 for EB-1/2/3 x 5 countries, while travel.state.gov blocks every
  automated route (including the Internet Archive since mid-July 2026) and
  our own table held 10 scattered months.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, lit  # noqa: E402

BASE = "https://permtrack.app/api/stats"
UA = {"User-Agent": "permtracker.app data-backfill (contact: notifications@permtracker.app)",
      "Accept": "application/json"}

# Their vocabulary -> ours. Probed 2026-08-26: EB-4/EB-5/Other Workers return
# a junk single row, so the mirror is EB-1/2/3 only - the PERM-relevant rows.
CATS = {"EB-1": "EB1", "EB-2": "EB2", "EB-3": "EB3"}
COUNTRIES = {"Rest of World": "worldwide", "China": "china", "India": "india",
             "Mexico": "mexico", "Philippines": "philippines"}

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
          "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def get(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read())


def cutoff(iso: str | None, current: bool, unavailable: bool) -> str | None:
    """Their {iso, flags} triple -> our C / U / DDMMMYY cell format."""
    if unavailable:
        return "U"
    if current:
        return "C"
    if not iso:
        return None
    d = dt.date.fromisoformat(iso)
    return f"{d.day:02d}{MONTHS[d.month - 1]}{d.year % 100:02d}"


def log(m): print(m, flush=True)


def backfill_bulletins(db: Turso) -> tuple[int, int]:
    res = db.execute("SELECT bulletin_month FROM visa_bulletins")
    have = {r[0]["value"] for r in res["response"]["result"]["rows"]}
    log(f"  bulletins already stored: {len(have)} months")

    # month -> chart -> category -> country -> cell
    fa: dict[str, dict] = {}
    dof: dict[str, dict] = {}
    for their_cat, our_cat in CATS.items():
        for their_c, our_c in COUNTRIES.items():
            q = urllib.parse.urlencode({"category": their_cat, "country": their_c})
            rows = get(f"{BASE}/visa-bulletin?{q}")
            if not isinstance(rows, list) or len(rows) < 12:
                log(f"    !! unexpected shape for {their_cat}/{their_c}: {str(rows)[:80]}")
                continue
            for row in rows:
                month = row["bulletin_date"][:7]
                fa.setdefault(month, {}).setdefault(our_cat, {})[our_c] = cutoff(
                    row.get("fad_cutoff"), row.get("fad_is_current"), row.get("fad_is_unavailable"))
                dof.setdefault(month, {}).setdefault(our_cat, {})[our_c] = cutoff(
                    row.get("dof_cutoff"), row.get("dof_is_current"), row.get("dof_is_unavailable"))
            time.sleep(0.3)  # politeness; 15 requests total

    missing = sorted(m for m in fa if m not in have)
    log(f"  their mirror holds {len(fa)} months; we lack {len(missing)}: {missing}")
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    stamp = int(time.time() * 1000)
    for m in missing:
        # Drop None cells (their series had no value) rather than storing them.
        fac = {c: {k: v for k, v in row.items() if v} for c, row in fa[m].items()}
        dfc = {c: {k: v for k, v in row.items() if v} for c, row in dof[m].items()}
        db.execute(
            "INSERT OR IGNORE INTO visa_bulletins "
            "(bulletin_month, source_url, archived_at, final_action, dates_for_filing, computed_at) "
            "VALUES (?,?,?,?,?,?)",
            [m,
             "https://permtrack.app/api/stats/visa-bulletin (mirror; original: travel.state.gov)",
             now, json.dumps(fac), json.dumps(dfc), stamp])
    return len(fa), len(missing)


def daily_decisions(db: Turso) -> None:
    db.execute("""CREATE TABLE IF NOT EXISTS daily_decisions (
        date TEXT NOT NULL, source TEXT NOT NULL,
        total INTEGER, certified INTEGER, denied INTEGER, withdrawn INTEGER,
        fetched_at INTEGER NOT NULL, PRIMARY KEY (date, source))""")

    # OURS, derived from our own corpus - 26 months of it. certified_expired
    # counts as certified in their series; ours has no such status.
    stamp = int(time.time() * 1000)
    db.execute("DELETE FROM daily_decisions WHERE source='dol-disclosure'")
    db.execute("""INSERT INTO daily_decisions
        SELECT decision_date, 'dol-disclosure', count(*),
               sum(status='certified'), sum(status='denied'), sum(status='withdrawn'), ?
        FROM perm_cases WHERE decision_date IS NOT NULL GROUP BY decision_date""", [stamp])
    ours = int(db.scalar("SELECT count(*) FROM daily_decisions WHERE source='dol-disclosure'") or 0)
    log(f"  daily series (ours, from perm_cases): {ours} days")

    # THEIR DAILY SERIES IS NO LONGER STORED, and the 88 rows it had written
    # were deleted on 2026-09-03. It was kept for a cross-check and became a
    # hazard instead: `daily_decisions` is keyed (date, source), their series
    # overlapped `dol-disclosure` on all 88 of its dates, and any reader that
    # summed the table by date - which `backtest_models.py` and
    # `backtest_pace.py` both did - counted 42,056 decisions twice.
    #
    # The comparison it existed for has also been answered: their numbers came
    # from scanning flag.dol.gov per case, and since 2026-08-27 we scan the
    # same endpoint ourselves. `ingest_case_status_direct.py` writes our own
    # observed series as `sweep-observed`, from `perm_case_events`, on every
    # sweep. Re-adding a second writer with a different notion of truth is the
    # flip-flop this project already retired `mirror_case_status.py` over.
    #
    # If a one-off comparison is ever wanted again, fetch it and print it. Do
    # not store it in a table the website reads.


def freshness(db: Turso, vb_max: str) -> None:
    db.execute("""CREATE TABLE IF NOT EXISTS data_freshness (
        dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
        source TEXT, cadence TEXT, note TEXT)""")
    stamp = int(time.time() * 1000)
    perm_asof = db.scalar("SELECT max(perm_as_of) FROM processing_times")
    rows = [
        ("perm-cases", "2026-06-30", "DOL quarterly disclosure files (flag.dol.gov)",
         "Quarterly, a few days after each federal quarter",
         "373,939 decided cases, FY2024-FY2026"),
        ("processing-times", str(perm_asof), "DOL FLAG (flag.dol.gov/processingtimes)",
         "Weekly", "DOL's own as-of date"),
        ("visa-bulletin", vb_max, "State Dept via Internet Archive; gaps via permtrack.app mirror",
         "Monthly", "travel.state.gov refuses automated clients incl. the Archive since Jul 2026"),
        ("daily-decisions", str(db.scalar("SELECT max(date) FROM daily_decisions WHERE source='dol-disclosure'")),
         "Derived from the disclosure corpus", "Quarterly with the files",
         "Per-day counts computed from per-case decision dates"),
        ("uscis-i140-times", "2026-08-17", "USCIS processing-times page (egov.uscis.gov), dated mirror",
         "Checked on update; USCIS revises monthly", "Per-subtype published ranges"),
        ("entities", "2026-08-26", "Derived from the disclosure corpus",
         "Rebuilt with each quarterly ingest", "79,386 employers, firms and occupations"),
    ]
    for ds, asof, src, cad, note in rows:
        db.execute("INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?)",
                   [ds, asof, stamp, src, cad, note])
    log(f"  data_freshness registry: {len(rows)} datasets")


def main() -> int:
    db = Turso()
    total, added = backfill_bulletins(db)
    daily_decisions(db)
    vb_max = db.scalar("SELECT max(bulletin_month) FROM visa_bulletins")
    freshness(db, str(vb_max))
    got = int(db.scalar("SELECT count(*) FROM visa_bulletins") or 0)
    log(f"  VERIFY: visa_bulletins now holds {got} months (max {vb_max}); mirror added {added}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
