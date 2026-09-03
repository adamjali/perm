"""A `Turso` shim over real, in-memory SQLite, for the ingest contract tests.

WHY A SHIM AND NOT A FIXTURE. The defects these tests guard live INSIDE the
SQL - a CTE with three window functions, a `NOT IN` over a grouped subquery,
a `GROUP BY` on a substring. A canned fixture of result rows passes with the
query deleted, which is the failure mode this repo keeps meeting: a checker
that cannot see its subject reads exactly like a pass. Running the real
statement against real SQLite is the only shape that cannot.

WHY VALUES COME BACK AS STRINGS. libSQL returns integers as STRINGS on the
wire to protect precision, and every decoder in the ingests (`_rows`,
`scalar`, `live_norm`) was written against that convention. A shim returning
native Python ints would hide exactly the class of bug that once rewrote all
136,886 rows of `perm_live_recent` because a stored `'0'` never equalled a
built `0`.

Extracted here the SECOND time it was needed - `test_sweep_runs.py` had the
only copy, and `test_observed_decisions.py` needed the same four methods. A
third copy is how two harnesses drift and one test starts proving something
about a shim nobody else uses.

NOT a test file, deliberately: it holds no assertions and runs nothing on
import, so a test module importing it cannot inherit another test's setup.
"""
from __future__ import annotations

import sqlite3


class SqliteTurso:
    """The four methods the ingests call, in the Hrana result shape."""

    def __init__(self) -> None:
        self.conn = sqlite3.connect(":memory:")

    @staticmethod
    def _cell(v):
        if v is None:
            return {"type": "null"}
        if isinstance(v, bool):
            return {"type": "integer", "value": str(int(v))}
        if isinstance(v, int):
            return {"type": "integer", "value": str(v)}
        if isinstance(v, float):
            return {"type": "float", "value": v}
        return {"type": "text", "value": str(v)}

    def execute(self, sql: str, args: list | None = None, **_kw):
        # **_kw absorbs `retry_transient`, which the real client takes and a
        # shim has no use for: there is no transport to be transient about.
        cur = self.conn.execute(sql, list(args or []))
        rows = cur.fetchall()
        self.conn.commit()
        return {"response": {"result": {
            "cols": [{"name": d[0]} for d in (cur.description or [])],
            "rows": [[self._cell(v) for v in r] for r in rows],
            "affected_row_count": max(cur.rowcount, 0)}}}

    def scalar(self, sql: str, args: list | None = None):
        rows = self.execute(sql, args)["response"]["result"]["rows"]
        if not rows:
            return None
        c = rows[0][0]
        return None if c["type"] == "null" else c["value"]

    def script(self, statements: list[str]):
        for s in statements:
            self.conn.execute(s)
        self.conn.commit()

    def pipeline(self, reqs: list[dict], **_kw):
        for r in reqs:
            if r.get("type") != "execute":
                continue
            st = r["stmt"]
            self.conn.execute(st["sql"], [
                None if a["type"] == "null" else a["value"]
                for a in st.get("args", [])])
        self.conn.commit()
        return {"results": []}
