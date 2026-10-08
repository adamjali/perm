"""Ask DOL about only the cases someone is waiting to hear about.

The full and pending sweeps ask about every case twice a day, so a watched
case could change and its subscriber hear up to twelve hours later.

Since Oct 7 2026 the server runs this every 5 minutes (`permtracker-watched.
timer`): `--cadence` lets it through every time on weekdays from 7 AM to 9 PM
Eastern, when DOL decides cases, and on the half hour otherwise.
`--from-convex` reads the list from Convex's `GET /watched-cases` (case
numbers only, never an address) and `--sweep` asks Convex's
`POST /watched-cases/sweep` to send the alerts as soon as anything moved.
Both routes need WATCHED_CASES_SECRET. `watched-cases.yml` still runs it by
hand from a file.

SAME DOL CLIENT, SAME SOURCE, SAME TABLES as the sweeps, so a change recorded
here is the change the sweep would have recorded a few hours later, and every
downstream reader (decision counts, the RFI funnel, the census) treats it the
same way.

SAFE BESIDE A RUNNING SWEEP. The workflow skips an hour a sweep is running,
but a sweep can still start during this run. So every write is conditional:
the status UPDATE applies only while the row still holds the status this run
read, and the event row is inserted only when that UPDATE changed a row
(`changes() > 0` on the same connection). A sweep that already recorded the
move leaves this run nothing to do, and the reverse is guarded the same way
in the sweeps' own snapshot comparison.

    python3 scripts/check_watched_cases.py watched.json
    python3 scripts/check_watched_cases.py watched.json --dry-run
    python3 scripts/check_watched_cases.py --from-convex --cadence --sweep

Prints `CHANGED=<n>` last, for the workflow to decide whether to run alerts.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
import time
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_flag_serials import PERM_OFFICE_PREFIXES  # noqa: E402
from lib_turso import Turso, query_rows, read_doc, record_run, run_stmts, stmt, write_doc  # noqa: E402
import ingest_case_status_direct as perm  # noqa: E402
import ingest_pwd_status_direct as flag  # noqa: E402

BATCH = perm.BATCH
PACE_S = perm.PACE_S
SCRIPT = "check_watched_cases.py"


def split_programs(numbers: list[str]) -> dict[str, list[str]]:
    """PERM numbers and each FLAG program's, each list deduplicated and sorted.
    Anything that matches no program's prefixes is dropped."""
    out: dict[str, set[str]] = {"perm": set(), **{name: set() for name in flag.PROGRAMS}}
    for raw in numbers:
        cn = (raw or "").strip().upper()
        if cn.startswith(PERM_OFFICE_PREFIXES):
            out["perm"].add(cn)
            continue
        prog = next((p for pfx, p in flag.PREFIX_TO_PROGRAM.items() if cn.startswith(pfx)), None)
        if prog in out:
            out[prog].add(cn)
    return {k: sorted(v) for k, v in out.items()}


def tables_for(program: str) -> tuple[str, str]:
    if program == "perm":
        return "perm_case_status", "perm_case_events"
    cfg = flag.PROGRAMS[program]
    return cfg["table"], cfg["events"]


def final_for(program: str, status: str) -> int:
    if program == "perm":
        return 1 if status.upper() in perm.FINAL_STATUSES else 0
    return flag.is_final(status, program)


def plan_changes(program: str, stored: dict[str, list], answers: list[dict], stamp: int) -> list[dict]:
    """The conditional writes for every watched case whose status moved.

    `stored` maps case number -> [current_status, employer_name, job_title].
    Pure, so the test pins the guard: nothing is planned for an unchanged or
    blank answer, and every UPDATE is conditioned on the status it read.
    """
    table, events = tables_for(program)
    stmts: list[dict] = []
    for v in answers:
        cn = v.get("caseNumber")
        old = stored.get(cn)
        if not old:
            continue
        new = (v.get("caseStatus") or "").strip()
        was = (old[0] or "").strip()
        if not new or new == was:
            continue
        fin = final_for(program, new)
        extra = ", visa_type=COALESCE(?, visa_type)" if program != "perm" else ""
        extra_args = [(v.get("visaType") or "").strip() or None] if program != "perm" else []
        stmts.append({
            "sql": f"UPDATE {table} SET current_status=?, is_final=?, employer_name=?, job_title=?, "
                   f"source=?, fetched_at=?{extra} WHERE case_number=? AND current_status=?",
            "args": [new, fin, v.get("employerName") or old[1], v.get("jobTitle") or old[2],
                     perm.SOURCE, stamp, *extra_args, cn, old[0]],
            "case": cn,
        })
        # Inserted only when the UPDATE above changed a row: if a sweep got
        # there first, the row no longer holds `old` and this adds nothing.
        stmts.append({
            "sql": f"INSERT OR IGNORE INTO {events} (case_number, changed_at, from_status, to_status, "
                   f"to_final, source) SELECT ?,?,?,?,?,? WHERE changes() > 0",
            "args": [cn, stamp, was, new, fin, perm.SOURCE],
            "case": cn,
        })
    return stmts


