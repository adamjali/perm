#!/usr/bin/env python3
"""ingest_visa_refusals: State's table of visa ineligibilities by ground, read from its own PDFs.

The fixtures are State's files byte for byte (SHA-256 checked against the copies read in a
browser on Nov 5 2026): FY2000, whose figures sit on a ground's last line and whose "not
applicable" cells are footnote markers, and FY2022 to FY2024, whose figures sit on a ground's
first line. Public charge, 212(a)(4), must come out exactly as State printed it, and every
year's grounds must add up to State's own total line.

Run: python3 scripts/test_visa_refusals.py
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ingest_visa_refusals as R  # noqa: E402
from lib_db import query_rows, read_doc  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FIX = HERE / "fixtures" / "visa_refusals"
FAILS: list[str] = []
N = 0

# State's own figures for 212(a)(4), read off each PDF: IV found, IV overcome, NIV found, NIV overcome.
PUBLIC_CHARGE = {2000: (46450, 30165, 825, 62), 2022: (678, 2063, 93, 21), 2023: (452, 766, 86, 8),
                 2024: (1008, 846, 74, 30)}
TOTALS = {2000: (273021, 178163, 2452185, 310899), 2024: (273845, 216929, 3891139, 699371)}


def check(label, got, want=True):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


def refused(fn, *args) -> str:
    try:
        fn(*args)
    except R.Refusal as exc:
        return str(exc)
    return ""


def ground(table: dict, code: str) -> list[dict]:
    return [g for g in table["grounds"] if g["ground_code"] == code]


def safe(fn, *args) -> dict:
    """A table that should read; a refusal is a failed check, not a crash."""
    try:
        return fn(*args)
    except R.Refusal as exc:
        FAILS.append(f"refused: {exc}")
        return {"grounds": [{"ground_code": "", "ground": ""}]}


def first(table: dict, code: str) -> dict:
    """A ground's row, or an empty one (every figure None) when the table lacks it."""
    got = ground(table, code)
    return got[0] if got else {"ground": "", **{c: None for c in R.FIGURES}}


def line(code=(), desc=(), figures=None) -> dict:
    return {"code": list(code), "desc": list(desc), "figures": figures}


def load(fy: int) -> dict:
    """A fixture's table; a refusal is a failed check, not a crash, so every other check still runs."""
    try:
        return R.parse((FIX / f"fy{fy}_ineligibilities.pdf").read_bytes(), f"fy{fy}")
    except R.Refusal as exc:
        FAILS.append(f"FY{fy} was refused: {exc}")
        return {"fy": None, "grounds": [], "totals": {}, "knownGaps": []}


