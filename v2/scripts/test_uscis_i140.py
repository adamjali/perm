#!/usr/bin/env python3
"""Checks for the I-140 quarter's database copy (`store_doc` in ingest_uscis_i140).

The two tool pages read `perm_docs['uscis_i140']` first since Sep 29 2026,
because the server reaches www.uscis.gov and holds no Convex deploy key. So
this copy has to carry the same gates Convex's `storeStats` does: a quarter
with nothing in it never replaces a good one, and a re-read of the same file
keeps its first write time.

Run: python3 scripts/test_uscis_i140.py
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ingest_uscis_i140 as iu  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


class SqliteDb:
    """The slice of lib_turso.Turso that store_doc uses, over an in-memory SQLite."""

    def __init__(self):
        self.conn = sqlite3.connect(":memory:")

    def execute(self, sql, args=None):
        rows = self.conn.execute(sql, args or []).fetchall()
        self.conn.commit()
        cell = lambda v: {"type": "null"} if v is None else {"type": "text", "value": str(v)}  # noqa: E731
        return {"response": {"result": {"rows": [[cell(v) for v in r] for r in rows]}}}

    def held(self):
        r = self.conn.execute("SELECT json, computed_at FROM perm_docs WHERE key = ?", [iu.DOC_KEY]).fetchone()
        return (json.loads(r[0]), r[1]) if r else (None, None)


def payload(quarter: str, pending: int) -> dict:
    subtypes = [{"code": "E21", "label": "Advanced degree", "received": 10,
                 "approved": 5, "denied": 1, "pending": pending}]
    body = json.dumps({"sourceFile": f"i140_{quarter}.xlsx", "asOfQuarter": quarter,
                       "subtypes": subtypes}, sort_keys=True)
    return {"sourceFile": f"i140_{quarter}.xlsx", "asOfQuarter": quarter,
            "subtypes": subtypes, "contentHash": str(hash(body))}


db = SqliteDb()
q2 = payload("FY2026 Q2", 400)

check("a complete quarter is stored", iu.store_doc(db, q2, 1_000) == "stored")
doc, at = db.held()
check("the stored copy has the fields the pages read",
      doc is not None and set(doc) == {"sourceFile", "asOfQuarter", "subtypes", "contentHash"}
      and doc["subtypes"][0]["pending"] == 400, str(doc))
check("the write time is recorded", at == 1_000, str(at))

check("the same file again changes nothing", iu.store_doc(db, q2, 2_000) == "unchanged")
check("and keeps its first write time", db.held()[1] == 1_000, str(db.held()[1]))

empty = payload("FY2026 Q3", 0)
check("a quarter with no pending petitions is refused",
      iu.store_doc(db, empty, 3_000).startswith("refused"))
check("and the good quarter is still there", db.held()[0]["asOfQuarter"] == "FY2026 Q2")
check("no subtypes at all is refused",
      iu.store_doc(db, {**q2, "subtypes": [], "contentHash": "x"}, 3_000).startswith("refused"))

q3 = payload("FY2026 Q3", 450)
check("a new quarter replaces the old one", iu.store_doc(db, q3, 4_000) == "stored")
doc, at = db.held()
check("with its own content and time", doc["asOfQuarter"] == "FY2026 Q3" and at == 4_000, f"{doc} {at}")

fresh = SqliteDb()
check("the table is created on a database that lacks it", iu.store_doc(fresh, q2, 5_000) == "stored")

if failures:
    print(f"\nFAIL ({len(failures)})")
    sys.exit(1)
print("\nok  the I-140 quarter's database copy keeps Convex's gates")
