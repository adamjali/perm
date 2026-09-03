#!/usr/bin/env python3
"""The sweep coverage record, and the freshness claim it replaced.

    python3 scripts/test_sweep_runs.py

NO NETWORK, and no production database: every test runs the REAL SQL against
an in-memory SQLite through a shim that speaks the Hrana result shape. That is
deliberate rather than convenient - the defect these tests guard is inside a
CTE with three window functions, and a canned fixture would pass with the
query deleted.

WHAT THIS FILE IS ABOUT. `perm_case_status.last_checked_at` is permtrack's
column, inherited from the mirror seed, and the PERM sweep has never written
it. `write_review_stages` used to take MIN/MAX of it and publish that as
`seenFrom`/`seenTo`, which `/perm-rfi-audit` renders as a sentence about when
the stages were read. Measured on production 2026-09-03: 66,771 pending cases
carried a 2026-07 date and 12,187 carried none, on a morning when the sweep had
asked DOL about every one of them.
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import lib_turso  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

spec = importlib.util.spec_from_file_location("csd", HERE / "ingest_case_status_direct.py")
csd = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(csd)

FAILURES: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{'' if cond else f': {detail}'}")
    if not cond:
        FAILURES.append(label)


# The Turso shim over real SQLite lives in lib_sqlite_shim so this file and
# test_observed_decisions.py cannot drift into two harnesses that prove
# different things. Extracted the second time it was needed, not the third.


def seeded_db(*, pending: int = 60, stale_checked: str | None = "2026-07-02") -> SqliteTurso:
    """A pending population carrying the STALE mirror timestamp, as production does."""
    db = SqliteTurso()
    db.script(["""CREATE TABLE perm_case_status (
        case_number TEXT PRIMARY KEY, filing_date TEXT, current_status TEXT,
        is_final INTEGER, employer_name TEXT, job_title TEXT,
        last_checked_at TEXT, source TEXT, fetched_at INTEGER)""",
        """CREATE TABLE perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)"""])
    rows = []
    for i in range(pending):
        status = "ANALYST REVIEW" if i % 3 else "RFI ISSUED"
        rows.append((f"G-100-26100-{i:06d}", "2026-04-10", status, 0,
                     f"EMPLOYER {i % 7}", "ENGINEER", stale_checked))
    # DOL's own test fixture, which the census must exclude.
    rows.append(("G-100-26100-999999", "2026-04-10", "RFI ISSUED", 0,
                 csd.TEST_FIXTURE_EMPLOYER, "BAH_TESTER", stale_checked))
    # A decided case, which is not part of the pending census.
    rows.append(("G-100-26100-888888", "2026-04-10", "CERTIFIED", 1,
                 "EMPLOYER 0", "ENGINEER", stale_checked))
    db.conn.executemany(
        "INSERT INTO perm_case_status (case_number, filing_date, current_status,"
        " is_final, employer_name, job_title, last_checked_at) VALUES (?,?,?,?,?,?,?)",
        rows)
    db.conn.commit()
    return db


def doc_of(db: SqliteTurso) -> dict | None:
    j = db.scalar("SELECT json FROM perm_docs WHERE key = 'review_stages'")
    return json.loads(j) if j else None


# ---------------------------------------------------------------------------
# The reader's rules, transcribed from src/lib/turso/rfi.ts.
#
# Transcribed rather than imported because that file is TypeScript. It is
# checked against the shipped doc below, so a drift shows up as this test
# rejecting a doc production accepts, not as silence.
# ---------------------------------------------------------------------------
def parse_review_stages_doc(doc: dict) -> list | None:
    """A port of `parseReviewStagesDoc` + `isDocRow`. None means rejected."""
    def num_or_null(v):
        return v is None or (isinstance(v, (int, float)) and not isinstance(v, bool))

    def str_or_null(v):
        return v is None or isinstance(v, str)

    if not isinstance(doc, dict):
        return None
    if (not isinstance(doc.get("asOf"), str)
            or not isinstance(doc.get("pendingTotal"), int)
            or not isinstance(doc.get("stages"), list)):
        return None
    for r in doc["stages"]:
        if not isinstance(r, dict):
            return None
        if not (isinstance(r.get("status"), str)
                and isinstance(r.get("cases"), int)
                and isinstance(r.get("employerNames"), int)
                and isinstance(r.get("topEmployerCases"), int)
                and str_or_null(r.get("topEmployer"))
                and str_or_null(r.get("seenFrom"))
                and str_or_null(r.get("seenTo"))
                and all(num_or_null(r.get(k)) for k in ("aged", "d10", "d50", "d90"))):
            return None
    if sum(r["cases"] for r in doc["stages"]) != doc["pendingTotal"]:
        return None
    return doc["stages"]


def main() -> int:
    print("sweep coverage record\n")

    # --- sweep_is_complete: the coverage claim ----------------------------
    # Every False below is a run that returns a plausible partial result with
    # no error, which is why the predicate exists at all.
    check("a clean full run is complete",
          csd.sweep_is_complete(None, 0, False, 0) is True)
    check("--limit makes it a slice, not a sweep",
          csd.sweep_is_complete(500, 0, False, 0) is False)
    check("--offset makes it a slice, not a sweep",
          csd.sweep_is_complete(None, 1000, False, 0) is False)
    check("a run stopped by three far-end failures is not complete",
          csd.sweep_is_complete(None, 0, True, 3) is False)
    check("ONE batch that exhausted its retries is a 50-case hole, not complete",
          csd.sweep_is_complete(None, 0, False, 1) is False)

    # --- record_sweep / last_complete_sweep -------------------------------
    db = SqliteTurso()
    now = time.time()
    row = lib_turso.record_sweep(
        db, script="s.py", program="perm", mode="pending", started_at=now - 900,
        asked=100, answered=98, missing=2, changed=4, requests=2,
        failed_batches=0, complete=True, status_counts={"ANALYST REVIEW": 98})
    check("record_sweep returns the row it wrote", isinstance(row, dict))
    got = lib_turso.last_complete_sweep(db, "perm")
    check("last_complete_sweep finds a complete run", got is not None)
    check("it decodes the counts as integers",
          got and got["asked"] == 100 and got["answered"] == 98
          and got["changed"] == 4, str(got))
    check("it carries the dates the RUN wrote, not the reader's clock",
          got and got["started_on"] == time.strftime("%Y-%m-%d", time.localtime(now - 900))
          and got["finished_on"] == time.strftime("%Y-%m-%d"), str(got))
    stored = db.scalar("SELECT status_counts FROM sweep_runs WHERE id = 1")
    check("the status breakdown round-trips as JSON",
          json.loads(stored) == {"ANALYST REVIEW": 98}, str(stored))

    # A PARTIAL run must be RECORDED and must not be usable to date anything.
    lib_turso.record_sweep(
        db, script="s.py", program="perm", mode="full", started_at=time.time(),
        asked=10, answered=10, missing=0, changed=0, requests=1,
        failed_batches=1, complete=False)
    check("a partial run is still recorded",
          int(db.scalar("SELECT COUNT(*) FROM sweep_runs")) == 2)
    still = lib_turso.last_complete_sweep(db, "perm")
    check("a NEWER partial run never becomes the answer",
          still and still["mode"] == "pending", str(still))
    check("mode filtering works",
          lib_turso.last_complete_sweep(db, "perm", modes=("full",)) is None)
    check("another program's run is not this program's",
          lib_turso.last_complete_sweep(db, "pwd") is None)
    check("an empty table answers None, not a guess",
          lib_turso.last_complete_sweep(SqliteTurso(), "perm") is None)

    # Bookkeeping must never break the ingest it books.
    class Broken(SqliteTurso):
        def script(self, statements):
            raise RuntimeError("libsql error: disk full")
    # CALLED INSIDE try/except, NOT INLINE IN `check`. A version that
    # re-raises would then take the whole test file down with a traceback
    # instead of printing one FAIL - which is what the probe run showed, and
    # a suite that dies reads as a broken harness rather than a broken guard.
    def swallows(label: str, fn) -> None:
        try:
            check(label, fn() is None)
        except Exception as exc:  # noqa: BLE001
            check(label, False, f"raised instead of swallowing: {exc!r}")

    swallows("record_sweep swallows a write failure and reports None",
             lambda: lib_turso.record_sweep(
                 Broken(), script="s.py", program="perm", mode="full",
                 started_at=time.time(), asked=1, answered=1, missing=0,
                 changed=0, complete=True))
    swallows("last_complete_sweep swallows a read failure and reports None",
             lambda: lib_turso.last_complete_sweep(Broken(), "perm"))

    # --- the published doc -------------------------------------------------
    # THE DEFECT ITSELF. Every row carries a July timestamp; the sweep ran
    # today. The doc must say today.
    db = seeded_db(stale_checked="2026-07-02")
    lib_turso.record_sweep(
        db, script="ingest_case_status_direct.py", program="perm", mode="full",
        started_at=time.time(), asked=62, answered=62, missing=0, changed=1,
        requests=2, failed_batches=0, complete=True)
    csd.write_review_stages(db)
    doc = doc_of(db)
    today = time.strftime("%Y-%m-%d")
    check("the doc was written", doc is not None)
    seen = {(s["seenFrom"], s["seenTo"]) for s in (doc or {}).get("stages", [])}
    check("seenFrom/seenTo are the SWEEP's dates, not the mirror's",
          seen == {(today, today)}, str(seen))
    check("no stage carries the July mirror date anywhere",
          "2026-07-02" not in json.dumps(doc), "mirror timestamp leaked")
    check("the fixture employer is still excluded",
          doc and doc["pendingTotal"] == 60, str(doc and doc["pendingTotal"]))
    check("the decided case is not in the pending census",
          doc and sum(s["cases"] for s in doc["stages"]) == 60)
    check("the doc still passes the reader's validation",
          parse_review_stages_doc(doc) is not None)
    check("the age band still computes (it reads last_checked_at, unchanged)",
          doc and any(s["d50"] is not None for s in doc["stages"]),
          str([s["d50"] for s in (doc or {}).get("stages", [])]))

    # NO SWEEP RECORDED -> NO CLAIM. Null, not somebody else's timestamp.
    db = seeded_db(stale_checked="2026-07-02")
    csd.write_review_stages(db)
    doc = doc_of(db)
    seen = {(s["seenFrom"], s["seenTo"]) for s in (doc or {}).get("stages", [])}
    check("with no sweep on record both fields are null",
          seen == {(None, None)}, str(seen))
    check("a null-dated doc still passes the reader's validation",
          parse_review_stages_doc(doc) is not None)

    # A PARTIAL sweep cannot date the census either.
    db = seeded_db(stale_checked="2026-07-02")
    lib_turso.record_sweep(
        db, script="ingest_case_status_direct.py", program="perm", mode="full",
        started_at=time.time(), asked=10, answered=10, missing=0, changed=0,
        requests=1, failed_batches=2, complete=False)
    csd.write_review_stages(db)
    seen = {(s["seenFrom"], s["seenTo"]) for s in (doc_of(db) or {}).get("stages", [])}
    check("a partial sweep leaves the dates null rather than overstating",
          seen == {(None, None)}, str(seen))

    # --- sweep_coverage, the web-readable projection -----------------------
    db = seeded_db()
    lib_turso.record_sweep(
        db, script="ingest_case_status_direct.py", program="perm", mode="full",
        started_at=time.time() - 3600, asked=62, answered=61, missing=1,
        changed=3, requests=2, failed_batches=0, complete=True)
    csd.write_sweep_coverage(db)
    cov = db.scalar("SELECT json FROM perm_docs WHERE key = 'sweep_coverage'")
    cov = json.loads(cov) if cov else None
    check("sweep_coverage names the finish date and the coverage",
          cov and cov["finishedOn"] == today and cov["asked"] == 62
          and cov["answered"] == 61 and cov["changed"] == 3, str(cov))
    check("sweep_coverage carries a real duration",
          cov and 3500 <= cov["durationS"] <= 3700, str(cov and cov["durationS"]))
    db2 = seeded_db()
    csd.write_sweep_coverage(db2)
    check("sweep_coverage is NOT written before a complete sweep exists",
          db2.scalar("SELECT json FROM perm_docs WHERE key = 'sweep_coverage'") is None)

    # --- the call ORDER in main(), which is what makes any of it work -----
    #
    # `write_review_stages` reads the row `record_sweep` writes. Reorder them
    # and the doc silently publishes YESTERDAY's sweep date every night, with
    # nothing failing and nothing looking wrong - the date would just always
    # be one day behind, which is the hardest kind of wrong to notice. A
    # static check because the alternative is executing main() against DOL.
    #
    # Written against the CODE rather than a fixed line range, because the
    # doc writers were refactored from bare calls into a `tail_steps` table
    # while this was being written. The gate has to survive that: it locates
    # each call wherever it lives and compares positions.
    src = (HERE / "ingest_case_status_direct.py").read_text()

    def after(text: str, *names: str) -> dict[str, int]:
        # Ignore the many mentions in prose: require the call parenthesis.
        return {n: text.find(n) for n in names}

    steps = src[src.index("def tail_steps"):src.index("def main()")]
    o = after(steps, "write_sweep_coverage(db)", "write_review_stages(db)")
    check("the coverage doc is written before the stage census reads it back",
          0 <= o["write_sweep_coverage(db)"] < o["write_review_stages(db)"], str(o))

    body = src[src.index("def main()"):]
    m = after(body, "record_sweep(", "tail_steps(db, discover=bool(args.full))")
    check("main() records the sweep before it runs the doc writers",
          0 <= m["record_sweep("] < m["tail_steps(db, discover=bool(args.full))"],
          str(m))
    check("write_sweep_coverage and write_review_stages are both scheduled",
          all(v >= 0 for v in o.values()), str(o))

    # And the census must no longer read the mirror's column for its dates.
    body = src[src.index("def write_review_stages"):src.index("def write_sweep_coverage")]
    check("write_review_stages no longer selects last_checked_at as an observation",
          "AS seen" not in body and "MIN(seen)" not in body, "the mirror timestamp is back")
    check("write_review_stages still computes the age band from last_checked_at",
          "_AGE_DAYS" in body,
          "AGE_DAYS is pinned to src/lib/turso/rfi.ts and must not drift here")

    print(f"\n  {len(FAILURES)} failure(s)"
          + (f": {', '.join(FAILURES)}" if FAILURES else ""))
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