# Even, so an UPDATE and the INSERT that tests its changes() share a request.
STMTS_PER_REQUEST = 100


def apply(db: Turso, stmts: list[dict]) -> int:
    """Run the planned pairs in order on one connection (so `changes()` refers
    to the UPDATE just before each INSERT); returns updates that applied."""
    counts = run_stmts(db, [stmt(s["sql"], s["args"]) for s in stmts], STMTS_PER_REQUEST)
    return sum(1 for s, n in zip(stmts, counts) if s["sql"].startswith("UPDATE") and n)


def check(db: Turso, program: str, numbers: list[str], dry: bool) -> dict:
    table, _ = tables_for(program)
    stored: dict[str, list] = {}
    for i in range(0, len(numbers), 200):
        chunk = numbers[i:i + 200]
        q = ",".join("?" * len(chunk))
        for r in query_rows(db, f"SELECT case_number, current_status, employer_name, job_title "
                                f"FROM {table} WHERE case_number IN ({q})", chunk):
            stored[r[0]] = list(r[1:])
    stamp = int(time.time() * 1000)
    asked = moved = requests = 0
    unknown_hits: list[dict] = []
    stmts: list[dict] = []
    for i in range(0, len(numbers), BATCH):
        chunk = numbers[i:i + BATCH]
        requests += 1
        got = perm.lookup_with_retry(chunk)
        asked += len(chunk)
        # The endpoint is a SEARCH: it answers with near matches for numbers
        # it does not hold. Only the numbers asked about count.
        wanted = set(chunk)
        got = [v for v in got if v.get("caseNumber") in wanted]
        unknown_hits += [v for v in got if v.get("caseNumber") not in stored]
        stmts += plan_changes(program, stored, got, stamp)
        time.sleep(PACE_S)
    moved = sum(1 for s in stmts if s["sql"].startswith("UPDATE"))
    applied = 0 if dry else apply(db, stmts)
    inserted = 0
    if unknown_hits and not dry:
        # Watched but never seen by a sweep: record it the way discovery does.
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if program == "perm":
            inserted = perm._insert_perm_hits(db, unknown_hits, now_iso, stamp)
        else:
            inserted = flag.insert_hits(db, unknown_hits, perm.DISCOVERY_SOURCE)
    return {"program": program, "watched": len(numbers), "asked": asked, "requests": requests,
            "moved": moved, "applied": applied, "inserted": inserted}


ET = ZoneInfo("America/New_York")


def due(now: datetime.datetime) -> bool:
    """The cadence: every run on weekdays from 7 AM to 9 PM Eastern, when DOL
    decides cases; otherwise only the run that lands in the first five minutes
    of a half hour (the timer fires every 5 minutes)."""
    et = now.astimezone(ET)
    if et.weekday() < 5 and 7 <= et.hour < 21:
        return True
    return et.minute % 30 < 5


def convex_site() -> str:
    site = os.environ.get("CONVEX_SITE_URL", "").strip()
    if not site:
        cloud = os.environ.get("NEXT_PUBLIC_CONVEX_URL", "").strip()
        site = cloud.replace(".convex.cloud", ".convex.site")
    if not site.startswith("https://"):
        raise SystemExit("CONVEX_SITE_URL (or NEXT_PUBLIC_CONVEX_URL) is not set")
    return site.rstrip("/")


