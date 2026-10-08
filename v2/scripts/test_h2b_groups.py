#!/usr/bin/env python3
"""Gates for the H-2B assignment groups: the list parser, the per-group timing,
and the one estimate rule the page, the scorecard and the backtest share."""
from __future__ import annotations
import io, pathlib, sys, zipfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from ingest_h2b_groups import (as_day, group_estimate, group_order, group_stats, parse_list, peak_of,
                               percentile_of, previous_peak, MIN_DECIDED)

fails: list[str] = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: fails.append(msg)

NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'

def xlsx(sheets: list[list[list]]) -> bytes:
    """A minimal workbook: inline strings, numbers as numbers."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for si, rows in enumerate(sheets, 1):
            body = []
            for ri, row in enumerate(rows, 1):
                cells = []
                for ci, v in enumerate(row):
                    ref = f"{chr(65 + ci)}{ri}"
                    if v is None:
                        continue
                    if isinstance(v, (int, float)):
                        cells.append(f'<c r="{ref}"><v>{v}</v></c>')
                    else:
                        cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{v}</t></is></c>')
                body.append(f'<row r="{ri}">{"".join(cells)}</row>')
            z.writestr(f"xl/worksheets/sheet{si}.xml", f'<worksheet {NS}><sheetData>{"".join(body)}</sheetData></worksheet>')
    return buf.getvalue()

HDR = ["Case Number", "Business Name", "Agent Attorney Name", "Worksite State", "Randomization Group",
       "Randomization Email Date", "Submitted Date", "Begin Date", "Case Status"]

# ---- the list ----------------------------------------------------------------
check(as_day("46023") == "2026-01-01", "an Excel day serial")
check(as_day("2025-07-03 00:00:00") == "2025-07-03" and as_day("7/3/2025") == "2025-07-03", "text dates")
check(as_day("") is None and as_day(None) is None, "a blank cell is no date")

data = xlsx([
    [["Technical Notes: The Office"], [], ["Field Name", "Description"], ["Case Number", "Unique identifier"]],
    [HDR,
     ["H-400-26001-520299", "2 Brothers, LLC", "Some Attorney", "OHIO", "e", 46026.67, 46023, 46113, "Pending Processing"],
     ["H-400-26001-520300", "Acme", "Another Attorney", "IOWA", "A", 46026.67, 46024, 46113, "Pending Processing"],
     ["not a case", "x", "y", "z", "A", None, None, None, None]],
])
rows = parse_list(data)
check(len(rows) == 2, "rows from the sheet with the header, the notes sheet and a junk row skipped")
check(rows[0] == {"case": "H-400-26001-520299", "group": "E", "submitted": "2026-01-01", "begin": "2026-04-01"},
      "case, group (uppercased) and both dates")
check(all("attorney" not in str(r).lower() and "Some Attorney" not in str(r.values()) for r in rows), "no attorney is ever read")
check(peak_of(rows, "FY26_JanPeak_PublicFacingReport.xlsx") == "2026-01", "the season from the submitted month")
check(peak_of([{"submitted": None}], "FY25_JulPeak_PublicFacingReport.xlsx") == "2025-07", "the file name when no date is read")

# ---- timing --------------------------------------------------------------------
check(group_order(["B", "AA", "A", "H"]) == ["A", "B", "H", "AA"], "groups in DOL's order")
check(percentile_of([10, 20, 30], 4, 50) == 20, "the day half of the group's 4 cases were decided")
check(percentile_of([10], 4, 50) is None, "not yet half decided: no median")

def cases(group, days, pending=0, withdrawn=0):
    return ([{"group": group, "days": d, "withdrawn": False} for d in days]
            + [{"group": group, "days": None, "withdrawn": False}] * pending
            + [{"group": group, "days": 5, "withdrawn": True}] * withdrawn)

st = group_stats(cases("A", list(range(35, 47)) * 4, pending=2, withdrawn=9) + cases("B", [60] * (MIN_DECIDED - 1)))
check(st["A"]["cases"] == 50 and st["A"]["decided"] == 48, "a withdrawal is not a case in the line; a pending one is")
check(st["A"]["p50"] == 41 and "p25" in st["A"], "percentiles over the group's whole line")
check("p50" not in st["B"], "too few decided to read a percentile")

# January 2025's real groups (medians, 8,759 applications) predicting January 2026 (10,062).
jan25 = {"A": {"p25": 35, "p50": 41, "p75": 47}, "B": {"p25": 52, "p50": 55, "p75": 58}, "C": {"p25": 62, "p50": 64, "p75": 69},
         "D": {"p25": 75, "p50": 77, "p75": 82}, "E": {"p25": 84, "p50": 88, "p75": 91}, "F": {"p25": 92, "p50": 97, "p75": 99},
         "G": {"p25": 101, "p50": 104, "p75": 105}}
jan26_actual = {"A": 41, "B": 61, "C": 75, "D": 84, "E": 98, "F": 109, "G": 118, "H": 125}
this = {g: {"cases": 1000, "decided": 0} for g in jan26_actual}
est = group_estimate(jan25, 8759, this, 10062)
check(set(est) == set(jan26_actual), "every group gets a date, H included though last January had none")
off = {g: est[g]["p50"] - jan26_actual[g] for g in jan26_actual}
check(all(abs(v) <= 9 for v in off.values()), f"last January, spaced by this January's applications, is within 9 days of every group: {off}")
check(est["C"]["p25"] < est["C"]["p50"] < est["C"]["p75"], "a middle half around the date")
check(all(e["p10"] <= e["p25"] <= e["p50"] <= e["p75"] <= e["p90"] for e in est.values()), "every group's percentiles in order")
check(est["A"]["basis"] == "last season's groups", "before any of this season is decided, the basis says so")

this_a = dict(this, A={"cases": 1000, "decided": 600, "p25": 36, "p50": 44})
est2 = group_estimate(jan25, 8759, this_a, 10062)
check(est2["B"]["p50"] == est["B"]["p50"] + 3, "this season's own group A moves every later group")
check(est2["A"]["p50"] == 44 and est2["A"]["basis"] == "this group's own decisions", "a group's own percentile wins once measurable")
check(group_estimate({"A": {"cases": 5}}, 100, this, 100) == {}, "no measured group A last season: no estimate")

peaks = {"2025-01": {"groups": {"A": {"p50": 41}}}, "2025-07": {"groups": {"A": {"p50": 34}}},
         "2026-01": {"groups": {"A": {"cases": 9}}}, "2024-01": {"groups": {"A": {"p50": 40}}}}
check(previous_peak(peaks, "2027-01") == "2025-01", "the newest measured season of the same month (2026-01 not measured)")
check(previous_peak(peaks, "2026-07") == "2025-07" and previous_peak(peaks, "2025-01") == "2024-01", "January and July apart")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
