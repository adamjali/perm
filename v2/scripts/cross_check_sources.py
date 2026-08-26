#!/usr/bin/env python3
"""Cross-check our figures against permtrack.app's public API.

Adam asked for a live sync from permtrack and the attorney requested it. What
measurement found instead is worth stating plainly, because it changes what is
worth building:

**Their entire live scrape produces `pwd_months: [4, 6]`.** Their
/api/stats/timeline-data carries a `sources` block with a live flag per
dataset, and only `pwd` is true - visa_bulletin, i140 and i485 are all
live:false. The `flag_checked` timestamp that updates every few minutes is
them polling flag.dol.gov/processingtimes, the same public page we ingest
first-party, and OUR parse of it is strictly richer: three named PERM queues
with their frontier months, four PWD programs with OEWS and non-OEWS receipt
dates, and the backlog - against their two-number summary.

So there is no live data of theirs worth importing. What IS worth having is
this: a second independent read of the same public sources, so a divergence
tells us one of us has a parsing bug. That is the honest use of a competitor's
public API, and it costs them four requests a day.

Exit 1 only on a divergence that indicates a real defect (a cutoff we both
publish for the same month disagreeing). Anything explained by different
corpus windows is reported and does not fail.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso  # noqa: E402

BASE = "https://permtrack.app/api"
UA = {"User-Agent": "permtracker.app cross-check (contact: notifications@permtracker.app)",
      "Accept": "application/json"}

# Their spelling -> ours, for the bulletin comparison.
COUNTRY = {"Rest of World": "worldwide", "China": "china", "India": "india",
           "Mexico": "mexico", "Philippines": "philippines"}
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
          "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def get(path: str):
    req = urllib.request.Request(f"{BASE}/{path}", headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read())


def norm(cell) -> str | None:
    """Their cutoff spelling -> ours (C / U / DDMMMYY)."""
    if cell is None:
        return None
    if cell == "Current":
        return "C"
    if cell == "Unavailable":
        return "U"
    try:
        d = dt.date.fromisoformat(cell)
    except (TypeError, ValueError):
        return str(cell)
    return f"{d.day:02d}{MONTHS[d.month - 1]}{d.year % 100:02d}"


def log(m: str) -> None:
    print(m, flush=True)


def main() -> int:
    db = Turso()
    findings: list[str] = []

    log("CROSS-CHECK vs permtrack.app public API")

    # -- 1. What is actually live on their side ----------------------------
    tl = get("stats/timeline-data")
    live = {k: v.get("live") for k, v in tl.get("sources", {}).items()}
    log(f"  their live sources: {live}")
    if any(v for k, v in live.items() if k != "pwd"):
        # Worth knowing the day it changes: it would mean they started
        # publishing something live that we would want to look at.
        findings.append(f"NEW: they now report live sources beyond pwd: {live}")

    fresh = get("stats/data-freshness")
    log(f"  their oflc_through: {fresh.get('oflc_through')}  "
        f"flag_checked: {fresh.get('flag_checked')}")

    # -- 2. Our disclosure window against theirs ---------------------------
    ours_max = db.scalar("SELECT max(decision_date) FROM perm_cases")
    ours_n = int(db.scalar("SELECT count(*) FROM perm_cases") or 0)
    theirs = get("stats/summary")
    log(f"  cases  ours {ours_n:,} through {ours_max}  |  "
        f"theirs {theirs.get('total'):,} through {theirs.get('max_decision_date')}")
    if str(ours_max) < str(theirs.get("max_decision_date") or ""):
        findings.append(
            f"STALE: their disclosure data reaches {theirs.get('max_decision_date')} "
            f"and ours stops at {ours_max} - a quarterly file we have not ingested")

    # -- 3. The visa bulletin, cell by cell --------------------------------
    # The one comparison that can prove a parsing bug: same published month,
    # same category, same country, two independent reads.
    vb = tl.get("visa_bulletin") or {}
    their_month_name = vb.get("month")  # e.g. "September 2026"
    their_cells = vb.get("cutoffs") or {}
    row = db.execute(
        "SELECT bulletin_month, final_action FROM visa_bulletins "
        "ORDER BY bulletin_month DESC LIMIT 1")["response"]["result"]["rows"]
    if row and their_month_name:
        our_month, our_fa = row[0][0]["value"], json.loads(row[0][1]["value"])
        try:
            tm = dt.datetime.strptime(their_month_name, "%B %Y").strftime("%Y-%m")
        except ValueError:
            tm = None
        log(f"  bulletin  ours {our_month}  |  theirs {tm} ({their_month_name})")
        if tm == our_month:
            compared = mismatched = 0
            for their_cat, cells in their_cells.items():
                cat = their_cat.replace("-", "")          # "EB-2" -> "EB2"
                if cat not in our_fa:
                    continue
                for their_country, cell in cells.items():
                    ours_key = COUNTRY.get(their_country)
                    if not ours_key or ours_key not in our_fa[cat]:
                        continue
                    compared += 1
                    a, b = our_fa[cat][ours_key], norm(cell)
                    if a != b:
                        mismatched += 1
                        findings.append(
                            f"CUTOFF MISMATCH {our_month} {cat}/{ours_key}: "
                            f"ours={a} theirs={b}")
            log(f"    compared {compared} cutoff cells, {mismatched} disagree")
        elif tm and tm > our_month:
            findings.append(
                f"BEHIND: they publish the {tm} bulletin and our newest is {our_month}")

    # -- 4. Their live PWD summary against our full parse -------------------
    pwd = tl.get("pwd_months")
    j = db.scalar("SELECT json FROM processing_times ORDER BY rowid DESC LIMIT 1")
    if j:
        ours = json.loads(str(j))
        perm_pwd = next((q for q in ours.get("pwdQueues", [])
                         if q.get("program") == "PERM"), None)
        log(f"  pwd  theirs {pwd} months (their ONLY live figure)  |  "
            f"ours PERM oews={perm_pwd and perm_pwd.get('oewsReceiptDate')} "
            f"non-oews={perm_pwd and perm_pwd.get('nonOewsReceiptDate')} "
            f"as-of {ours.get('pwdAsOf')}")

    log("")
    if findings:
        log(f"  {len(findings)} finding(s):")
        for f in findings:
            log(f"    {f}")
        # Only a real cutoff disagreement or our own staleness is a failure.
        hard = [f for f in findings if f.startswith(("CUTOFF MISMATCH", "STALE", "BEHIND"))]
        return 1 if hard else 0
    log("  no divergence: both reads agree everywhere they overlap")
    return 0


if __name__ == "__main__":
    sys.exit(main())