def convex_call(path: str, method: str = "GET") -> dict:
    secret = os.environ.get("WATCHED_CASES_SECRET", "").strip()
    if not secret and os.environ.get("WATCHED_CASES_SECRET_FILE"):
        secret = Path(os.environ["WATCHED_CASES_SECRET_FILE"]).read_text().strip()
    if not secret:
        raise SystemExit("WATCHED_CASES_SECRET is not set")
    req = urllib.request.Request(convex_site() + path, method=method, data=b"" if method == "POST" else None,
                                 headers={"x-watched-secret": secret, "User-Agent": "permtracker-watched/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"{}")


# The scorecard records the date each subscriber's case page showed, once per
# case (src/lib/turso/predictions.ts, predictWatched). It reads the list from
# this doc: case numbers only, never an address. Written only when it changed.
WATCHED_DOC = "watched_cases"


def keep_watched_list(db, numbers: list[str]) -> bool:
    """Store the watched case numbers when the set differs from the stored one."""
    want = sorted({n.strip().upper() for n in numbers if n and n.strip()})
    have = read_doc(db, WATCHED_DOC) or {}
    if sorted(have.get("caseNumbers") or []) == want:
        return False
    write_doc(db, WATCHED_DOC, {"caseNumbers": want, "count": len(want)})
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("file", nargs="?", help="JSON from watchedCases:watchedCaseNumbers ({caseNumbers: [...]}), or a bare list")
    ap.add_argument("--from-convex", action="store_true", help="Read the list from Convex's GET /watched-cases instead of a file.")
    ap.add_argument("--cadence", action="store_true", help="Exit quietly unless this run is due (see due()).")
    ap.add_argument("--sweep", action="store_true", help="When anything moved, ask Convex to send the alerts now.")
    ap.add_argument("--dry-run", action="store_true", help="Ask DOL and plan, write nothing.")
    a = ap.parse_args()
    started = time.time()
    if a.cadence and not due(datetime.datetime.now(datetime.timezone.utc)):
        print("not due; CHANGED=0")
        return 0
    if a.from_convex:
        doc = convex_call("/watched-cases")
    elif a.file:
        doc = json.loads(Path(a.file).read_text())
    else:
        ap.error("give a file or --from-convex")
    numbers = doc.get("caseNumbers", []) if isinstance(doc, dict) else doc
    groups = split_programs(numbers)
    db = Turso()
    if not a.dry_run and a.from_convex:
        try:
            keep_watched_list(db, numbers)
        except Exception as exc:  # noqa: BLE001 - the list is for the scorecard; the check goes on
            print(f"::warning::watched list not kept: {exc}")
    results, failed = [], []
    for program, nums in groups.items():
        if not nums:
            continue
        try:
            results.append(check(db, program, nums, a.dry_run))
        except Exception as exc:  # noqa: BLE001
            failed.append(f"{program}: {exc}")
    changed = sum(r["applied"] + r["inserted"] for r in results)
    note = "; ".join(
        f"{r['program']} {r['watched']} watched, {r['moved']} moved, {r['applied']} written"
        + (f", {r['inserted']} new" if r["inserted"] else "")
        for r in results) or "nothing watched"
    if failed:
        note += "; FAILED " + "; ".join(failed)
    print(note)
    swept = ""
    if a.sweep and changed and not a.dry_run:
        try:
            convex_call("/watched-cases/sweep", "POST")
            swept = "; alerts asked for"
        except Exception as exc:  # noqa: BLE001
            # The Convex crons still sweep twice a day, so a refused call delays the email, never loses it.
            swept = f"; alert call failed ({exc})"
        print(swept.lstrip("; "))
    # Every 5 minutes is 288 runs a day: record the ones that changed or
    # failed something, and one an hour so the health check sees it alive.
    on_the_hour = datetime.datetime.now(datetime.timezone.utc).minute < 5
    if not a.dry_run and (changed or failed or swept or on_the_hour or not a.cadence):
        # A DOL refusal is named but is not a broken ingest: the sweeps cover
        # every case twice a day anyway, and the next run tries again.
        record_run(db, SCRIPT, status="ok", rows_written=changed, note=note + swept, started_at=started)
    print(f"CHANGED={changed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
