#!/usr/bin/env python3
"""seasonal_employer_index on real SQLite (lib_sqlite_shim).

Only employers with no page yet get a row; cases are counted once across the
live and published tables and split by visa from the case-number prefix; ranks
are dense by first filing; an unchanged rebuild writes nothing; changed pages
join the nightly expiry list.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_seasonal_employers as bse  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILED: list[str] = []


def check(name: str, got, want) -> None:
    ok = got == want
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {got!r}" + ("" if ok else f" (want {want!r})"))
    if not ok:
        FAILED.append(name)


def seed() -> SqliteTurso:
    db = SqliteTurso()
    db.script([
        "CREATE TABLE perm_entities (kind TEXT, slug TEXT)",
        "CREATE TABLE perm_entity_alias (kind TEXT, slug TEXT, target_slug TEXT)",
        "CREATE TABLE perm_live_only_index (slug TEXT)",
        """CREATE TABLE seasonal_case_status (case_number TEXT PRIMARY KEY, filing_date TEXT,
             employer_name TEXT, employer_slug TEXT, fetched_at INTEGER)""",
        """CREATE TABLE seasonal_cases (case_number TEXT PRIMARY KEY, received_date TEXT,
             decision_date TEXT, employer_name TEXT, employer_slug TEXT)""",
        "INSERT INTO perm_entities VALUES ('employer', 'big-perm-sponsor')",
        "INSERT INTO perm_entity_alias VALUES ('employer', 'old-spelling-inc', 'big-perm-sponsor')",
        "INSERT INTO perm_live_only_index VALUES ('new-perm-filer')",
    ])
    live = [
        ("H-300-26100-000001", "2026-04-10", "Green Acres Farm LLC", "green-acres-farm-llc", 1790000000000),
        ("JO-A-300-26100-000002", "2026-04-10", "Green Acres Farm LLC", "green-acres-farm-llc", 1790000000000),
        ("H-400-25300-000003", "2025-10-27", "Shore Crabs", "shore-crabs", 1760000000000),
        ("H-300-26100-000004", "2026-04-10", "Big PERM Sponsor", "big-perm-sponsor", 1790000000000),
        ("H-300-26100-000005", "2026-04-10", "Old Spelling Inc", "old-spelling-inc", 1790000000000),
        ("H-300-26100-000006", "2026-04-10", "New PERM Filer", "new-perm-filer", 1790000000000),
    ]
    for r in live:
        db.execute("INSERT INTO seasonal_case_status VALUES (?,?,?,?,?)", list(r))
    published = [
        # Also in the live table: counted once.
        ("H-400-25300-000003", "2025-10-27", "2025-12-01", "SHORE CRABS", "shore-crabs"),
        ("C-500-25200-000007", "2025-07-19", "2025-09-01", "Saipan Tours", "saipan-tours"),
        ("P-500-25200-000008", "2025-07-18", "2025-08-01", "Saipan Tours", "saipan-tours"),
    ]
    for r in published:
        db.execute("INSERT INTO seasonal_cases VALUES (?,?,?,?,?)", list(r))
    return db


def main() -> int:
    db = seed()
    taken = bse.taken_slugs(db)
    check("published, aliased and live-only slugs are taken",
          sorted(taken), ["big-perm-sponsor", "new-perm-filer", "old-spelling-inc"])
    want = bse.build_rows(bse.read_cases(db), taken)
    by = {r[0]: r for r in want}
    check("only seasonal-only employers get a row", sorted(by), ["green-acres-farm-llc", "saipan-tours", "shore-crabs"])
    check("a case in both tables counts once", by["shore-crabs"][2], 1)
    check("the job order counts as H-2A", (by["green-acres-farm-llc"][2], by["green-acres-farm-llc"][3]), (2, 2))
    check("CW-1 application and wage request both count as CW-1", by["saipan-tours"][5], 2)
    check("ranked by first filing", [r[0] for r in want], ["saipan-tours", "shore-crabs", "green-acres-farm-llc"])
    check("ranks are dense", [r[7] for r in want], [1, 2, 3])
    check("last changed is the newest decision", by["saipan-tours"][8], "2025-09-01")

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "changed.json")
        json.dump({"slugs": ["big-perm-sponsor"]}, open(path, "w"))
        changed, gone, slugs = bse.write_index(db, want)
        check("first build writes every row", (changed, gone), (3, 0))
        added = bse.add_changed_slugs(slugs, path)
        check("changed pages join the expiry list after the sweep's own",
              json.load(open(path))["slugs"], ["big-perm-sponsor", *[w[0] for w in want]])
        check("count added", added, 3)
        changed, gone, _ = bse.write_index(db, want)
        check("an unchanged rebuild writes nothing", (changed, gone), (0, 0))
        check("no expiry file, nothing added", bse.add_changed_slugs(["x"], os.path.join(tmp, "none.json")), 0)

    # A slug that becomes a PERM employer leaves the family on the next build.
    db.execute("INSERT INTO perm_entities VALUES ('employer', 'shore-crabs')")
    want2 = bse.build_rows(bse.read_cases(db), bse.taken_slugs(db))
    changed, gone, _ = bse.write_index(db, want2)
    check("a new PERM sponsor is removed", gone, 1)
    check("ranks re-dense after removal", [r[7] for r in want2], [1, 2])

    print(f"\n{len(FAILED)} failed")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
