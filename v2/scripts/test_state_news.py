#!/usr/bin/env python3
"""The State Department newsroom reader, on real SQLite.

    python3 scripts/test_state_news.py

The fixtures are trimmed real copies read on adoption.state.gov on Oct 27 2026
(fixtures/policy_news/state_*): the newsroom's results JSON (its newest 10
items, every tag), four item pages, and what a server still on State's old
site answers for a new page. No request leaves the machine: every fetch is a
stand-in, and so is the robots.txt check.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
from email.message import Message

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.pop("REVALIDATE_SECRET", None)  # no call to the site from a test
import ingest_state_news as s  # noqa: E402
from lib_db import query_dicts, read_doc  # noqa: E402
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


LISTING = read("state_newsroom_results.json")
OLD_PAGE = read("state_old_backend_404.html")
PAGES = {slug: read(f"state_item_{slug}.html") for slug in (
    "announcement-of-expanded-screening-and-vetting-for-visa-applicants",
    "nonimmigrant-visa-expedited-appointment-pilot-program",
    "countries-subject-to-visa-bonds",
    "public-charge-bonds-for-immigrant-visa-applicants",
)}
IV_PATH = "/en/newsroom/visas/2026/immigrant-visa-processing-updates-for-nationalities-at-high-risk-of-public-benefits-usage.html"


def page_url(slug: str, year: str = "2026") -> str:
    return f"{s.HOST}/en/newsroom/visas/{year}/{slug}.html"


def http(code: int, location: str | None = None) -> urllib.error.HTTPError:
    h = Message()
    if location:
        h["Location"] = location
    return urllib.error.HTTPError(s.LISTING_URL, code, "x", h, None)


OLD_REDIRECT = http(302, "https://travel.state.gov/content/travel/en/404.html")


def fetcher(answers: dict):
    """A stand-in fetch: each URL answers a list in turn (text, or an exception to raise); the last repeats."""
    calls: list[str] = []
    seen: dict[str, int] = {}

    def fetch(url: str) -> str:
        calls.append(url)
        got = answers[url]
        seq = got if isinstance(got, list) else [got]
        a = seq[min(seen.get(url, 0), len(seq) - 1)]
        seen[url] = seen.get(url, 0) + 1
        if isinstance(a, BaseException):
            raise a
        return a
    fetch.calls = calls
    return fetch


def no_sleep(_s: float) -> None:
    pass


def allow(_u: str) -> bool:
    return True


def fresh(db) -> list[dict]:
    """The reader's freshness row; none when the table was never made."""
    if not query_dicts(db, "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'data_freshness'"):
        return []
    return query_dicts(db, "SELECT as_of, max_age_days FROM data_freshness WHERE dataset = ?", [s.DATASET], typed=True)


def runs(db) -> list[dict]:
    return query_dicts(db, "SELECT status, rows_written, note FROM ingest_runs WHERE script = ? ORDER BY rowid",
                       [s.SCRIPT], typed=True)


