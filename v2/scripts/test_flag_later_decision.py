#!/usr/bin/env python3
"""A case in two DOL files keeps its LATER decision, whatever order they load.

Three H-2B cases are in both the FY2025 Q4 and the FY2026 Q3 file. Loading
FY2025 second replaced their newer rows with older ones, because the writer
was INSERT OR REPLACE. These run the real writer against real SQLite
(lib_sqlite_shim): a canned result would pass with the clause deleted.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_flag_disclosure as fd  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

TABLE = "seasonal_cases"
FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def row(case: str, decided: str, status: str, source: str) -> dict:
    r = {c: None for c in fd.COLUMNS}
    r.update(case_number=case, case_status=status, decision_date=decided, source_file=source)
    return r


def fresh() -> SqliteTurso:
    db = SqliteTurso()
    db.script(fd.table_ddl(TABLE))
    return db


def held(db: SqliteTurso, case: str) -> tuple:
    rows = db.execute(
        f"SELECT case_status, decision_date, source_file FROM {TABLE} WHERE case_number = ?", [case]
    )["response"]["result"]["rows"]
    return tuple(c.get("value") for c in rows[0])


def main() -> int:
    new = "H-2B_Disclosure_Data_FY2026_Q3.xlsx"
    old = "H-2B_Disclosure_Data_FY2025_Q4.xlsx"

    # Newest first, then history: the newer decision stays.
    db = fresh()
    fd.write_cases(db, TABLE, [row("H-400-25200-000001", "2025-11-20", "DETERMINATION ISSUED - CERTIFICATION", new)], pause=0)
    sent, written = fd.write_cases(
        db, TABLE,
        [row("H-400-25200-000001", "2025-09-02", "DETERMINATION ISSUED - DENIED", old),
         row("H-400-25200-000002", "2025-09-03", "WITHDRAWN", old)],
        pause=0,
    )
    check("history load sent both rows", sent, 2)
    check("history load wrote only the case it had no later decision for", written, 1)
    check("the later decision stays", held(db, "H-400-25200-000001"),
          ("DETERMINATION ISSUED - CERTIFICATION", "2025-11-20", new))
    check("a case only the history file has is stored", held(db, "H-400-25200-000002")[2], old)

    # History first, then the newest: the newer decision replaces the older.
    db = fresh()
    fd.write_cases(db, TABLE, [row("H-400-25200-000001", "2025-09-02", "DETERMINATION ISSUED - DENIED", old)], pause=0)
    _, written = fd.write_cases(db, TABLE, [row("H-400-25200-000001", "2025-11-20", "DETERMINATION ISSUED - CERTIFICATION", new)], pause=0)
    check("a later decision replaces an earlier one", (written, held(db, "H-400-25200-000001")[2]), (1, new))

    # Reloading the same file always writes, even with an earlier date (DOL corrected it).
    _, written = fd.write_cases(db, TABLE, [row("H-400-25200-000001", "2025-11-18", "DETERMINATION ISSUED - CERTIFICATION", new)], pause=0)
    check("a reload of the same file is written", (written, held(db, "H-400-25200-000001")[1]), (1, "2025-11-18"))

    # A held row with no decision date never blocks.
    db = fresh()
    fd.write_cases(db, TABLE, [row("H-400-25200-000003", None, "WITHDRAWN", new)], pause=0)
    _, written = fd.write_cases(db, TABLE, [row("H-400-25200-000003", "2025-09-01", "WITHDRAWN", old)], pause=0)
    check("an undated held row is replaced", written, 1)

    print(f"\n{len(FAILED)} failed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
