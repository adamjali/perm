"""Minimal libSQL HTTP client, plus the bookkeeping every ingest shares.

The database (sqld on the server, Turso before it) speaks Hrana over HTTP at
/v2/pipeline, which is a JSON POST, so a client library would buy nothing.
Keeping the writers in Python also lets them import the entity and slug rules
from the scripts that own them, rather than re-deriving them in a third
language.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import pathlib
import time
import urllib.error
import urllib.request
from collections.abc import Iterable, Iterator, Sequence
from itertools import islice
from zoneinfo import ZoneInfo


def env(name: str, path: str = ".env.local") -> str:
    """The real environment first, then `.env.local`.

    A CI step supplies secrets as environment variables and a laptop keeps them
    in `.env.local`; reading the environment first serves both, with no
    credentials file written to a runner's disk.
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


def stmt(sql: str, args: list | tuple = ()) -> dict:
    """One Hrana execute request for a pipeline; `args` are plain Python values."""
    return {"type": "execute", "stmt": {"sql": sql, "args": [lit(a) for a in args]}}


def run_stmts(db: "Turso", stmts: Iterable[dict], per_request: int = 200) -> list[int]:
    """Send `stmts` in closed pipelines of `per_request`, in order.

    Statements are drawn as they're sent, so a generator never sits in memory
    whole. Returns each statement's affected-row count, aligned with `stmts`
    (0 when the far end reports none), so a caller can tell which writes applied.
    """
    counts: list[int] = []
    it = iter(stmts)
    while chunk := list(islice(it, per_request)):
        res = db.pipeline(chunk + [{"type": "close"}])
        results = (res.get("results") or []) if isinstance(res, dict) else []
        for j in range(len(chunk)):
            r = results[j] if j < len(results) else {}
            got = ((r.get("response") or {}).get("result") or {}).get("affected_row_count")
            counts.append(int(got or 0))
    return counts


def insert_stmts(table: str, columns: Sequence[str], rows: Sequence[Sequence],
                 per_stmt: int = 400) -> Iterator[dict]:
    """INSERT OR REPLACE statements for `rows`, `per_stmt` rows to a statement.

    Many rows to a statement because the cost is per statement: written one
    at a time, updates measured 49 rows a second against 1,233 batched.
    """
    mark = "(" + ",".join("?" * len(columns)) + ")"
    head = f"INSERT OR REPLACE INTO {table} ({','.join(columns)}) VALUES "
    for i in range(0, len(rows), per_stmt):
        chunk = rows[i:i + per_stmt]
        yield stmt(head + ",".join([mark] * len(chunk)), [v for row in chunk for v in row])


def insert_rows(db: "Turso", table: str, columns: Sequence[str], rows: Sequence[Sequence],
                per_stmt: int = 400, per_request: int = 4) -> int:
    """Write `rows` with `insert_stmts`; returns how many rows were sent."""
    run_stmts(db, insert_stmts(table, columns, rows, per_stmt), per_request)
    return len(rows)


def case_update(table: str, key: str, columns: Sequence[str], rows: Sequence[Sequence]) -> dict:
    """One UPDATE giving each row its own values; each row is (key, *values),
    values in `columns` order.

    A CASE arm per row, so a batch costs one statement and each row a
    primary-key seek. A row not named keeps its values, which the ELSE arm
    makes explicit.
    """
    arms = " ".join("WHEN ? THEN ?" for _ in rows)
    sets, args = [], []
    for i, col in enumerate(columns, start=1):
        sets.append(f"{col} = CASE {key} {arms} ELSE {col} END")
        args += [v for r in rows for v in (r[0], r[i])]
    args += [r[0] for r in rows]
    return stmt(f"UPDATE {table} SET {', '.join(sets)} WHERE {key} IN ({','.join('?' * len(rows))})",
                args)


# ---------------------------------------------------------------------------
# Reading results
#
# Hrana sends every cell as {"type", "value"}, with integers as strings (see
# `lit`). These decode a result without changing that: callers that want
# numbers convert, so a diff against stored values stays like for like.
# ---------------------------------------------------------------------------

def cell(c: dict):
    """One result cell as its raw value, None for SQL NULL."""
    return None if c["type"] == "null" else c["value"]


def typed_cell(c: dict):
    """One result cell with integers and floats converted to Python numbers."""
    v = cell(c)
    if c["type"] == "integer":
        return int(v)
    if c["type"] == "float":
        return float(v)
    return v


def rows_of(res: dict) -> list[list]:
    """An `execute()` response's rows, each cell decoded by `cell`."""
    return [[cell(c) for c in r] for r in res["response"]["result"]["rows"]]