def main() -> int:
    # --- the parser -----------------------------------------------------------
    items = s.parse_listing(LISTING)
    check("ten items are read, every tag", len(items) == 10, str(len(items)))
    check("six are tagged Visas", sum("Visas" in i["tags"] for i in items) == 6)
    check("the newest is Oct 20 2026", max(i["day"] for i in items) == "2026-10-20")
    bonds = next(i for i in items if "visa-bonds" in i["num"])
    check("a day is State's own, Eastern", bonds["day"] == "2026-10-02", bonds["day"])
    check("a number carries its year folder", bonds["num"] == "state-2026-countries-subject-to-visa-bonds", bonds["num"])
    dv = next(i for i in items if "diversity" in i["num"])
    check("the year folder is the address's, not the publication's", dv["num"].startswith("state-2025-") and dv["day"] == "2026-08-31")
    check("a day is read from the printed date when the epoch is missing",
          s._day({"newsroomPublish": "October 02, 2026"}) == "2026-10-02")

    # --- the rules ------------------------------------------------------------
    def td(start: str):
        return s.title_decision(next(i for i in items if i["title"].startswith(start)))
    check("an adoption notice is dropped without its page", td("Building Arizona Families")[0] is False)
    check("a passports item is dropped without its page", td("Executive Order 14418")[0] is False)
    check("the diversity lottery is dropped by its title", td("Diversity Visa Issuance") == (False, "the title names diversity"))
    check("an ordinary Visas title needs its page", td("Countries Subject to Visa Bonds") is None)

    def on_page(slug: str):
        t = PAGES[slug]
        title = t.split("<title>")[1].split("</title>")[0].strip()
        body, abstract = s.article(t)
        return s.decide(title, body), abstract
    (k, why), abstract = on_page("announcement-of-expanded-screening-and-vetting-for-visa-applicants")
    check("expanded screening is kept: it names TN and H-1B", k and "TN" in why, why)
    check("its abstract is the first real paragraph, spacing mended",
          abstract and abstract.startswith("Effective October 1, the Department of State"), str(abstract)[:80])
    # A shape no fixture has (the date line inside the article), written here:
    _, ab = s.article('<div class="prose text"><p>Published: October 2, 2026</p><p>Short line.</p>'
                      '<p>The Department of State will resume visa interviews at the following posts next month.</p></div>')
    check("an abstract skips a date line and a short line", ab and ab.startswith("The Department of State will"), str(ab))
    (k, why), _ = on_page("public-charge-bonds-for-immigrant-visa-applicants")
    check("public charge bonds are kept: immigrant visas", k and "immigrant visa" in why.lower(), why)
    (k, why), _ = on_page("countries-subject-to-visa-bonds")
    check("visa bonds are dropped: B1/B2 only", not k and "B1/B2" in why, why)
    (k, why), _ = on_page("nonimmigrant-visa-expedited-appointment-pilot-program")
    check("the appointment pilot is dropped on its text, though its title reads general", not k and "B visa" in why, why)
    # Shapes with no real example on the Oct 27 list (written here, not State's titles):
    check("a work-visa code is kept whatever else", s.decide("Update on H-2B processing", "")[0])
    check("'TN' needs its case", s.decide("Visitors in tn", "")[0] is False)
    check("'nonimmigrant visa' is not 'immigrant visa'", s.WORK_WORDS.search("nonimmigrant visa holders") is None)
    check("general visa policy is kept", s.decide("Visa fee changes", "all visa applicants pay")[0])
    check("nothing on visas is dropped", s.decide("Holiday hours", "Embassies close on the 25th.")[0] is False)

    # --- a full run, three times --------------------------------------------
    db = SqliteTurso()
    answers = {
        s.LISTING_URL: [OLD_REDIRECT, OLD_REDIRECT, LISTING],
        page_url("countries-subject-to-visa-bonds"): PAGES["countries-subject-to-visa-bonds"],
        page_url("announcement-of-expanded-screening-and-vetting-for-visa-applicants"):
            PAGES["announcement-of-expanded-screening-and-vetting-for-visa-applicants"],
        # No real copy of this item's page is kept; another real page stands in, after two old servers.
        s.HOST + IV_PATH: [http(404), OLD_PAGE, PAGES["public-charge-bonds-for-immigrant-visa-applicants"]],
        page_url("nonimmigrant-visa-expedited-appointment-pilot-program"):
            PAGES["nonimmigrant-visa-expedited-appointment-pilot-program"],
        page_url("public-charge-bonds-for-immigrant-visa-applicants"): PAGES["public-charge-bonds-for-immigrant-visa-applicants"],
    }
    f1 = fetcher(answers)
    rc = s.run(db, fetch=f1, sleep=no_sleep, robots=allow)
    rows = query_dicts(db, "SELECT document_number, type, html_url, agencies, topics, abstract, publication_date "
                           "FROM policy_notices ORDER BY document_number", typed=True)
    nums = [r["document_number"] for r in rows]
    check("the first run exits 0", rc == 0, str(rc))
    check("it asked past two old servers for the list", f1.calls.count(s.LISTING_URL) == 3)
    check("it read four pages and left the fifth for the next run (the cap)",
          sum(c != s.LISTING_URL for c in f1.calls) == 6   # bonds, screening, the IV item (3 tries), the pilot
          and page_url("public-charge-bonds-for-immigrant-visa-applicants") not in f1.calls, str(f1.calls))
    check("it wrote the two kept items it could read", nums == [
        "state-2026-announcement-of-expanded-screening-and-vetting-for-visa-applicants",
        "state-2026-immigrant-visa-processing-updates-for-nationalities-at-high-risk-of-public-benefits-usage"], str(nums))
    scr = rows[0]
    check("a row's address is travel.state.gov's", scr["html_url"].startswith("https://travel.state.gov/en/newsroom/visas/2026/"))
    check("a row's type and agency", scr["type"] == s.TYPE and json.loads(scr["agencies"]) == ["State Department"])
    check("a row's topics come from its text", "H-1B" in json.loads(scr["topics"]), scr["topics"])
    check("a row's abstract is set", bool(scr["abstract"]))
    seen = (read_doc(db, s.SEEN_DOC) or {}).get("decided", {})
    check("five decisions are remembered (dropped ones too)", len(seen) == 5, str(sorted(seen)))
    check("the waiting item is not decided", "state-2026-public-charge-bonds-for-immigrant-visa-applicants" not in seen)
    fr = fresh(db)
    check("freshness is the newest item of any tag, budget 21", fr and fr[0]["as_of"] == "2026-10-20"
          and int(fr[0]["max_age_days"]) == 21, str(fr))
    r1 = runs(db)
    check("an ok run row names the waiting item", r1 and r1[-1]["status"] == "ok" and "waiting" in r1[-1]["note"], str(r1))

    f2 = fetcher({**answers, s.LISTING_URL: LISTING})
    s.run(db, fetch=f2, sleep=no_sleep, robots=allow)
    n2 = query_dicts(db, "SELECT COUNT(*) AS n FROM policy_notices", typed=True)[0]["n"]
    check("the second run reads only the waiting page", [c for c in f2.calls if c != s.LISTING_URL] ==
          [page_url("public-charge-bonds-for-immigrant-visa-applicants")], str(f2.calls))
    check("and writes it", int(n2) == 3, str(n2))

    f3 = fetcher({s.LISTING_URL: LISTING})
    before = len(runs(db))
    s.run(db, fetch=f3, sleep=no_sleep, robots=allow)
    check("a third run reads the list alone", f3.calls == [s.LISTING_URL], str(f3.calls))
    check("and records no new run row inside three hours", len(runs(db)) == before)
    check("and wrote nothing", int(query_dicts(db, "SELECT COUNT(*) AS n FROM policy_notices", typed=True)[0]["n"]) == 3)

    # --- trouble ---------------------------------------------------------------
    db = SqliteTurso()
    slept: list[float] = []
    f = fetcher({s.LISTING_URL: OLD_REDIRECT})
    rc = s.run(db, fetch=f, sleep=slept.append, robots=allow)
    r = runs(db)
    check("only old servers answering is a refusal: exit 0", rc == 0)
    check("it asked LISTING_TRIES times, pausing between", len(f.calls) == s.LISTING_TRIES and len(slept) == s.LISTING_TRIES - 1)
    check("the run is ok and names what came back", r and r[-1]["status"] == "ok" and "old site" in r[-1]["note"], str(r))
    check("no freshness is stamped on a refusal",
          not fresh(db))

    db = SqliteTurso()
    rc = s.run(db, fetch=fetcher({s.LISTING_URL: http(503)}), sleep=no_sleep, robots=allow)
    check("an outage is a refusal that names it", rc == 0 and "HTTP 503" in runs(db)[-1]["note"], str(runs(db)))

    db = SqliteTurso()
    f = fetcher({s.LISTING_URL: LISTING})
    rc = s.run(db, fetch=f, sleep=no_sleep, robots=lambda u: False)
    check("robots.txt saying no is a refusal, and nothing is asked", rc == 0 and f.calls == [] and "robots" in runs(db)[-1]["note"])

    db = SqliteTurso()
    rc = s.run(db, fetch=fetcher({s.LISTING_URL: json.dumps({"id": "x", "facets": []})}), sleep=no_sleep, robots=allow)
    check("JSON without its results list exits 1, run failed", rc == 1 and runs(db)[-1]["status"] == "failed", str(runs(db)))
    check("and writes nothing", not fresh(db))

    empty = json.loads(LISTING)
    empty["results"] = []
    db = SqliteTurso()
    rc = s.run(db, fetch=fetcher({s.LISTING_URL: json.dumps(empty)}), sleep=no_sleep, robots=allow)
    check("an empty list exits 1", rc == 1 and runs(db)[-1]["status"] == "failed")

    bad = json.loads(LISTING)
    for x in bad["results"][:3]:
        x["url"] = "/somewhere/else"
    db = SqliteTurso()
    rc = s.run(db, fetch=fetcher({s.LISTING_URL: json.dumps(bad)}), sleep=no_sleep, robots=allow)
    check("rows that stop parsing (7 of 10) exit 1", rc == 1 and runs(db)[-1]["status"] == "failed"
          and "7 of" in runs(db)[-1]["note"], str(runs(db)))

    try:
        s.run(SqliteTurso(), fetch=fetcher({s.LISTING_URL: KeyError("bug")}), sleep=no_sleep, robots=allow)
        check("a code error crashes", False)
    except KeyError:
        check("a code error crashes", True)

    f = fetcher(answers)
    rc = s.run(None, fetch=f, sleep=no_sleep, robots=allow, dry_run=True)
    check("a dry run reads and writes nowhere", rc == 0 and f.calls.count(s.LISTING_URL) == 3)

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
