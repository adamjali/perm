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


class Turso:
    def __init__(self, url: str | None = None, token: str | None = None):
        self.url = (url or env("TURSO_DATABASE_URL")).replace("libsql://", "https://")
        self.token = token or env("TURSO_AUTH_TOKEN")

    def pipeline(self, requests: list[dict], *, timeout: int = 180, retries: int = 4):
        body = json.dumps({"requests": requests}).encode()
        last = None
        for attempt in range(retries):
            req = urllib.request.Request(
                self.url + "/v2/pipeline", data=body,
                headers={"Authorization": f"Bearer {self.token}",
                         "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    out = json.loads(resp.read())
                break
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last = e
                if attempt == retries - 1:
                    raise
                time.sleep(1.5 * (attempt + 1))
        else:  # pragma: no cover
            raise last  # type: ignore[misc]
        # A pipeline returns 200 even when a statement failed. Surfacing that
        # is the whole point: a loader that reports success over a failed
        # INSERT is worse than one that crashes.
        for r in out.get("results", []):
            if r.get("type") == "error":
                raise RuntimeError("libsql error: " + json.dumps(r.get("error"))[:600])
        return out

    def execute(self, sql: str, args: list | None = None):
        reqs = [{"type": "execute", "stmt": {
            "sql": sql, "args": [lit(a) for a in (args or [])]}}]
        return self.pipeline(reqs + [{"type": "close"}])["results"][0]

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
    started_at: int | None = None,
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
        db.execute(
            "INSERT INTO ingest_runs (script, status, rows_written, note, "
            "started_at, finished_at) VALUES (?,?,?,?,?,?)",
            [script, status, rows_written, note, started_at or now, now],
        )
    except Exception as exc:  # noqa: BLE001 - audit must never break the ingest
        print(f"  [record_run] audit write failed (non-fatal): {exc}", flush=True)
