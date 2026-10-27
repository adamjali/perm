#!/usr/bin/env python3
"""The court opinion reader and the caption name rule, on real SQLite.

    python3 scripts/test_court_opinions.py

The fixtures (fixtures/courts/) are trimmed copies of two real CourtListener
answers read on Oct 27 2026, with every individual's name replaced by an
invented one; organizations, agencies and officials are as printed. No
request leaves the machine: every fetch is a stand-in.

What the two answers measured (Oct 27 2026): 40 results, 32 distinct
opinions. The keep rule kept 13, every one a federal suit on a work visa or
an employment-based green card (two of them only touching one: a special
immigrant juvenile case, and a waiver case that names H-1B as the way out).
It dropped 19: 12 state-court opinions (Delaware docket entries "D.I. 140",
discrimination claims "employment based"), a contract board's "labor,
certification", two criminal opinions, one petition for review of a removal
order, and three federal discrimination cases that match "employment based".
"""
from __future__ import annotations

import json
import os
import socket
import sys
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.pop("REVALIDATE_SECRET", None)  # no call to the site from a test
import ingest_court_opinions as co  # noqa: E402
import lib_case_captions as cc  # noqa: E402
from lib_db import query_dicts  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures", "courts")
FAILS: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def read(name: str) -> str:
    return open(os.path.join(FIX, name), encoding="utf-8").read()


NEW, OLD = read("search-2026-10-27.json"), read("search-earlier-query-2026-10-27.json")


