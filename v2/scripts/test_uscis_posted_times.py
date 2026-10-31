#!/usr/bin/env python3
"""USCIS's posted times, read from the project's daily files (ingest_uscis_posted_times.py).

* a posting date and a figure are read as USCIS wrote them, in days, weeks and months, and a note is no figure;
* a day's file that isn't SQLite, has no table or too few rows is refused, never loaded as an empty day;
* several days carrying one posting fold into one row with its first and last day, the newest copy's figures;
* the typed fallback is compared with the newest posting by code.

Run: python3 scripts/test_uscis_posted_times.py
"""
from __future__ import annotations

import pathlib
import sqlite3
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ingest_uscis_posted_times as u  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


check("a posting date reads as USCIS wrote it", u.iso("October 19, 2026") == "2026-10-19")
check("a date in another shape is no date", u.iso("19/10/2026") is None and u.iso("") is None)
check("months stay months", u.months(32.5, "Months") == 32.5)
check("weeks and days become months", u.months(2, "Weeks") == round(14 / (365.25 / 12), 2) and u.months(15, "Days") == round(15 / (365.25 / 12), 2))
check("a note is no figure", u.months(None, "See notes") is None and u.months(3, "learn more.") is None)
check("the figure's text keeps its unit", u.text_of(32.5, "Months") == "32.5 Months" and u.text_of(3.0, "Months") == "3 Months")


def day_file(path: pathlib.Path, rows: list[tuple], *, table: bool = True) -> None:
    con = sqlite3.connect(path)
    if table:
        con.execute("CREATE TABLE processing_time (form_name, form_note_en, office_code, form_subtype, publication_date, "
                    "range_upper, range_upper_unit, range_lower, range_lower_unit, service_request_date)")
        con.executemany("INSERT INTO processing_time (form_name, office_code, form_subtype, publication_date, range_lower, "
                        "range_lower_unit, range_upper, range_upper_unit, service_request_date) VALUES (?,?,?,?,?,?,?,?,?)", rows)
        con.execute("CREATE TABLE form_types (form_name, form_key, form_type, description_en)")
        con.execute("INSERT INTO form_types VALUES ('I-140', '136A-E21', '136A-E21', 'Advanced degree or exceptional ability (E21)')")
    else:
        con.execute("CREATE TABLE other (x)")
    con.commit()
    con.close()


def day_rows(pub: str, e21: float, extra: int = 200) -> list[tuple]:
    rows = [("I-140", "SCD", "136A-E21", pub, e21, "Months", e21 + 3, "Months", "April 19, 2026")]
    rows += [("N-400", f"O{i:03d}", "160A", pub, 6.0, "Months", 9.0, "Months", "May 01, 2026") for i in range(extra)]
    return rows


with tempfile.TemporaryDirectory() as tmp:
    t = pathlib.Path(tmp)
    good = t / "good.db"
    day_file(good, day_rows("October 19, 2026", 3.0))
    rows, labels, pub = u.read_release(good, "2026-10-31")
    e21 = next(r for r in rows if r[0] == "I-140")
    check("a day's file is read row by row in the table's order",
          e21[:6] == ["I-140", "136A-E21", "SCD", "2026-10-19", 3.0, "3 Months"] and e21[8] == "2026-04-19", str(e21))
    check("the day's posting date is the date most rows carry", pub == "2026-10-19", str(pub))
    check("USCIS's own name for a subtype comes with it",
          labels.get(("subtype", "136A-E21", "I-140")) == "Advanced degree or exceptional ability (E21)")

    for name, make, why in (
        ("not SQLite", lambda p: p.write_bytes(b"<html>rate limited</html>"), "not a SQLite file"),
        ("no table", lambda p: day_file(p, [], table=False), "no processing_time table"),
        ("too few rows", lambda p: day_file(p, day_rows("October 19, 2026", 3.0, extra=5)), "rows, under"),
        ("no I-140", lambda p: day_file(p, [r for r in day_rows("October 19, 2026", 3.0) if r[0] != "I-140"]), "no I-140 rows"),
    ):
        bad = t / f"{name}.db"
        make(bad)
        try:
            u.read_release(bad, "2026-10-31")
            check(f"a file with {name} is refused", False, "it was read")
        except ValueError as exc:
            check(f"a file with {name} is refused", why in str(exc), str(exc))

# Three days of one posting, the last a correction: one row, its first and last day, the newest figures.
merged: dict = {}
for tag, val in (("2026-10-20", 3.0), ("2026-10-21", 3.0), ("2026-10-22", 3.5)):
    u.merge(merged, [["I-140", "136A-E21", "SCD", "2026-10-19", val, f"{val:g} Months", None, None, None, tag, tag]])
(row,) = merged.values()
check("days carrying one posting fold into one row", len(merged) == 1)
check("the row keeps its first and last day", row[9] == "2026-10-20" and row[10] == "2026-10-22", str(row))
check("the newest copy's figure wins", row[4] == 3.5, str(row))
u.merge(merged, [["I-140", "136A-E21", "SCD", "2026-10-19", 9.0, "9 Months", None, None, None, "2026-10-01", "2026-10-01"]])
check("an older copy read later changes the first day, not the figure", row[9] == "2026-10-01" and row[4] == 3.5, str(row))

# The typed fallback, read the way the loader reads it.
typed = u.hand_figures()
check("the typed I-140 figures are found by code", {"E11", "E21", "E31", "NIW"} <= set(typed), str(sorted(typed)))
check("the pattern reads a figure, not a premium-processing day count",
      u.HAND_RE.findall('{ code: "E21", label: "x", months80: 3, premiumBusinessDays: 15 }') == [("E21", "3")])

print(f"\n{len(failures)} failure(s)" if failures else "\nall passed")
sys.exit(1 if failures else 0)
