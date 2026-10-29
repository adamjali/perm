#!/usr/bin/env python3
"""ingest_visa_wait_times: State's Global Visa Wait Times table, read and kept.

The fixtures are State's own pages, trimmed: the live table of Oct 28 2026
(fixtures/visa_wait_times_2026-10-21.html, every row) and two older formats
from the Internet Archive's copies (fixtures/visa_wait_times_archive.html: a
bare "7.5" with no unit, Jan 2026, and "<0.5 months", Nov 2025). State's
October table prints no blank cell and no "Same day", so those two cases are
one real row each with that one cell edited, said where it's done.

The writes run through lib_sqlite_shim, which returns integers as strings the
way the wire does, so "an unchanged page writes nothing" is tested against the
real diff.

Run: python3 scripts/test_visa_wait_times.py
"""
from __future__ import annotations

import pathlib
import sys
import tempfile
import urllib.error

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_visa_wait_times as W  # noqa: E402
from lib_db import query_rows  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

FIX = pathlib.Path(__file__).resolve().parent / "fixtures"
LIVE = (FIX / "visa_wait_times_2026-10-21.html").read_text(encoding="utf8")
ARCHIVE = (FIX / "visa_wait_times_archive.html").read_text(encoding="utf8")
TODAY = "2026-10-28"
FAILS: list[str] = []


def check(name: str, cond) -> None:
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        FAILS.append(name)


def refused(page: str, today: str = TODAY) -> str:
    """The refusal's reason, or '' when the page was accepted."""
    try:
        W.parse(page, today)
    except W.Refusal as e:
        return str(e)
    except Exception as e:  # noqa: BLE001 - a crash is a failed check here, not a refusal
        return f"crashed: {type(e).__name__}: {e}"
    return ""


def cell(got: dict, post: str, cls: str, measure: str = "next") -> dict:
    return next(r for r in got["rows"] if r["post"] == post and r["visa_class"] == cls and r["measure"] == measure)


# --- the live table -----------------------------------------------------------------
got = W.parse(LIVE, TODAY)
check("reads State's 'Last updated: 21-OCT-2026'", got["reading"] == "2026-10-21")
check("241 posts, five columns each", got["posts"] == 241 and len(got["rows"]) == 1205)
check("the two placeholder rows named NA are skipped, not read as a post",
      got["skipped"] == 2 and not any(r["post"] == "NA" for r in got["rows"]))
check("the five columns, read from their headers", got["columns"] == [
    ("required", "B1/B2", "average"), ("required", "B1/B2", "next"), ("required", "F,M,J", "next"),
    ("required", "H,L,O,P,Q", "next"), ("required", "C,D,C1/D", "next")])
check("every cell this month reads", got["unread"] == [])
a = cell(got, "Abidjan", "B1/B2", "average")
check("'9 Months' is 9 months, 270 days, the header kept as printed",
      (a["kind"], a["amount"], a["unit"], a["days"], a["wait_text"]) == ("value", 9.0, "month", 270, "9 Months")
      and a["column_label"] == "Interview Required (B1/B2) Average wait times")
u = cell(got, "Abidjan", "F,M,J")
check("'< 0.5 Month' is under half a month: 0.5, bound under, 15 days",
      (u["kind"], u["amount"], u["bound"], u["days"]) == ("value", 0.5, "under", 15))
na = cell(got, "Abuja", "H,L,O,P,Q")
check("'NA' is na with no amount, never 0", (na["kind"], na["amount"], na["days"]) == ("na", None, None))
check("'11 Month' (Calgary, singular) reads as 11 months", cell(got, "Calgary", "B1/B2", "average")["amount"] == 11.0)
c = cell(got, "Chennai (Madras)", "F,M,J")
check("'3.5 months' (Chennai, lower case) reads, the post's name kept as printed",
      (c["amount"], c["unit"], c["post_key"]) == (3.5, "month", "chennai (madras)"))
check("N`Djamena's key folds the backtick to an apostrophe",
      {r["post_key"] for r in got["rows"] if r["post"] == "N`Djamena"} == {"n'djamena"})
check("State's table names no country", all(r["country"] is None for r in got["rows"]))

# --- older formats, from the Internet Archive's copies -----------------------------
cal, rest = ARCHIVE.split("<div id='jan'>", 1)
jan_part, nov_part = rest.split("<div id='nov'>", 1)
jan_rows = W.table_rows(cal + jan_part)
check("the City/Post table is found past the Archive's own calendar table", jan_rows[0][0] == "City/Post")
check("'14-JANUARY-2026' and '20-NOVEMBER-2025' read as dates",
      (W.reading_of(cal + jan_part, TODAY), W.reading_of(cal + nov_part, TODAY)) == ("2026-01-14", "2025-11-20"))
