#!/usr/bin/env python3
"""ingest_niv_issuances: State's file names, the workbook's total and its formula, the PDF reader,
the Internet Archive's index, and main() end to end on real SQLite.

The fixtures are State's own files, trimmed: February 2026's workbook cut to its first 38 rows
with its GRAND TOTAL formula and cached sum set to match them, the last page of June 2020's PDF,
and the first page of February 2017's table by post and nationality.

Run: python3 scripts/test_niv_issuances.py
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ingest_niv_issuances as niv  # noqa: E402
from lib_db import query_rows, read_doc  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402
from lib_test_xlsx import Formula, xlsx_bytes  # noqa: E402

FIX = HERE / "fixtures" / "niv"
FAILS: list[str] = []
N = 0


def check(label, got, want=True):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


def refused(fn, *args) -> str:
    """The refusal's message, or '' when there was none."""
    try:
        fn(*args)
    except niv.Refusal as exc:
        return str(exc)
    return ""


def fresh_db() -> SqliteTurso:
    """An empty database with the table every deployment already holds."""
    db = SqliteTurso()
    db.execute("CREATE TABLE IF NOT EXISTS perm_docs (key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)")
    return db


def words(*items, top=100.0):
    return [{"text": t, "x0": a, "x1": b, "top": top} for t, a, b in items]


def book(rows: list[list]) -> bytes:
    return xlsx_bytes({"Sheet1": [["Nonimmigrant Visa Issuances by Post   February 2026 (FY 2026)"],
                                  ["Post", "Visa Class", "Issuances"], *rows]})


