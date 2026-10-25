#!/usr/bin/env python3
"""Every state's WARN reader beyond the first four, against what each state
served on Oct 25 2026, trimmed to a few real rows (scripts/fixtures/warn/).

    python3 scripts/test_warn_states.py

Each reader resolves columns by header words, so the checks that matter are a
known row's fields and the count: a column a state renames would otherwise
land as None and read as a quiet week. Then the invariants every state shares:
no private key left on a row, a unique and stable id per notice, and a second
write of the same rows writing nothing. No test touches the network; every
fetch is substituted.
"""
from __future__ import annotations

import contextlib
import datetime as dt
import io
import json
import os
import re
import sqlite3
import sys
import urllib.error
import warnings

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ingest_warn as iw  # noqa: E402
import lib_gov_data  # noqa: E402
import lib_warn as lw  # noqa: E402
import warn_states as ws  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "warn")


def b(name: str) -> bytes:
    with open(os.path.join(FIX, name), "rb") as fh:
        return fh.read()


def js(name: str):
    return json.loads(b(name))


def check(cond: bool, msg: str, failures: list[str]) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


class SqliteDb:
    """A libSQL-shaped database over SQLite. Every value comes back as text,
    the way libSQL hands integers back: the trap `_cmp` exists for, so a write
    check here meets it as production would."""

    def __init__(self) -> None:
        self.conn = sqlite3.connect(":memory:")

    def script(self, stmts) -> None:
        for s in stmts:
            self.conn.execute(s)

    def execute(self, sql, args=None):
        cur = self.conn.execute(sql, args or [])
        rows = cur.fetchall() if cur.description else []
        cells = [[{"type": "null"} if v is None else {"type": "text", "value": str(v)} for v in r] for r in rows]
        return {"response": {"result": {"rows": cells, "cols": [{"name": d[0]} for d in cur.description or []]}}}