def dicts_of(res: dict, *, typed: bool = False) -> list[dict]:
    """An `execute()` response's rows as {column: value} dicts."""
    result = res["response"]["result"]
    decode = typed_cell if typed else cell
    cols = [c["name"] for c in result["cols"]]
    return [dict(zip(cols, (decode(c) for c in r))) for r in result["rows"]]


def query_rows(db: "Turso", sql: str, args: list | None = None) -> list[list]:
    """Run one statement and return its rows as plain lists."""
    return rows_of(db.execute(sql, args or []))


def query_dicts(db: "Turso", sql: str, args: list | None = None, *,
                typed: bool = False) -> list[dict]:
    """Run one statement and return its rows as {column: value} dicts."""
    return dicts_of(db.execute(sql, args or []), typed=typed)


def add_missing_columns(db: "Turso", table: str, columns: dict[str, str]) -> list[str]:
    """Add each of `columns` ({name: SQL type}) that the live table lacks.

    `CREATE TABLE IF NOT EXISTS` never adds a column to a table that already
    exists, so a schema that grows needs this before the first write that
    names the new column. A table that doesn't exist yet is left alone: its
    own CREATE carries every column. Returns the names added.
    """
    have = {r[1] for r in query_rows(db, f"PRAGMA table_info({table})")}
    if not have:
        return []
    added = [c for c in columns if c not in have]
    for c in added:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {c} {columns[c]}")
    return added


def write_doc(db: "Turso", key: str, doc, computed_at: int | None = None) -> str:
    """Store perm_docs[key]: `doc` as a dict, or JSON text already serialized.

    Returns the stored text, so a caller can read the row back and compare.
    """
    text = doc if isinstance(doc, str) else json.dumps(doc, separators=(",", ":"))
    db.execute("INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
               [key, text, int(time.time() * 1000) if computed_at is None else computed_at])
    return text


def read_doc(db: "Turso", key: str) -> dict | None:
    """perm_docs[key] as a dict, or None when it's missing, unreadable or not
    a JSON object."""
    rows = query_rows(db, "SELECT json FROM perm_docs WHERE key = ?", [key])
    try:
        doc = json.loads(rows[0][0]) if rows and rows[0][0] else None
    except ValueError:
        return None
    return doc if isinstance(doc, dict) else None


def canon(v) -> str:
    """One spelling per value, whether it was built here or read back.

    SQLite stores a REAL column's 93205 as 93205.0, so comparing str() of the
    two would mark every such row as changed; both sides go through here, so a
    diff compares values, not storage types. 1.5 stays 1.5.
    """
    if v is None or v == "":
        return ""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    return str(int(f)) if f == int(f) else repr(f)


def canon_hash(values) -> str:
    """A short hash of `values` through `canon`, for cheap change detection."""
    return hashlib.blake2b("\x1f".join(canon(v) for v in values).encode(), digest_size=8).hexdigest()


# The site's day is Eastern: in UTC, a change after 8 PM ET would be dated
# tomorrow, and a fixed -4 hours is wrong for half the year.
ET = ZoneInfo("America/New_York")
# Stamps are epoch milliseconds; a value below this is read as seconds.
MS_EPOCH_FLOOR = 10_000_000_000


def et_date(stamp) -> str | None:
    """An epoch stamp (milliseconds, seconds tolerated) as its Eastern date."""
    if stamp is None or stamp == "":
        return None
    n = int(stamp)
    secs = n / 1000 if n > MS_EPOCH_FLOOR else n
    return datetime.datetime.fromtimestamp(secs, tz=ET).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# What is worth retrying
#
# An allow-list, not a deny-list: an unknown error code is treated as
# deterministic and fails at once. A new transient code costs one wasted run
# and a one-line addition here; a deterministic code caught by a deny-list would
# be re-sent on every statement forever.
# ---------------------------------------------------------------------------

