#!/usr/bin/env python3
"""Contract tests for the failure-visibility half: check_ingest_health.check_runs.

    python3 scripts/test_ingest_health.py

No network, no Turso. The database is a stub returning Hrana-shaped rows.

WHAT THIS PROTECTS. Before 2026-09-03 nothing anywhere alerted on a failed
ingest. Two scheduled DOL sweeps died that morning within two minutes of each
other and every monitor stayed green, because:

  - the case-status sweep stamps `data_freshness` when ITS OWN work is done
    and then writes five precomputed docs. It stamped `perm-case-status-full`
    fresh at 13:58:50 and died at 14:00:11, so the freshness check had nothing
    to complain about;
  - `ingest_runs` has a `status` column and all 36 rows in it said `ok`. A
    status column with one value in it is not a status column;
  - the pwd sweep died before its own `record_run` ever ran, so it left no
    trace at all.

`check_runs` closes that by failing when an ingest's MOST RECENT run did not
finish clean. The workflows' `if: failure()` hook writes the row that no
surviving Python could have written.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import check_ingest_health as health  # noqa: E402

failures: list[str] = []
H = 3_600_000
NOW = health.NOW_MS


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{'' if cond else f': {detail}'}")
    if not cond:
        failures.append(label)


class FakeDB:
    """Serves `ingest_runs` the way libSQL does: every cell a typed string."""

    def __init__(self, rows):
        self.rows = rows          # (script, status, note, finished_ms)
        self.sql = None
        self.args = None

    def execute(self, sql, args=None):
        self.sql, self.args = sql, args
        if "ingest_runs" not in sql:
            raise AssertionError(f"check_runs read the wrong table: {sql[:60]}")
        cutoff = int(args[0])
        keep = sorted((r for r in self.rows if r[3] >= cutoff),
                      key=lambda r: -r[3])
        return {"response": {"result": {"rows": [
            [{"type": "text", "value": str(r[0])},
             {"type": "text", "value": str(r[1])},
             {"type": "text", "value": str(r[2])},
             {"type": "integer", "value": str(r[3])}] for r in keep]}}}


def run(rows) -> int:
    return health.check_runs(FakeDB(rows))


def main() -> int:
    # --- the two outcomes that mean something is broken ---------------------
    check("a failed run fails the check",
          run([("ingest_case_status_direct.py", "failed", "died in the tail",
                int(NOW - 2 * H))]) == 1)
    # `partial` is the new one: the sweep worked, some tail doc did not. That
    # is exactly what happened, and exiting 0 on it would have re-created the
    # silence this whole change exists to end.
    check("a partial run fails the check",
          run([("ingest_case_status_direct.py", "partial",
                "full: 414,357 cases; 1/5 tail steps failed",
                int(NOW - 2 * H))]) == 1)
    check("a clean run passes",
          run([("ingest_case_status_direct.py", "ok", "full: 414,357 cases",
                int(NOW - 2 * H))]) == 0)

    # --- a cancellation is NOT a break --------------------------------------
    # Both workflows set cancel-in-progress: false, so nothing supersedes a
    # run and a cancellation is a person pressing stop. Recording it is
    # useful; turning it red would train the reader to skim past the alert
    # inside a week, which costs more than the cancellation it reported.
    check("a cancelled run is recorded but does not fail the check",
          run([("ingest_pwd_status_direct.py", "cancelled", "run 999",
                int(NOW - 2 * H))]) == 0)
    check("'cancelled' is not in the broken set",
          "cancelled" not in health.BROKEN_STATUSES)
    check("the broken set is exactly failed + partial",
          health.BROKEN_STATUSES == frozenset({"failed", "partial"}),
          str(sorted(health.BROKEN_STATUSES)))

    # --- recovery, keyed on FILENAME + MODE ---------------------------------
    # `record_run` writes the full argv ("... --pending --program all"). The
    # key is the filename plus its first mode flag: a later clean run of the
    # SAME mode clears a failure, a clean run of a DIFFERENT mode does not.
    # Filename-only keying let Monday's daily pass erase Sunday's weekly
    # failure before the health cron looked (Sep 6 2026); the workflow hooks
    # now record the mode too, so a killed run and its recovery share a key.
    check("run_key keeps the filename and the first mode flag",
          health.run_key("ingest_pwd_status_direct.py --full --program all")
          == "ingest_pwd_status_direct.py --full",
          health.run_key("ingest_pwd_status_direct.py --full --program all"))
    check("run_key of a bare filename is the filename",
          health.run_key("ingest_case_status_direct.py") == "ingest_case_status_direct.py")
    check("a later success of the SAME mode clears its failure",
          run([("ingest_pwd_status_direct.py --backfill --from a", "failed", "x",
                int(NOW - 5 * H)),
               ("ingest_pwd_status_direct.py --backfill --from a", "ok", "y",
                int(NOW - 1 * H))]) == 0)
    check("a daily pass does NOT clear a weekly failure (the Sep 6 masking)",
          run([("ingest_pwd_status_direct.py --full --program all", "failed", "x",
                int(NOW - 5 * H)),
               ("ingest_pwd_status_direct.py --pending --program all", "ok", "y",
                int(NOW - 1 * H))]) == 1)
    check("an OLDER success does not clear a NEWER failure",
          run([("ingest_pwd_status_direct.py --pending", "ok", "y",
                int(NOW - 5 * H)),
               ("ingest_pwd_status_direct.py --backfill", "failed", "x",
                int(NOW - 1 * H))]) == 1)
    check("one ingest failing does not hide another's success",
          run([("ingest_case_status_direct.py", "ok", "y", int(NOW - 1 * H)),
               ("ingest_pwd_status_direct.py", "failed", "x", int(NOW - 1 * H))]) == 1)

    # --- the window ---------------------------------------------------------
    # An ingest that failed and never ran again is a STOPPED ingest, and
    # `data_freshness` is the check that says so. Two red lines for one cause
    # teach people to skim past the true one sitting next to it.
    old = int(NOW - (health.RUN_FAILURE_WINDOW_DAYS + 1) * 24 * H)
    check("a failure older than the window ages out",
          run([("ingest_case_status_direct.py", "failed", "x", old)]) == 0)
    inside = int(NOW - (health.RUN_FAILURE_WINDOW_DAYS - 1) * 24 * H)
    check("a failure just inside the window still counts",
          run([("ingest_case_status_direct.py", "failed", "x", inside)]) == 1)
    db = FakeDB([])
    health.check_runs(db)
    check("the window is pushed into SQL, not filtered in Python",
          db.args is not None and int(db.args[0]) < NOW
          and "finished_at >= ?" in (db.sql or ""), str(db.sql)[:80])

    # --- degrading, not failing ---------------------------------------------
    class NoTable:
        def execute(self, *_a, **_k):
            raise RuntimeError("libsql error: no such table: ingest_runs")

    check("a database that has never run an ingest is not a failure",
          health.check_runs(NoTable()) == 0)

    # --- PROBE BY REVERSION -------------------------------------------------
    # A gate that passes against the broken version is decoration. Put `ok`
    # back into the broken set and the clean case must go red.
    real = health.BROKEN_STATUSES
    health.BROKEN_STATUSES = frozenset({"failed", "partial", "ok"})
    broke = run([("ingest_case_status_direct.py", "ok", "y", int(NOW - H))])
    health.BROKEN_STATUSES = real
    check("PROBE: widening the broken set really does change the verdict",
          broke == 1, "the verdict is not gated on BROKEN_STATUSES")

    # --- the frontier: progress, not activity -------------------------------
    import json as _json
    import datetime as _dt

    class DocDB:
        def __init__(self, doc=None, runs=()):
            self.doc, self.runs = doc, list(runs)
        def execute(self, sql, args=None):
            if sql.startswith("SELECT json FROM perm_docs"):
                rows = [[{"type": "text", "value": _json.dumps(self.doc)}]] if self.doc is not None else []
                return {"response": {"result": {"rows": rows}}}
            if sql.startswith("SELECT MAX(filing_date)"):
                return {"response": {"result": {"rows": [[{"type": "text", "value": "2026-09-05"}]]}}}
            if "FROM ingest_runs WHERE script = ?" in sql:
                rows = [[{"type": "text", "value": st},
                         {"type": "integer", "value": str(rw)} if rw is not None else {"type": "null", "value": None},
                         {"type": "integer", "value": str(f)}] for st, rw, f in self.runs[: int(args[1])]]
                return {"response": {"result": {"rows": rows}}}
            raise AssertionError("unexpected sql: " + sql[:60])

    def code(days_ago):
        d = _dt.date.today() - _dt.timedelta(days=days_ago)
        return f"{d.year % 100:02d}{d.timetuple().tm_yday:03d}"

    check("frontier: a missing cursor doc fails", health.check_frontier(DocDB(None)) == 1)
    check("frontier: a cursor 2 days old passes",
          health.check_frontier(DocDB({"day_code": code(2), "serial": 200246})) == 0)
    check("frontier: a cursor 5 days old (a Friday after a Monday holiday) passes",
          health.check_frontier(DocDB({"day_code": code(5), "serial": 1})) == 0)
    check("frontier: a cursor 9 days old fails (the Aug 28 stall)",
          health.check_frontier(DocDB({"day_code": code(9), "serial": 200246})) == 1)
    check("frontier: an unreadable doc fails", health.check_frontier(DocDB({"nope": 1})) == 1)

    z = [("ok", 0, int(NOW - i * 24 * H)) for i in range(4)]
    check("yield: four dry walks fail", health.check_discovery_yield(DocDB(runs=z)) == 1)
    check("yield: one productive walk in four passes",
          health.check_discovery_yield(DocDB(runs=[("ok", 0, 1), ("ok", 108, 2), ("ok", 0, 3), ("ok", 0, 4)])) == 0)
    check("yield: fewer than four walks on record is not judged",
          health.check_discovery_yield(DocDB(runs=z[:2])) == 0)
    check("yield: a null rows_written counts as zero",
          health.check_discovery_yield(DocDB(runs=[("ok", None, 1)] * 4)) == 1)

    # ---- legacy bare-key failures --------------------------------------
    class RunsDB:
        def __init__(self, rows):
            self.rows = rows            # newest first: (script, status, note, finished)
        def execute(self, sql, args=None):
            assert sql.startswith("SELECT script, status, note, finished_at FROM ingest_runs")
            return {"response": {"result": {"rows": [[
                {"type": "text", "value": sc}, {"type": "text", "value": st},
                {"type": "text", "value": n}, {"type": "integer", "value": str(int(f))}]
                for sc, st, n, f in self.rows]}}}

    h = 3_600_000
    check("runs: a bare-key failure with no later clean run stays BROKEN",
          health.check_runs(RunsDB([("ingest_pwd_status_direct.py", "failed", "timeout", NOW - 30 * h)])) == 1)
    check("runs: a bare-key failure is superseded by a later clean --full run",
          health.check_runs(RunsDB([("ingest_pwd_status_direct.py --full", "ok", "", NOW - 2 * h),
                                    ("ingest_pwd_status_direct.py", "failed", "timeout", NOW - 30 * h)])) == 0)
    check("runs: a clean run BEFORE the bare failure does not supersede it",
          health.check_runs(RunsDB([("ingest_pwd_status_direct.py", "failed", "timeout", NOW - 2 * h),
                                    ("ingest_pwd_status_direct.py --full", "ok", "", NOW - 30 * h)])) == 1)
    check("runs: a mode-keyed --full failure is NOT cleared by a clean --pending run",
          health.check_runs(RunsDB([("ingest_pwd_status_direct.py --pending", "ok", "", NOW - 2 * h),
                                    ("ingest_pwd_status_direct.py --full", "failed", "timeout", NOW - 30 * h)])) == 1)
    check("runs: a clean run of a DIFFERENT script does not supersede",
          health.check_runs(RunsDB([("ingest_case_status_direct.py --full", "ok", "", NOW - 2 * h),
                                    ("ingest_pwd_status_direct.py", "failed", "timeout", NOW - 30 * h)])) == 1)

    # ---- the stalled-backfill line ----------------------------------------
    class ProgressDB:
        def __init__(self, doc):
            self.doc = doc
        def execute(self, sql, args=None):
            assert "flag_backfill_progress" in (args or [""])[0]
            rows = [[{"type": "text", "value": _json.dumps(self.doc)}]] if self.doc is not None else []
            return {"response": {"result": {"rows": rows}}}

    day = 86_400_000
    check("backfill: no record passes", health.check_backfill(ProgressDB(None)) == 0)
    check("backfill: complete passes",
          health.check_backfill(ProgressDB({"complete": True, "to": "2026-09-08"})) == 0)
    check("backfill: incomplete and moved 2 days ago passes",
          health.check_backfill(ProgressDB({"lastDayDone": "26194", "lastDayDoneAt": NOW - 2 * day})) == 0)
    check("backfill: incomplete and not moved in 8 days FAILS (the Sep 3 stall)",
          health.check_backfill(ProgressDB({"lastDayDone": "26161", "lastDayDoneAt": NOW - 8 * day})) == 1)
    check("backfill: a pre-resumer record without a movement stamp is not judged",
          health.check_backfill(ProgressDB({"lastDayDone": "26161"})) == 0)

    # ---- the lookup-demand line -------------------------------------------
    class DemandDB:
        def __init__(self, counts):
            self.counts = counts        # newest first: [(date, count), ...]
        def execute(self, sql, args=None):
            assert "discovery_budget_" in sql
            rows = [[{"type": "text", "value": f"discovery_budget_{d}"},
                     {"type": "text", "value": str(n)}] for d, n in self.counts[: int(args[0])]]
            return {"response": {"result": {"rows": rows}}}

    def days(counts):
        return [(f"2026-09-{i:02d}", n) for i, n in zip(range(30, 0, -1), counts)]

    quiet = days([3] + [4, 2, 5, 3, 1, 2, 4, 3, 5, 2])
    check("demand: single digits every day passes", health.check_lookup_demand(DemandDB(quiet)) == 0)
    check("demand: fewer than 8 days is not judged", health.check_lookup_demand(DemandDB(quiet[:5])) == 0)
    check("demand: 499 on a single-digit median passes (the 500 floor)",
          health.check_lookup_demand(DemandDB(days([499] + [3] * 10))) == 0)
    check("demand: 2,000 on a single-digit median FAILS (the Meta crawler)",
          health.check_lookup_demand(DemandDB(days([2000] + [3] * 10))) == 1)
    check("demand: 4x a busy median (300 on 100) passes",
          health.check_lookup_demand(DemandDB(days([300] + [100] * 10))) == 0)
    check("demand: 6x a busy median (600 on 100) FAILS",
          health.check_lookup_demand(DemandDB(days([600] + [100] * 10))) == 1)
    check("demand: a quoted JSON count is read",
          health.check_lookup_demand(DemandDB(days(['"7"'] + [3] * 10))) == 0)

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
