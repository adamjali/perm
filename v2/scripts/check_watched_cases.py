"""Ask DOL, every hour, about only the cases someone is waiting to hear about.

WHY (2026-09-26). The full and pending sweeps ask about every case twice a
day, so a watched case could change and its subscriber hear up to twelve hours
later. Two rivals now sell "hourly checks" as a paid plan. `watched-cases.yml`
runs this every hour with the list from Convex (`watchedCases:
watchedCaseNumbers`: case numbers only, never an address), then runs the
existing alert sweeps when anything moved.

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

Prints `CHANGED=<n>` last, for the workflow to decide whether to run alerts.
"""

from __future__ import annotations

import argparse
import datetime
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_turso import Turso, record_run  # noqa: E402
import ingest_case_status_direct as perm  # noqa: E402
import ingest_pwd_status_direct as flag  # noqa: E402

BATCH = perm.BATCH
PACE_S = perm.PACE_S
SCRIPT = "check_watched_cases.py"


def split_programs(numbers: list[str]) -> dict[str, list[str]]:
    """PERM, PWD and LCA numbers, each list deduplicated and sorted.
    Anything that matches no program's prefixes is dropped."""
    out: dict[str, set[str]] = {"perm": set(), "pwd": set(), "lca": set()}
    for raw in numbers:
        cn = (raw or "").strip().upper()
        if cn.startswith(perm.PERM_PREFIXES):
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


def _arg(a):
    if a is None:
        return {"type": "null"}
    if isinstance(a, int):
        return {"type": "integer", "value": str(a)}
    return {"type": "text", "value": str(a)}


def apply(db: Turso, stmts: list[dict]) -> int:
    """Run the planned pairs in order on ONE connection (so `changes()` refers
    to the UPDATE just before each INSERT); returns updates that applied."""
    applied = 0
    for i in range(0, len(stmts), 100):
        chunk = stmts[i:i + 100]
        out = db.pipeline([{"type": "execute", "stmt": {"sql": s["sql"], "args": [_arg(a) for a in s["args"]]}}
                           for s in chunk] + [{"type": "close"}])
        results = out.get("results", []) if isinstance(out, dict) else []
        for s, r in zip(chunk, results):
            if s["sql"].startswith("UPDATE"):
                n = (r.get("response", {}).get("result", {}) or {}).get("affected_row_count", 0)
                applied += 1 if n else 0
    return applied


def check(db: Turso, program: str, numbers: list[str], dry: bool) -> dict:
    table, _ = tables_for(program)
    stored: dict[str, list] = {}
    for i in range(0, len(numbers), 200):
        chunk = numbers[i:i + 200]
        q = ",".join("?" * len(chunk))
        for r in perm._rows(db, f"SELECT case_number, current_status, employer_name, job_title "
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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("file", help="JSON from watchedCases:watchedCaseNumbers ({caseNumbers: [...]}), or a bare list")
    ap.add_argument("--dry-run", action="store_true", help="Ask DOL and plan, write nothing.")
    a = ap.parse_args()
    started = time.time()
    doc = json.loads(Path(a.file).read_text())
    numbers = doc.get("caseNumbers", []) if isinstance(doc, dict) else doc
    groups = split_programs(numbers)
    db = Turso()
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
    if not a.dry_run:
        # A DOL refusal is named but is not a broken ingest: the sweeps cover
        # every case twice a day anyway, and next hour tries again.
        record_run(db, SCRIPT, status="ok", rows_written=changed, note=note, started_at=started)
    print(f"CHANGED={changed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