dhaka = dict(zip(jan_rows[0], jan_rows[1]))
bare = W.read_value(dhaka.get("Interview Required (B1/B2) Average wait times", "missing"))
check("a bare '7.5' (Dhaka, Jan 2026) reads as 7.5 months, unit not printed",
      (bare["kind"], bare["amount"], bare["unit"], bare["unit_printed"], bare["days"]) == ("value", 7.5, "month", 0, 225))
check("a printed unit is recorded as printed", W.read_value("9 Months")["unit_printed"] == 1)
nov_rows = W.table_rows(cal + nov_part)
abidjan_crew = nov_rows[1][5] if len(nov_rows) > 1 and len(nov_rows[1]) > 5 else "missing"
lt = W.read_value(abidjan_crew)
check("'<0.5 months' (Nov 2025, no space) is under half a month",
      (abidjan_crew, lt["amount"], lt["bound"]) == ("<0.5 months", 0.5, "under"))
check("days read as days: '12 Calendar Days' is 12", (W.read_value("12 Calendar Days")["unit"],
                                                     W.read_value("12 Calendar Days")["days"]) == ("day", 12))

# --- blank and Same day are two different things -------------------------------------
check("a blank cell is blank, with no amount", W.read_value("") == {
    "kind": "blank", "amount": None, "unit": None, "bound": None, "unit_printed": None, "days": None})
check("'Same Day' is same_day, 0 days", (W.read_value("Same Day")["kind"], W.read_value("Same day")["days"])
      == ("same_day", 0))
# Abidjan's real row, with its F,M,J cell edited to "Same Day" and its C,D,C1/D cell emptied.
row = "<td width=\"211\">&lt; 0.5 Month</td>\n<td width=\"332\">3 Months</td>\n<td width=\"342\">&lt; 0.5 Month</td>"
check("(the edit below finds Abidjan's real row)", row in LIVE)
edited = LIVE.replace(row, "<td width=\"211\">Same Day</td>\n<td width=\"332\">3 Months</td>\n<td width=\"342\"></td>")
e = W.parse(edited, TODAY)
sd, bl = cell(e, "Abidjan", "F,M,J"), cell(e, "Abidjan", "C,D,C1/D")
check("in a table, Same Day stores 0 and blank stores nothing",
      (sd["kind"], sd["amount"], bl["kind"], bl["amount"], bl["wait_text"]) == ("same_day", 0.0, "blank", None, ""))

# --- what is refused ---------------------------------------------------------------
rows_at = [i for i in range(len(LIVE)) if LIVE.startswith("<tr>", i)]
cut = LIVE[:rows_at[150]] + "</tbody></table>"
check("a table cut to 149 posts is refused (the floor is 200)", "only 149 posts" in refused(cut))
check("a page with no 'Last updated' date is refused", "Last updated" in refused(LIVE.replace("Last updated", "Updated")))
check("a page with no City/Post table is refused", "City/Post" in refused(LIVE.replace("City/Post", "Location")))
check("a header with no visa class is refused",
      "header" in refused(LIVE.replace("Interview Required<br>\nPetition-Base (H,L,O,P,Q)", "Workers")))
last_cell = "<td width=\"342\">&lt; 0.5 Month</td>\n</tr>"
check("(the edit below finds Abidjan's last cell)", LIVE.count(last_cell) == 1)
check("a row missing a cell is refused", "cells" in refused(LIVE.replace(last_cell, "</tr>")))
check("a post listed twice is refused", "twice" in refused(LIVE.replace(">Adana<", ">Abuja<")))
check("a table mostly unreadable is refused", "unreadable" in refused(LIVE.replace(" Months<", " Mo.<")))
check("a 'Last updated' after today is refused", "after today" in refused(LIVE, today="2026-10-01"))
check("one odd cell is kept as printed, not refused",
      cell(W.parse(LIVE.replace("<td width=\"170\">9 Months</td>", "<td width=\"170\">Closed</td>"), TODAY),
           "Abidjan", "B1/B2", "average")["kind"] == "unread")

# --- writing: history per reading, and nothing written twice -----------------------
db = SqliteTurso()
db.script(["CREATE TABLE perm_docs (key TEXT PRIMARY KEY, json TEXT, computed_at INTEGER)"])
first = W.write(db, got)
check("a first load writes every cell", first == {"written": 1205, "deleted": 0, "unchanged": 0})
again = W.write(db, W.parse(LIVE, TODAY))
check("the same page again writes nothing", again == {"written": 0, "deleted": 0, "unchanged": 1205})
restated = W.write(db, W.parse(LIVE.replace("<td width=\"170\">9 Months</td>", "<td width=\"170\">8 Months</td>"), TODAY))
check("a cell State restates in the same reading rewrites that cell alone", restated["written"] == 1)
older = W.parse(LIVE.replace("21-OCT-2026", "18-JUN-2026"), TODAY)
W.write(db, older)
by_reading = dict(query_rows(db, f"SELECT reading, count(*) FROM {W.TABLE} GROUP BY 1"))
check("each reading is kept beside the others", by_reading == {"2026-06-18": "1205", "2026-10-21": "1205"})
check("the newest reading held is October's", W.newest_held(db) == "2026-10-21")