# Statement failures that mean "the far end could not do this right now".
TRANSIENT_SQLITE_CODES = frozenset({
    "SQLITE_NOMEM",      # the far end briefly out of memory
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

    A deliberate refusal is not a transient failure and never reaches here: the
    ingests' reconciliation guards return early rather than raising.
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

        Two kinds of failure arrive by two routes. A transport error (connection
        reset, DNS, a timeout) raises out of `urlopen`. A statement error comes back
        inside a 200 OK body as `{"type": "error"}`; a transient one there (the far
        end briefly out of memory, say) is retried like a transport error, because
        the same statement usually succeeds a few seconds later.
        """
        body = json.dumps({"requests": requests}).encode()
        last: BaseException | None = None
        for attempt in range(retries):
            if attempt:
                # A transient error is usually the far end under pressure, which a
                # retry a second later is likely to meet again; RETRY_BACKOFF_S spans
                # 43 seconds, nothing against a long sweep.
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
                # read-only token's BLOCKED. Retrying only delays the real error.
                raise RuntimeError(detail)
            last = RuntimeError(detail)
            print(f"  [turso] {code} on attempt {attempt + 1}/{retries}; "
                  f"retrying", flush=True)
        raise last if last is not None else RuntimeError(  # pragma: no cover
            "turso pipeline exhausted its retries with no recorded error")

    def execute(self, sql: str, args: list | None = None, *,
                retry_transient: bool = True):
        return self.pipeline([stmt(sql, args or []), {"type": "close"}],
                             retry_transient=retry_transient)["results"][0]

    def scalar(self, sql: str, args: list | None = None):
        res = self.execute(sql, args or [])
        rows = res["response"]["result"]["rows"]
        return cell(rows[0][0]) if rows else None

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
) -> bool:
    """Append one row to the ingest audit trail; True when the row was written.

    A freshness stamp is overwritten every run and can't show a history; this
    table is append-only, so "why did this table change, and to what?" has an
    answer after the fact (rows_written makes a sudden drop visible).

    Never raises: an audit write that fails must not fail the ingest it audits.
    It returns False instead, so a caller can go red when the row that would
    have told the health check about it never landed (Oct 10 2026: a full disk
    failed 10 of 11 doc writes AND this row, and the run stayed green).
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
        # Both columns are milliseconds. A caller may pass `time.time()` seconds:
        # anything below 1e11 has to be seconds (as milliseconds it would be 1973),
        # so the two are separable for any timestamp this will ever see.
        started = float(started_at) if started_at is not None else float(now)
        started_ms = int(started * 1000) if started < 1e11 else int(started)
        # Not retried: `ingest_runs.id` is AUTOINCREMENT, so a re-sent pipeline
        # would append a second row for one run. Every other scheduled write is
        # INSERT OR IGNORE, INSERT OR REPLACE or a keyed UPDATE, so re-sending
        # those is a no-op.
        db.execute(
            "INSERT INTO ingest_runs (script, status, rows_written, note, "
            "started_at, finished_at) VALUES (?,?,?,?,?,?)",
            [script, status, rows_written, note, started_ms, now],
            retry_transient=False,
        )
        return True
    except Exception as exc:  # noqa: BLE001 - audit must never break the ingest
        print(f"  [record_run] audit write failed (non-fatal): {exc}", flush=True)
        return False


# ---------------------------------------------------------------------------
# Sweep coverage: what a run actually looked at
#
# `record_run` answers "did this script run, and how many rows did it write".
# This answers "which cases did a sweep look at, and when", which is what the
# review-stage pages print a freshness date from.
#
# Coverage is a property of the run, not of each case in it: a sweep asks about
# a population, so one row per sweep says it, where stamping every case would be
# hundreds of thousands of writes a day. And it is an append-only table rather
# than a `perm_docs` key, because the question is historical ("has the sweep run
# every day, and did it finish?") and a keyed doc keeps only the latest value.
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
# "newest complete run for a program", which the index answers without a sort.
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

    `complete` is a claim about coverage, and only the caller can make it: pass
    1 only when the run walked its whole population (no `--limit`, no
    `--offset`, no early stop, no batch that exhausted its retries).

    Never raises, like `record_run`. A missed write only means the next reader
    falls back to the previous complete sweep, so the published date is a day
    old rather than wrong.
    """
    now = int(time.time() * 1000)
    started = float(started_at)
    started_ms = int(started * 1000) if started < 1e11 else int(started)
    row = {
        "script": script, "program": program, "mode": mode,
        "started_at": started_ms, "finished_at": now,
        # The date is written by the run, not derived by the reader from epoch
        # ms, so the reader's timezone never enters a published freshness claim.
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
        # Not retried, for the same reason as record_run's INSERT: a re-sent
        # pipeline would record one sweep twice, and `Turso.pipeline` can't tell
        # whether the far end applied a statement before it failed.
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

    None is a real answer: before the first complete run there is no date to
    publish, and the caller renders nothing rather than borrow another one.
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
    for name, c in zip(_SWEEP_COLS, rows[0]):
        v = cell(c)
        out[name] = v if name in ("mode", "started_on", "finished_on") else (
            None if v is None else int(v))
    return out


# ---------------------------------------------------------------------------
# Running the tail of an ingest
# ---------------------------------------------------------------------------

def run_independently(steps: list[tuple[str, object]]) -> list[tuple[str, str]]:
    """Run each step in order; one failing must not cost the ones after it.

    The tail of a sweep is a handful of precomputed docs, each useful on its
    own, so one failing must not cost the rest (or turn a sweep that did its
    work red). Not a swallow: every failure is printed as a GitHub `::error::`
    annotation, and the list is returned so the caller can record it in
    `ingest_runs`, where check_ingest_health.py finds it. Order is preserved,
    because callers depend on it.
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
