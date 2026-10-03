#!/usr/bin/env python3
"""perm_docs['seasonal_timing'], built on real SQLite (lib_sqlite_shim).

The percentiles are nearest rank over certifications only, a visa under the
floor gets no block, and H-2A carries the share decided 30 days ahead.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_seasonal_timing as bst  # noqa: E402
import ingest_flag_disclosure as fd  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def main() -> int:
    check("nearest rank on a histogram", bst.percentiles({d: 1 for d in range(1, 101)}),
          {"n": 100, "p10": 10, "p25": 25, "p50": 50, "p75": 75, "p90": 90})
    check("under the floor answers nothing", bst.percentiles({5: bst.MIN_N - 1}), None)

    db = SqliteTurso()
    db.script(fd.table_ddl("seasonal_cases"))
    rows = []
    # 60 H-2A certifications: received day 0, decided day 20, work starting
    # 10 to 69 days after the decision, so 40 of 60 are 30+ days ahead.
    for i in range(60):
        rows.append((f"H-300-25001-{i:06d}", "H-2A", "DETERMINATION ISSUED - CERTIFICATION",
                     "2025-01-01", "2025-01-21", f"2025-{1 + (21 + 10 + i) // 31:02d}-01"))
    # A denial and a withdrawal must not count.
    rows.append(("H-300-25001-900000", "H-2A", "DETERMINATION ISSUED - DENIED", "2025-01-01", "2025-06-01", "2025-07-01"))
    rows.append(("H-300-25001-900001", "H-2A", "DETERMINATION ISSUED - WITHDRAWN", "2025-01-01", "2025-06-01", "2025-07-01"))
    # Ten CW-1 certifications: under the floor, so no block.
    for i in range(10):
        rows.append((f"C-500-25001-{i:06d}", "CW-1", "DETERMINATION ISSUED - CERTIFICATION", "2025-01-01", "2025-02-01", "2025-03-01"))
    for cn, visa, status, rec, dec, begin in rows:
        db.execute("INSERT INTO seasonal_cases (case_number, visa_class, case_status, received_date, decision_date, "
                   "begin_date, source_file) VALUES (?,?,?,?,?,?,?)", [cn, visa, status, rec, dec, begin, "f.xlsx"])

    doc = bst.build(db)
    h2a = doc.get("H-2A") or {}
    check("H-2A counts certifications only", (h2a.get("daysToDecision") or {}).get("n"), 60)
    check("H-2A days to decision", (h2a.get("daysToDecision") or {}).get("p50"), 20)
    check("CW-1 under the floor has no block", "CW-1" in doc, False)
    check("H-2B with no rows has no block", "H-2B" in doc, False)
    lead = h2a.get("leadDays") or {}
    on_time = h2a.get("onTime") or {}
    want_share = round(sum(1 for d in lead_days(rows) if d >= 30) / 60, 4)
    check("H-2A on-time share is the share 30+ days ahead", on_time.get("share"), want_share)
    check("percentiles rise", lead.get("p10", 0) <= lead.get("p50", 0) <= lead.get("p90", 0), True)

    print(f"\n{len(FAILED)} failed")
    return 1 if FAILED else 0


def lead_days(rows) -> list[int]:
    from datetime import date
    out = []
    for cn, visa, status, _rec, dec, begin in rows:
        if visa == "H-2A" and status == "DETERMINATION ISSUED - CERTIFICATION":
            out.append((date.fromisoformat(begin) - date.fromisoformat(dec)).days)
    return out


if __name__ == "__main__":
    sys.exit(main())
