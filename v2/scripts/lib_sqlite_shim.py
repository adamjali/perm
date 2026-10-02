"""A `Turso` shim over real, in-memory SQLite, for the ingest contract tests.

WHY A SHIM AND NOT A FIXTURE. The defects these tests guard live INSIDE the
SQL - a CTE with three window functions, a `NOT IN` over a grouped subquery,
a `GROUP BY` on a substring. A canned fixture of result rows passes with the
query deleted, which is the failure mode this repo keeps meeting: a checker
that cannot see its subject reads exactly like a pass. Running the real
statement against real SQLite is the only shape that cannot.

WHY VALUES COME BACK AS STRINGS. libSQL returns integers as strings on the
wire to protect precision, and every decoder in the ingests was written
against that convention. A shim returning native Python ints would hide the
class of bug where a stored '0' never equals a built 0 and a diff rewrites
every row. Results are therefore encoded with the client's own `lit`.

NOT a test file, deliberately: it holds no assertions and runs nothing on
import, so a test module importing it cannot inherit another test's setup.
"""
from __future__ import annotations

import pathlib
import sqlite3
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import cell, lit  # noqa: E402


class SqliteTurso:
    """The four methods the ingests call, in the Hrana result shape."""

    def __init__(self) -> None:
        self.conn = sqlite3.connect(":memory:")

    def execute(self, sql: str, args: list | None = None, **_kw):
        # **_kw absorbs `retry_transient`, which the real client takes and a
        # shim has no use for: there is no transport to be transient about.
        cur = self.conn.execute(sql, list(args or []))
        rows = cur.fetchall()
        self.conn.commit()
        return {"response": {"result": {
            "cols": [{"name": d[0]} for d in (cur.description or [])],
            "rows": [[lit(v) for v in r] for r in rows],
            "affected_row_count": max(cur.rowcount, 0)}}}

    def scalar(self, sql: str, args: list | None = None):
        rows = self.execute(sql, args)["response"]["result"]["rows"]
        return cell(rows[0][0]) if rows else None

    def script(self, statements: list[str]):
        for s in statements:
            self.conn.execute(s)
        self.conn.commit()

    def pipeline(self, reqs: list[dict], **_kw):
        results = []
        for r in reqs:
            if r.get("type") != "execute":
                results.append({"type": "ok", "response": {"type": r.get("type")}})
                continue
            st = r["stmt"]
            cur = self.conn.execute(st["sql"], [cell(a) for a in st.get("args", [])])
            results.append({"type": "ok", "response": {"type": "execute", "result": {
                "affected_row_count": max(cur.rowcount, 0)}}})
        self.conn.commit()
        return {"results": results}
