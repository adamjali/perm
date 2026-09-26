#!/usr/bin/env python3
"""Contract tests for the visa-bulletin parser and its primary-source route.

    python3 scripts/test_visa_bulletin.py

Why this exists as a test rather than a one-off check: the parser is the ONLY
thing standing between a saved government page and a cutoff date published on
the site, and every one of its guards protects against a failure that produces
a plausible wrong answer rather than an error.

The fixture is a trimmed real capture of the July 2026 bulletin (the last one
the Internet Archive obtained before travel.state.gov began refusing its
crawler). Trimmed deliberately: it keeps the title phrase and the two
employment-based tables and nothing else, which also proves the parser does
not depend on page chrome.
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
FIXTURE = HERE / "__fixtures__" / "visa-bulletin-2026-07.html"

spec = importlib.util.spec_from_file_location("vb", HERE / "ingest_visa_bulletin.py")
vb = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(vb)

failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{'' if cond else f': {detail}'}")
    if not cond:
        failures.append(label)


def refuses(label: str, page: str, month: str | None, expect: str) -> None:
    """Every guard must raise SystemExit BEFORE any database connection."""
    with tempfile.TemporaryDirectory() as d:
        p = pathlib.Path(d) / "page.html"
        p.write_text(page)
        try:
            vb.ingest_saved_page(str(p), month)
        except SystemExit as exc:
            check(label, expect.lower() in str(exc).lower(), f"said {exc!s:.70}")
        except Exception as exc:  # noqa: BLE001
            check(label, False, f"{type(exc).__name__}: {exc}")
        else:
            check(label, False, "did not refuse")


def main() -> int:
    page = FIXTURE.read_text()

    # --- the happy path, which is also the control -----------------------
    # Five refusals below prove nothing on their own: a parser that refused
    # everything would pass all of them.
    check("month read off the page", vb.month_from_page(page) == "2026-07",
          f"got {vb.month_from_page(page)}")

    parsed = vb.parse_bulletin(page)

    # The three EB-5 set-aside rows (added 2026-09-07). Both charts print the

    # label differently ("5th Set Aside: Rural (20%, ...)" vs "5th Set Aside:

    # (Rural: NR, RR - 20%)"), so both tables must resolve all three.

    for chart in ("finalAction", "datesForFiling"):

        for code in ("EB5R", "EB5HU", "EB5I"):

            check(f"{chart} carries {code}", code in (parsed or {}).get(chart, {}), "set-aside row not parsed")

    check("nine categories per chart from May 2022 on", vb.expected_categories("2022-05") == 9 and vb.expected_categories("2022-04") == 6)

    check("both charts parsed", bool(parsed))
    if parsed:
        fa = parsed["finalAction"]
        check("all nine categories", sorted(fa) == ["EB1", "EB2", "EB3", "EB4", "EB5", "EB5HU", "EB5I", "EB5R", "EW3"],
              f"got {sorted(fa)}")
        check("every country column present",
              all(set(r) == {"worldwide", "china", "india", "mexico", "philippines"}
                  for r in fa.values()))
        # A cutoff cell is a DATE, or C, or U, and C and U are opposites. If a
        # future change ever coerced U into a date, EB2 India would read as
        # "nearly there" in the month the category shut.
        check("EB2 India is U, not a date", fa["EB2"]["india"] == "U", fa["EB2"]["india"])
        check("EB2 worldwide is C", fa["EB2"]["worldwide"] == "C", fa["EB2"]["worldwide"])
        check("EB3 India is a real cutoff", fa["EB3"]["india"] == "01JAN14", fa["EB3"]["india"])
        # Final action first, dates for filing second. Swapping them would
        # publish the wrong chart under the right heading.
        check("the two charts differ",
              parsed["finalAction"] != parsed["datesForFiling"])
        # The trimmed fixture carries no family tables, and that must be a
        # null rather than an empty chart: null is what the backfill refills.
        check("no family chart on a page without one", "familyFinalAction" not in parsed)

    # --- the FAMILY charts (added 2026-09-08), on the untrimmed July 2026 page --
    full = (HERE / "__fixtures__" / "visa-bulletin-2026-07-family.html").read_text()
    fam = vb.parse_bulletin(full)
    check("family charts parsed from the full page", bool(fam) and "familyFinalAction" in fam and "familyDatesForFiling" in fam)
    if fam and "familyFinalAction" in fam:
        ffa = fam["familyFinalAction"]
        check("five family categories", sorted(ffa) == ["F1", "F2A", "F2B", "F3", "F4"], f"got {sorted(ffa)}")
        check("F2A is not read as F2B", ffa["F2A"]["worldwide"] == "01JAN25" and ffa["F2B"]["worldwide"] == "22NOV17",
              f"{ffa['F2A']['worldwide']} / {ffa['F2B']['worldwide']}")
        check("F1 Mexico is its own cell, not worldwide's", ffa["F1"]["mexico"] == "08NOV07", ffa["F1"]["mexico"])
        check("the employment charts on the full page still match the trimmed one",
              fam["finalAction"]["EB3"]["india"] == "01JAN14" and fam["finalAction"]["EB2"]["india"] == "U")
        check("family final action and dates for filing differ", fam["familyFinalAction"] != fam["familyDatesForFiling"])

    # --- the guards ------------------------------------------------------
    refuses("refuses a Cloudflare challenge page",
            "<html><title>Attention Required! | Cloudflare</title></html>", None,
            "challenge page")
    refuses("refuses a month that contradicts the page", page, "2026-08", "page says")
    refuses("refuses a page with no month", "<html><table></table></html>", None,
            "exactly one bulletin month")
    refuses("refuses a month with no charts",
            "<html>Visa Bulletin For March 2026</html>", None,
            "no employment-based charts")
    refuses("refuses two different months on one page",
            "Visa Bulletin For March 2026 ... Visa Bulletin For April 2026", None,
            "exactly one bulletin month")

    # --- the SIX-column layout, which is why position cannot be trusted ---
    # Bulletins before ~April 2023 carry an extra EL SALVADOR / GUATEMALA /
    # HONDURAS column on the EMPLOYMENT chart, between CHINA and INDIA. A
    # parser keyed on position reads El Salvador's cell as India's: for this
    # very bulletin that would have published EB3 India as "Current" when it
    # was actually backlogged to 2012.
    six = (HERE / "__fixtures__" / "visa-bulletin-2023-02-sixcol.html").read_text()
    check("the six-column month is read", vb.month_from_page(six) == "2023-02",
          str(vb.month_from_page(six)))
    old = vb.parse_bulletin(six)
    check("the six-column layout parses at all", bool(old))
    if old:
        fa6 = old["finalAction"]
        check("six-column: all nine categories (Feb 2023 is after the 2022 split)",
              sorted(fa6) == ["EB1", "EB2", "EB3", "EB4", "EB5", "EB5HU", "EB5I", "EB5R", "EW3"], str(sorted(fa6)))
        # The whole point: India from India's column, not El Salvador's.
        check("six-column: EB3 India is 15JUN12, not El Salvador's C",
              fa6["EB3"]["india"] == "15JUN12", fa6["EB3"]["india"])
        check("six-column: EB2 India is 08OCT11",
              fa6["EB2"]["india"] == "08OCT11", fa6["EB2"]["india"])
        check("six-column: the extra column is not stored",
              set(fa6["EB3"]) == {"worldwide", "china", "india", "mexico", "philippines"},
              str(sorted(fa6["EB3"])))

    # --- a MISSING country is still a hard failure ------------------------
    # Resolving by name means a reordered column is read correctly rather
    # than refused, which is strictly better. What must still fail loudly is
    # a country we need not being there at all - that is a family-sponsored
    # chart, or a layout change we have not seen.
    # Two refusal MECHANISMS, and the test must accept both or it reports a
    # working guard as broken. Removing INDIA also removes the token that
    # SELECTS the employment chart, so the chart is never picked and
    # parse_bulletin returns None - a refusal that arrives earlier than the
    # ValueError, not a weaker one.
    gone = six.replace("INDIA", "ELBONIA")
    try:
        got = vb.parse_bulletin(gone)
        check("a missing country column is rejected", got is None,
              "parsed a chart with no India column")
    except ValueError as exc:
        check("a missing country column is rejected", True, str(exc)[:60])
    except Exception as exc:  # noqa: BLE001
        check("a missing country column is rejected", False, type(exc).__name__)

    # And the ValueError path specifically: a chart that IS selected (INDIA
    # present in the header) but is missing another required country.
    lost_mexico = six.replace("MEXICO", "ELBONIA")
    try:
        vb.parse_bulletin(lost_mexico)
        check("a chart missing MEXICO raises", False, "parsed anyway")
    except ValueError as exc:
        check("a chart missing MEXICO raises", "MEXICO" in str(exc).upper(), str(exc)[:60])
    except Exception as exc:  # noqa: BLE001
        check("a chart missing MEXICO raises", False, type(exc).__name__)

    # --- a family-sponsored chart still yields nothing ---------------------
    page_family = page.replace("INDIA", "EL SALVADOR")
    check("a family-sponsored chart yields nothing",
          vb.parse_bulletin(page_family) is None)
    refuses("refuses a family-sponsored chart", page_family, "2026-07",
            "no employment-based charts")

    # --- before dates for filing existed (added 2026-09-26) -----------------
    # The Dates for Filing chart began with the October 2015 bulletin, so an
    # earlier bulletin prints ONE employment chart and ONE family chart. The
    # two fixtures are real Internet Archive captures trimmed to their charts
    # (the capture URL is in each file's first line).
    jan15 = (HERE / "__fixtures__" / "visa-bulletin-2015-01.html").read_text()
    p15 = vb.parse_bulletin(jan15, "2015-01")
    check("Jan 2015: one employment chart is a whole bulletin for its era", p15 is not None)
    if p15:
        check("Jan 2015: final action read by column",
              p15["finalAction"].get("EB2", {}).get("india") == "15FEB05"
              and p15["finalAction"].get("EB3", {}).get("worldwide") == "01JUN13",
              str(p15["finalAction"].get("EB2")))
        check("Jan 2015: no dates-for-filing chart, stored as empty",
              p15["datesForFiling"] == {}, str(p15["datesForFiling"])[:60])
        check("Jan 2015: EB5 read from the Targeted Employment Areas row",
              p15["finalAction"].get("EB5", {}).get("china") == "C", str(p15["finalAction"].get("EB5")))
        check("Jan 2015: every category its era had",
              len(p15["finalAction"]) == vb.expected_categories("2015-01") == 6,
              str(sorted(p15["finalAction"])))
        check("Jan 2015: family final action read, family filing absent",
              "familyFinalAction" in p15 and "familyDatesForFiling" not in p15)
    check("Jan 2015: month read off the page", vb.month_from_page(jan15) == "2015-01")
    # A single chart is only whole BEFORE October 2015. After it, one chart is
    # a truncated capture, and accepting it would store a month with no
    # dates for filing that the bulletin did print.
    check("one chart is refused for a month that printed two",
          vb.parse_bulletin(jan15, "2016-01") is None)
    check("one chart is refused when the month is unknown",
          vb.parse_bulletin(jan15) is None)
    refuses("the saved-page route refuses one chart for a two-chart month",
            jan15.replace("January 2015", "January 2016"), None, "no employment-based charts")

    oct15 = (HERE / "__fixtures__" / "visa-bulletin-2015-10.html").read_text()
    po = vb.parse_bulletin(oct15, "2015-10")
    check("Oct 2015: both charts, the first month with dates for filing",
          po is not None and po["finalAction"].get("EB2", {}).get("india") == "01MAY05"
          and po["datesForFiling"].get("EB2", {}).get("india") == "01JUL09")
    if po:
        check("Oct 2015: final action EB5 still from the non-regional row",
              po["finalAction"].get("EB5", {}).get("china") == "08OCT13", str(po["finalAction"].get("EB5")))
        check("Oct 2015: filing-chart EB5 from the Targeted Employment Areas row",
              po["datesForFiling"].get("EB5", {}).get("china") == "01MAY15", str(po["datesForFiling"].get("EB5")))
        check("Oct 2015: six categories on both charts",
              len(po["finalAction"]) == 6 and len(po["datesForFiling"]) == 6,
              f"{sorted(po['finalAction'])} / {sorted(po['datesForFiling'])}")

    # --- the backfill's dry run writes nothing (added 2026-09-26) -----------
    # A recording stand-in for the database and a fetch that serves the fixture,
    # so the ONLY statements the dry run may send are reads.
    class Recorder:
        def __init__(self):
            self.sql: list[str] = []

        def execute(self, sql, args=None):
            self.sql.append(sql)
            return {"response": {"result": {"rows": []}}}

        def scalar(self, sql, args=None):
            self.sql.append(sql)
            return 0

    rec = Recorder()
    saved = (vb.Turso, vb.discover_snapshots, vb.fetch, vb.time.sleep)
    try:
        vb.Turso = lambda: rec
        vb.discover_snapshots = lambda limit, years: [("2015-01", "20260511180158", "https://example.invalid/jan-2015")]
        vb.fetch = lambda url, attempts=3: jan15
        vb.time.sleep = lambda s: None
        rc = vb.backfill_from_archive([2015], 400, dry_run=True)
        writes = [q for q in rec.sql if not q.lstrip().upper().startswith("SELECT")]
        check("the dry run sends reads only", not writes and rc == 0, str(writes)[:80])
        rec.sql.clear()
        vb.backfill_from_archive([2015], 400)
        check("control: the real run does write the month",
              any("INSERT OR REPLACE INTO visa_bulletins" in q for q in rec.sql))
    finally:
        vb.Turso, vb.discover_snapshots, vb.fetch, vb.time.sleep = saved

    # --- the direct route: State's own index on adoption.state.gov -------
    idx = (
        '<a href="/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-july-2026.html">Jul</a>'
        '<a href="/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-october-2026.html">Oct</a>'
        '<a href="/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-june-2026.html">Jun</a>'
        '<a href="/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-smarch-2026.html">x</a>'
    )
    months = vb.direct_months(idx)
    check("the index gives each linked month once, newest first, across fiscal-year folders",
          [m for m, _ in months] == ["2026-10", "2026-07", "2026-06"], str(months)[:120])
    check("each month keeps the absolute URL on State's host",
          months[1][1].startswith("https://adoption.state.gov/") and months[1][1].endswith("july-2026.html"))
    check("a page from State's own host ranks as a primary source",
          vb.rank_of(vb.DIRECT_SOURCE) == 3)
    check("control: a mirror still ranks below it",
          vb.rank_of("third party (mirror; original: travel.state.gov)") == 1)

    class Held(Recorder):
        def execute(self, sql, args=None):
            self.sql.append(sql)
            if sql.startswith("SELECT bulletin_month, source_url"):
                return {"response": {"result": {"rows": [
                    [{"type": "text", "value": "2026-07"}, {"type": "text", "value": vb.SAVED_PAGE_SOURCE}],
                    [{"type": "text", "value": "2026-06"}, {"type": "text", "value": "https://web.archive.org/x travel.state.gov"}],
                ]}}}
            return {"response": {"result": {"rows": []}}}

    held = Held()
    asked: list[str] = []
    saved = (vb.Turso, vb.fetch, vb.time.sleep)
    try:
        vb.Turso = lambda: held
        vb.time.sleep = lambda s: None

        def fake_fetch(url, attempts=3):
            asked.append(url)
            return idx if url == vb.DIRECT_INDEX else page   # the July 2026 fixture

        vb.fetch = fake_fetch
        vb.ingest_direct(2)
        pages = [u for u in asked if u != vb.DIRECT_INDEX]
        check("a month already held from a primary source is not fetched again",
              not any("july-2026" in u for u in pages), str(pages))
        check("a month held only from the archive is upgraded",
              any("june-2026" in u for u in pages), str(pages))
        check("a page that reads as a different month is not stored under the linked one",
              not any("INSERT OR REPLACE INTO visa_bulletins" in q for q in held.sql),
              "stored the July fixture as October or June")

        def refused(url, attempts=3):
            raise vb.urllib.error.HTTPError(url, 403, "Forbidden", {}, None)

        class Empty(Recorder):
            pass

        fresh = Empty()
        vb.Turso = lambda: fresh
        vb.fetch = lambda url, attempts=3: (
            '<a href="/content/travel/en/legal/visa-law0/visa-bulletin/2026/visa-bulletin-for-july-2026.html">Jul</a>'
            if url == vb.DIRECT_INDEX else page)
        vb.ingest_direct(2)
        check("control: a month not held is stored, labelled as State's own host",
              any("INSERT OR REPLACE INTO visa_bulletins" in q for q in fresh.sql))

        vb.fetch = refused
        check("a refused index warns and exits 0 (the freshness budget is the alarm)",
              vb.ingest_direct(2) == 0)
    finally:
        vb.Turso, vb.fetch, vb.time.sleep = saved

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
