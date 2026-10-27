#!/usr/bin/env python3
"""The pure parts of the PWD ingest: day codes, serials, batching, finality.

    python3 scripts/test_pwd_status.py
"""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from ingest_pwd_status_direct import (  # noqa: E402
    BATCH, PREFIX, PWD_FINAL, RESUME_QUIET_HOURS, candidate_batches, day_code,
    is_final, resume_decision, serial_of,
)

FAILURES: list[str] = []


def check(name: str, got, want) -> None:
    if got == want:
        print(f"  ok   {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL {name}\n         got  {got!r}\n         want {want!r}")


def sweep_heals_stale_flags() -> None:
    """A row stored before its status joined the final set is fixed by the
    next pass with no event, and a row whose flag already agrees is not
    written at all."""
    import ingest_pwd_status_direct as m

    stored = [  # case, status, employer, title, is_final AS libSQL returns it
        ("P-400-25308-369253", "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION", "A", "t", "0"),
        ("P-400-25325-428824", "BALCA OVERTURNED", "B", "t", "0"),
        ("H-300-26246-000001", "IN PROCESS", "C", "t", "0"),
        ("H-300-26246-000002", "FULL CERTIFICATION", "D", "t", "1"),
        # A rejection stored while NOR ISSUED was still filed as pending.
        ("C-500-26100-000003", "NOR ISSUED", "E", "t", "0"),
        # DOL's file records a decision; its live service still says IN PROCESS.
        ("H-400-25321-412193", "IN PROCESS", "F", "t", "0"),
    ]
    # What the "decided in DOL's file" query returns: only the IN PROCESS row
    # the file holds. An appeal is never in it (its status is not the rule's).
    in_file = [("H-400-25321-412193",)]
    writes: list[dict] = []
    saved = (m.query_rows, m.lookup_with_retry, m.run_stmts, m.record_sweep, m.time.sleep)
    try:
        m.query_rows = lambda db, sql, args=None: in_file if "JOIN seasonal_cases" in sql else stored
        m.lookup_with_retry = lambda nums: [
            {"caseNumber": c, "caseStatus": st} for c, st, *_ in stored if c in nums]
        m.run_stmts = lambda db, stmts, per_request=200: writes.extend(stmts) or [1] * len(stmts)
        m.record_sweep = lambda *a, **k: None
        m.time.sleep = lambda s: None
        m.sweep(None, "seasonal", pending_only=True, limit=None)
    finally:
        m.query_rows, m.lookup_with_retry, m.run_stmts, m.record_sweep, m.time.sleep = saved
    sqls = [w["stmt"]["sql"] for w in writes]
    fixed = sorted(w["stmt"]["args"][1]["value"] for w in writes
                   if w["stmt"]["sql"].startswith("UPDATE seasonal_case_status SET is_final"))
    check("every stale row gets its flag fixed, and only those", fixed,
          ["C-500-26100-000003", "H-400-25321-412193", "P-400-25308-369253", "P-400-25325-428824"])
    check("each fix sets the case finished",
          sorted({w["stmt"]["args"][0]["value"] for w in writes}), ["1"])
    check("a heal writes no event (nothing moved)",
          any("seasonal_case_events" in q for q in sqls), False)
    check("rows whose flag agrees are not written", len(writes), 4)
    check("DOL's status word is never rewritten by a heal",
          any("current_status" in q for q in sqls), False)


