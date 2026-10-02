#!/usr/bin/env python3
"""Contract tests for ingest_sevp_top_employers.py, offline.

The word positions mimic what pdfplumber reads off ICE's 2024 OPT list (read
2026-10-01): right-aligned counts at three right edges, a title and a header
that carry numbers of their own, and a row with a blank STEM OPT cell.
Run: python3 scripts/test_sevp_top_employers.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_sevp_top_employers as sevp  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FAILS: list[str] = []
N = 0
EDGES = (431, 574, 744)


def check(label, got, want) -> None:
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


def refuses(label, fn) -> None:
    global N
    N += 1
    try:
        fn()
    except sevp.Refusal:
        return
    FAILS.append(f"{label}: did not refuse")


def line(top: float, name: str, counts: list[str | None]) -> list[dict]:
    words, x = [], 70.0
    for t in name.split():
        words.append({"text": t, "x0": x, "x1": x + 6 * len(t), "top": top})
        x += 6 * len(t) + 3
    for edge, c in zip(EDGES, counts):
        if c is not None:
            words.append({"text": c, "x0": edge - 6 * len(c), "x1": edge, "top": top})
    return words


def header() -> list[dict]:
    return line(83, "2024 Top 200 Employers for OPT and STEM-OPT Students**", []) + \
        line(142, "Top 200 Employer Names Number of Students in 2024", [])


def opt_list(n: int = 200, blank_at: int = 15) -> list[list[dict]]:
    words = header()
    for i in range(n):
        total = 10_000 - i * 10
        stem = None if i == blank_at else f"{total // 2:,}"
        opt = f"{total if i == blank_at else total // 2 + 5:,}"
        words += line(163 + i * 14.5, f"Employer {chr(65 + i % 26)}{i}", [f"{total:,}", opt, stem])
    return [words]


def test_identify() -> None:
    check("2024 OPT", sevp.identify("2024_Top200_Employers_OPT_STEM_OPT_Students.pdf"), (2024, "opt"))
    check("2019 CPT", sevp.identify("20_0903_hsi_sevp-sevis-btn-2019-top200-employers-cpt-students.pdf"), (2019, "cpt"))
    check("the year inside a dated prefix", sevp.identify("17_0623_hsi_sevp-sevis-btn-2017-top200-employers-stem-opt-students.pdf"), (2017, "opt"))
    check("a cumulative list is skipped",
          sevp.identify("20_0903_hsi_sevp-sevis-btn-2019-top200-employers-prepost-completion-opt-students-2003-2019.pdf"), None)
    check("a school list is skipped", sevp.identify("2024_Top100_PrimaryMajors.pdf"), None)


def test_parse() -> None:
    rows = sevp.parse(opt_list(), "opt")
    check("two hundred employers", len(rows), 200)
    check("the title and header numbers are not rows", rows[0]["employer"], "Employer A0")
    check("ranked in printed order", [r["rank"] for r in rows[:3]], [1, 2, 3])
    blank = rows[15]
    check("a blank STEM OPT cell stays blank, not shifted", (blank["opt"], blank["stem_opt"]), (blank["total"], None))
    check("a full row", (rows[0]["total"], rows[0]["opt"], rows[0]["stem_opt"]), (10_000, 5_005, 5_000))


def test_refusals() -> None:
    refuses("a short list", lambda: sevp.parse(opt_list(n=150), "opt"))
    pages = opt_list()
    pages[0] += line(163 + 3 * 14.5 + 7, "WRAPPED NAME HALF", [])
    refuses("a wrapped name between rows", lambda: sevp.parse(pages, "opt"))
    bad = opt_list()
    for w in bad[0]:
        if w["text"] == "5,005":
            w["text"] = "10,001"  # an OPT count above the combined count
    refuses("a combined count below one of its parts", lambda: sevp.parse(bad, "opt"))
    shuffled = opt_list()
    tops = sorted({w["top"] for w in shuffled[0] if w["top"] >= 163})
    swap = {tops[10]: tops[50], tops[50]: tops[10], tops[20]: tops[60], tops[60]: tops[20], tops[30]: tops[70], tops[70]: tops[30]}
    for w in shuffled[0]:
        w["top"] = swap.get(w["top"], w["top"])
    refuses("rows read out of order", lambda: sevp.parse(shuffled, "opt"))


def test_as_printed() -> None:
    rows = sevp.parse(opt_list(), "opt")
    rows[8], rows[9] = rows[9], rows[8]
    check("one slip of ICE's is named, not refused", len(sevp.out_of_order(rows)), 1)


def test_store() -> None:
    db = SqliteTurso()
    rows = sevp.parse(opt_list(), "opt")
    check("stored", sevp.store(db, 2024, "opt", rows, "f.pdf"), 200)
    sevp.store(db, 2024, "opt", rows[:195] + rows[195:], "f.pdf")
    check("a reload replaces the list", int(db.scalar(f"SELECT count(*) FROM {sevp.TABLE}")), 200)


def main() -> int:
    for t in (test_identify, test_parse, test_refusals, test_as_printed, test_store):
        t()
    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
