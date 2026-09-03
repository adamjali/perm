#!/usr/bin/env python3
"""Contract tests for the transient-failure retry and the independent tail.

    python3 scripts/test_ingest_resilience.py

No network, no Turso. `urllib.request.urlopen` is replaced with a fake Hrana
server backed by in-memory SQLite, so every statement really executes and the
assertions COUNT ROWS rather than counting calls. That distinction is the whole
point here: "the client retried" and "the database now holds two rows" are
different claims, and only the second one is the defect.

WHAT THIS IS FOR. On 2026-09-03 both scheduled DOL sweeps died on
`{"message": "SQLite error: out of memory", "code": "SQLITE_NOMEM"}` two
minutes apart (Actions runs 33757242079 and 33763357105). That error arrives
INSIDE a 200 OK body, and `Turso.pipeline` only ever retried errors that raised
out of `urlopen`, so a moment of far-end memory pressure was treated as a
settled, final answer. The same query re-ran by hand in 22.2s.

Retrying is therefore right - but only for writes that can be re-applied. The
fake server here models the genuinely dangerous case: the far end APPLIES the
statement and THEN reports an error, which is indistinguishable from the far
end rejecting it. That is why a bare `INSERT INTO ... AUTOINCREMENT` cannot be
retried and an `INSERT OR IGNORE` can.
"""
from __future__ import annotations

import io
import json
import pathlib
import sqlite3
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import lib_turso  # noqa: E402

failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{'' if cond else f': {detail}'}")
    if not cond:
        failures.append(label)


# ---------------------------------------------------------------------------
# A fake Hrana server
# ---------------------------------------------------------------------------

NOMEM = {"message": "SQLite error: out of memory", "code": "SQLITE_NOMEM"}
CONSTRAINT = {"message": "UNIQUE constraint failed: t.id", "code": "SQLITE_CONSTRAINT"}
BLOCKED = {"message": "BLOCKED: SQL write operations are forbidden",
           "code": "BLOCKED"}


def _py(cell: dict):
    t = cell.get("type")
    if t == "null":
        return None
    if t == "integer":
        return int(cell["value"])
    if t == "float":
        return float(cell["value"])
    return cell["value"]


class FakeHrana:
    """Executes statements for real, and can fail a scripted number of POSTs.

    `apply_then_fail` is the honest model of the failure this guards against.
    A far end that runs out of memory partway through, or a response that is
    lost on the way back, leaves the client unable to tell "not applied" from
    "applied, and you did not hear about it". Modelling only "rejected"
    would make every retry look safe, which is exactly the wrong conclusion.
    """

    def __init__(self, *, fail_posts: int = 0, error=NOMEM,
                 apply_then_fail: bool = True, fail_on: str | None = None):
        self.db = sqlite3.connect(":memory:")
        self.posts = 0
        # `fail_on` NAMES THE STATEMENT TO FAIL, and it exists because the
        # first version of this file counted POSTs instead - which quietly
        # tested nothing. `record_run` issues a `CREATE TABLE IF NOT EXISTS`
        # before its INSERT, so "fail the next POST" landed the NOMEM on the
        # CREATE, which is idempotent and retried happily; the INSERT then ran
        # once with no failure in sight and the assertion passed for the wrong
        # reason. Deleting the opt-out it was supposed to be guarding changed
        # nothing. Caught by mutation, never by reading.
        self.fail_on = fail_on
        self.fail_remaining = fail_posts
        self.error = error
        self.apply_then_fail = apply_then_fail
        self.sql_seen: list[str] = []

    def __call__(self, req, timeout=None):  # stands in for urlopen
        self.posts += 1
        payload = json.loads(req.data)
        sqls = [r["stmt"]["sql"] for r in payload["requests"]
                if r.get("type") == "execute"]
        matched = self.fail_on is None or any(self.fail_on in q for q in sqls)
        failing = self.fail_remaining > 0 and matched
        if failing:
            self.fail_remaining -= 1
        results = []
        for r in payload["requests"]:
            if r.get("type") != "execute":
                results.append({"type": "ok", "response": {"type": "close"}})
                continue
            stmt = r["stmt"]
            self.sql_seen.append(stmt["sql"])
            here = failing and (self.fail_on is None or self.fail_on in stmt["sql"])
            if here and not self.apply_then_fail:
                results.append({"type": "error", "error": self.error})
                break
            cur = self.db.execute(stmt["sql"],
                                  [_py(a) for a in stmt.get("args", [])])
            if here:
                results.append({"type": "error", "error": self.error})
                break
            results.append({"type": "ok", "response": {"type": "execute", "result": {
                "cols": [{"name": d[0]} for d in (cur.description or [])],
                "rows": [[{"type": "null"} if v is None
                          else {"type": "integer", "value": str(v)} if isinstance(v, int)
                          else {"type": "text", "value": str(v)} for v in row]
                         for row in cur.fetchall()],
                "affected_row_count": cur.rowcount if cur.rowcount > 0 else 0}}})
        self.db.commit()
        return _Resp(json.dumps({"results": results}).encode())

    def count(self, table: str) -> int:
        return self.db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def attempt(fn):
    """Run `fn`, returning the exception instead of letting it escape.

    EVERY call that can raise goes through this. The first version of this
    file called `db.execute` bare inside the happy-path assertions, so when
    the retry was mutated away the whole test CRASHED with a traceback
    instead of printing FAIL - which a mutation harness keying on "did a check
    fail" reads as UNDETECTED. A test that dies is not a test that reports.
    """
    try:
        fn()
    except Exception as exc:  # noqa: BLE001
        return exc
    return None


