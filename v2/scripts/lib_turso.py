"""Minimal Turso/libSQL HTTP client.

Deliberately NOT a dependency. Turso speaks Hrana-over-HTTP at /v2/pipeline,
which is a JSON POST, so a client library would buy us nothing and would put
a third copy of the slug rules in a third language. Keeping the migration in
Python means it imports `entity_key` and `slugify` from the ingest scripts
that already own them, and a slug computed differently in the writer than in
the reader is a detail page that 404s from its own index.
"""
from __future__ import annotations

import json
import os
import pathlib
import time
import urllib.error
import urllib.request


def env(name: str, path: str = ".env.local") -> str:
    """The real environment first, then `.env.local`.

    This used to read the FILE ONLY, which is the wrong way round for CI: a
    GitHub step supplies secrets as environment variables, so a script that
    only reads a file could not see them and died with a bare
    `FileNotFoundError: '.env.local'` - an error that names a file nobody
    expected it to want, from a step that had the credentials all along.

    That is not hypothetical. Three steps of the quarterly ingest call
    `Turso()` at the end of `main()` to stamp their freshness row, and the DOL
    one crashed exactly there **after** parsing 259,489 cases and writing every
    payload. The work was done; only the bookkeeping call failed, and it took
    the whole job red with it.

    Reading os.environ first also means a workflow no longer has to materialise
    a credentials file on disk just to hand a value to a Python script.
    """
    value = os.environ.get(name)
    if value:
        return value
    p = pathlib.Path(path)
    if p.exists():
        for line in p.read_text().splitlines():
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip()
    raise SystemExit(
        f"{name} is not set in the environment and was not found in {path}")


def lit(v):
    """A Python value as an Hrana argument.

    Integers travel as STRINGS on purpose: JSON numbers are doubles, and a
    case count or a wage silently losing precision is the kind of defect that
    looks fine until someone reconciles a total.
    """
    if v is None:
        return {"type": "null"}
    if isinstance(v, bool):
        return {"type": "integer", "value": str(int(v))}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    return {"type": "text", "value": str(v)}


# ---------------------------------------------------------------------------
# What is worth retrying
#
# AN ALLOW-LIST, NOT A DENY-LIST, on purpose. An unknown error code is treated
# as deterministic and fails immediately, which is the safe direction: a new
# transient code costs one wasted run and a one-line addition here, whereas a
# new DETERMINISTIC code caught by a deny-list would be re-sent four times on
# every statement forever.
# ---------------------------------------------------------------------------

# Statement failures that mean "the far end could not do this right now".
TRANSIENT_SQLITE_CODES = frozenset({
    "SQLITE_NOMEM",      # measured twice on 2026-09-03, two minutes apart
    "SQLITE_BUSY",       # write contention - a disclosure load starves reads
    "SQLITE_LOCKED",
    "SQLITE_IOERR",
    "SQLITE_PROTOCOL",   # WAL retry
    "SQLITE_INTERRUPT",  # the far end cancelled the statement
})

# Stream-lifetime failures. These say the CONNECTION went away, never that the
# statement is wrong, so a fresh request is the correct response.
TRANSIENT_STREAM_CODES = frozenset({"STREAM_EXPIRED", "STREAM_NOT_FOUND"})

# 3s, then 10s, then 30s. See the note in Turso.pipeline for why this is not
# the old 1.5/3/4.5.
RETRY_BACKOFF_S = (3, 10, 30)


def transient_code(err) -> str | None:
    """The error code when a statement failure is worth re-sending, else None.

    A HEALTHY REFUSAL IS NOT A TRANSIENT FAILURE and must never reach here.
    The reconciliation guards in the ingests (`sum(matrix) != total`, so the
    census is not written) return early rather than raising, precisely so a
    deliberate no-op cannot be mistaken for something to retry.
    """
    if not isinstance(err, dict):
        return None
    code = str(err.get("code") or "")
    if code in TRANSIENT_SQLITE_CODES or code in TRANSIENT_STREAM_CODES:
        return code
    return None


