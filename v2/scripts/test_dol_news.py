#!/usr/bin/env python3
"""The DOL newsroom reader, on real SQLite.

    python3 scripts/test_dol_news.py

The fixtures are trimmed copies of the list as the Internet Archive kept it
(fixtures/policy_news/dol_releases_*.html): Oct 8 2026 (20 releases, Sep 10 to
Oct 8) and Sep 6 2026 (20 releases, Jul 30 to Sep 4). This Mac can't read
www.dol.gov, so the live page is unverified until a GitHub run. No request
leaves the machine: every fetch is a stand-in.
"""
from __future__ import annotations

import os
import sys
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.pop("REVALIDATE_SECRET", None)  # no call to the site from a test
import ingest_dol_news as d  # noqa: E402
import ingest_oflc_news  # noqa: E402
from lib_db import query_dicts  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures", "policy_news")
FAILS: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def read(name: str) -> str:
    return open(os.path.join(FIX, name), encoding="utf-8").read()


OCT, SEP = read("dol_releases_2026-10-08.html"), read("dol_releases_2026-09-04.html")
EMPTY = "<html><head><title>News Releases | U.S. Department of Labor</title></head><body><main></main></body></html>"


def http(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://www.dol.gov/newsroom/releases", code, "x", {}, None)


def fetcher(pages: list):
    """A stand-in fetch: page n's answer is text, or an exception to raise."""
    calls: list[str] = []

    def fetch(url: str) -> str:
        calls.append(url)
        n = int(url.split("page=")[1]) if "page=" in url else 0
        a = pages[min(n, len(pages) - 1)]
        if isinstance(a, BaseException):
            raise a
        return a
    fetch.calls = calls
    return fetch


def no_sleep(_s):
    pass


def rows(db) -> list[dict]:
    try:
        return query_dicts(db, "SELECT * FROM policy_notices ORDER BY document_number", typed=True)
    except Exception:  # noqa: BLE001 - no table: nothing was written
        return []


def runs(db) -> list[dict]:
    try:
        return query_dicts(db, "SELECT * FROM ingest_runs ORDER BY id", typed=True)
    except Exception:  # noqa: BLE001
        return []


def fresh(db) -> dict | None:
    try:
        got = query_dicts(db, "SELECT * FROM data_freshness WHERE dataset = ?", [d.DATASET], typed=True)
    except Exception:  # noqa: BLE001
        return None
    return got[0] if got else None


def main() -> int:
    # --- the parser, on the Archive's copies --------------------------------
    rel = d.parse_releases(OCT)
    check("Oct 8 page: 20 releases, Oct 8 back to Sep 10 2026",
          len(rel) == 20 and rel[0]["day"] == "2026-10-08" and rel[-1]["day"] == "2026-09-10",
          f"{len(rel)} {rel[0]['day']} {rel[-1]['day']}")
    h2a = [i for i in rel if i["id"] == "whd20260914"]
    check("Oct 8 page: the H-2A debarment, Sep 14 2026, under the Wage and Hour Division",
          len(h2a) == 1 and h2a[0]["day"] == "2026-09-14" and h2a[0]["office"] == "whd"
          and h2a[0]["title"] == "US Department of Labor debars Louisiana employer from H-2A visa program for federal violations",
          str(h2a))
    check("summaries come through as text", all("<" not in i["summary"] and "&nbsp;" not in i["summary"] for i in rel))
    check("every summary on the page is DOL's whole sentence, none marked cut",
          all(i["summary"] and i["summary"][-1] in '.?!' and not i["summary"].endswith(" ...") for i in rel))
    check("a summary DOL cut mid-sentence ends with an ellipsis",
          d._summary("<p>The 4-week moving average was&nbsp;</p>") == "The 4-week moving average was ...",
          d._summary("<p>The 4-week moving average was&nbsp;</p>"))
    sep = d.parse_releases(SEP)
    check("Sep 6 page: 20 releases, Sep 4 back to Jul 30 2026",
          len(sep) == 20 and sep[0]["day"] == "2026-09-04" and sep[-1]["day"] == "2026-07-30")

    # --- what's kept (real titles from the Archive's copies, Oct 2025 to Oct 2026)
    keep = [
        "US Department of Labor launches Project Firewall to protect America’s highly skilled workforce",
        "Project Firewall partnership leads to enhanced federal enforcement against discriminatory hiring practices",
        "US Department of Labor issues proposed rule revising prevailing wage methodology for H-1B, PERM visa programs",
        "US departments of Labor, Justice announce enforcement actions against Cloudera Inc. for alleged Immigration and Nationality Act violations",
        "US Department of Labor reinforces English language proficiency requirements for foreign workers operating commercial motor vehicles",
        "US Department of Labor debars Louisiana employer from H-2A visa program for federal violations",
    ]
    drop = [
        "Unemployment Insurance Weekly Claims Report",
        "US Department of Labor cites Pennsylvania excavation employer for failing to provide trench protection following fatal trench cave-in",
        "US Department of Labor hosts seminars for current, prospective federal contractors on prevailing wage requirements",
        "US Department of Labor surveys West Virginia highway construction industry to establish prevailing wage rates",
    ]
    check("foreign labor and work-visa releases are kept", all(d.keep_release(t) for t in keep),
          str([t for t in keep if not d.keep_release(t)]))
    check("other DOL news is dropped, Davis-Bacon prevailing wages included", not any(d.keep_release(t) for t in drop),
          str([t for t in drop if d.keep_release(t)]))
    check("a plain title is kept on a summary that names a work visa",
          d.keep_release("US Department of Labor recovers back wages for farmworkers", "workers employed under the H-2A program"))

    out = d.release_rows(rel)
    check("one row kept from the Oct 8 page", [r["document_number"] for r in out] == ["dol-whd-whd20260914"], str(out))
    r0 = out[0] if out else {}
    check("the row: DOL's own URL (not the Archive's), its type, its offices",
          r0.get("html_url") == "https://www.dol.gov/newsroom/releases/whd/whd20260914" and r0.get("type") == "DOL news release"
          and r0.get("agencies") == ["Labor Department", "Wage and Hour Division"] and "H-2A" in r0.get("topics", []), str(r0))

    check("the OFLC reader's browser header set is the one used", d.BROWSER_HEADERS is ingest_oflc_news.BROWSER_HEADERS)
    sent: dict = {}

    class Resp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return OCT.encode()
    real_open, real_robots = d.urllib.request.urlopen, d.robots_allowed
    d.urllib.request.urlopen = lambda req, timeout=0: (sent.update(req.headers), Resp())[1]
    d.robots_allowed = lambda url: True
    try:
        d.fetch_url(d.LIST_URL)
    finally:
        d.urllib.request.urlopen, d.robots_allowed = real_open, real_robots
    check("the request carries that header set", sent.get("User-agent") == ingest_oflc_news.BROWSER_HEADERS["User-Agent"]
          and "Sec-ch-ua" in sent, str(sent))

    # --- a run, then a second one -------------------------------------------
    db = SqliteTurso()
    quiet: list[dict] = []
    real_quiet = d.record_quiet_run

    def spy_quiet(*a, **kw):
        quiet.append(kw)
        return real_quiet(*a, **kw)
    d.record_quiet_run = spy_quiet
    try:
        f = fetcher([OCT, SEP, SEP])
        code = d.run(db, fetch=f, sleep=no_sleep)
        check("a first run exits 0 and writes the kept release", code == 0 and len(rows(db)) == 1, f"{code} {rows(db)}")
        check("a first run reads back until a page brings nothing new", len(f.calls) == 3, str(f.calls))
        fr = fresh(db)
        check("freshness: as of the newest release, a 21-day budget",
              fr is not None and fr["as_of"] == "2026-10-08" and fr["max_age_days"] == 21, str(fr))
        check("the run is recorded ok through record_quiet_run",
              len(runs(db)) == 1 and runs(db)[0]["status"] == "ok" and quiet and quiet[0]["written"] == 1,
              str(runs(db)) + str(quiet))

        f = fetcher([OCT, SEP])
        code = d.run(db, fetch=f, sleep=no_sleep)
        check("a second run asks page 0 only (its oldest is already held)", f.calls == [d.LIST_URL], str(f.calls))
        check("an unchanged second run writes nothing", code == 0 and len(rows(db)) == 1)
        check("the quiet run goes through record_quiet_run with written=0, no new row",
              len(quiet) == 2 and quiet[1]["written"] == 0 and len(runs(db)) == 1, str(quiet) + str(runs(db)))
    finally:
        d.record_quiet_run = real_quiet

    # --- nothing to read: refuse, write nothing, exit 1 --------------------
    db = SqliteTurso()
    code = d.run(db, fetch=fetcher([EMPTY]), sleep=no_sleep)
    r = runs(db)
    check("a page with no releases exits 1", code == 1, str(code))
    check("and writes nothing, stamps nothing", not rows(db) and fresh(db) is None)
    check("and records a failed run naming what was missing",
          len(r) == 1 and r[0]["status"] == "failed" and "no rows" in r[0]["note"], str(r))
    db = SqliteTurso()
    code = d.run(db, fetch=fetcher([OCT.replace("dol-date-text", "release-date")]), sleep=no_sleep)
    check("a page whose releases lost their dates exits 1 and writes nothing", code == 1 and not rows(db), str(code))

    # --- refused: a warning, nothing written, an ok run with the reason -----
    for code_in in (403, 429, 503):
        db = SqliteTurso()
        quiet.clear()
        d.record_quiet_run = spy_quiet
        try:
            code = d.run(db, fetch=fetcher([http(code_in)]), sleep=no_sleep)
        finally:
            d.record_quiet_run = real_quiet
        r = runs(db)
        check(f"HTTP {code_in}: exits 0, writes and stamps nothing, an ok run with the refusal, through record_run",
              code == 0 and not rows(db) and fresh(db) is None and len(r) == 1 and r[0]["status"] == "ok"
              and f"HTTP {code_in}" in r[0]["note"] and not quiet, str(r))
    db = SqliteTurso()
    code = d.run(db, fetch=fetcher([TimeoutError("timed out")]), sleep=no_sleep)
    check("a timeout is a refusal too", code == 0 and runs(db) and runs(db)[0]["status"] == "ok"
          and "TimeoutError" in runs(db)[0]["note"], str(runs(db)))
    db = SqliteTurso()
    code = d.run(db, fetch=fetcher([OCT, http(503)]), sleep=no_sleep)
    r = runs(db)
    check("an older page refused: page 0 still written, the run ok with the refusal noted",
          code == 0 and len(rows(db)) == 1 and r and r[-1]["status"] == "ok" and "page 2 unread (HTTP 503)" in r[-1]["note"],
          str(r))
    db = SqliteTurso()
    code = d.run(db, fetch=fetcher([http(404)]), sleep=no_sleep)
    check("a list that answers 404 (moved) exits 1", code == 1 and runs(db)[0]["status"] == "failed", str(runs(db)))

    # --- a defect here crashes ----------------------------------------------
    try:
        d.run(SqliteTurso(), fetch=fetcher([KeyError("bug")]), sleep=no_sleep)
        check("a code error crashes", False)
    except KeyError:
        check("a code error crashes", True)

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
