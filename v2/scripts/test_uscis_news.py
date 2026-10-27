#!/usr/bin/env python3
"""The USCIS newsroom and Policy Manual reader, on real SQLite.

    python3 scripts/test_uscis_news.py

The fixtures are trimmed real copies read on Oct 27 2026
(fixtures/policy_news/): the All News feed (51 of its 250 items), the newsroom
page (its 10 rows), the Policy Manual updates page (19 of its 355 rows). No
request leaves the machine: every fetch is a stand-in.
"""
from __future__ import annotations

import os
import sys
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.pop("REVALIDATE_SECRET", None)  # no call to the site from a test
import ingest_uscis_news as u  # noqa: E402
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


FEED, PAGE, PM = read("uscis_news_feed.rss"), read("uscis_newsroom_page.html"), read("uscis_pm_updates.html")
EMPTY_FEED = FEED[: FEED.find("<item>")] + "</channel></rss>"
EMPTY_PAGE = "<html><body><p>Page not found</p></body></html>"


def http(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://www.uscis.gov/x", code, "x", {}, None)


def fetcher(answers: dict):
    """A stand-in fetch: a URL's answer is text, or an exception to raise."""
    calls: list[str] = []

    def fetch(url: str) -> str:
        calls.append(url)
        a = answers[url]
        if isinstance(a, BaseException):
            raise a
        return a
    fetch.calls = calls
    return fetch


def no_sleep(_s):
    pass


def rows(db, where: str = "1=1") -> list[dict]:
    try:
        return query_dicts(db, f"SELECT * FROM policy_notices WHERE {where} ORDER BY document_number", typed=True)
    except Exception:  # noqa: BLE001 - no table: nothing was written
        return []


def runs(db) -> list[dict]:
    try:
        return query_dicts(db, "SELECT * FROM ingest_runs ORDER BY id", typed=True)
    except Exception:  # noqa: BLE001
        return []


def fresh(db, dataset: str) -> dict | None:
    try:
        got = query_dicts(db, "SELECT * FROM data_freshness WHERE dataset = ?", [dataset], typed=True)
    except Exception:  # noqa: BLE001
        return None
    return got[0] if got else None


GOOD = {u.FEED_URL: FEED, u.NEWS_URL: PAGE, u.PM_URL: PM}


def main() -> int:
    # --- the parsers, on the real copies -----------------------------------
    feed = u.parse_rss(FEED)
    check("feed: 51 items", len(feed) == 51, str(len(feed)))
    check("feed: newest is Oct 26 2026 (an RFC 822 date with a two-digit year)", feed[0]["day"] == "2026-10-26", feed[0]["day"])
    h1b = [i for i in feed if i["title"] == "USCIS Reaches Fiscal Year 2027 H-1B Cap"]
    check("feed: the FY 2027 H-1B cap alert, Jul 17 2026, an Alert",
          len(h1b) == 1 and h1b[0]["day"] == "2026-07-17" and h1b[0]["kind"] == "Alert", str(h1b))
    ead = [i for i in feed if i["title"] == "DHS Ends Automatic Extension of Employment Authorization"]
    check("feed: the end of automatic EAD extensions is a News release of Oct 29 2025",
          len(ead) == 1 and ead[0]["day"] == "2025-10-29" and ead[0]["kind"] == "News release", str(ead))
    check("feed: summaries come through decoded (no &nbsp; left)",
          all("&nbsp;" not in i["summary"] and "&amp;" not in i["summary"] for i in feed))

    page = u.parse_listing_html(PAGE)
    check("newsroom page: 10 rows, newest Oct 26 2026", len(page) == 10 and page[0]["day"] == "2026-10-26",
          f"{len(page)} {page[0]['day'] if page else ''}")
    idaho = [i for i in page if i["title"] == "Aliens in Idaho Charged for Illegal Voting"]
    check("newsroom page: a known row and its day", len(idaho) == 1 and idaho[0]["day"] == "2026-10-22", str(idaho))
    check("newsroom page and feed agree on an item's slug and day",
          {(u._slug(i["url"]), i["day"]) for i in page} <= {(u._slug(i["url"]), i["day"]) for i in feed})

    pm = u.parse_policy_manual(PM)
    check("Policy Manual: 19 rows, newest Oct 23 2026, oldest Jan 7 2013",
          len(pm) == 19 and pm[0]["day"] == "2026-10-23" and pm[-1]["day"] == "2013-01-07",
          f"{len(pm)} {pm[0]['day']} {pm[-1]['day']}")
    day = [i for i in pm if i["title"] == "Definition of Day for Purposes of Filing Deadlines" and i["kind"] == "Policy alert"]
    check("Policy Manual: the definition-of-day alert, Sep 23 2026, with its PDF and section",
          len(day) == 1 and day[0]["day"] == "2026-09-23" and day[0]["pdf_url"].endswith("20260923-DefinitionOfDay.pdf")
          and day[0]["sections"][0][:3] == (1, "B", "1 USCIS-PM B.6"), str(day))
    check("Policy Manual: both kinds read", {i["kind"] for i in pm} == {"Policy alert", "Technical update"})

    # --- what's kept (real titles) -----------------------------------------
    keep = [
        "USCIS Reaches Fiscal Year 2027 H-1B Cap",
        "USCIS Adjusts EB-5 Fees to Cover Program Costs and Strengthen Integrity Measures",
        "USCIS to Publish New Edition of Form I-485; Older Editions Will Be Rejected Starting Sept. 18",
        "USCIS to Increase Premium Processing Fees",
        "DHS Ends Automatic Extension of Employment Authorization",
        "USCIS Announces FY 2027 Inflation Increase for Certain Immigration-Related Fees",
        "Presidential Proclamation on Restriction on Entry of Certain Nonimmigrant Workers",
        "USCIS Reaches H-2B Cap for First Half of FY 2027",
        "USCIS Updates Guidance on EB-2 National Interest Waiver Petitions",
        "USCIS Issues Updated Guidance on Evidence for Applicants Under the International Entrepreneur Rule",
        "Tools Outage",
    ]
    drop = [
        "Aliens in Idaho Charged for Illegal Voting",
        "Six Charged in Large-Scale Marriage Fraud Ring",
        "USCIS Opens Asylum Office in Charlotte",
        "DHS Terminates Temporary Protected Status for Yemen",
        "USCIS Implements New Immigration Parole Fee Required by H.R. 1",
        "Grocery Store Manager Convicted of Immigration Document Fraud, Obstruction of Two Federal Labor Investigations, and Conspiracy",
        "Five Defendants Charged with Defrauding and Exploiting H-2A Visa Program Workers",
        "USCIS Unveils First Changes to Naturalization Test in Multi-Step Overhaul of American Citizenship Standards",
        "USCIS Updates Policy on Biometrics for Detainees",
    ]
    kept_wrong = [t for t in keep if not u.keep_news(t)]
    dropped_wrong = [t for t in drop if u.keep_news(t)]
    check("news: work-based titles are kept", not kept_wrong, str(kept_wrong))
    check("news: fraud cases, naturalization and humanitarian titles are dropped", not dropped_wrong, str(dropped_wrong))
    check("news: a crime title is dropped even when it names a visa program",
          not u.keep_news("Five Defendants Charged with Defrauding and Exploiting H-2A Visa Program Workers"))
    check("news: a summary about work keeps a plain title",
          u.keep_news("USCIS Increases Screening, Vetting of Aliens Working in U.S.",
                      "aliens with employment authorization documents will be vetted again"))
    check("news: a humanitarian summary drops a plain title",
          not u.keep_news("USCIS Continues to Put the Safety of Americans First",
                          "interview criteria for asylees and refugees filing Form I-485"))

    pm_keep = [
        ("Employment Authorization-Related Technical Changes", [(10, "A")]),
        ("Documentation of Employment Authorization for Certain E and L Nonimmigrant Dependent Spouses", [(10, "A"), (10, "B")]),
        ("Supporting Evidence for International Entrepreneur Parole", [(3, "G")]),
        ("Public Charge Ground of Inadmissibility", [(8, "G")]),
        ("Definition of Day for Purposes of Filing Deadlines", [(1, "B")]),
        # Kept only by the part of the manual they changed: their titles name no program.
        ("Clarifying the Term “Science or Art” for Schedule A, Group II Occupations", [(6, "E")]),
        ("Professionals under the United States-Mexico-Canada Agreement (USMCA)", [(2, "P")]),
        ("Extraordinary Ability Criteria Clarification", [(6, "F")]),
        ("Removal of COVID-19 Vaccine Requirement", [(8, "B")]),
    ]
    pm_drop = [
        ("Revocation of Naturalization Referrals", [(12, "L")]),
        ("Family-Based Immigration: Spousal Petitions", [(6, "B")]),
        ("Refugee and Asylee Adjustment of Status Interview Criteria", [(7, "L"), (7, "M")]),
        ("Deferred Action as an Extraordinary Use of Prosecutorial Discretion", [(1, "I")]),
        ("Customer Contact Options for Certain Asylum-Related and Other Protected Populations", [(1, "A")]),
        ("Customer Service Procedures for Persons Protected by 8 U.S.C. 1367", [(1, "A")]),
        ("Biometrics Collection for Aliens in Custody", [(1, "C")]),
    ]
    check("Policy Manual: updates to work-based parts are kept",
          all(u.keep_policy_manual(t, "", s) for t, s in pm_keep),
          str([t for t, s in pm_keep if not u.keep_policy_manual(t, "", s)]))
    check("Policy Manual: naturalization, family and humanitarian updates are dropped",
          not any(u.keep_policy_manual(t, "", s) for t, s in pm_drop),
          str([t for t, s in pm_drop if u.keep_policy_manual(t, "", s)]))

    # --- small helpers -------------------------------------------------------
    long = " ".join(["word"] * 400)
    cut = u.cut_at_word(long)
    check("an abstract is cut at a word near 600 characters", len(cut) <= 604 and cut.endswith("word ..."), str(len(cut)))
    check("a short abstract is kept whole", u.cut_at_word("A short one.") == "A short one.")
    import datetime as dt
    check("a year typed as 2103 is not a plausible day", not u.plausible_day("2103-04-04", dt.date(2026, 10, 27)))
    typo = FEED.replace("<pubDate>Mon, 26 Oct 26", "<pubDate>Mon, 26 Oct 2103", 1)
    got = u.parse_rss(typo)
    check("an item with an implausible date is dropped, the rest kept",
          len(got) == 50 and got[0]["day"] != "2103-10-26", f"{len(got)} {got[0]['day'] if got else ''}")
    check("a saved copy is told apart", (u.detect(FEED), u.detect(PAGE), u.detect(PM)) == ("feed", "page", "pm"))

    # --- a run, written twice ----------------------------------------------
    db = SqliteTurso()
    quiet: list[dict] = []
    real_quiet = u.record_quiet_run

    def spy_quiet(*a, **kw):
        quiet.append(kw)
        return real_quiet(*a, **kw)
    u.record_quiet_run = spy_quiet
    try:
        f = fetcher(GOOD)
        slept: list = []
        code = u.run(db, fetch=f, sleep=slept.append)
        news = rows(db, "source = 'uscis-news'")
        pmr = rows(db, "source = 'uscis-policy-manual'")
        check("first run exits 0", code == 0, str(code))
        check("first run writes the kept news and Policy Manual rows", len(news) == 9 and len(pmr) == 7,
              f"{len(news)} news, {len(pmr)} pm")
        cap = [r for r in news if r["document_number"] == "uscis-uscis-reaches-fiscal-year-2027-h-1b-cap"]
        check("a news row: its slug, type, action, USCIS's own URL and topics",
              len(cap) == 1 and cap[0]["type"] == "USCIS announcement" and cap[0]["action"] == "Alert"
              and cap[0]["html_url"] == "https://www.uscis.gov/newsroom/alerts/uscis-reaches-fiscal-year-2027-h-1b-cap"
              and "H-1B" in cap[0]["topics"], str(cap))
        alert = [r for r in pmr if r["title"] == "Definition of Day for Purposes of Filing Deadlines" and r["action"] == "Policy alert"]
        check("a Policy Manual row: its type, citation, PDF and a stable number",
              len(alert) == 1 and alert[0]["type"] == "Policy Manual update" and alert[0]["citation"] == "1 USCIS-PM B.6"
              and alert[0]["html_url"] == alert[0]["pdf_url"] and alert[0]["document_number"].startswith("uscis-pm-2026-09-23-"),
              str(alert))
        check("the lists are read ten seconds apart, two requests in all",
              f.calls == [u.FEED_URL, u.PM_URL] and slept == [10], f"{f.calls} {slept}")
        fn, fp = fresh(db, u.NEWS_DATASET), fresh(db, u.PM_DATASET)
        check("news freshness: as of the feed's newest item, 24-day budget",
              fn is not None and fn["as_of"] == "2026-10-26" and fn["max_age_days"] == 24, str(fn))
        check("Policy Manual freshness: as of its newest update, 101-day budget",
              fp is not None and fp["as_of"] == "2026-10-23" and fp["max_age_days"] == 101, str(fp))
        r1 = runs(db)
        check("the first run is recorded ok through record_quiet_run",
              len(r1) == 1 and r1[0]["status"] == "ok" and r1[0]["script"] == "ingest_uscis_news.py"
              and quiet and quiet[0]["written"] == 16, str(r1) + str(quiet))

        code = u.run(db, fetch=fetcher(GOOD), sleep=no_sleep)
        n2 = len(rows(db))
        check("an unchanged second run exits 0 and writes nothing", code == 0 and n2 == 16, f"{code} {n2}")
        check("the quiet second run goes through record_quiet_run with written=0",
              len(quiet) == 2 and quiet[1]["written"] == 0, str(quiet))
        check("and, inside three hours, adds no run row", len(runs(db)) == 1, str(runs(db)))
    finally:
        u.record_quiet_run = real_quiet

    # --- the feed gone: the newsroom page instead ---------------------------
    db = SqliteTurso()
    f = fetcher({u.FEED_URL: EMPTY_FEED, u.NEWS_URL: PAGE, u.PM_URL: PM})
    code = u.run(db, fetch=f, sleep=no_sleep, only="news")
    check("an empty feed falls back to the newsroom page", code == 0 and f.calls == [u.FEED_URL, u.NEWS_URL], str(f.calls))
    check("and the run's note says so", "newsroom page read" in (runs(db) or [{}])[-1].get("note", ""), str(runs(db)))

    # --- nothing to read: refuse, write nothing, exit 1 --------------------
    db = SqliteTurso()
    code = u.run(db, fetch=fetcher({u.FEED_URL: EMPTY_FEED, u.NEWS_URL: EMPTY_PAGE, u.PM_URL: EMPTY_PAGE}), sleep=no_sleep)
    r = runs(db)
    check("lists that read as nothing exit 1", code == 1, str(code))
    check("and write nothing, stamp nothing", not rows(db) and fresh(db, u.NEWS_DATASET) is None
          and fresh(db, u.PM_DATASET) is None)
    check("and record a failed run naming what was missing",
          len(r) == 1 and r[0]["status"] == "failed" and "no rows" in r[0]["note"], str(r))

    db = SqliteTurso()
    lost = PM.replace("pm-resource__update_header", "pm-resource__heading")
    code = u.run(db, fetch=fetcher({u.FEED_URL: FEED, u.NEWS_URL: PAGE, u.PM_URL: lost}), sleep=no_sleep)
    r = runs(db)
    check("a Policy Manual page that changed shape exits 1, the news still written",
          code == 1 and not rows(db, "source = 'uscis-policy-manual'") and len(rows(db, "source = 'uscis-news'")) == 9,
          f"{code} {len(rows(db))}")
    check("and is recorded partial", r and r[-1]["status"] == "partial" and "Policy Manual" in r[-1]["note"], str(r))

    # --- refused: a warning, nothing written, an ok run with the reason -----
    db = SqliteTurso()
    quiet.clear()
    u.record_quiet_run = spy_quiet
    try:
        code = u.run(db, fetch=fetcher({u.FEED_URL: http(403), u.NEWS_URL: PAGE, u.PM_URL: http(503)}), sleep=no_sleep)
    finally:
        u.record_quiet_run = real_quiet
    r = runs(db)
    check("a refused run exits 0", code == 0, str(code))
    check("and writes nothing, stamps nothing", not rows(db) and fresh(db, u.NEWS_DATASET) is None)
    check("and is recorded ok with the refusal in its note, through record_run",
          len(r) == 1 and r[0]["status"] == "ok" and "HTTP 403" in r[0]["note"] and "HTTP 503" in r[0]["note"]
          and not quiet, str(r))

    db = SqliteTurso()
    code = u.run(db, fetch=fetcher({u.FEED_URL: http(429), u.NEWS_URL: PAGE, u.PM_URL: PM}), sleep=no_sleep)
    check("the news refused, the Policy Manual still read",
          code == 0 and not rows(db, "source = 'uscis-news'") and len(rows(db, "source = 'uscis-policy-manual'")) == 7,
          f"{code} {len(rows(db))}")

    db = SqliteTurso()
    code = u.run(db, fetch=fetcher({u.FEED_URL: http(404), u.NEWS_URL: PAGE, u.PM_URL: PM}), sleep=no_sleep, only="news")
    check("a feed that answers 404 (moved) falls back to the newsroom page", code == 0 and len(rows(db)) == 0
          and "HTTP 404" in runs(db)[-1]["note"], str(runs(db)))

    # --- a defect here crashes ----------------------------------------------
    try:
        u.run(SqliteTurso(), fetch=fetcher({u.FEED_URL: KeyError("bug"), u.PM_URL: PM}), sleep=no_sleep)
        check("a code error crashes", False)
    except KeyError:
        check("a code error crashes", True)

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
