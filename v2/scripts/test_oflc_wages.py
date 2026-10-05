#!/usr/bin/env python3
"""ingest_oflc_wages against a wage-year zip built here, loaded into real SQLite.

Run: python3 scripts/test_oflc_wages.py
"""
from __future__ import annotations

import io
import pathlib
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_oflc_wages as ow  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402
from lib_test_xlsx import xlsx_bytes  # noqa: E402

FAILS: list[str] = []
N = 0


def check(label, got, want):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


ALC = ('"Area","SocCode","GeoLvl","Level1","Level2","Level3","Level4","Average","Label"\r\n'
       '"41940","15-1252",1,"55.10","70.20","85.30","100.40","80.00",""\r\n'
       '"41940","29-1216","1",,,,,"115.00","High Wage"\r\n'
       '"100001","15-1252","2","30.00","40.00","50.00","60.00","45.00",""\r\n'
       '"41940","bad",1,"1","2","3","4","5",""\r\n')
EDC_OLD = ('"Area","SocCode","GeoLvl","Level1","Level2","Level3","Level4","Average"\r\n'
           '"41940","15-1252","3","","","","","90.00"\r\n')
GEO = ('"Area","AreaName","StateAb","State","CountyTownName"\r\n'
       '"41940","San Jose-Sunnyvale-Santa Clara, CA","CA","California","Santa Clara County"\r\n'
       '"7200001","Western Puerto Rico nonmetropolitan area","PR","Puerto Rico","Mayag\x81ez Municipio"\r\n')


def year_zip(with_appendix: bool, geo_bytes: bytes | None = None) -> bytes:
    sheets = {"All SOC Codes (Job Zones)": [["O*NET Code", "SOC Code", "Title", "Job Zone"],
                                            ["15-1252.00", "15-1252", "Software Developers", "4"],
                                            ["29-1216.00", "29-1216", "General Internal Medicine Physicians", "5"]],
              "All SOC Codes (Education)": [["O*NET Code", "SOC Code", "Title", "Education", "Source"],
                                            ["15-1252.00", "15-1252", "Software Developers", "Bachelor's degree", "BLS"],
                                            ["29-1216.00", "29-1216", "GIM Physicians", "Doctoral or professional degree", "BLS"]]}
    if with_appendix:
        sheets = {"Appendix A SOC Codes": [["O*NET Code", "Occupation", "Education", "Source"],
                                           ["15-1252.00", "Software Developers", "Bachelor's degree", "BLS"]], **sheets}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("OFLC_Wages_2024-25/ALC_Export.csv", ALC)
        z.writestr("OFLC_Wages_2024-25/EDC_Export.csv", EDC_OLD)
        z.writestr("OFLC_Wages_2024-25/Geography.csv", geo_bytes if geo_bytes is not None else GEO.encode("latin-1"))
        z.writestr("OFLC_Wages_2024-25/Wage Year 2024-25 Appendix A, Job Zone, and Education.xlsx", xlsx_bytes(sheets))
    return buf.getvalue()


def main() -> int:
    check("the year is the July that opened it", ow.wage_year_of("OFLC_Wages_2024-25.zip"), 2024)
    check("a pair that isn't consecutive is no year", ow.wage_year_of("OFLC_Wages_2024-26.zip"), None)

    saved = (ow.MIN_ALC_ROWS, ow.MIN_COUNTIES)
    ow.MIN_ALC_ROWS, ow.MIN_COUNTIES = 1, 1
    try:
        parts = ow.parse_year(year_zip(True), 2024)
        alc = {(r[2], r[3]): r for r in parts["alc"]}
        check("rows with a bad SOC code are dropped", len(alc), 3)
        check("levels hourly, as printed", alc[("41940", "15-1252")][5:9], (55.1, 70.2, 85.3, 100.4))
        check("GeoLvl read whether quoted or not", (alc[("41940", "15-1252")][4], alc[("100001", "15-1252")][4]), (1, 2))
        check("a High Wage row keeps its label and only an average",
              (alc[("41940", "29-1216")][5:11]), (None, None, None, None, 115.0, "High Wage"))
        check("an old file with no Label column reads as no label", parts["edc"][0][10], None)
        geo = {(r[1], r[2]): r for r in parts["geo"]}
        check("the DOS code page is read as DOS: Mayagüez", ("PR", "Mayagüez Municipio") in geo, True)
        basis = {r[1]: r for r in parts["basis"]}
        check("Job Zone and education joined per O*NET code",
              (basis["29-1216.00"][4], basis["29-1216.00"][5]), ("5", "Doctoral or professional degree"))
        check("on the Appendix A list", basis["15-1252.00"][6], 1)
        check("off it, in a year that has one", basis["29-1216.00"][6], 0)
        no_list = {r[1]: r for r in ow.parse_year(year_zip(False), 2023)["basis"]}
        check("a year with no list stores NULL, not 0", no_list["29-1216.00"][6], None)
        utf = ow.parse_year(year_zip(True, GEO.replace("\x81", "ü").encode("utf-8")), 2024)
        check("a UTF-8 file stays UTF-8", ("PR", "Mayagüez Municipio") in {(r[1], r[2]) for r in utf["geo"]}, True)

        backwards = ALC.replace('"55.10","70.20"', '"75.10","70.20"')
        buf = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(year_zip(True))) as src, zipfile.ZipFile(buf, "w") as dst:
            for n in src.namelist():
                dst.writestr(n, backwards if n.endswith("ALC_Export.csv") else src.read(n))
        try:
            ow.parse_year(buf.getvalue(), 2024)
            refused = False
        except ow.Refusal:
            refused = True
        check("levels that run backwards are refused (a shifted column)", refused, True)

        db = SqliteTurso()
        db.script(["CREATE TABLE perm_docs (key TEXT PRIMARY KEY, json TEXT, computed_at INTEGER)"] + ow.DDL)
        ow.HISTORY_PAUSE_S = ow.NEWEST_PAUSE_S = 0
        first = ow.load_year(db, 2024, year_zip(True), newest=True, force=False)
        check("a first load writes every all-industry row", first["alc"]["written"], 3)
        check("and the counties", db.conn.execute("SELECT count(*) FROM oflc_wage_geography").fetchone()[0], 2)
        again = ow.load_year(db, 2024, year_zip(True), newest=True, force=False)
        check("the same bytes again are skipped", again.get("skipped"), True)
        forced = ow.load_year(db, 2024, year_zip(True), newest=True, force=True)
        check("forced, an unchanged year writes nothing", forced["alc"]["written"], 0)
        other = ow.load_year(db, 2023, year_zip(False), newest=False, force=False)
        check("another year loads beside it", other["alc"]["written"], 3)
        check("each year keeps its own rows",
              db.conn.execute("SELECT count(*) FROM oflc_wage_levels WHERE collection='alc'").fetchone()[0], 6)
    finally:
        ow.MIN_ALC_ROWS, ow.MIN_COUNTIES = saved
    try:
        ow.parse_year(year_zip(True), 2024)
        refused = False
    except ow.Refusal:
        refused = True
    check("a year far short of a full table is refused", refused, True)

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
