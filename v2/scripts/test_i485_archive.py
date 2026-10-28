"""ingest_i485_inventory.py --archive: which months it asks the Internet Archive for, and what it records."""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_i485_inventory as inv  # noqa: E402
import lib_warn  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILED: list[str] = []
BASE = "https://www.uscis.gov/sites/default/files/document/data/"


def check(name: str, got, want) -> None:
    ok = got == want
    print(("ok  " if ok else "FAIL") + f" {name}" + ("" if ok else f": got {got!r}, want {want!r}"))
    if not ok:
        FAILED.append(name)


def main() -> int:
    REPORTS = BASE.replace("/data/", "/reports/")
    by_prefix = {
        inv.ARCHIVE_PREFIXES[0]: [
            BASE + "eb_inventory_april_2024_071924.xlsx",
            BASE + "eb_inventory_december_2025.xlsx",
            BASE + "eb_inventory_april_2024_062524.xlsx",
            BASE + "eb_inventory_june_2026_v1.0.xlsx",
            BASE + "eb_inventory_smarch_2025.xlsx",
        ],
        inv.ARCHIVE_PREFIXES[1]: [
            REPORTS + "eb_inventory_02222024.xlsx",
            REPORTS + "eb_inventory_feb_2023.xlsx",
            REPORTS + "eb_inventory_march_2024_061224.xlsx",
            # The same file reached in both folders is read once.
            REPORTS + "eb_inventory_december_2025.xlsx",
        ],
    }
    lib_warn.archive_index = lambda prefix, pattern: by_prefix[prefix]
    got = inv.archive_workbooks({"2025-12"})
    check("both folders and both name forms, oldest first; a held month and an unplaceable name are skipped",
          [label for _, label in got],
          ["2023-02", "published 2024-02-22", "2024-03", "2024-04", "2024-04", "2026-06"])
    check("a month written by its first three letters is read", inv.name_month("eb_inventory_feb_2023.xlsx"), (2023, 2))
    check("a dated name says its day, not its month", (inv.name_month("eb_inventory_02222024.xlsx"),
          inv.name_date("eb_inventory_02222024.xlsx")), (None, "2024-02-22"))
    check("a reissued month is read last by its later name, so its rows are kept",
          [u.rsplit("_", 1)[-1] for u, label in got if label == "2024-04"], ["062524.xlsx", "071924.xlsx"])
    again = inv.archive_workbooks({"2025-12"}, {"eb_inventory_02222024.xlsx"})
    check("a dated file already loaded isn't asked for again", any("02222024" in u for u, _ in again), False)

    db = SqliteTurso()
    db.execute("CREATE TABLE i485_inventory (as_of TEXT, country TEXT, category TEXT, status TEXT, pd_year TEXT, "
               "pd_month INTEGER, count INTEGER, suppressed INTEGER)")
    db.execute("CREATE TABLE ingest_runs (id INTEGER PRIMARY KEY, script TEXT, status TEXT, rows_written INTEGER, "
               "note TEXT, started_at INTEGER, finished_at INTEGER)")
    db.execute("CREATE TABLE perm_docs (key TEXT PRIMARY KEY, json TEXT, computed_at INTEGER)")

    def no_copy(url, accept=None, newest=12):
        raise LookupError("never captured whole")
    lib_warn.archive_copy = no_copy
    check("a month the Archive can't serve leaves the run going", inv.load_archive(db), 0)
    rows = db.execute("SELECT script, status, note FROM ingest_runs")["response"]["result"]["rows"]
    last = [c.get("value") for c in rows[-1]]
    check("a refusing Archive is no failure of ours: the run is ok, under its own name", (last[0], last[1]),
          ("ingest_i485_inventory.py --archive", "ok"))
    check("and the note names the months to ask for again", "2024-04" in last[2] and "2026-06" in last[2], True)

    lib_warn.archive_copy = lambda url, accept=None, newest=12: lib_warn.ArchiveCopy(b"PK", "2025-01-01", url)
    inv.parse_workbook = lambda blob: (None, [])
    inv.load_archive(db)
    rows = db.execute("SELECT status, note FROM ingest_runs")["response"]["result"]["rows"]
    last = [c.get("value") for c in rows[-1]]
    check("a copy that parses to nothing is ours to look at: partial, named", (last[0], "parsed to nothing" in last[1]),
          ("partial", True))

    inv.parse_workbook = lambda blob: ("2024-01-31", [{"country": "india", "category": "EB2", "status": "Awaiting",
                                                      "pd_year": "2015", "pd_month": 1, "count": 9, "suppressed": 0}])
    inv.store = lambda db_, as_of, records: len(records)
    inv.load_archive(db)
    held = db.execute("SELECT json FROM perm_docs WHERE key = ?", [inv.LOADED_DOC])["response"]["result"]["rows"]
    check("a loaded file's name is remembered", "eb_inventory_02222024.xlsx" in (held[0][0].get("value") if held else ""), True)
    print(f"{len(FAILED)} failure(s)")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
