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

    # --- recovery, keyed on the FILENAME ------------------------------------
    # `record_run` writes the full argv ("... --pending --program all"), and
    # the workflow hook cannot know which mode was running when the runner was
    # killed. Keying on the filename is what lets a later success clear the
    # flag; keying on the full string would leave an ingest red forever the
    # first time the two strings drifted, and drift silently.
    check("a later success under DIFFERENT argv clears the failure",
          run([("ingest_pwd_status_direct.py --backfill", "failed", "x",
                int(NOW - 5 * H)),
               ("ingest_pwd_status_direct.py --pending --program all", "ok", "y",
                int(NOW - 1 * H))]) == 0)
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

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