def http(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(co.API, code, "x", {}, None)


def fetcher(answers: list):
    """A stand-in fetch: each call takes the next answer (text, or an
    exception to raise); the last repeats."""
    calls: list[tuple[str, str | None]] = []

    def fetch(url: str, _sleep, token=None) -> str:
        calls.append((url, token))
        a = answers[min(len(calls) - 1, len(answers) - 1)]
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


def answer(results: list[dict], next_url: str | None = None) -> str:
    return json.dumps({"count": len(results), "next": next_url, "results": results})


def item(name: str, *, court="District Court, District of Columbia", juris="FD", day="2026-10-20", cid=1,
         docket="Civil Action No. 2026-0001", snippet="an approved <mark>labor certification</mark> and a visa") -> dict:
    return {"caseName": name, "dateFiled": day, "court": court, "court_jurisdiction": juris, "cluster_id": cid,
            "docketNumber": docket, "citation": [], "opinions": [{"snippet": snippet}]}


def parse_one(**kw) -> dict:
    return co.parse_answer(answer([item(**kw)]))[0][0]


def kept(text: str) -> tuple[list[str], dict]:
    items = co.parse_answer(text)[0]
    got, _held, counts = co.sort_items(items, {})
    return [r["title"] for r in got], counts


def main() -> int:
    # --- the query's precision, on the real answers --------------------------
    titles, counts = kept(NEW)
    check("the current query's answer: 6 of 20 kept", counts["kept"] == 6, str(counts))
    check("its drops are state courts, a contract board, a removal petition and discrimination claims",
          counts["dropped"] == {"not a federal court": 10, "the visa words aren't in the matched passage": 3,
                                "a petition for review of a removal order": 1}, str(counts["dropped"]))
    check("an EB-2 suit against the State Department is kept, the person as an initial",
          "E. v. U.S. Department of State" in titles, str(titles))
    check("an EB-5 suit is kept, the official as printed", "P. v. Mayorkas" in titles, str(titles))
    check("initials a court already gave are kept", "I.G.I. v. Noem" in titles, str(titles))
    check("a two-word name becomes two initials", "F.Q. v. Mullin" in titles, str(titles))
    check("no FBI discrimination case (\"employment based\") is kept", not any("Bondi" in t for t in titles), str(titles))
    titles2, counts2 = kept(OLD)
    check("the earlier query's answer: 11 of 20 kept", counts2["kept"] == 11, str(counts2))
    check("its drops: six non-federal, two criminal, one removal petition",
          counts2["dropped"] == {"not a federal court": 6, "a criminal case": 2,
                                 "a petition for review of a removal order": 1}, str(counts2["dropped"]))
    check("an H-2A suit by an advocacy group is kept as printed", "Advocates for Human Rights v. Bondi" in titles2)
    check("a worker's suit against an H-2A employer keeps the employer", "M.S. v. Purpose Point Harvesting, LLC" in titles2,
          str(titles2))
    check("a criminal case is dropped", not any(t.startswith("United States v.") for t in titles2), str(titles2))

    # --- the strict reading of the matched words ---------------------------
    def keep_of(**kw):
        return co.keep_result(parse_one(**kw))
    check("\"labor certification\" counts", keep_of(name="Acme LLC v. Rubio")[0])
    check("\"labor, certification\" (a contract's line items) doesn't",
          not keep_of(name="Acme LLC v. Rubio", snippet="lines for <mark>labor, certification</mark>, connection")[0])
    check("\"D.I. 140\" (a docket entry) doesn't", not keep_of(name="Acme LLC v. Rubio", snippet="D.<mark>I. 140</mark>")[0])
    check("\"employment-based\" beside a visa word counts",
          keep_of(name="Acme LLC v. Rubio", snippet="<mark>employment-based</mark> immigrant visas")[0])
    check("\"employment-based\" with no immigration word doesn't",
          not keep_of(name="Acme LLC v. Rubio", snippet="her <mark>employment-based</mark> retaliation claim")[0])
    check("a state court doesn't", not keep_of(name="Acme LLC v. Rubio", court="Superior Court of Delaware", juris="SA")[0])
    check("a federal court with no jurisdiction code is judged by its name",
          keep_of(name="Acme LLC v. Rubio", court="Court of Appeals for the Fourth Circuit", juris=None)[0])
    check("Maryland's Court of Appeals (a state court) doesn't",
          not keep_of(name="Acme LLC v. Rubio", court="Court of Appeals of Maryland", juris=None)[0])
    check("a court named like a federal one that CourtListener codes as a state trial court doesn't",
          not keep_of(name="Acme LLC v. Rubio", court="District Court, Second Judicial District", juris="ST")[0])
    check("a contract board (FS) doesn't",
          not keep_of(name="Acme LLC v. Rubio", court="Armed Services Board of Contract Appeals", juris="FS")[0])
    check("a criminal docket doesn't", not keep_of(name="Acme LLC v. Rubio", docket="1:24-cr-00350")[0])
    check("United States v. a person doesn't", not keep_of(name="United States v. Fakeconn")[0])
    check("United States v. a company does", keep_of(name="United States v. Acme Farms, LLC")[0])
    check("a removal petition against the Attorney General in a court of appeals doesn't",
          not keep_of(name="Fauxman v. Blanche", court="Court of Appeals for the Second Circuit", juris="F")[0])
    check("a district court suit against the Attorney General does",
          keep_of(name="Fauxman v. Blanche")[0])

    # --- the name rule -----------------------------------------------------
    def rule(c, ctx="court", year=2026):
        return cc.caption_rule(c, context=ctx, year=year)
    check("a person becomes an initial", rule("Exampleton v. U.S. Department of State").text == "E. v. U.S. Department of State")
    check("an organization stays", rule("Coalition for Independent Technology Research v. Rubio").text
          == "Coalition for Independent Technology Research v. Rubio")
    check("an agency stays", rule("Acme LLC v. United States Citizenship and Immigration Services").text
          == "Acme LLC v. United States Citizenship and Immigration Services")
    check("In re a person", rule("In re Exampleton").text == "In re E.", rule("In re Exampleton").text)
    check("In re an organization", rule("In re Acme Farms, LLC").text == "In re Acme Farms, LLC")
    check("Matter of a person", rule("Matter of Testova").text == "Matter of T.", rule("Matter of Testova").text)
    check("Matter of an organization", rule("Matter of Hawai'i Pacific University").text == "Matter of Hawai'i Pacific University")
    check("et al. is kept after the initial", rule("Exampleton et al. v. Rubio").text == "E. et al. v. Rubio",
          rule("Exampleton et al. v. Rubio").text)
    check("an official inside their term stays", rule("Testova v. Rubio").text == "T. v. Rubio")
    check("the same surname outside the term is a person", rule("Testova v. Rubio", year=2015).text == "T. v. R.",
          rule("Testova v. Rubio", year=2015).text)
    check("a common surname in first place is a person even in an official's term",
          rule("Johnson v. Acme Corp.", year=2015).text == "J. v. Acme Corp.", rule("Johnson v. Acme Corp.", year=2015).text)
    check("a pseudonym stays", rule("John Doe v. Catholic Relief Services").text == "John Doe v. Catholic Relief Services")
    check("a d/b/a keeps the business, not the person", rule("Mateo Testova d/b/a Testova Farms v. Mullin").text
          == "M.T. d/b/a Testova Farms v. Mullin", rule("Mateo Testova d/b/a Testova Farms v. Mullin").text)
    check("the name after d/b/a is printed as registered", rule("Mateo Testova d/b/a Blue Heron v. Mullin").text
          == "M.T. d/b/a Blue Heron v. Mullin", rule("Mateo Testova d/b/a Blue Heron v. Mullin").text)
    check("two people joined by \"and\" are held", rule("Exampleton and Testova v. Rubio").held is not None)
    check("two people in capitals joined by AND are held", rule("MICHAEL SAMPLE AND HAROLD SAMPLE", "employer").held is not None,
          rule("MICHAEL SAMPLE AND HAROLD SAMPLE", "employer").text)
    check("an employer caption: a given name makes a person", rule("Philip Exampleton", "employer").text == "P.E.")
    check("an employer caption: a trade name without a marker is held", rule("Sushi Shogun", "employer").held is not None)
    check("an employer caption: a business stays", rule("CURBY'S LAWN AND GARDEN", "employer").text == "CURBY'S LAWN AND GARDEN")
    check("a ruling settles a held caption", cc.caption_rule("Sushi Shogun", context="employer", year=2026,
                                                             ruling="organization").text == "Sushi Shogun")

    # --- the abstract ------------------------------------------------------
    cap = rule("Placeholdera v. Blinken")
    ab, left = cc.safe_abstract("Nora Placeholdera, an Iranian national, filed an H-1B visa application.", cap)
    check("the caption's person and their first name become the initial", ab ==
          "P., an Iranian national, filed an H-1B visa application.", str(ab))
    ab, _ = cc.safe_abstract("the plaintiff, Ms. Fakeworth, applied for an H-1B visa.", rule("Acme LLC v. Rubio"))
    check("an honorific name becomes the honorific and initial", ab == "the plaintiff, Ms. F., applied for an H-1B visa.", str(ab))
    ab, left = cc.safe_abstract("an affidavit of Ray Sampleton about the H-1B petition.", rule("Acme LLC v. Rubio"))
    check("a name nobody redacted costs the abstract", ab is None and "Ray" in left, f"{ab} {left}")
    ab, left = cc.safe_abstract("E.’s petition was current under the Visa Bulletin in May.", rule("Exampleton v. Rubio"))
    check("a possessive initial and the Visa Bulletin keep the abstract", ab is not None, str(left))
    ab, left = cc.safe_abstract("Plaintiff Exampleton filed an I-140 petition with USCIS in March.", rule("Exampleton v. Rubio"))
    check("vocabulary before a surname stays", ab == "Plaintiff E. filed an I-140 petition with USCIS in March.", f"{ab} {left}")
    row = co.build(co.parse_answer(NEW)[0][0])[0]
    check("the link carries the number and the redacted caption only",
          row["html_url"] == "https://www.courtlistener.com/opinion/11045835/e-v-u-s-department-of-state/", row["html_url"])
    check("the docket number is the citation", row["citation"] == "No. 2026-0092", str(row["citation"]))
    check("the court is the agency", row["agencies"] == ["District Court, District of Columbia"])
    h1b = co.build(next(i for i in co.parse_answer(NEW)[0] if i["name"].startswith("Mockwell")))[0]
    check("topics come from the passage", h1b["topics"] == ["H-1B"], str(h1b["topics"]))

    # --- writing: an unchanged run writes nothing, held captions stay off --
    db = SqliteTurso()
    rc = co.run(db, fetch=fetcher([NEW]), sleep=no_sleep, force=True)
    first = rows(db)
    check("a first run writes the six it kept", rc == 0 and len(first) == 6, f"rc={rc} rows={len(first)}")
    fresh = query_dicts(db, "SELECT as_of, max_age_days FROM data_freshness WHERE dataset = ?", [co.DATASET], typed=True)
    check("freshness is the newest kept opinion, budget 30", fresh and fresh[0]["as_of"] == "2026-10-26"
          and int(fresh[0]["max_age_days"]) == 30, str(fresh))
    before = [r["fetched_at"] for r in first]
    rc = co.run(db, fetch=fetcher([NEW]), sleep=no_sleep, force=True)
    check("a second run with nothing new writes nothing", rc == 0 and [r["fetched_at"] for r in rows(db)] == before)
    check("and records no extra run row inside the quiet window", len(runs(db)) == 1, str(len(runs(db))))
    f = fetcher([NEW])
    check("a run within three hours asks nothing", co.run(db, fetch=f, sleep=no_sleep) == 0 and f.calls == [], str(f.calls))

    db = SqliteTurso()
    held_answer = answer([item("Exampleton and Testova v. Rubio", cid=77), item("Acme Farms, LLC v. Mullin", cid=78)])
    co.run(db, fetch=fetcher([held_answer]), sleep=no_sleep, force=True)
    nums = [r["document_number"] for r in rows(db)]
    check("a held caption is not on the page", nums == ["cl-78"], str(nums))
    held = cc.held_rows(db, co.SOURCE)
    check("it's in the held list with its reason", "cl-77" in held and "can't tell" in held["cl-77"]["reason"], str(held))
    check("holding it again writes nothing", cc.hold(db, co.SOURCE, json.loads(held["cl-77"]["row_json"]),
                                                     held["cl-77"]["caption"], held["cl-77"]["reason"]) == 0)
    co.release(db, "cl-77", "person")
    got = {r["document_number"]: r["title"] for r in rows(db)}
    check("a ruling of person writes it with initials", got.get("cl-77") == "E. and T. v. Rubio", str(got))
    co.run(db, fetch=fetcher([held_answer]), sleep=no_sleep, force=True)
    check("a later run applies the ruling and holds nothing new", {r["document_number"] for r in rows(db)} == {"cl-77", "cl-78"})

    # --- stopping at what's stored ----------------------------------------
    db = SqliteTurso()
    page1 = answer([item("Acme Farms, LLC v. Mullin", cid=1), item("Beta Inc. v. Rubio", cid=2)], next_url="page2")
    page2 = answer([item("Gamma LLC v. Noem", cid=3)])
    f = fetcher([page1, page2])
    co.run(db, fetch=f, sleep=no_sleep, force=True)
    check("a first run walks on while nothing is stored", len(f.calls) == 2, str(len(f.calls)))
    f = fetcher([page1, page2])
    co.run(db, fetch=f, sleep=no_sleep, force=True)
    check("a later run stops at the first page holding a stored opinion", len(f.calls) == 1, str(len(f.calls)))
    check("the search is bounded by a filing window", "filed_after=" in f.calls[0][0], f.calls[0][0])

    # --- trouble -----------------------------------------------------------
    for label, err in (("a 429", http(429)), ("a 503", http(503)), ("a timeout", TimeoutError("timed out")),
                       ("a socket timeout", socket.timeout("timed out")), ("a 403", http(403))):
        db = SqliteTurso()
        rc = co.run(db, fetch=fetcher([err]), sleep=no_sleep, force=True)
        r = runs(db)
        check(f"{label} is a warning and an ok run", rc == 0 and r and r[-1]["status"] == "ok" and "unread" in r[-1]["note"],
              f"rc={rc} {r}")
        check(f"{label} writes nothing", rows(db) == [])
    db = SqliteTurso()
    f = fetcher([co.TokenRefused(), NEW])
    rc = co.run(db, fetch=f, sleep=no_sleep, force=True, token="not-a-real-token")
    check("a refused token is dropped and the answer asked without it",
          rc == 0 and len(f.calls) == 2 and f.calls[1][1] is None and len(rows(db)) == 6, f"{f.calls}")
    check("and the run says so", "token was refused" in (runs(db)[-1]["note"] or ""), str(runs(db)[-1]["note"]))
    for label, text in (("no results", answer([])), ("results without captions", answer([{"dateFiled": "2026-10-01"}])),
                        ("an answer that isn't JSON", "<html>busy</html>")):
        db = SqliteTurso()
        rc = co.run(db, fetch=fetcher([text]), sleep=no_sleep, force=True)
        r = runs(db)
        check(f"{label} exits 1 and records a failed run", rc == 1 and r and r[-1]["status"] == "failed", f"rc={rc} {r}")
    try:
        co.run(SqliteTurso(), fetch=fetcher([KeyError("defect")]), sleep=no_sleep, force=True)
        crashed = False
    except KeyError:
        crashed = True
    check("a defect crashes", crashed)

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