def active_pass_band() -> None:
    """The daytime pass asks only about the requests DOL is working: in process,
    PERM wage requests, filed up to a week past the newest filing day DOL
    decided in the last week; and it records itself as its own mode."""
    import ingest_pwd_status_direct as m
    from lib_sqlite_shim import SqliteTurso

    db = SqliteTurso()
    db.script([
        "CREATE TABLE pwd_case_status (case_number TEXT PRIMARY KEY, filing_date TEXT, current_status TEXT, "
        "is_final INTEGER, employer_name TEXT, job_title TEXT, visa_type TEXT)",
        "CREATE TABLE pwd_case_events (case_number TEXT, changed_at INTEGER, from_status TEXT, to_status TEXT, "
        "to_final INTEGER, source TEXT)",
    ])
    today = datetime.date(2026, 10, 27)
    day_ms = lambda d: int(datetime.datetime.combine(d, datetime.time(5, 40), tzinfo=m.ET).timestamp() * 1000)
    db.conn.executemany("INSERT INTO pwd_case_status VALUES (?,?,?,?,?,?,?)", [
        ("P-100-26190-000001", "2026-07-17", "DETERMINATION ISSUED", 1, "A", "t", "PERM"),  # decided lately
        ("P-100-26200-000002", "2026-07-19", "IN PROCESS", 0, "B", "t", "PERM"),             # in the band
        ("P-100-26205-000003", "2026-07-24", "IN PROCESS", 0, "C", "t", None),               # a week past: in
        ("P-100-26210-000004", "2026-07-29", "IN PROCESS", 0, "D", "t", "PERM"),             # past the band
        ("P-100-26200-000005", "2026-07-19", "IN PROCESS", 0, "E", "t", "H-1B"),             # not a PERM wage
        ("P-200-26200-000006", "2026-07-19", "IN PROCESS", 0, "F", "t", None),               # another office
        ("P-100-26150-000007", "2026-05-30", "CENTER DIRECTOR REVIEW", 0, "G", "t", "PERM"), # not in process
    ])
    db.conn.executemany("INSERT INTO pwd_case_status VALUES (?,?,?,?,?,?,?)", [
        ("P-100-26290-000008", "2026-10-17", "WITHDRAWN", 1, "H", "t", "PERM"),  # the employer's act
    ])
    db.conn.executemany("INSERT INTO pwd_case_events VALUES (?,?,?,?,?,?)", [
        ("P-100-26190-000001", day_ms(datetime.date(2026, 10, 26)), "IN PROCESS", "DETERMINATION ISSUED", 1, "x"),
        ("P-100-26290-000008", day_ms(datetime.date(2026, 10, 26)), "IN PROCESS", "WITHDRAWN", 1, "x"),
    ])
    db.conn.commit()
    through = m.active_through(db, today)
    check("the band ends a week past the newest filing day DOL decided", through, "2026-07-24")
    asked: list[str] = []
    recorded: dict = {}
    saved = (m.lookup_with_retry, m.record_sweep, m.time.sleep, m.decided_in_file)
    try:
        m.lookup_with_retry = lambda nums: asked.extend(nums) or [{"caseNumber": c, "caseStatus": "IN PROCESS"} for c in nums]
        m.record_sweep = lambda *a, **k: recorded.update(k)
        m.time.sleep = lambda s: None
        m.decided_in_file = lambda db, program: set()
        m.sweep(db, "pwd", pending_only=True, limit=None, active_through_day=through)
    finally:
        m.lookup_with_retry, m.record_sweep, m.time.sleep, m.decided_in_file = saved
    check("it asks only the in-process PERM wage requests in the band", sorted(asked),
          ["P-100-26200-000002", "P-100-26205-000003"])
    check("it records itself as the active mode, never a check of every case",
          (recorded.get("mode"), recorded.get("complete")), ("active", True))
    db.conn.execute("UPDATE pwd_case_events SET changed_at = ?", [day_ms(datetime.date(2026, 10, 10))])
    db.conn.commit()
    check("no decision in the last week means nothing to check", m.active_through(db, today), None)


def run_status_and_exit() -> None:
    """A pass with cases to check that checked none is failed and red; one DOL
    stopped answering is partial; two failed docs or a lost run row are red,
    as in the PERM sweep."""
    import ingest_pwd_status_direct as m

    clean = {"pwd": {"todo": 900, "checked": 900, "truncated": False},
             "lca": {"todo": 0, "checked": 0, "truncated": False}}
    check("a clean pass is ok, an empty LCA pass included", m.pass_status(clean, 0), "ok")
    check("cases to check and none answered is failed",
          m.pass_status({"pwd": {"todo": 900, "checked": 0, "truncated": True}}, 0), "failed")
    check("a pass DOL stopped answering is partial",
          m.pass_status({"pwd": {"todo": 900, "checked": 300, "truncated": True}}, 0), "partial")
    check("one failed doc is partial", m.pass_status(clean, 1), "partial")
    check("one failed doc keeps the run green", m._tail_exit([("pwd", "x")]), 0)
    check("two failed docs turn the run red", m._tail_exit([("pwd", "x"), ("lca", "y")]), 1)
    check("a run row that never landed turns the run red", m._tail_exit([], recorded=False), 1)
    check("a program swept for nothing turns the run red", m._tail_exit([], swept_nothing=True), 1)


