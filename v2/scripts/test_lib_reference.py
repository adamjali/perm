#!/usr/bin/env python3
"""lib_reference.sync_rows writes only what changed, on real SQLite.

The reference loaders re-read sources that change once a year. A diff that
never matches would rewrite every row every month while logging success (the
`live_norm` defect of Aug 2026: libSQL returns integers as strings), so these
run the real statements through the shim, which encodes results the way the
wire does.

Run: python3 scripts/test_lib_reference.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_reference import keep_record, seen_before, sync_rows  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILS: list[str] = []
N = 0


def check(label, got, want):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


def main() -> int:
    db = SqliteTurso()
    db.script(["CREATE TABLE t (yr INTEGER, k TEXT, v REAL, note TEXT, PRIMARY KEY (yr, k))",
               "CREATE TABLE perm_docs (key TEXT PRIMARY KEY, json TEXT, computed_at INTEGER)"])
    cols = ("yr", "k", "v", "note")
    first = [(2026, "a", 1.5, "x"), (2026, "b", 93205.0, None), (2025, "a", 2.0, "y")]
    got = sync_rows(db, "t", ("yr", "k"), cols, first)
    check("a first load writes every row", got, {"written": 3, "deleted": 0, "unchanged": 0})

    again = [(2026, "a", 1.5, "x"), (2026, "b", 93205, None), (2025, "a", 2, "y")]
    got = sync_rows(db, "t", ("yr", "k"), cols, again)
    check("the same rows again write nothing (93205 is 93205.0)", got,
          {"written": 0, "deleted": 0, "unchanged": 3})

    moved = [(2026, "a", 1.75, "x"), (2026, "c", 4.0, "new")]
    got = sync_rows(db, "t", ("yr", "k"), cols, moved, scope_sql="yr = ?", scope_args=[2026])
    check("a scoped load replaces, adds and deletes inside its slice", got,
          {"written": 2, "deleted": 1, "unchanged": 0})
    rows = db.conn.execute("SELECT yr, k, v FROM t ORDER BY yr, k").fetchall()
    check("rows outside the slice are untouched", rows,
          [(2025, "a", 2.0), (2026, "a", 1.75), (2026, "c", 4.0)])

    many = [(2024, f"k{i}", float(i), None) for i in range(1300)]
    got = sync_rows(db, "t", ("yr", "k"), cols, many, scope_sql="yr = ?", scope_args=[2024], per_stmt=100)
    check("a load larger than one statement writes every row", got["written"], 1300)
    gone = sync_rows(db, "t", ("yr", "k"), cols, many[:10], scope_sql="yr = ?", scope_args=[2024])
    check("and deletes past the 200-key batch", gone["deleted"], 1290)
    check("leaving exactly what was asked for",
          db.conn.execute("SELECT count(*) FROM t WHERE yr = 2024").fetchone()[0], 10)

    check("an unseen digest is not seen", seen_before(db, "rec", "abc"), False)
    keep_record(db, "rec", "abc", rows=3)
    check("a kept digest is seen", seen_before(db, "rec", "abc"), True)
    check("a different digest is not", seen_before(db, "rec", "abd"), False)

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