def main() -> int:
    os.environ.pop("REVALIDATE_SECRET", None)
    # --- State's file names ---------------------------------------------------------------
    for name, want in [("FEBRUARY 2026 - NIV Issuances by Post and Visa Class.xlsx", "2026-02"),
                       ("APRIL 2024  - NIV Issuances by Post and Visa Class.xlsx", "2024-04"),
                       ("June 2020 - NIV Issuances by Post and Visa Class.pdf", "2020-06"),
                       ("JUNE 2021 -- NIV Issuances by Post and Visa Class.pdf", "2021-06"),
                       ("AUGUST 2020 -  NIV Issuances by Post and Visa Class.pdf", "2020-08"),
                       ("FEB 2017 NIV Issuances by Post.pdf", "2017-02")]:
        check(f"month of {name[:26]}", niv.month_of(name), want)
    check("a by-post file", niv.is_by_post("MAY 2025 - NIV Issuances by Post and Visa Class.xlsx"))
    check("a by-nationality file isn't", niv.is_by_post("MAY 2025 - NIV Issuances by Nationality and Visa Class.pdf"), False)

    html = "".join(f'<a href="{niv.DAM}{h}">' for h in [
        "FEBRUARY%202026%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.pdf",
        "Excel/FY2026/FEBRUARY%202026%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.xlsx",
        "FEBRUARY%202026%20-%20NIV%20Issuances%20by%20Nationality%20and%20Visa%20Class.pdf",
        "MARCH%202019%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.pdf"])
    found = niv.listing(html)
    check("one by-post file a month", sorted(found), ["2019-03", "2026-02"])
    check("the workbook when a month has both", found["2026-02"].endswith(".xlsx"))

    # --- the workbook ---------------------------------------------------------------------
    saved = niv.MIN_ROWS
    niv.MIN_ROWS = 1
    try:
        real = (FIX / "niv-post-2026-02-trimmed.xlsx").read_bytes()
        rows, titled = niv.from_xlsx(real, "fixture")
        check("the trimmed workbook: 38 rows", len(rows), 38)
        check("its rows add to its own GRAND TOTAL", sum(rows.values()), 1491)
        check("its title's month", titled, "2026-02")
        check("a row keyed by post and class", rows.get(("Abidjan", "B1/B2")), 22)

        good = [["Mumbai", "H1B", "1,204"], ["Mumbai", "L1", "96"], ["Mumbai", "K1", "3"]]
        check("a GRAND TOTAL formula over exactly the rows passes",
              niv.from_xlsx(book(good + [["GRAND TOTAL", "", Formula("SUM(C3:C5)", 1303)]]), "t")[0],
              {("Mumbai", "H1B"): 1204, ("Mumbai", "L1"): 96, ("Mumbai", "K1"): 3})
        check("a formula with no cached value passes on its range",
              len(niv.from_xlsx(book(good + [["GRAND TOTAL", "", Formula("SUM(C3:C5)")]]), "t")[0]), 3)
        check("a plain number total passes", len(niv.from_xlsx(book(good + [["GRAND TOTAL", "", "1303"]]), "t")[0]), 3)
        check("a formula that leaves a row out is refused",
              "sums rows 3 to 4" in refused(niv.from_xlsx, book(good + [["GRAND TOTAL", "", Formula("SUM(C3:C4)", 1303)]]), "t"))
        check("a cached sum that disagrees is refused",
              "GRAND TOTAL says 1,300" in refused(niv.from_xlsx, book(good + [["GRAND TOTAL", "", Formula("SUM(C3:C5)", 1300)]]), "t"))
        check("a number total that disagrees is refused",
              "rows add to 1,303" in refused(niv.from_xlsx, book(good + [["GRAND TOTAL", "", "1302"]]), "t"))
        check("no GRAND TOTAL is refused", "no GRAND TOTAL" in refused(niv.from_xlsx, book(good), "t"))
        check("an empty GRAND TOTAL is refused",
              "holds no figure" in refused(niv.from_xlsx, book(good + [["GRAND TOTAL", "", ""]]), "t"))
        check("a formula this doesn't read is refused",
              "doesn't read" in refused(niv.from_xlsx, book(good + [["GRAND TOTAL", "", Formula("SUBTOTAL(9,C3:C5)", 1303)]]), "t"))
        check("a row that isn't a post, a class and a count is refused",
              "row 4" in refused(niv.from_xlsx, book([good[0], ["Mumbai", "Visitors", "9"], good[2], ["GRAND TOTAL", "", "1207"]]), "t"))
        check("no header row is refused", "header" in refused(niv.from_xlsx, xlsx_bytes({"Sheet1": good}), "t"))
        check("rows after the total aren't read",
              len(niv.from_xlsx(book(good + [["GRAND TOTAL", "", "1303"], ["Note", "X1", "5"]]), "t")[0]), 3)
    finally:
        niv.MIN_ROWS = saved
    check("a full month's floor still applies", "only 38 rows" in refused(niv.from_xlsx, real, "fixture"))

    # --- the PDF ----------------------------------------------------------------------------
    check("a class pattern for State's nonimmigrant symbols",
          [bool(niv.NIV_CLASS.match(s)) for s in ("H1B", "B1/B2", "NATO2", "C1/D", "C4/D3", "BBBCC", "E2C", "I", "Total", "of")],
          [True, True, True, True, True, True, True, True, False, False])
    lines = [words(("Nonimmigrant", 160, 269), ("Visa", 274, 307), ("Issuances", 311, 389), ("by", 393, 412), ("Post", 416, 451)),
             words(("Post", 196, 220), ("Visa", 370, 392), ("Class", 395, 425), ("Issuances", 468, 522)),
             words(("Abu", 183, 203), ("Dhabi", 205, 233), ("B1/B2", 383, 411), ("1", 486, 491), (",204", 491, 512)),
             words(("Abu", 183, 203), ("Dhabi", 205, 233), ("NATO2", 380, 414), ("7", 492, 498)),
             words(("Page", 276, 297), ("1", 300, 305), ("of", 308, 317), ("2", 319, 325)),
             words(("Grand", 139, 175), ("Total", 178, 208), ("1,211", 450, 496))]
    rows = niv.iv.rows_from_lines(lines, "t", niv.NIV_CLASS, 1)
    check("the PDF reader takes the NIV classes and a lower-case Grand Total",
          rows, {("Abu Dhabi", "B1/B2"): 1204, ("Abu Dhabi", "NATO2"): 7})
    jun = (FIX / "niv-post-2020-06-last-page.pdf").read_bytes()
    msg = refused(niv.parse, jun, "June 2020 - NIV Issuances by Post and Visa Class.pdf")
    check("one page of a 33-page month is refused against State's own total", "GRAND TOTAL says 46,435" in msg, True)
    feb = (FIX / "niv-post-and-nationality-2017-02-first-page.pdf").read_bytes()
    check("a table split by nationality too is refused, never guessed at",
          "nationality" in refused(niv.parse, feb, "FEB 2017 NIV Issuances by Post.pdf"))
    check("a file that's neither a workbook nor a PDF is refused", "neither" in refused(niv.parse, b"<html>", "x.xlsx"))

    # --- one key per post -------------------------------------------------------------------
    rows = niv.table_rows("2026-02", {("China - mainland born", "H1B"): 2, ("China-mainland born", "H1B"): 3, ("Mumbai", "K1"): 1})
    check("two spellings of one post are one row", [(r[1], r[2], r[4]) for r in rows],
          [("china - mainland born", "H1B", 5), ("mumbai", "K1", 1)])

    # --- the Internet Archive's index ---------------------------------------------------------
    base = "https://travel.state.gov" + niv.DAM
    cdx = [["timestamp", "original"],
           ["20240913172329", base + "APRIL%202024%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.pdf"],
           ["20250122213557", base + "APRIL%202024%20%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.pdf"],
           ["20240929194242", base + "Excel/FY2024/APRIL%202024%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.xlsx"],
           ["20170526032738", base + "APRIL%202017%20-%20NIV%20Issuances%20by%20Nationality%20and%20Visa%20Class.pdf"],
           ["20170702205907", base + "APRIL%202017%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.pdf?ncid=x"],
           ["20170526032740", base + "APRIL%202017%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.pdf"],
           ["20201018054314", base + "FEBRUARY%202020%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.pdf"]]
    saved_fetch = niv.fetch
    niv.fetch = lambda url, **_: json.dumps(cdx).encode()
    try:
        files = niv.archive_files()
    finally:
        niv.fetch = saved_fetch
    check("the Archive's months, by post only", sorted(files), ["2017-04", "2020-02", "2024-04"])
    check("a month's workbook wins over its PDFs", files["2024-04"][1].endswith(".xlsx"))
    check("a capture with a query string isn't used", files["2017-04"][0], "20170526032740")

    # --- main(), end to end -------------------------------------------------------------------
    def run(argv, database) -> int:
        saved_argv, saved_db = sys.argv, niv.Database
        sys.argv, niv.Database = ["ingest_niv_issuances.py", *argv], (lambda: database)
        try:
            return niv.main()
        finally:
            sys.argv, niv.Database = saved_argv, saved_db

    niv.MIN_ROWS = 1
    try:
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "FEBRUARY 2026 - NIV Issuances by Post and Visa Class.xlsx"
            path.write_bytes(real)
            db = fresh_db()
            first, second = run(["--local", str(path)], db), run(["--local", str(path)], db)
            check("two loads of one file both succeed", (first, second), (0, 0))
            check("38 rows stored", query_rows(db, f"SELECT count(*), sum(n) FROM {niv.TABLE}"), [["38", "1491"]])
            check("the second load writes nothing",
                  [int(r[0]) for r in query_rows(db, "SELECT rows_written FROM ingest_runs ORDER BY id")], [38, 0])
            check("freshness: the month's last day and its budget",
                  query_rows(db, "SELECT as_of, max_age_days FROM data_freshness WHERE dataset = 'niv-issuances'"),
                  [["2026-02-28", str(niv.MAX_AGE_DAYS)]])
            doc = read_doc(db, niv.SUMMARY) or {}
            check("the summary names the newest month and its total", (doc.get("newest"), doc.get("totalByMonth")),
                  ("2026-02", {"2026-02": 1491}))
            check("the summary counts the classes the pages lead with", sorted(doc.get("classByMonth", {})), sorted(niv.SUMMARY_CLASSES))

            wrong = pathlib.Path(tmp) / "MARCH 2026 - NIV Issuances by Post and Visa Class.xlsx"
            wrong.write_bytes(real)
            bad = fresh_db()
            check("a file loaded as another month than its title says is refused", run(["--local", str(wrong)], bad), 1)
            check("and nothing is written", query_rows(bad, "SELECT name FROM sqlite_master WHERE name = ?", [niv.TABLE]), [])
            check("its run row says why", [r[0] for r in query_rows(bad, "SELECT status FROM ingest_runs")], ["failed"])
            check("--month names one file only", _exits(run, ["--local", str(path), str(wrong), "--month", "2026-02"], db))

        # --archive: the Internet Archive's index, then each month's file, with nothing asked of State.
        febx = base + "Excel/FY2026/FEBRUARY%202026%20-%20NIV%20Issuances%20by%20Post%20and%20Visa%20Class.xlsx"
        index = [["timestamp", "original"], ["20260430114950", febx],
                 ["20170405011410", base + "FEB%202017%20NIV%20Issuances%20by%20Post.pdf"]]
        asked: list[str] = []

        def archive_fetch(url, **_):
            asked.append(url)
            if url.startswith(niv.CDX):
                return json.dumps(index).encode()
            if "FEBRUARY%202026" in url:
                return real
            raise AssertionError(f"asked for {url}")

        saved_fetch, saved_pause = niv.fetch, niv.ARCHIVE_PAUSE_S
        niv.fetch, niv.ARCHIVE_PAUSE_S = archive_fetch, 0
        try:
            adb = fresh_db()
            check("the Archive's months load", run(["--archive"], adb), 0)
            check("its file is fetched as the Archive stored it, and February 2017 isn't asked for",
                  [u for u in asked if not u.startswith(niv.CDX)], [f"https://web.archive.org/web/20260430114950id_/{febx}"])
            check("the month is stored", query_rows(adb, f"SELECT count(*) FROM {niv.TABLE} WHERE month = '2026-02'"), [["38"]])
            asked.clear()
            check("a second walk skips a month already held", (run(["--archive"], adb), [u for u in asked if not u.startswith(niv.CDX)]), (0, []))

            def refusing(url, **_):
                if url.startswith(niv.CDX):
                    return json.dumps(index).encode()
                raise niv.urllib.error.HTTPError(url, 429, "Too Many Requests", {}, None)

            niv.fetch = refusing
            rdb = fresh_db()
            check("an Archive that stops answering ends the walk without failing it", run(["--archive"], rdb), 0)
            check("and says where it stopped", "stopped answering at 2026-02" in str(query_rows(rdb, "SELECT note FROM ingest_runs")))
        finally:
            niv.fetch, niv.ARCHIVE_PAUSE_S = saved_fetch, saved_pause
    finally:
        niv.MIN_ROWS = saved

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


def _exits(run, argv, db) -> bool:
    """argparse's error exits with code 2."""
    try:
        run(argv, db)
    except SystemExit as exc:
        return exc.code == 2
    return False


if __name__ == "__main__":
    sys.exit(main())
