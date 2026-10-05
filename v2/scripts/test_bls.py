#!/usr/bin/env python3
"""ingest_bls against workbooks built here, shaped like BLS's own.

Run: python3 scripts/test_bls.py
"""
from __future__ import annotations

import io
import pathlib
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_bls as bls  # noqa: E402
from lib_test_xlsx import xlsx_bytes  # noqa: E402

FAILS: list[str] = []
N = 0


def check(label, got, want):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


HEAD = ["AREA", "AREA_TITLE", "AREA_TYPE", "PRIM_STATE", "NAICS", "NAICS_TITLE", "I_GROUP", "OWN_CODE",
        "OCC_CODE", "OCC_TITLE", "O_GROUP", "TOT_EMP", "EMP_PRSE", "H_MEAN", "A_MEAN", "H_PCT10", "H_PCT25",
        "H_MEDIAN", "H_PCT75", "H_PCT90", "A_PCT10", "A_PCT25", "A_MEDIAN", "A_PCT75", "A_PCT90", "ANNUAL", "HOURLY"]


def row(area, atype, code, group="detailed", naics="000000", own="1235", igroup="cross-industry",
        p=(80000, 100000, 130000, 170000, 210000), annual="", emp="1,000", hmed="62.5"):
    base = {"AREA": area, "AREA_TITLE": f"Area {area}", "AREA_TYPE": atype, "PRIM_STATE": "CA", "NAICS": naics,
            "NAICS_TITLE": "x", "I_GROUP": igroup, "OWN_CODE": own, "OCC_CODE": code, "OCC_TITLE": f"Occ {code}",
            "O_GROUP": group, "TOT_EMP": emp, "EMP_PRSE": "1", "H_MEAN": "60", "A_MEAN": "125,000",
            "H_PCT10": "", "H_PCT25": "", "H_MEDIAN": hmed, "H_PCT75": "", "H_PCT90": "",
            "A_PCT10": p[0], "A_PCT25": p[1], "A_MEDIAN": p[2], "A_PCT75": p[3], "A_PCT90": p[4],
            "ANNUAL": annual, "HOURLY": ""}
    return [base[h] for h in HEAD]