def main() -> int:
    print("pwd status ingest")
    run_status_and_exit()
    active_pass_band()
    # The day code is YYDDD from a real date, year boundary included.
    check("day code for 2026-08-28 is 26240", day_code(datetime.date(2026, 8, 28)), "26240")
    check("day code for 2026-01-01 is 26001", day_code(datetime.date(2026, 1, 1)), "26001")
    check("day code for 2025-12-31 is 25365", day_code(datetime.date(2025, 12, 31)), "25365")

    # The serial is the last segment, for either prefix.
    check("serial of a P- number", serial_of("P-100-26240-200135"), 200135)
    check("serial of a G- number", serial_of("G-100-26240-200246"), 200246)
    check("serial of junk is None", serial_of("A-23043-00641"), None)

    # Batching skips serials already held and never exceeds the DOL ceiling.
    batches = list(candidate_batches("26240", 1, 120, known={5, 6, 7}))
    flat = [n for b in batches for n in b]
    check("batches never exceed the ceiling", max(len(b) for b in batches), BATCH)
    check("known serials are skipped", all(f"{PREFIX}26240-{s}" not in flat for s in (5, 6, 7)), True)
    check("every other serial is present exactly once", len(flat), 117)
    # Padded: DOL issues "P-100-26240-000001". Bare "-1" was a number DOL had
    # never seen, which is why the post-wrap half of June 2026 stayed empty.
    check("candidates carry the P- prefix, the day code and a padded serial", flat[0], "P-100-26240-000001")

    # Finality: the observed vocabulary, and unknown statuses stay pending.
    check("issued is final", is_final("DETERMINATION ISSUED"), 1)
    check("in process is pending", is_final("IN PROCESS"), 0)
    check("case and whitespace do not matter", is_final("  withdrawn "), 1)
    check("an unseen status is pending, not final", is_final("CENTER DIRECTOR REVIEW"), 0)
    check("NOR ISSUED is a rejection, so final", is_final("NOR ISSUED", "seasonal"), 1)
    check("IN PROCESS with a decision in DOL's file is finished",
          is_final("IN PROCESS", "seasonal", published=True), 1)
    check("IN PROCESS without one is still pending", is_final("IN PROCESS", "seasonal"), 0)
    check("an appeal stays pending whatever the file says",
          is_final("PENDING APPEAL", "seasonal", published=True), 0)
    check("the file rule is seasonal only: a PWD request in process stays pending",
          is_final("IN PROCESS", "pwd", published=True), 0)
    check("the final set names the observed outcomes",
          {"DETERMINATION ISSUED", "REDETERMINATION AFFIRMED", "REDETERMINATION MODIFIED",
           "WITHDRAWN"} <= PWD_FINAL, True)

    print("sweep corrects a stale final flag")
    sweep_heals_stale_flags()

    print("backfill resumer")
    H = 3_600_000
    now = 1_788_800_000_000
    doc = {"lastDayDone": "26194", "from": "2026-06-10", "to": "2026-09-08", "complete": False}
    check("no record: noop", resume_decision({}, None, now)[0], "noop")
    check("complete: noop", resume_decision({**doc, "complete": True}, None, now)[0], "noop")
    check("no range recorded (pre-resumer doc): noop",
          resume_decision({"lastDayDone": "26194"}, None, now)[0], "noop")
    check("a leg ran 2h ago: noop, the chain is alive",
          resume_decision(doc, now - 2 * H, now)[0], "noop")
    check("a leg ran just inside the quiet window: still noop",
          resume_decision(doc, now - (RESUME_QUIET_HOURS * H - 1), now)[0], "noop")
    check("a leg ran 26h ago and the range is incomplete: dispatch",
          resume_decision(doc, now - 26 * H, now)[0], "dispatch")
    check("no leg ever recorded but a range exists: dispatch",
          resume_decision(doc, None, now)[0], "dispatch")
    check("the dispatch reason names the frontier and the target",
          resume_decision(doc, None, now)[1], "incomplete: last day done 26194, target 2026-09-08")

    print()
    if FAILURES:
        print(f"{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
