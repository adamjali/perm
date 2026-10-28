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
    lib_warn.archive_index = lambda prefix, pattern: [
        BASE + "eb_inventory_april_2024_071924.xlsx",
        BASE + "eb_inventory_december_2025.xlsx",
        BASE + "eb_inventory_april_2024_062524.xlsx",
        BASE + "eb_inventory_june_2026_v1.0.xlsx",
        BASE + "eb_inventory_smarch_2025.xlsx",
    ]
    got = inv.archive_workbooks({"2025-12"})
    check("a month already held isn't asked for, and a name that isn't a month is skipped",
          [label for _, label in got], ["2024-04", "2024-04", "2026-06"])
    check("a reissued month is read last by its later name, so its rows are kept",
          [u.rsplit("_", 1)[-1] for u, _ in got[:2]], ["062524.xlsx", "071924.xlsx"])

    db = SqliteTurso()
    db.execute("CREATE TABLE i485_inventory (as_of TEXT, country TEXT, category TEXT, status TEXT, pd_year TEXT, "
               "pd_month INTEGER, count INTEGER, suppressed INTEGER)")
    db.execute("CREATE TABLE ingest_runs (id INTEGER PRIMARY KEY, script TEXT, status TEXT, rows_written INTEGER, "
               "note TEXT, started_at INTEGER, finished_at INTEGER)")

    def no_copy(url, accept=None, newest=12):
        raise LookupError("never captured whole")
    lib_warn.archive_copy = no_copy
    check("a month the Archive can't serve leaves the run going", inv.load_archive(db), 0)
    rows = db.execute("SELECT script, status, note FROM ingest_runs")["response"]["result"]["rows"]
    last = [c.get("value") for c in rows[-1]]
    check("the run is recorded under its own name, partial, naming the months", (last[0], last[1]),
          ("ingest_i485_inventory.py --archive", "partial"))
    check("and the note names them", "2024-04" in last[2] and "2026-06" in last[2], True)
    print(f"{len(FAILED)} failure(s)")
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