class Turso:
    def __init__(self, url: str | None = None, token: str | None = None):
        self.url = (url or env("TURSO_DATABASE_URL")).replace("libsql://", "https://")
        self.token = token or env("TURSO_AUTH_TOKEN")

    def pipeline(self, requests: list[dict], *, timeout: int = 180,
                 retries: int = 4, retry_transient: bool = True):
        """POST one Hrana pipeline, retrying only the transient failures.

        TWO KINDS OF FAILURE ARRIVE BY TWO DIFFERENT ROUTES and this used to
        retry only the first. A transport error (connection reset, DNS, a
        timeout) raises out of `urlopen`. A STATEMENT error comes back inside
        a **200 OK** body as `{"type": "error"}`, and the old code checked for
        that only AFTER the retry loop had exited - so the far end could say
        "out of memory" and the client treated it as a settled, final answer.

        That is not hypothetical. On 2026-09-03 both scheduled DOL sweeps died
        two minutes apart on `{"message": "SQLite error: out of memory",
        "code": "SQLITE_NOMEM"}` (Actions runs 33757242079 and 33763357105) -
        one on a single-row INSERT into perm_docs, one inside a batched write.
        Re-running the same query by hand afterwards took 22.2s and succeeded.
        Nothing was wrong with either statement; the primary was under
        pressure for a moment and the client had no way to wait it out.

        Same shape as the defect already recorded for the TypeScript read
        layer, whose retry guard excluded the one error it was written for.
        """
        body = json.dumps({"requests": requests}).encode()
        last: BaseException | None = None
        for attempt in range(retries):
            if attempt:
                # Longer than the old 1.5/3/4.5s. A NOMEM is the far end short
                # of memory; coming back in a second and a half is likely to
                # meet the same pressure. 3/10/30 spans 43 seconds, which is
                # nothing against an 85-minute sweep and long enough for a
                # pressure window to clear.
                time.sleep(RETRY_BACKOFF_S[min(attempt - 1, len(RETRY_BACKOFF_S) - 1)])
            req = urllib.request.Request(
                self.url + "/v2/pipeline", data=body,
                headers={"Authorization": f"Bearer {self.token}",
                         "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    out = json.loads(resp.read())
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last = e
                continue
            # A pipeline returns 200 even when a statement failed. Surfacing
            # that is the whole point: a loader that reports success over a
            # failed INSERT is worse than one that crashes.
            err = next((r.get("error") for r in out.get("results", [])
                        if r.get("type") == "error"), None)
            if err is None:
                return out
            detail = "libsql error: " + json.dumps(err)[:600]
            code = transient_code(err) if retry_transient else None
            if code is None:
                # Deterministic: a constraint violation, a missing table, the
                # read-only token's BLOCKED. Retrying only delays the real
                # error by three quarters of a minute.
                raise RuntimeError(detail)
            last = RuntimeError(detail)
            print(f"  [turso] {code} on attempt {attempt + 1}/{retries}; "
                  f"retrying", flush=True)
        raise last if last is not None else RuntimeError(  # pragma: no cover
            "turso pipeline exhausted its retries with no recorded error")

    def execute(self, sql: str, args: list | None = None, *,
                retry_transient: bool = True):
        reqs = [{"type": "execute", "stmt": {
            "sql": sql, "args": [lit(a) for a in (args or [])]}}]
        return self.pipeline(reqs + [{"type": "close"}],
                             retry_transient=retry_transient)["results"][0]

    def scalar(self, sql: str, args: list | None = None):
        res = self.execute(sql, args or [])
        rows = res["response"]["result"]["rows"]
        if not rows:
            return None
        cell = rows[0][0]
        return None if cell["type"] == "null" else cell["value"]

    def script(self, statements: list[str]):
        """Run DDL in order, one pipeline, failing loudly on the first error."""
        reqs = [{"type": "execute", "stmt": {"sql": s}} for s in statements]
        return self.pipeline(reqs + [{"type": "close"}])


# ---------------------------------------------------------------------------
# Freshness + audit trail
#
# Two small shared writes every ingest should make, kept here so the schema
# lives in ONE place and a new script cannot invent its own column order.
# ---------------------------------------------------------------------------

def stamp_freshness(
    db: "Turso",
    dataset: str,
    *,
    as_of: str | None = None,
    source: str,
    cadence: str,
    note: str,
    max_age_days: int,
) -> None:
    """Record that `dataset` refreshed, so check_ingest_health.py can see it stop.

    The health checker reads every row in this table dynamically, so a NEW
    dataset name here is monitored automatically - no registry to update. Only
    call this on a run that actually did the work: stamping on a run that died
    early keeps a broken ingest reporting itself healthy forever.
    """
    db.execute(
        """CREATE TABLE IF NOT EXISTS data_freshness (
            dataset TEXT PRIMARY KEY, as_of TEXT, fetched_at INTEGER,
            source TEXT, cadence TEXT, note TEXT, max_age_days INTEGER)"""
    )
    db.execute(
        "INSERT OR REPLACE INTO data_freshness VALUES (?,?,?,?,?,?,?)",
        [dataset, as_of or time.strftime("%Y-%m-%d"), int(time.time() * 1000),
         source, cadence, note, max_age_days],
    )


def record_run(
    db: "Turso",
    script: str,
    *,
    status: str,
    rows_written: int | None = None,
    note: str = "",
    started_at: float | None = None,
) -> None:
    """Append one row to the ingest audit trail.

    This is the answer to 'why did this table change at 13:48, and to what?'
    A last-write freshness stamp is overwritten every run and cannot show a
    history; this table is append-only. It exists because a scheduled job once
    ran OLD code and silently rebuilt perm_live_recent from 137k rows down to
    16k - freshness stayed green because the reverted run still stamped itself
    fresh, and the only record of the drop was in GitHub Actions logs that age
    out. rows_written per run makes that drop visible after the fact.

    Never raises: an audit write that fails must not fail the ingest it audits.
    """
    try:
        db.execute(
            """CREATE TABLE IF NOT EXISTS ingest_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                script TEXT NOT NULL, status TEXT NOT NULL,
                rows_written INTEGER, note TEXT,
                started_at INTEGER, finished_at INTEGER)"""
        )
        now = int(time.time() * 1000)
        # BOTH COLUMNS ARE MILLISECONDS. `finished_at` always was, but
        # `started_at` used to be written through untouched - so a caller
        # reaching for the obvious `time.time()` (SECONDS) put seconds in a
        # milliseconds column, and the only symptom was a duration off by a
        # factor of 1000. Nothing raised. Caught by actually calling this once
        # and reading the row back, which is the only way a unit mismatch in a
        # loosely-typed column ever shows up.
        #
        # Anything below 1e11 has to be seconds: as milliseconds it would be
        # 1973, and as seconds it is year 5138. So the two are separable with
        # no ambiguity for any timestamp this will ever see, and a caller may
        # pass whichever it has.
        started = float(started_at) if started_at is not None else float(now)
        started_ms = int(started * 1000) if started < 1e11 else int(started)
        # THE ONLY NON-IDEMPOTENT WRITE IN ANY SCHEDULED INGEST, so it is the
        # only one that must not be retried. `ingest_runs.id` is AUTOINCREMENT,
        # so a re-sent pipeline appends a SECOND row describing one run and
        # quietly corrupts the audit trail this table exists to be. Measured
        # 2026-09-03: every other INSERT in the scheduled scripts is
        # `INSERT OR IGNORE` or `INSERT OR REPLACE`, and every UPDATE is keyed
        # on a primary key, so re-sending them is a no-op:
        #   grep -rn "INSERT INTO" scripts/*.py | grep -viE "OR IGNORE|OR REPLACE"
        # returns this line plus three scripts no workflow runs.
        db.execute(
            "INSERT INTO ingest_runs (script, status, rows_written, note, "
            "started_at, finished_at) VALUES (?,?,?,?,?,?)",
            [script, status, rows_written, note, started_ms, now],
            retry_transient=False,
        )
    except Exception as exc:  # noqa: BLE001 - audit must never break the ingest
        print(f"  [record_run] audit write failed (non-fatal): {exc}", flush=True)


# ---------------------------------------------------------------------------
# Sweep coverage: what a run actually looked at
#
# `record_run` above answers "did this script run, and how many rows did it
# write". It cannot answer "which cases did we look at, and when" - and that
# question is load-bearing, because the review-stage pages print a freshness
# claim about exactly that.
#
# WHY IT HAD TO EXIST. The only per-case record of "when was this looked at"
# was `perm_case_status.last_checked_at`, which is PERMTRACK'S field, seeded
# from their mirror and never written by our own PERM sweep - the ingest's own
# header says so. Measured 2026-09-03 against production:
#
#   66,771 pending cases carried a 2026-07 timestamp
#   12,187 carried none at all
#
# while the sweep had in fact asked DOL about every one of them that morning.
# The published doc said the largest stage was "checked ... 2026-08-31"; the
# run that produced the number finished 2026-09-03. So the site was citing a
# retired competitor's bookkeeping as its own measurement. Probably true,
# unprovable, and not ours.
#
# WHY NOT STAMP EVERY ROW. 414,358 rows x 365 days is ~12.4M writes/month
# against a 10M plan, to express something ONE ROW PER SWEEP says better. A
# sweep asks about a POPULATION; coverage is a property of the run, not of
# each row in it. The sweep deliberately writes only CHANGED rows (~1,300/day)
# and this keeps it that way: 2 rows/day for PERM, ~3 for the FLAG programs.
#
# WHY A TABLE AND NOT A `perm_docs` KEY. `perm_docs` is keyed and written with
# INSERT OR REPLACE, so it holds one value and destroys the previous one - the
# same trap already recorded for the DOL as-of stamp. The question this
# answers is historical ("has the sweep run every day, and did it finish?"),
# and an append-only table is the only shape that can answer it. It is also
# free on the read side: the WEBSITE never reads this table, only the ingest
# does, and only ever one row of it.
# ---------------------------------------------------------------------------

_SWEEP_DDL = """CREATE TABLE IF NOT EXISTS sweep_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script TEXT NOT NULL,
    program TEXT NOT NULL,          -- perm | pwd | lca
    mode TEXT NOT NULL,             -- full | pending | discover | backfill | limit
    started_at INTEGER NOT NULL,    -- epoch ms
    finished_at INTEGER NOT NULL,   -- epoch ms
    started_on TEXT NOT NULL,       -- ISO date, written by the run itself
    finished_on TEXT NOT NULL,
    asked INTEGER NOT NULL,         -- case numbers put to DOL
    answered INTEGER NOT NULL,      -- of those, ones DOL returned a record for
    missing INTEGER NOT NULL,
    changed INTEGER NOT NULL,       -- statuses that moved
    requests INTEGER,               -- HTTP batches attempted
    failed_batches INTEGER,         -- batches that exhausted their retries
    complete INTEGER NOT NULL,      -- 1 only if the whole population was covered
    status_counts TEXT              -- JSON {status: n} over what DOL answered
)"""

# Leading equalities, ordering column last: the one query this table serves is
# "newest complete run for a program", which the index then answers without a
# sort. Same rule the case_status_stage index was built on.
_SWEEP_INDEX = ("CREATE INDEX IF NOT EXISTS sweep_runs_cover "
                "ON sweep_runs (program, complete, finished_at)")

_SWEEP_COLS = ("mode", "started_on", "finished_on", "started_at", "finished_at",
               "asked", "answered", "missing", "changed", "complete")


def _ensure_sweep_runs(db: "Turso") -> None:
    db.script([_SWEEP_DDL, _SWEEP_INDEX])


def record_sweep(
    db: "Turso",
    *,
    script: str,
    program: str,
    mode: str,
    started_at: float,
    asked: int,
    answered: int,
    missing: int,
    changed: int,
    complete: bool,
    requests: int | None = None,
    failed_batches: int | None = None,
    status_counts: dict[str, int] | None = None,
) -> dict | None:
    """Append one row describing what this sweep covered. Returns the row.

    `complete` IS A CLAIM ABOUT COVERAGE AND ONLY THE CALLER CAN MAKE IT.
    Pass 1 only when the run walked its whole population: no `--limit`, no
    `--offset`, no early stop, and no batch that exhausted its retries. A
    partial run that claimed completeness would let a freshness date be
    stamped on stages the run never reached, which is the defect this table
    exists to end rather than relocate.

    NEVER RAISES, for the same reason `record_run` does not: bookkeeping must
    not fail the ingest it books. The failure mode is benign in the one
    direction that matters - a missed write means the next reader falls back
    to the PREVIOUS complete sweep, so the published date is a day old rather
    than wrong. Understating freshness is the safe side of this trade.
    """
    now = int(time.time() * 1000)
    started = float(started_at)
    started_ms = int(started * 1000) if started < 1e11 else int(started)
    row = {
        "script": script, "program": program, "mode": mode,
        "started_at": started_ms, "finished_at": now,
        # THE DATE IS WRITTEN BY THE RUN, NOT DERIVED BY THE READER. Re-deriving
        # a date from epoch ms puts the reader's timezone in the middle of a
        # published freshness claim; storing what the run itself called "today"
        # keeps it in step with the doc's own `asOf`, which uses the same clock.
        "started_on": time.strftime("%Y-%m-%d", time.localtime(started_ms / 1000)),
        "finished_on": time.strftime("%Y-%m-%d", time.localtime(now / 1000)),
        "asked": int(asked), "answered": int(answered), "missing": int(missing),
        "changed": int(changed), "requests": requests,
        "failed_batches": failed_batches,
        "complete": 1 if complete else 0,
        "status_counts": (json.dumps(status_counts, separators=(",", ":"))
                          if status_counts else None),
    }
    try:
        _ensure_sweep_runs(db)
        cols = list(row)
        # NOT RETRIED, for the same reason as record_run's INSERT: this is a
        # bare `INSERT INTO` against an AUTOINCREMENT id, so a re-sent pipeline
        # appends a SECOND row for one sweep - and a sweep appearing twice
        # poisons the very coverage claim this table exists to make honest.
        # `Turso.pipeline` cannot tell whether the far end applied a statement
        # before it ran out of memory, so retrying a non-idempotent write is
        # never safe; it is a parameter, not a default, exactly as the
        # TypeScript read layer's retry is.
        #
        # Measured 2026-09-03 - the two non-idempotent writes in this file are
        # the only ones in any SCHEDULED ingest. Everything else is
        # `INSERT OR IGNORE`, `INSERT OR REPLACE`, or an UPDATE keyed on a
        # primary key, so re-sending it is a no-op:
        #   grep -rn "INSERT INTO" scripts/*.py | grep -viE "OR IGNORE|OR REPLACE"
        # returns this line, record_run's below, and three scripts that no
        # workflow runs (rebuild_entities, backfill_permtrack, test_turso_load).
        db.execute(
            f"INSERT INTO sweep_runs ({', '.join(cols)}) "
            f"VALUES ({', '.join('?' * len(cols))})",
            [row[c] for c in cols],
            retry_transient=False,
        )
    except Exception as exc:  # noqa: BLE001 - bookkeeping must not break the sweep
        print(f"  [record_sweep] write failed (non-fatal): {exc}", flush=True)
        return None
    return row


def last_complete_sweep(
    db: "Turso", program: str, modes: tuple[str, ...] | None = None
) -> dict | None:
    """The newest run that covered `program`'s whole population, or None.

    None is a real and correct answer - before the first complete run there is
    no honest date to publish, and the caller must render nothing rather than
    reach for somebody else's timestamp. That is the whole point.
    """
    try:
        _ensure_sweep_runs(db)
        where = "program = ? AND complete = 1"
        args: list = [program]
        if modes:
            where += f" AND mode IN ({', '.join('?' * len(modes))})"
            args.extend(modes)
        res = db.execute(
            f"SELECT {', '.join(_SWEEP_COLS)} FROM sweep_runs WHERE {where} "
            f"ORDER BY finished_at DESC LIMIT 1", args)
        rows = res["response"]["result"]["rows"]
    except Exception as exc:  # noqa: BLE001
        print(f"  [last_complete_sweep] read failed (non-fatal): {exc}", flush=True)
        return None
    if not rows:
        return None
    out: dict = {}
    for name, cell in zip(_SWEEP_COLS, rows[0]):
        v = None if cell["type"] == "null" else cell["value"]
        out[name] = v if name in ("mode", "started_on", "finished_on") else (
            None if v is None else int(v))
    return out


# ---------------------------------------------------------------------------
# Running the tail of an ingest
# ---------------------------------------------------------------------------

def run_independently(steps: list[tuple[str, object]]) -> list[tuple[str, str]]:
    """Run each step in order; one failing must not cost the ones after it.

    WHY. The last thing both DOL sweeps do is write a handful of precomputed
    docs, and they were written as four bare statements in a row. On
    2026-09-03 the fourth raised `SQLITE_NOMEM` and took the whole run red
    AFTER the 70-minute sweep had already written its 566 status changes and
    stamped itself fresh - so the expensive work was done, one small doc was
    18 hours stale, and the run's exit code said the sweep had failed.

    NOT A SWALLOW. Every failure is printed as a GitHub `::error::`
    annotation, which renders on the run page whatever the job's conclusion,
    and the caller gets the list back so it can be written to `ingest_runs`
    where `check_ingest_health.py` will find it. A step that fails silently is
    worse than one that crashes; the point here is only that it should not
    take its siblings with it.

    Order is preserved, because it is load-bearing: discovery has to run
    before the census, or the census is written without the day's new filings.
    """
    failed: list[tuple[str, str]] = []
    for name, fn in steps:
        try:
            fn()  # type: ignore[operator]
        except Exception as exc:  # noqa: BLE001 - the whole point
            failed.append((name, f"{type(exc).__name__}: {exc}"))
            print(f"::error::{name} failed: {type(exc).__name__}: {exc}",
                  flush=True)
    return failed