# (state, label, parse, expected rows, the first row's fields)
CASES = [
    ("IL", "Illinois export", lambda: ws.parse_illinois(b("il_export_2026-10-25.xlsx")), 5,
     {"company": "Momence Packing Co.", "notice_date": "2025-06-02", "effective_date": "2025-08-01",
      "employees": 274, "kind": "Plant Closure", "county": "Kankakee County",
      "site": "334 W North St, Momence, IL 60954-1157"}),
    ("NJ", "New Jersey archive", lambda: ws.parse_new_jersey(b("nj_archive_2026-10-25.xlsx")), 8,
     {"company": "The Fresh Market", "notice_date": "2026-01", "effective_date": "2026-04-12", "employees": 55,
      "site": "Montvale"}),
    ("MA", "Massachusetts weekly CSV", lambda: ws.parse_massachusetts(b("ma_weekly_2026-10-23.csv")), 5,
     {"company": "EyePoint US Inc.", "notice_date": "2026-10-20", "effective_date": "2026-12-31", "employees": 105}),
    ("MA", "Massachusetts FY2023 workbook", lambda: ws.parse_massachusetts(b("ma_fy2023.xlsx")), 4,
     {"company": "H3 Biomedicine Inc.", "notice_date": "2022-07-14", "employees": 79, "site": "Cambridge"}),
    ("GA", "Georgia list", lambda: ws.parse_georgia(b("ga_list_2026-10-25.json")), 5,
     {"company": "Dexter Axle Company", "notice_date": "2023-01-17", "employees": 67}),
    ("NC", "North Carolina CSV", lambda: ws.parse_north_carolina(b("nc_tableau_2026-10-25.csv")), 5,
     {"company": "Conduent Commercial Solutions, LLC", "notice_date": "2026-06-30", "employees": 67,
      "kind": "Permanent Layoff", "site": "100 Campus Dr., Florham Park NJ"}),
    ("NC", "North Carolina 2025 archive", lambda: ws.parse_north_carolina_archive(js("nc_archive_2025_tables.json")), 4,
     {"company": "Resilience US, Inc.", "notice_date": "2025-01-06", "employees": 120, "kind": "Permanent Layoff",
      "county": "Durham County"}),
    ("NC", "North Carolina 2020 archive", lambda: ws.parse_north_carolina_archive(js("nc_archive_2020_tables.json")), 4,
     {"company": "Mas US Holdings Inc", "notice_date": "2020-01-06", "employees": 124, "kind": "Closure Permanent"}),
    ("VA", "Virginia CSV", lambda: ws.parse_virginia(b("va_warn_2026-10-25.csv")), 6,
     {"company": "The Washington Post", "notice_date": "2026-10-07", "effective_date": "2026-12-31",
      "employees": 118, "kind": "Closure", "site": "Springfield VA"}),
    ("MI", "Michigan search", lambda: ws.parse_michigan(b("mi_search_2026-10-25.json")), 4,
     {"company": "Salterra at Chesterfield", "notice_date": "2026-10-23", "effective_date": "2026-11-20",
      "employees": 46, "county": "Macomb", "site": "29891 23 Mile Road, New Baltimore, MI 48047"}),
    ("OH", "Ohio CSV", lambda: ws.parse_ohio(b("oh_warn_2026.csv")), 5,
     {"company": "The Blade", "notice_date": "2026-10-26", "employees": 116, "county": "Wood", "site": "Northwood"}),
    ("FL", "Florida page", lambda: ws.parse_florida(b("fl_records_2026.html")), 4,
     {"company": "Aetos Systems, Inc.", "notice_date": "2026-10-16", "effective_date": "2026-12-01",
      "employees": 126, "site": "Space Commerce Way, MERRITT ISLAND, FL, 32953"}),
    ("MD", "Maryland page", lambda: ws.parse_maryland(b("md_warn_2026.html")), 5,
     {"company": "Atlantic Tractor", "notice_date": "2026-10-19", "employees": 9, "kind": "Plant Closure",
      "industry": "444230"}),
    ("PA", "Pennsylvania page", lambda: ws.parse_pennsylvania(b("pa_warn_2026-10-25.html")), 4,
     {"company": "Kenco Logistic Services, LLC", "notice_date": "2026-10", "effective_date": "2027-03-01",
      "employees": 81, "kind": "Layoff", "county": "Lebanon", "site": "60 Central Boulevard, Myerstown, PA 17407"}),
    ("CT", "Connecticut library", lambda: ws.parse_connecticut(b("ct_2026.json")), 4,
     {"company": "Cycling Sports Group, Inc.", "notice_date": "2026-10-21", "effective_date": "2026-12-21",
      "employees": 143, "kind": "Closing", "site": "Wilton"}),
    ("CO", "Colorado 2026 sheet", lambda: ws.parse_colorado(b("co_2026.csv")), 4,
     {"company": "TIAA", "notice_date": "2026-01-02", "employees": 101, "county": "Denver, RC"}),
    ("CO", "Colorado 2021 sheet", lambda: ws.parse_colorado(b("co_2021.csv")), 2,
     {"company": "SSDI", "notice_date": "2019-04-21", "employees": 5}),
    ("IN", "Indiana page", lambda: ws.parse_indiana(b("in_warn_current.html")), 5,
     {"company": "American Woodmark Corporation", "notice_date": "2026-10-05", "employees": 207, "kind": "Layoff",
      "site": "Gas City"}),
    ("AL", "Alabama CSV", lambda: ws.parse_alabama(b("al_warn.csv")), 6,
     {"company": "The Andersons Inc.", "notice_date": "2026-10-20", "employees": 64, "kind": "Closure"}),
    ("AK", "Alaska page", lambda: ws.parse_alaska(b("ak_warn.html")), 4,
     {"company": "RNDC Shared Services LLC", "notice_date": "2026-07-06", "employees": 160, "site": "Juneau"}),
    ("NE", "Nebraska page", lambda: ws.parse_nebraska(b("ne_warn.html")), 5,
     {"company": "Fortrex 0129 Madison", "notice_date": "2026-08-26", "employees": 91}),
    ("SD", "South Dakota page", lambda: ws.parse_south_dakota(b("sd_warn.html")), 5,
     {"company": "JeniusBank (digital unit of SMBC Manubank)", "notice_date": "2026-08-10", "employees": 2}),
    ("TN", "Tennessee page", lambda: ws.parse_tennessee(b("tn_warn.html")), 6,
     {"company": "Akzo Nobel", "notice_date": "2026-10-20", "effective_date": "2026-12-31", "employees": 76,
      "county": "Davidson"}),
    ("UT", "Utah page", lambda: ws.parse_utah(b("ut_warn.html")), 6,
     {"company": "Point Designs", "notice_date": "2026-10-30", "employees": 8, "site": "Bountiful"}),
    ("DC", "District of Columbia page", lambda: ws.parse_dc(b("dc_warn_2026.html")), 5,
     {"company": "Elior North America", "notice_date": "2026-02-02", "employees": 76, "kind": "Layoff"}),
    ("IA", "Iowa log", lambda: ws.parse_iowa(b("ia_warn_log.xlsx")), 5,
     {"company": "CNH Industrial America LLC", "notice_date": "2026-01-20", "employees": 7, "kind": "Closing",
      "county": "Des Moines", "site": "1930 Des Moines Ave, Burlington, IA 52601"}),
    ("KY", "Kentucky report", lambda: ws.parse_kentucky(b("ky_current.xlsx")), 3,
     {"company": "RNDC of Kentucky, LLC", "notice_date": "2026-10-12", "employees": 7, "kind": "Layoff",
      "county": "Jefferson County - Louisville"}),
    ("KY", "Kentucky prior years", lambda: ws.parse_kentucky(b("ky_prior.xlsx")), 4,
     {"company": "Moveret", "notice_date": "2025-12-19", "employees": 90, "county": "Hardin"}),
    ("MT", "Montana workbook", lambda: ws.parse_montana(b("mt_warn.xlsx")), 3,
     {"company": "Wells Fargo & Company", "notice_date": "2026-03-30", "employees": 77, "county": "Yellowstone"}),
    ("WI", "Wisconsin sheet", lambda: ws.parse_wisconsin(b("wi_originals.csv")), 5,
     {"company": "Semco Windows and Doors", "notice_date": "2020-01-02", "employees": 141,
      "kind": "Facility closure", "county": "Lincoln"}),
    ("OK", "Oklahoma service", lambda: ws.parse_oklahoma(b("ok_aura.json")), 4,
     {"company": "Macy's Distribution", "notice_date": "2026-01-15", "employees": None, "kind": "Plant Closing"}),
    ("OR", "Oregon page", lambda: ws.parse_oregon(b("or_warn_page1.html")), 4,
     {"company": "Pacific Source", "notice_date": "2026-10-20", "employees": 134, "site": "Springfield"}),
    ("AZ", "Arizona job-center search", lambda: ws.parse_job_center("AZ", b("az_search.html")), 3,
     {"company": "Farmers Investment Co.", "notice_date": "2026-09-15", "site": "Sahuarita, 85629"}),
    ("HI", "Hawaii archive year", lambda: ws.parse_hawaii(b("hi_archive_2026.html")), 5,
     {"company": "Watabe Wedding Corporation (dba Michel’s at the Colony Surf)", "notice_date": "2026-07-31",
      "employees": None}),
    ("ID", "Idaho PDF", lambda: ws.parse_idaho(js("id_tables.json")), 5,
     {"company": "Amy's Kitchen, LLC", "notice_date": "2026-09-17", "effective_date": "2026-12-18",
      "employees": 49, "site": "221 Phil Meador Ave, Pocatello, ID 83202"}),
    ("MS", "Mississippi PDF", lambda: ws.parse_mississippi(js("ms_tables.json")), 2,
     {"company": "Morrison Healthcare", "notice_date": "2026-07-21", "employees": 86, "county": "Jackson"}),
    ("ND", "North Dakota PDF", lambda: ws.parse_north_dakota(js("nd_tables.json")), 4,
     {"company": "Accelerate360 Distribution", "notice_date": "2025-04-25", "effective_date": "2025-06-28",
      "employees": 324}),
    ("SC", "South Carolina PDF", lambda: ws.parse_south_carolina(js("sc_tables.json")), 5,
     {"company": "Saddle Creek Logistics Services", "notice_date": "2026-01-02", "employees": 130,
      "kind": "Permanent Layoff", "county": "Spartanburg"}),
]