def with_server(server) -> "lib_turso.Turso":
    lib_turso.urllib.request.urlopen = server           # type: ignore[assignment]
    return lib_turso.Turso(url="https://fake", token="x")


def main() -> int:
    lib_turso.time.sleep = lambda *_: None   # do not really wait 43 seconds

    # --- the allow-list ---------------------------------------------------
    # An ALLOW-list, so an unknown code fails fast. A deny-list would re-send
    # every new deterministic error four times, forever.
    print("classifier")
    check("SQLITE_NOMEM is transient", lib_turso.transient_code(NOMEM) == "SQLITE_NOMEM")
    check("SQLITE_BUSY is transient",
          lib_turso.transient_code({"code": "SQLITE_BUSY"}) == "SQLITE_BUSY")
    check("a constraint violation is NOT transient",
          lib_turso.transient_code(CONSTRAINT) is None)
    check("the read-only token's BLOCKED is NOT transient",
          lib_turso.transient_code(BLOCKED) is None,
          "retrying BLOCKED would hide a credential problem behind a delay")
    check("an unknown code is NOT transient",
          lib_turso.transient_code({"code": "SQLITE_NEWTHING"}) is None)
    check("a malformed error object is NOT transient",
          lib_turso.transient_code("boom") is None)

    # --- the retry actually fires ----------------------------------------
    print("\nretry")
    s = FakeHrana(fail_posts=2, apply_then_fail=False)
    db = with_server(s)
    err = attempt(lambda: db.execute("CREATE TABLE t (id INTEGER PRIMARY KEY)"))
    check("a NOMEM inside a 200 body is retried until it succeeds",
          err is None and s.posts == 3, f"{s.posts} POSTs, raised {err!r}")

    # This is the regression the whole change exists for. Before it, the
    # statement-error check sat AFTER the retry loop, so this raised.
    s = FakeHrana(fail_posts=99, apply_then_fail=False)
    db = with_server(s)
    raised = attempt(lambda: db.execute("CREATE TABLE t (id INTEGER)"))
    check("retries are bounded and the last error surfaces",
          raised is not None and "SQLITE_NOMEM" in str(raised), str(raised))
    check("bounded at four attempts", s.posts == 4, f"{s.posts} POSTs")

    # --- deterministic errors must NOT be retried -------------------------
    s = FakeHrana(fail_posts=99, error=CONSTRAINT, apply_then_fail=False)
    db = with_server(s)
    attempt(lambda: db.execute("CREATE TABLE t (id INTEGER)"))
    check("a constraint violation fails on the FIRST attempt",
          s.posts == 1, f"{s.posts} POSTs - retrying a deterministic error "
                        f"only delays the real message")

    s = FakeHrana(fail_posts=99, error=BLOCKED, apply_then_fail=False)
    db = with_server(s)
    try:
        db.execute("CREATE TABLE t (id INTEGER)")
    except Exception:  # noqa: BLE001
        pass
    check("BLOCKED fails on the first attempt", s.posts == 1, f"{s.posts} POSTs")

    # --- retry_transient=False --------------------------------------------
    s = FakeHrana(fail_posts=1, apply_then_fail=False)
    db = with_server(s)
    try:
        db.execute("CREATE TABLE t (id INTEGER)", retry_transient=False)
    except Exception:  # noqa: BLE001
        pass
    check("retry_transient=False makes even a NOMEM final",
          s.posts == 1, f"{s.posts} POSTs")

    # --- the point of it all: what lands in the table ---------------------
    #
    # The far end applies the statement and THEN reports NOMEM. An idempotent
    # write may be re-sent; a bare INSERT against AUTOINCREMENT may not.
    print("\nwhat actually lands in the table")

    s = FakeHrana(fail_posts=0, apply_then_fail=True)
    db = with_server(s)
    db.execute("CREATE TABLE k (id INTEGER PRIMARY KEY, v TEXT)")
    s.posts, s.fail_remaining, s.fail_on = 0, 1, "INSERT OR IGNORE INTO k"
    err = attempt(lambda: db.execute(
        "INSERT OR IGNORE INTO k (id, v) VALUES (?, ?)", [1, "a"]))
    check("an INSERT OR IGNORE survives an applied-then-failed NOMEM",
          err is None and s.count("k") == 1,
          f"{s.count('k')} rows, raised {err!r}")
    check("...and it took a second POST to get there, so the retry is what "
          "saved it", s.posts == 2, f"{s.posts} POSTs")

    # record_run: the audit trail must not gain a phantom run.
    s = FakeHrana(fail_posts=1, apply_then_fail=True,
                  fail_on="INSERT INTO ingest_runs")
    db = with_server(s)
    lib_turso.record_run(db, "probe.py", status="ok", note="first")
    before, after = 0, s.count("ingest_runs")
    check("record_run writes EXACTLY ONE row through an applied-then-failed NOMEM",
          after - before == 1,
          f"{after - before} rows added - a retried AUTOINCREMENT INSERT "
          f"double-books one run and corrupts the audit trail")

    # record_sweep: same shape, and it is the freshness claim itself.
    s = FakeHrana(fail_posts=1, apply_then_fail=True,
                  fail_on="INSERT INTO sweep_runs")
    db = with_server(s)
    kw = dict(script="probe.py", program="perm", mode="full", started_at=1.0,
              asked=1, answered=1, missing=0, changed=0, complete=True)
    lib_turso.record_sweep(db, **kw)                      # type: ignore[arg-type]
    before, after = 0, s.count("sweep_runs")
    check("record_sweep writes EXACTLY ONE row through the same failure",
          after - before == 1,
          f"{after - before} rows added - one sweep counted twice would "
          f"poison the coverage claim the table exists to make honest")

    # --- PROBE BY REVERTING ----------------------------------------------
    # A guard nobody has seen fire is not a control. Turn the opt-out off and
    # confirm the double-write this file asserts against actually appears.
    print("\nprobe: revert the opt-out and confirm the defect returns")
    s = FakeHrana(fail_posts=0, apply_then_fail=True)
    db = with_server(s)
    db.execute("""CREATE TABLE IF NOT EXISTS probe_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT)""")
    s.fail_remaining, s.fail_on = 1, "INSERT INTO probe_runs"
    try:
        db.execute("INSERT INTO probe_runs (note) VALUES (?)", ["x"])
    except Exception:  # noqa: BLE001
        pass
    check("WITH retry on, a bare AUTOINCREMENT insert really does double-write",
          s.count("probe_runs") == 2,
          f"{s.count('probe_runs')} rows - if this is 1 the test cannot tell "
          f"a working opt-out from a broken one")

    # --- run_independently ------------------------------------------------
    print("\nrun_independently")
    order: list[str] = []

    def ok(name):
        return lambda: order.append(name)

    def boom(name):
        def f():
            order.append(name)
            raise RuntimeError("nope")
        return f

    failed = lib_turso.run_independently(
        [("a", ok("a")), ("b", boom("b")), ("c", ok("c")), ("d", boom("d"))])
    check("a failing step does not stop the ones after it",
          order == ["a", "b", "c", "d"], str(order))
    check("every failure is reported back to the caller",
          [k for k, _ in failed] == ["b", "d"], str(failed))
    check("the reason travels with the name",
          "RuntimeError" in failed[0][1], str(failed[0]))
    check("a clean pass reports nothing",
          lib_turso.run_independently([("a", ok("a2"))]) == [])

    # A DECLINED WRITE IS NOT A FAILURE. The reconciliation guards return
    # early instead of raising, precisely so a deliberate no-op can never be
    # mistaken for something to retry or to alarm on.
    check("a step that returns falsy without raising is not a failure",
          lib_turso.run_independently([("guard", lambda: False)]) == [])

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