def main() -> int:
    book = xlsx_bytes({"MSA_M2025_dl": [HEAD,
        row("99", "1", "15-1252"),
        row("99", "1", "00-0000", group="total"),
        row("99", "1", "15-1250", group="broad"),
        row("99", "1", "15-1252", naics="541500", igroup="4-digit"),
        row("99", "1", "15-1252", own="5"),
        row("41940", "4", "15-1252", p=(90000, 120000, 160000, "#", "#")),
        row("41940", "4", "25-2021", p=(50000, 60000, 70000, 80000, 90000), annual="TRUE", hmed=""),
        row("100001", "6", "29-1141", p=("*", "*", "75000", "*", "**")),
        row("06", "2", "15-1252"),
    ], "Field Descriptions": [["x"]]})
    rows = bls.oews_rows(book, "May 2025")
    keys = sorted((r[0], r[1]) for r in rows)
    check("cross-industry, all-ownership, SOC rows only; broad kept, total dropped", keys,
          [("06", "15-1252"), ("100001", "29-1141"), ("41940", "15-1252"), ("41940", "25-2021"),
           ("99", "15-1250"), ("99", "15-1252")])
    by = {(r[0], r[1]): r for r in rows}
    sj = by[("41940", "15-1252")]
    check("a '#' percentile is stored as NULL", sj[11:13], (None, None))
    check("and named in top_coded", sj[14], "pct75,pct90")
    check("numbers lose their commas", by[("99", "15-1252")][6], 1000)
    check("annual-only occupations are marked", by[("41940", "25-2021")][15], 1)
    check("a missing hourly median is NULL", by[("41940", "25-2021")][13], None)
    check("'*' and '**' are NULL", by[("100001", "29-1141")][8:13], (None, None, 75000, None, None))
    check("area types are integers", sorted({r[2] for r in rows}), [1, 2, 4, 6])

    dup = [("1", "11-1011", 1, "x", "t", "broad", *[None] * 11), ("1", "11-1011", 1, "x", "t", "detailed", *[None] * 11)]
    check("detailed beats broad for one code", bls.merge_detailed(dup)[0][5], "detailed")

    saved = (bls.MIN_NATIONAL, bls.MIN_METRO_ROWS)
    bls.MIN_NATIONAL, bls.MIN_METRO_ROWS = 1, 1
    try:
        bls.check_oews(bls.merge_detailed(rows))
        ok = True
    except bls.Refusal as exc:
        ok = str(exc)
    check("a sane release passes", ok, True)
    bad = [r if r[1] != "15-1252" or r[0] != "99" else (*r[:8], 200000, 100000, *r[10:]) for r in rows]
    try:
        bls.check_oews(bad)
        refused = False
    except bls.Refusal:
        refused = True
    check("percentiles out of order are refused (a misread column)", refused, True)
    insane = [r if r[1] != "15-1252" or r[0] != "99" else (*r[:10], 5000, *r[11:]) for r in rows]
    try:
        bls.check_oews([r for r in insane])
        refused = False
    except bls.Refusal:
        refused = True
    check("a national median far outside its range is refused", refused, True)
    bls.MIN_NATIONAL, bls.MIN_METRO_ROWS = saved
    try:
        bls.check_oews(rows)
        refused = False
    except bls.Refusal:
        refused = True
    check("a release with too few national rows is refused", refused, True)

    # Projections: the header found by name, columns in a different order than BLS's.
    head = ["2025 National Employment Matrix title", "Occupation type", "2025 National Employment Matrix code",
            "Employment, 2025", "Employment, 2035", "Employment change, percent, 2025–35",
            "Employment change, numeric, 2025–35", "Occupational openings, 2025–35 annual average",
            "Median annual wage, dollars, 2025", "Typical education needed for entry",
            "Work experience in a related occupation", "Typical on-the-job training needed to attain competency in the occupation"]
    proj = xlsx_bytes({"Index": [["x"]], "Table 1.2": [
        ["Table 1.2 Occupational projections"], head,
        ["Total, all occupations", "Summary", "00-0000", "170280.8", "176198.5", "3.5", "5917.6", "17461.8", "50980", "—", "—", "—"],
        ["  Software developers", "Line item", "15-1252", "1717.8", "1892.6", "10.2", "174.7",
         "95.29999999", "135980", "Bachelor's degree", "None", "None"],
        ["  Nurse practitioners", "Line item", "29-1171", "336.3", "474.1", "41", "137.8", "29.4", "132300",
         "Master's degree", "None", "None"],
    ]})
    saved_min = bls.MIN_PROJECTIONS
    bls.MIN_PROJECTIONS = 2
    try:
        p = {r[0]: r for r in bls.projection_rows(proj)}
    finally:
        bls.MIN_PROJECTIONS = saved_min
    check("line items only", sorted(p), ["15-1252", "29-1171"])
    check("years read from the headers", p["15-1252"][2:4], (2025, 2035))
    check("columns by name, whatever their order", p["15-1252"][6:9], (174.7, 10.2, 95.3))
    check("text kept", p["29-1171"][10], "Master's degree")
    try:
        bls.projection_rows(xlsx_bytes({"Table 1.2": [head[:-1], ["x"]]}))
        refused = False
    except bls.Refusal:
        refused = True
    check("a missing column is refused, not misread", refused, True)

    html = ('<a href="/oes/special-requests/oesm24nat.zip"></a><a href="/oes/special-requests/oesm24st.zip"></a>'
            '<a href="/oes/special-requests/oesm24ma.zip"></a><a href="/oes/special-requests/oesm25nat.zip"></a>')
    yy, trio = bls.newest_oews(html)
    check("the newest year with all three files", yy, "24")
    check("as absolute links", trio["ma"], "https://www.bls.gov/oes/special-requests/oesm24ma.zip")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("oesm25ma/file_descriptions.xlsx", b"x")
        z.writestr("oesm25ma/MSA_M2025_dl.xlsx", b"a")
        z.writestr("oesm25ma/BOS_M2025_dl.xlsx", b"b")
    check("both data workbooks in a zip, not its descriptions", bls.xlsx_members(buf.getvalue()), [b"b", b"a"])

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