def main() -> int:
    os.environ.pop("REVALIDATE_SECRET", None)
    tables = {fy: load(fy) for fy in PUBLIC_CHARGE}

    # --- State's own figures -----------------------------------------------------------------
    for fy, want in PUBLIC_CHARGE.items():
        pc = ground(tables[fy], "212(a)(4)")
        check(f"FY{fy}: one public charge row", len(pc), 1)
        check(f"FY{fy}: public charge as State printed it", tuple(pc[0][c] for c in R.FIGURES) if pc else None, want)
        check(f"FY{fy}: the title's year", tables[fy]["fy"], fy)
    for fy, want in TOTALS.items():
        check(f"FY{fy}: State's total line", tuple(tables[fy]["totals"].values()), want)
    check("FY2000 holds 53 grounds", len(tables[2000]["grounds"]), 53)
    check("FY2024 holds 78 grounds", len(tables[2024]["grounds"]), 78)
    b24 = first(tables[2024], "214(b)")
    check("a dash is not applicable, never 0 (214(b) for immigrants)", (b24["iv_found"], b24["iv_overcome"]), (None, None))
    check("214(b), FY2024", (b24["niv_found"], b24["niv_overcome"]), (3010544, 11910))
    g24 = first(tables[2024], "221(g)")
    check("221(g), FY2024, all four", tuple(g24[c] for c in R.FIGURES), (225278, 191245, 809735, 672461))
    check("221(g)'s wrapped description is joined",
          g24["ground"], "Application does not comply with provisions of INA or regulations issued pursuant thereto")
    b00 = first(tables[2000], "214(b)")
    check("FY2000: a footnote marker in a cell is not applicable, not a count",
          (b00["iv_found"], b00["iv_overcome"], b00["niv_found"]), (None, None, 1956137))
    e00 = first(tables[2000], "212(a)(2)(E)")
    check("FY2000: a ground whose figures sit on its last line keeps its own code and words",
          (e00["ground"], tuple(e00[c] for c in R.FIGURES)),
          ("Certain Aliens Involved In Serious Criminal Activity Who Have Asserted Immunity From Prosecution", (0, 0, 1, 0)))
    m24 = [g["ground_code"] for g in tables[2024]["grounds"]]
    check("codes that aren't INA sections are read whole",
          [c for c in ("8 U.S.C. § 1182e", "Misc. Executive Orders", "Sec. 5(a)(1) of the JADE Act", "Sec.103 Pub. Law 105-227") if c in m24],
          ["8 U.S.C. § 1182e", "Misc. Executive Orders", "Sec. 5(a)(1) of the JADE Act", "Sec.103 Pub. Law 105-227"])
    check("a code State repeats is a row each (212(a)(9)(A)(i), three kinds)", m24.count("212(a)(9)(A)(i)"), 3)
    check("FY2023: a ground split over two pages reads as one",
          first(tables[2023], "221(g)")["ground"].endswith("regulations issued pursuant thereto"))

    # --- State's total, and the one gap allowed by name ----------------------------------------
    check("FY2024's named gap is recorded",
          [(k["column"], k["rowsAddTo"], k["stateTotal"]) for k in tables[2024]["knownGaps"]],
          [("iv_found", 273928, 273845)])
    check("no other year carries one", [fy for fy in (2000, 2022, 2023) if tables[fy]["knownGaps"]], [])
    saved = dict(R.KNOWN_GAPS)
    R.KNOWN_GAPS.clear()
    try:
        msg = refused(R.parse, (FIX / "fy2024_ineligibilities.pdf").read_bytes(), "fy2024")
        check("without it, FY2024 is refused for its immigrant findings", "iv_found adds to 273,928" in msg)
        R.KNOWN_GAPS[(2024, "iv_found")] = (84, "101(a)(27)(D)(i)", "wrong size")
        check("a gap of any other size is refused",
              "273,845" in refused(R.parse, (FIX / "fy2024_ineligibilities.pdf").read_bytes(), "fy2024"))
    finally:
        R.KNOWN_GAPS.clear()
        R.KNOWN_GAPS.update(saved)

    niv_pdf = HERE / "fixtures" / "niv" / "niv-post-2020-06-last-page.pdf"
    check("another of State's tables is refused by its title", "title is missing" in refused(R.parse, niv_pdf.read_bytes(), "x"))

    # --- the grouping rule, on lines -----------------------------------------------------------
    first_layout = [line(["212(a)(4)"], ["Public", "Charge"], [10, 4, 2, None]),
                    line(["203(c)"], ["Failure", "to", "fulfill"], [5, 1, None, None]),
                    line([], ["for", "Diversity", "Visa"])]
    last_layout = [line(["212(a)(2)(E)"], ["Certain", "Aliens"]),
                   line([], ["Prosecution"], [0, 0, 1, 0]),
                   line(["212(a)(4)"], ["Public", "Charge"], [10, 4, 2, None])]
    wrapped = [line(["212(a)(2)(A)(i)(II"], ["Controlled", "Substance"], [3, 0, 1, 1]),
               line([")"], [])]
    saved_min = R.MIN_GROUNDS
    R.MIN_GROUNDS = 1
    try:
        t = safe(R.read_table, 2030, first_layout, [15, 5, 2, 0], "t")
        check("figures on a ground's first line: what follows is its own",
              [(g["ground_code"], g["ground"]) for g in t["grounds"]],
              [("212(a)(4)", "Public Charge"), ("203(c)", "Failure to fulfill for Diversity Visa")])
        t = safe(R.read_table, 2030, last_layout, [10, 4, 3, 0], "t")
        check("figures on a ground's last line: what comes before is its own",
              [(g["ground_code"], g["ground"]) for g in t["grounds"]],
              [("212(a)(2)(E)", "Certain Aliens Prosecution"), ("212(a)(4)", "Public Charge")])
        t = safe(R.read_table, 2030, wrapped, [3, 0, 1, 1], "t")
        check("a code wrapped onto the next line is one code", t["grounds"][0]["ground_code"], "212(a)(2)(A)(i)(II)")
        check("a column that doesn't add up is refused, naming it",
              "niv_found adds to 2, State's total says 9" in refused(R.read_table, 2030, first_layout, [15, 5, 9, 0], "t"))
        check("no total line is refused", "Total Grounds" in refused(R.read_table, 2030, first_layout, None, "t"))
        check("a ground with no code is refused",
              "no code" in refused(R.read_table, 2030, [line([], ["Prosecution"], [1, 0, 0, 0])], [1, 0, 0, 0], "t"))
    finally:
        R.MIN_GROUNDS = saved_min
    check("too few grounds is a truncated read", "only 2 grounds" in refused(R.read_table, 2030, first_layout, [15, 5, 2, 0], "t"))

    # --- main(), end to end ------------------------------------------------------------------
    def run(argv, database) -> int:
        saved_argv, saved_db = sys.argv, R.Database
        sys.argv, R.Database = ["ingest_visa_refusals.py", *argv], (lambda: database)
        try:
            return R.main()
        finally:
            sys.argv, R.Database = saved_argv, saved_db

    db = SqliteTurso()
    db.execute("CREATE TABLE IF NOT EXISTS perm_docs (key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)")
    files = [str(FIX / f"fy{fy}_ineligibilities.pdf") for fy in (2022, 2023, 2024)]
    scratch = tempfile.TemporaryDirectory()
    manifest = pathlib.Path(scratch.name) / "manifest.json"
    state = "https://travel.state.gov/content/dam/visas/Statistics/AnnualReports/"
    manifest.write_text(json.dumps({
        "2022": {"url": state + "FY2022AnnualReport/FY22_TableXIX_vF.pdf", "sha": R.sha256(pathlib.Path(files[0]).read_bytes())},
        "2023": {"url": state + "FY2023AnnualReport/FY2023_AR_TableXIX.pdf", "sha": "0" * 64},
    }))
    check("three years load", run(["--local", *files, "--manifest", str(manifest)], db), 0)
    check("their rows", query_rows(db, f"SELECT fy, count(*) FROM {R.TABLE} GROUP BY fy ORDER BY fy"),
          [["2022", "76"], ["2023", "77"], ["2024", "78"]])
    check("a year's State address is kept only when the manifest's sha is the file's",
          (read_doc(db, R.SUMMARY) or {}).get("sources"), {"2022": state + "FY2022AnnualReport/FY22_TableXIX_vF.pdf"})
    scratch.cleanup()
    check("a not-applicable cell is stored as NULL",
          query_rows(db, f"SELECT iv_found FROM {R.TABLE} WHERE fy = 2024 AND ground_code = '214(b)'"), [[None]])
    doc = read_doc(db, R.SUMMARY) or {}
    check("the summary: years, newest, State's totals", (doc.get("years"), doc.get("newest"), doc.get("totals", {}).get("2024")),
          ([2022, 2023, 2024], 2024, {"iv_found": 273845, "iv_overcome": 216929, "niv_found": 3891139, "niv_overcome": 699371}))
    check("the summary keeps FY2024's named gap for the page", list(doc.get("knownGaps", {})), ["2024"])
    check("freshness: the newest year's last day and its budget",
          query_rows(db, "SELECT as_of, max_age_days FROM data_freshness WHERE dataset = 'visa-refusals'"),
          [["2024-09-30", str(R.MAX_AGE_DAYS)]])
    changed = doc.get("changedOn")
    check("a second load of the same files writes nothing", run(["--local", *files], db), 0)
    check("its run row says so", [int(r[0]) for r in query_rows(db, "SELECT rows_written FROM ingest_runs ORDER BY id")],
          [231, 0])
    check("and the page's date doesn't move", (read_doc(db, R.SUMMARY) or {}).get("changedOn"), changed)
    with tempfile.TemporaryDirectory() as tmp:
        bad = SqliteTurso()
        check("a year asked for that the title doesn't hold is refused", run(["--local", files[0], "--fy", "2021"], bad), 1)
        check("and nothing is written", query_rows(bad, "SELECT name FROM sqlite_master WHERE name = ?", [R.TABLE]), [])
        junk = pathlib.Path(tmp) / "junk.pdf"
        junk.write_bytes(b"<html>not a pdf</html>")
        check("a file that isn't a PDF is refused", run(["--local", str(junk)], SqliteTurso()), 1)

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