# --- main(), end to end on saved pages ----------------------------------------------
def run_main(argv: list[str], database) -> int:
    saved_argv, saved_db = sys.argv, W.Database
    sys.argv, W.Database = ["ingest_visa_wait_times.py", *argv], (lambda: database)
    try:
        return W.main()
    finally:
        sys.argv, W.Database = saved_argv, saved_db


scratch = tempfile.TemporaryDirectory()
tmp = pathlib.Path(scratch.name)
live_file, jun_file = tmp / "wt_live.html", tmp / "wt_jun.html"
live_file.write_text(LIVE, encoding="utf8")
jun_file.write_text(LIVE.replace("21-OCT-2026", "18-JUN-2026"), encoding="utf8")
W.et_today = lambda: TODAY  # reading_of's "after today" check, on the fixture's day
mdb = SqliteTurso()
code1 = run_main(["--from-file", str(live_file)], mdb)
code2 = run_main(["--from-file", str(live_file)], mdb)
runs = query_rows(mdb, "SELECT status, rows_written FROM ingest_runs ORDER BY id")
check("main: a first run writes 1205 cells, a second writes none", (code1, code2) == (0, 0)
      and [(s, int(n)) for s, n in runs] == [("ok", 1205), ("ok", 0)])
fresh = query_rows(mdb, "SELECT as_of, max_age_days FROM data_freshness WHERE dataset = 'visa-wait-times'")
check("main stamps State's own date with the measured budget", fresh == [["2026-10-21", "49"]])
run_main(["--from-file", str(jun_file)], mdb)
fresh = query_rows(mdb, "SELECT as_of FROM data_freshness WHERE dataset = 'visa-wait-times'")
check("an older reading served later never moves freshness back", fresh == [["2026-10-21"]])
ndb = SqliteTurso()
run_main(["--from-file", str(live_file), "--no-stamp"], ndb)
check("--no-stamp writes the rows and no freshness row",
      query_rows(ndb, f"SELECT count(*) FROM {W.TABLE}") == [["1205"]]
      and not query_rows(ndb, "SELECT name FROM sqlite_master WHERE name = 'data_freshness'"))
bad = tmp / "wt_bad.html"
bad.write_text(cut, encoding="utf8")
bdb = SqliteTurso()
code = run_main(["--from-file", str(bad)], bdb)
check("main: a refused page exits 1, writes no cell, records a failed run",
      code == 1 and not query_rows(bdb, "SELECT name FROM sqlite_master WHERE name = ?", [W.TABLE])
      and [r[0] for r in query_rows(bdb, "SELECT status FROM ingest_runs")] == ["failed"])
scratch.cleanup()

# --- reading State's site --------------------------------------------------------------
def http_error(url: str, code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(url, code, "x", {}, None)


def fake_fetch(answers: list):
    asked: list[str] = []

    def fetch(url: str) -> str:
        asked.append(url)
        if url.endswith("/robots.txt"):
            raise http_error(url, 404)
        a = answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return a
    return fetch, asked


pauses: list[float] = []
fetch, asked = fake_fetch([http_error(W.PAGE, 404), "<title>404 - Page Not Found</title>", LIVE])
try:
    page_read = W.read_page(fetch, pauses.append)
except W.Refusal:
    page_read = None
check("an old-site 404 and an old-site page are asked past until the table answers",
      page_read == LIVE and asked.count(W.PAGE) == 3)
check("robots.txt is asked first, and every request waits a second or more",
      asked[0].endswith("/robots.txt") and len(pauses) >= 3 and min(pauses) >= 1)
fetch, _ = fake_fetch([http_error(W.PAGE, 404)] * W.PAGE_TRIES)
try:
    W.read_page(fetch, lambda s: None)
    check("no new-site server in PAGE_TRIES tries is a refusal", False)
except W.Refusal as e:
    check("no new-site server in PAGE_TRIES tries is a refusal", "new-site" in str(e))
check("robots.txt that disallows the page is honoured",
      not W.robots_ok(W.PAGE, lambda u: "User-agent: *\nDisallow: /content/travel/\n"))
check("robots.txt that allows it is read as allowing it",
      W.robots_ok(W.PAGE, lambda u: "User-agent: *\nDisallow: /private/\n"))


class Opener:
    seen: list = []

    def open(self, req, timeout=None):
        self.seen.append(req)

        class R:
            def read(self):
                return b"ok"

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False
        return R()


saved_opener = W._OPENER
W._OPENER = Opener()
try:
    W.get_text(W.PAGE)
    ua = W._OPENER.seen[0].get_header("User-agent")
finally:
    W._OPENER = saved_opener
check("every request names PERM Tracker and how to reach it", "PERMTracker" in ua and "permtracker.app" in ua)

print(f"{len(FAILS)} failed")
sys.exit(1 if FAILS else 0)