# The states that print a notice's month and not its day.
MONTH_ONLY = {"NJ", "PA"}


def main() -> int:
    f: list[str] = []
    warnings.simplefilter("ignore")

    # --- every state, its fixture -------------------------------------------
    parsed: dict[str, list[dict]] = {}
    for st, label, parse, count, first in CASES:
        rows = parse()
        parsed.setdefault(st, []).extend(rows)
        check(len(rows) == count, f"{label}: {count} notices (got {len(rows)})", f)
        if rows:
            got = {k: rows[0].get(k) for k in first}
            check(got == first, f"{label}: the first row's fields are read by header (got {got})", f)
        check(all(r["state"] == st for r in rows), f"{label}: every row carries {st}", f)
        leftover = sorted({k for r in rows for k in r if k.startswith("_")})
        check(not leftover, f"{label}: no leftover private key (found {leftover})", f)
        check(all(r.get("id") for r in rows) and len({r["id"] for r in rows}) == len(rows),
              f"{label}: every row has its own id", f)
        check([r["id"] for r in rows] == [r["id"] for r in parse()], f"{label}: ids are stable across parses", f)
        shape = r"\d{4}-\d{2}" if st in MONTH_ONLY else r"\d{4}-\d{2}-\d{2}"
        check(all(re.fullmatch(shape, r["notice_date"]) for r in rows),
              f"{label}: notice dates are {'the month alone' if st in MONTH_ONLY else 'whole days'}", f)
        check(all(r["employees"] is None or isinstance(r["employees"], int) for r in rows),
              f"{label}: counts are integers or None", f)
        check(all(r["notice_date"] >= ws.SINCE[:7] for r in rows), f"{label}: nothing dated before {ws.SINCE}", f)

    # A second write of the same notices writes nothing: the libSQL-shaped
    # database hands every value back as text, as production does.
    for st, rows in parsed.items():
        db = SqliteDb()
        first_n = iw.write(db, rows, st)
        again = iw.write(db, rows, st)
        check(first_n == len(rows) and again == 0, f"{st}: a re-run of the same rows writes 0 (wrote {first_n}, then {again})", f)

    # --- what each state prints, read as it prints it --------------------------
    il = ws.parse_illinois(b("il_export_2026-10-25.xlsx"))
    sheet = lw.xlsx_sheets(b("il_export_2026-10-25.xlsx"))["Layoffs"]
    warn_col = sheet[0].index("WARN Notice")
    other = {r[0] for r in sheet[1:] if r[warn_col] is False}
    check(bool(other) and not other & {r["company"] for r in il},
          f"Illinois leaves out the {len(other)} rows marked as other layoffs, not WARN notices", f)
    check(il[0]["effective_date"] == "2025-08-01", "Illinois's effective date is the first scheduled wave", f)

    nj = ws.parse_new_jersey(b("nj_archive_2026-10-25.xlsx"))
    acme = [r for r in nj if r["company"].startswith("ACME Markets")]
    check(len(acme) == 1 and acme[0]["notice_date"] == "2024-01",
          "a New Jersey notice printed on two years' sheets is kept once, from the newer sheet", f)
    bms = next((r for r in nj if "Bristol" in r["company"]), {})
    check(bms.get("effective_date") == "2025-04-24", "a cell listing several effective dates gives the first", f)
    check(all(len(r["notice_date"]) == 7 for r in nj + ws.parse_pennsylvania(b("pa_warn_2026-10-25.html"))),
          "New Jersey and Pennsylvania store the month and never invent a day", f)

    ma = ws.parse_massachusetts(b("ma_weekly_2026-10-23.csv"))
    check(any(r["company"] == "Labouré College of Healthcare, Inc." for r in ma),
          "Massachusetts's CSV is read as Windows-1252 (Labouré, not a replacement mark)", f)
    upd = next((r for r in ma if r["company"] == "Revvity"), {})
    check(upd.get("kind") == "Update", "a Massachusetts *Updated* row keeps the name and says it's an update", f)
    check(ws.MA_UPDATED.sub("", "*UDATED* Schneider Electric") == "Schneider Electric",
          "the update marker's misspelling is stripped too", f)
    fy23 = ws.parse_massachusetts(b("ma_fy2023.xlsx"))
    check(any(r["notice_date"] == "2021-10-08" for r in fy23),
          "a regional sheet whose date column has no header still reads its dates", f)

    fl_rows, fl_last = ws.parse_florida_page(lw.decode(b("fl_records_2026.html")))
    check(fl_last == 3, f"Florida's escaped pager links (&amp;page=) are read: the last page is 3 (got {fl_last})", f)

    va = ws.parse_virginia(b("va_warn_2026-10-25.csv"))
    check(any(r["kind"] == "Closure, Layoff" for r in va), "Virginia's run-together choice reads Closure, Layoff", f)

    mi = ws.parse_michigan(b("mi_search_2026-10-25.json"))
    old = [r for r in mi if r["source_url"].endswith(".pdf") or ".pdf?" in r["source_url"]]
    check(len(old) == 2 and all(r["site"] for r in old),
          "Michigan's older notices link their PDF and take the city as the site", f)

    oh = ws.parse_ohio(b("oh_warn_2026.csv"))
    check(oh[0]["source_url"].endswith("The_Blade.pdf"), "an Ohio notice links its own PDF", f)

    co26, co21 = ws.parse_colorado(b("co_2026.csv")), ws.parse_colorado(b("co_2021.csv"))
    check(co26[1]["employees"] == 1, "Colorado counts its own notifications (Tessera: 1 of 90 in Colorado)", f)
    check(co21[0]["employees"] == 5, "Colorado's 2021 sheet adds permanent and temporary layoffs", f)
    sheets = ws.colorado_sheets(b("co_page.html").decode())
    check(sheets[0][0] == 2026 and "gid=1928499704" in sheets[0][1], "Colorado's sheets are read from the page's links", f)
    no_gid = [u for y, u in sheets if y == 2022]
    check(no_gid and "gid=" not in no_gid[0], "a sheet linked without a tab is exported without guessing one", f)

    ky = ws.parse_kentucky(b("ky_prior.xlsx"))
    led = next((r for r in ky if r["company"] == "LED VANCE LLC"), {})
    check(led.get("notice_date") == "2019-01-25" and led.get("effective_date") == "2019-09-27",
          "a Kentucky date stored as a spreadsheet serial (43490) reads as its day", f)
    ia = ws.parse_iowa(b("ia_warn_log.xlsx"))
    check(not any(r["company"].startswith("Smithfield") for r in ia), "Iowa's stray Sheet2 is not read as a year", f)
    mt = ws.parse_montana(b("mt_warn.xlsx"))
    check(all(r["notice_date"] >= "2019" for r in mt), "Montana's 2015 notice is before the window and left out", f)

    wi = ws.parse_wisconsin(b("wi_originals.csv"))
    check(any(r["kind"] == "Facility closure, Workforce reduction" for r in wi),
          "Wisconsin's codes read as its own legend's words", f)

    ok = ws.parse_oklahoma(b("ok_aura.json"))
    check(all(r["employees"] is None for r in ok), "Oklahoma prints no count, so every count is None, never 0", f)

    nd = ws.parse_north_dakota(js("nd_tables.json"))
    hess = next((r for r in nd if r["company"] == "Hess Corporation"), {})
    check(hess.get("notice_date") == "2025-07-21" and hess.get("effective_date") == "2025-09-26",
          "North Dakota's two dates in one cell split into the notice and the layoff", f)

    idaho = ws.parse_idaho(js("id_tables.json"))
    jb = next((r for r in idaho if r["company"].startswith("JeniusBank")), {})
    check(jb.get("employees") == 1, "Idaho's \"106 (1 in ID)\" keeps Idaho's share", f)

    ms = ws.parse_mississippi(js("ms_tables.json"))
    check(not any(r["company"].startswith("Conduent") for r in ms), "Mississippi's NON-WARN rows are left out", f)

    sc_tables = js("sc_tables.json")
    sc = ws.parse_south_carolina(sc_tables)
    smbc = next((r for r in sc if r["company"].startswith("SMBC")), {})
    check(smbc.get("notice_date") == "2026-01-08",
          "a South Carolina date a neighbouring word ran through (\"1C/8o/u2n0t2ie6s\") reads as 1/8/2026", f)
    total = lambda tables, n: tables + [[[f"Total WARN:{n}", "", "", "", "", "", ""]]]  # noqa: E731
    check(len(ws.parse_south_carolina(total(sc_tables, 5))) == 5, "a report whose own total matches is read", f)
    # Twenty-four of the fixture's real row, renamed so each is its own notice.
    head, row = sc_tables[0][0], sc_tables[0][1]
    many = [[head] + [[f"{row[0]} {i}"] + row[1:] for i in range(24)]]
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        short = ws.parse_south_carolina(total(many, 25))
    check(len(short) == 24 and "counts 25" in out.getvalue(),
          "one row short of a report's own total (1 in 25) warns and keeps the rest", f)
    try:
        ws.parse_south_carolina(total(sc_tables, 6))
        check(False, "a report short by more than one in twenty is refused", f)
    except ValueError as e:
        check("counts 6" in str(e), "a report short by more than one in twenty is refused", f)

    pa_sites = ws.pennsylvania_sites(
        "The GIANT Company, LLC. 216 East Fairmont Street Coopersburg, PA 18036 COUNTY: Lehigh # AFFECTED: 104 "
        "EFFECTIVE DATE: 3/13/26 CLOSURE OR LAYOFF: Closing 86 Glocker Way Pottstown, PA 19465 COUNTY: Montgomery "
        "# AFFECTED: 84 EFFECTIVE DATE: 3/20/26 CLOSURE OR LAYOFF: Closing")
    check([(s.get("COUNTY"), s.get("AFFECTED")) for s in pa_sites] == [("Lehigh", "104"), ("Montgomery", "84")],
          "a Pennsylvania notice listing two sites becomes two rows, each with its own count", f)
    check(pa_sites[1]["address"] == "86 Glocker Way Pottstown, PA 19465", "the second site's address follows the first's kind", f)

    hi = ws.parse_hawaii(b("hi_archive_2026.html"))
    check(not any("rescind" in r["company"].lower() for r in hi), "a Hawaii letter rescinding a notice is not a notice", f)
    check(any(r["kind"] == "Update" and r["company"] == "DFS Group L.P." for r in hi),
          "a Hawaii update letter is marked as one", f)
    amentum = ws.parse_hawaii_notice(b("hi_notice_amentum.html").decode(), "https://labor.hawaii.gov/x")
    check(amentum and amentum["employees"] == 62 and amentum["notice_date"] == "2026-08-20"
          and amentum["effective_date"] == "2026-10-31", "a Hawaii notice page gives its date, count and effective day", f)
    phrases = {
        "Number of employees at Store: 14 Approximate number of employees to be laid off: 14": 14,
        "Total employees at affected establishment: Approximately 9 Total employees expected to be separated: "
        "Approximately 9": 9,
        "Approximately 537 non‑contract employees work at the affected facilities Approximately 13 employees "
        "are anticipated to be separated": 13,
        "Total employees affected: 4 Expected impact: No loss of employment anticipated": 4,
        "Number not included": None,
    }
    for text, want in phrases.items():
        m = next((m for p in ws.HI_COUNT for m in [p.search(text)] if m), None)
        check((lw.parse_int(m[1]) if m else None) == want, f"a Hawaii count worded \"{text[:40]}...\" reads {want}", f)

    detail = ws.parse_job_center_detail(b("ks_notice.html").decode())
    check(detail == {"employees": 67, "site": "7373 East 29th Street Wichita, Kansas 67226"},
          "a job-center notice page gives its count and address", f)

    url, form = ws.georgia_form(b("ga_page_2026-10-25.html").decode())
    check(url == "https://www.tcsg.edu/wp-admin/admin-ajax.php" and b"nonce=517cf91187" in form and b"length=-1" in form,
          "Georgia's request carries the table's own nonce and asks for every row", f)
    okf = ws.oklahoma_form(b("ok_page.html").decode())
    check(b"fwuid" in okf and b"getListofLayoffAccService" in okf, "Oklahoma's request names the page's build and the notice list", f)

    # --- the job-center loader reuses a held count -----------------------------
    real_get, real_pause, real_held = ws.get, ws.pause, ws.HELD["lookup"]
    asked: list[str] = []
    try:
        def fake_get(u, referer=None):
            asked.append(u)
            return b("ks_notice.html") if "/warn_lookups/" in u and "commit=" not in u else b("az_search.html")
        ws.get, ws.pause = fake_get, (lambda *a: None)
        listed = ws.parse_job_center("AZ", b("az_search.html"))
        held_id = listed[0]["id"]
        ws.HELD["lookup"] = lambda st: {held_id: {"employees": 31, "site": "held site"}} if st == "AZ" else {}
        rows = ws.load_job_center("AZ")(None)
    finally:
        ws.get, ws.pause, ws.HELD["lookup"] = real_get, real_pause, real_held
    by = {r["id"]: r for r in rows}
    check(by[held_id]["employees"] == 31 and by[held_id]["site"] == "held site", "a held notice keeps its count without asking again", f)
    pages = [u for u in asked if "commit=" not in u]
    check(len(pages) == len(rows) - 1 and all(r["employees"] == 67 for i, r in by.items() if i != held_id),
          "every other notice's own page is asked for once", f)

    # --- values -------------------------------------------------------------------
    for raw, want in (("10/6/2026 12:00:00 AM", "2026-10-06"), (43490, "2019-01-25"), ("10-16-26", "2026-10-16"),
                      ("October 21, 2026", "2026-10-21"), ("Oct 2, 2026", "2026-10-02"), ("20261004", "2026-10-04"),
                      ("2026-10-21T00:00:00", "2026-10-21"), ("TBD", None), (2026, None), ("02/30/2026", None)):
        check(lw.parse_date(raw) == want, f"parse_date({raw!r}) is {want}", f)
    check(lw.first_date("12/31/2026-1/31/2027") == "2026-12-31" and lw.first_date("beginning 3/1/2027; ending 6/15/2027") == "2027-03-01",
          "first_date takes the first date of a range or list", f)
    check(lw.parse_month("October", 2026) == "2026-10" and lw.parse_month("Sept", "2025") == "2025-09"
          and lw.parse_month("Octember", 2026) is None, "parse_month gives the month or nothing", f)
    for raw, want in (("1,114", 1114), (" 52 ", 52), ("52 (estimated)", 52), ("50-75", None), ("TBD", None),
                      ("", None), (None, None), (0, 0), ("0", 0), (True, None)):
        check(lw.parse_int(raw) == want, f"parse_int({raw!r}) is {want}", f)
    check(lw.as_of_date("2026-10") == "2026-10-01" and lw.as_of_date("2026-10-21") == "2026-10-21",
          "a month reads as its first day for the freshness check", f)
    check(iw.stamp_date("2999-01-01") == dt.date.today().isoformat(), "a notice dated ahead never stamps freshness past today", f)

    # --- a refusal is told from a defect -------------------------------------------------
    check(lw.is_unreachable(urllib.error.URLError("reset")) and lw.is_unreachable(TimeoutError()),
          "a dropped connection or a timeout is the state's site being down", f)
    check(lw.is_unreachable(urllib.error.HTTPError("u", 503, "x", {}, None)), "an HTTP 503 is the site being down", f)
    check(not lw.is_unreachable(urllib.error.HTTPError("u", 404, "x", {}, None)), "an HTTP 404 is ours to look at", f)
    check(not lw.is_unreachable(ValueError("no header")), "a parse that broke is ours to fix", f)
    check(not lw.is_unreachable(lib_gov_data.RobotsDisallowed("x")), "robots.txt saying no is ours to act on", f)

    # --- robots.txt is asked before any request ---------------------------------------
    real_open = lw.urllib.request.urlopen
    opened: list = []
    lib_gov_data._ROBOTS["https://blocked.example"] = [(False, "/")]
    try:
        lw.urllib.request.urlopen = lambda *a, **k: opened.append(a)  # would be a request
        lib_gov_data.urllib.request.urlopen = lw.urllib.request.urlopen
        for fn in (lambda: lw.get("https://blocked.example/warn.csv"),
                   lambda: lw.post("https://blocked.example/api", b"x=1")):
            try:
                fn()
                check(False, "a path robots.txt disallows is refused", f)
            except lib_gov_data.RobotsDisallowed:
                check(True, "a path robots.txt disallows is refused", f)
        check(not opened, "and nothing is requested from that host", f)
    finally:
        lw.urllib.request.urlopen = real_open
        lib_gov_data.urllib.request.urlopen = real_open
        lib_gov_data._ROBOTS.pop("https://blocked.example", None)

    # --- history: all of it on a first load and on the state's walk day, the newest two years otherwise --------
    real_held = ws.HELD["lookup"]
    try:
        ws.HELD["lookup"] = None
        check(ws.years_to_read("CT", dt.date(2026, 10, 21))[-1] == int(ws.SINCE[:4]), "nothing held: every year back to SINCE", f)
        ws.HELD["lookup"] = lambda st: {"x": {}}
        walk = ws.walk_day("CT")
        on = dt.date(2026, 10, 19) + dt.timedelta(days=walk)          # Oct 19 2026 is a Monday
        off = dt.date(2026, 10, 19) + dt.timedelta(days=(walk + 3) % 7)
        check(ws.years_to_read("CT", off) == [2026, 2025], "rows held, not Connecticut's walk day: this year and last", f)
        check(ws.years_to_read("CT", on)[-1] == int(ws.SINCE[:4]), "rows held, on Connecticut's walk day: every year again", f)
    finally:
        ws.HELD["lookup"] = real_held
    days = [ws.walk_day(st) for st in ws.STATES]
    check(max(days.count(d) for d in range(7)) <= -(-len(days) // 7),
          f"the weekly walks spread over the week (at most {-(-len(days) // 7)} states a day, got {days})", f)
    slow = {st: ws.walk_day(st) for st in ("FL", "NC", "AZ", "HI")}
    check(len(set(slow.values())) == len(slow), f"the four slowest walks fall on four different days ({slow})", f)

    # --- the run: a down site leaves it green, a broken parse turns it partial ----------
    real_states, real_db, real_argv = iw.STATES, iw.Database, sys.argv
    try:
        def down(_f):
            raise urllib.error.URLError("connection reset")

        def broken(_f):
            raise ValueError("no header naming Company")
        iw.STATES = {"xa": {"name": "Down State", "page": "https://x", "days": 21, "load": down},
                     "xb": {"name": "Broken State", "page": "https://x", "days": 21, "load": broken},
                     "xc": {"name": "Good State", "page": "https://x", "days": 21,
                            "load": lambda _f: ws.parse_utah(b("ut_warn.html"))}}
        iw.Database = lambda *a, **k: (_ for _ in ()).throw(AssertionError("a parse-only run opened the database"))
        sys.argv = ["ingest_warn.py", "--parse-only"]
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = iw.main()
        text = out.getvalue()
        check(code == 0 and "site down or refusing: Down State" in text and "FAILED: Broken State" in text,
              "a parse-only run names the state that was down apart from the one that broke, and opens no database", f)
    finally:
        iw.STATES, iw.Database, sys.argv = real_states, real_db, real_argv

    # --- the registry and the site's words for it ------------------------------------------
    for st, s in ws.STATES.items():
        ok_entry = (s.get("name") and s.get("page", "").startswith("https://") and isinstance(s.get("days"), int)
                    and s["days"] >= 21 and callable(s.get("load")) and s.get("snapshot") is True)
        check(bool(ok_entry), f"{st}: the registry entry has a name, a page, a budget of 21+ days, a loader", f)
    check(len(iw.STATES) == 41, f"41 jurisdictions are read: 40 states and DC (got {len(iw.STATES)})", f)
    check(not set(iw.STATES) & {"ar", "wy", "nh", "la", "nm", "ri", "mo", "nv", "mn", "wv"},
          "no reader for a state that publishes nothing, forbids it in robots.txt or walls scripts out", f)
    cov = open(os.path.join(HERE, "..", "src", "lib", "datasetCoverage.ts"), encoding="utf8").read()
    missing = [st for st in iw.STATES if cov.count(f'"warn-notices-{st}"') < 2]
    check(not missing, f"every state's freshness row has a coverage sentence and a label (missing {missing})", f)

    # --- the fixtures are public: no one's email or phone in them --------------------------
    contact = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b")
    leaked = []
    for name in sorted(os.listdir(FIX)):
        data = b(name)
        if name.endswith(".xlsx"):
            text = "\n".join(" | ".join(str(c) for c in r if c is not None)
                             for rows in lw.xlsx_sheets(data).values() for r in rows)
        else:
            text = lw.decode(data)
        if contact.search(text):
            leaked.append(name)
    check(not leaked, f"no fixture carries an email address or a phone number (found in {leaked})", f)

    print("\nALL PASS" if not f else f"\n{len(f)} FAILURE(S)")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())
