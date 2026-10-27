#!/usr/bin/env python3
"""The BALCA caselist reader, on real SQLite.

    python3 scripts/test_balca.py

The fixtures (fixtures/balca/) are trimmed copies of OALJ's pages as the
Internet Archive kept them (Mar to Aug 2026), with every individual's name
replaced by an invented one. This Mac can't read www.dol.gov, so the live
pages are unverified until a GitHub run. No request leaves the machine.
"""
from __future__ import annotations

import datetime as dt
import os
import re
import socket
import sys
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.pop("REVALIDATE_SECRET", None)  # no call to the site from a test
import ingest_balca as b  # noqa: E402
import lib_case_captions as cc  # noqa: E402
from lib_db import query_dicts  # noqa: E402
from lib_sqlite_shim import SqliteTurso  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures", "balca")
FAILS: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def read(name: str) -> str:
    return open(os.path.join(FIX, f"{name}.html"), encoding="utf-8").read()


PAGES = {n: read(n) for n in ("LIBINA", "BALCA_DECISIONS_PERM", "PWD_DECISIONS", "TLN_DECISIONS",
                              "TLC_DECISIONS_FY2026")}
EMPTY = "<html><body><main><article about=\"/agencies/oalj/PUBLIC/INA/REFERENCES/CASELISTS/X\"></article></main></body></html>"


def http(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(b.LIBRARY, code, "x", {}, None)


def fetcher(overrides: dict | None = None):
    """A stand-in fetch: each page by its last path segment, or an override
    (text, or an exception to raise)."""
    calls: list[str] = []

    def fetch(url: str, _sleep=None) -> str:
        calls.append(url)
        name = url.rstrip("/").rsplit("/", 1)[-1]
        a = (overrides or {}).get(name, PAGES.get(name))
        if a is None:
            raise http(404)
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
    except Exception:  # noqa: BLE001
        return []


def runs(db) -> list[dict]:
    try:
        return query_dicts(db, "SELECT * FROM ingest_runs ORDER BY id", typed=True)
    except Exception:  # noqa: BLE001
        return []


def main() -> int:
    b.NEWEST_TLC_YEARS = 1  # the fixtures hold one H-2A year page
    # --- discovery --------------------------------------------------------
    found = b.discover(PAGES["LIBINA"])
    check("the library names the three lists and the H-2A year pages",
          {"BALCA_DECISIONS_PERM", "PWD_DECISIONS", "TLN_DECISIONS", "TLC_DECISIONS_FY2026"} <= set(found), str(found))
    check("addresses are DOL's, not the Archive's",
          all(u.startswith("https://www.dol.gov/agencies/oalj/PUBLIC/INA/REFERENCES/CASELISTS/") for u in found.values()))
    check("the newest H-2A year page is read", b.tlc_years(found, False) == ["TLC_DECISIONS_FY2026"])
    check("--all reads every H-2A year page from FY2025", b.tlc_years(found, True) == ["TLC_DECISIONS_FY2026",
                                                                                       "TLC_DECISIONS_FY2025"])
    try:
        b.discover("<html><body><a href='/agencies/oalj'>OALJ</a></body></html>")
        lost = False
    except b.LostStructure:
        lost = True
    check("a library naming no caselist is a changed shape", lost)

    # --- the four layouts ---------------------------------------------------
    per = b.parse_caselist(PAGES["BALCA_DECISIONS_PERM"], "BALCA_DECISIONS_PERM")
    check("16 en banc decisions, from the headings only", len(per) == 16, str(len(per)))
    storz = next(d for d in per if d["docket"] == "2011-PER-00040")
    check("Karl Storz: dated, an en banc decision, OALJ's headnote", storz["day"] == "2011-12-01"
          and storz["kind"] == "En banc decision" and storz["headnote"] == "PWD validity period", str(storz))
    check("a case cited inside a headnote is not a decision", not any(d["docket"] == "2011-PER-02677" for d in per))
    pwd = b.parse_caselist(PAGES["PWD_DECISIONS"], "PWD_DECISIONS")
    atp = [d for d in pwd if d["docket"] == "2023-PWD-00003"]
    check("a case with two decisions in one item is two decisions",
          [d["day"] for d in atp] == ["2023-09-28", "2023-10-26"], str(atp))
    check("the second takes its date from its file name and its kind from its words",
          atp[1]["kind"] == "Order Denying Motion for Reconsideration", str(atp[1]))
    check("a two-digit docket is padded", any(d["docket"] == "2022-PWD-00001" for d in pwd))
    tlc = b.parse_caselist(PAGES["TLC_DECISIONS_FY2026"], "TLC_DECISIONS_FY2026")
    check("the H-2A page: three decisions, each under the paragraph that names its case",
          [(d["docket"], d["caption"]) for d in tlc] == [("2026-TLC-00002", "Genetic Reflections, LLC"),
                                                         ("2026-TLC-00003", "Bitter Lakes Farm Company"),
                                                         ("2026-TLC-00008", "Philip Sampleman")], str(tlc))
    tln = b.parse_caselist(PAGES["TLN_DECISIONS"], "TLN_DECISIONS")
    watson = [d for d in tln if d["docket"] == "2025-TLN-00124"]
    check("the H-2B page: a later decision in a nested item keeps its case",
          len(watson) == 2 and len({d["day"] for d in watson}) == 2 and all("Watson" in d["caption"] for d in watson),
          str(watson))
    # The shape of OALJ's 2021 H-2B item for six boats under one appeal, the
    # later decision in an item of its own beneath: invented names.
    nested = ('<article about="/agencies/oalj/PUBLIC/INA/REFERENCES/CASELISTS/TLN_DECISIONS"><ul><li>ACME BOATS, INC., '
              'BETA BOATS, INC. 2021-TLN-39, -40<ul><li>Decision and Order Affirming Denial of Certification (ALJ May 3, '
              '2021) (Bell) <a href="https://www.oalj.dol.gov/DECISIONS/ALJ/TLN/2021/Employment_and_Train_v_Beta_Boats_'
              'Inc_2021TLN00040_(MAY_03_2021)_1_CADEC_PD.PDF"><strong>PDF</strong></a></li><li>Order Denying Motion for '
              'Reconsideration&nbsp;(ALJ May 18,&nbsp;2021)&nbsp;(Bell) <a href="https://www.oalj.dol.gov/DECISIONS/ALJ/TLN/'
              '2021/Employment_and_Train_v_Beta_Boats_Inc_2021TLN00040_(MAY_18_2021)_2_MODIS_PD.PDF"><strong>PDF</strong>'
              '</a></li></ul></li></ul></article>')
    got = b.parse_caselist(nested, "TLN_DECISIONS")
    check("a nested item's decision keeps the case named above it",
          [(d["docket"], d["day"]) for d in got] == [("2021-TLN-00039", "2021-05-03"), ("2021-TLN-00039", "2021-05-18")],
          str(got))
    check("the kind is read after a list of dockets",
          [d["kind"] for d in got] == ["Decision and Order Affirming Denial of Certification",
                                       "Order Denying Motion for Reconsideration"], str([d["kind"] for d in got]))
    check("every decision in range has a kind", all(d["kind"] for d in tln + pwd + tlc if d["day"] >= b.SINCE))
    check("no address is the Archive's or carries a tracking query",
          not any("web.archive.org" in d["pdf"] or "_ga=" in d["pdf"] for d in per + pwd + tlc + tln))
    check("an empty caselist parses to nothing", b.parse_caselist(EMPTY, "PWD_DECISIONS") == [])

    # --- the rows: range, names, PDFs -------------------------------------
    allr, held = b.decision_rows(per + pwd + tlc + tln, found, {})
    by = {r["document_number"]: r for r in allr}
    check("the en banc list is kept whole, the others from FY2025",
          "balca-2011-PER-00040-20111201" in by and not any(r["publication_date"] < b.SINCE and
                                                             r["citation"].split("-")[1] != "PER"
                                                             and "BALCA_DECISIONS_PERM" not in r["html_url"]
                                                             for r in allr), "")
    check("a 2009 H-2B decision is out of range", not any(r["citation"].startswith("2009-TLN") for r in allr))
    check("a sole proprietor becomes initials", by["balca-2026-TLC-00008-20260129"]["title"] == "P.S., 2026-TLC-00008")
    check("three given names, three initials", by["balca-2026-TLN-00013-20260129"]["title"] == "J.M.T., 2026-TLN-00013")
    check("a business stays as printed", by["balca-2025-PWD-00003-20250529"]["title"]
          == "ICEKISS, INC. d/b/a FOREMOST FOODS SAIPAN, 2025-PWD-00003")
    held_nums = {r["document_number"] for r, _c, _w in held}
    check("a household, an address and a name without a known given name are held",
          {"balca-2025-TLN-00078-20250519", "balca-2025-TLN-00106-20250610", "balca-2025-TLN-00137-20250929"}
          <= held_nums, str(held_nums))
    check("nothing held is on the page", not (held_nums & set(by)))
    check("a person's PDF is never linked (their name is in its file name)",
          by["balca-2026-TLC-00008-20260129"]["pdf_url"] is None)
    check("a PDF naming the worker is not linked", by["balca-2009-PER-00127-20100302"]["pdf_url"] is None)
    check("a PDF naming someone the caption doesn't is not linked",
          by["balca-2025-TLN-00090-20250603"]["pdf_url"] is None)
    check("an employer's PDF is linked", (by["balca-2011-PER-00040-20111201"]["pdf_url"] or "").startswith(
        "https://www.oalj.dol.gov/DECISIONS/ALJ/PER/2011/In_re_KARL_STORZ"))
    check("the link is the caselist on www.dol.gov",
          by["balca-2026-TLC-00002-20251215"]["html_url"].endswith("/CASELISTS/TLC_DECISIONS_FY2026"))
    check("the topic follows the docket type", by["balca-2026-TLC-00002-20251215"]["topics"] == ["H-2A"]
          and "Prevailing wage" in by["balca-2025-PWD-00003-20250529"]["topics"])
    days = sorted({r["publication_date"] for r in allr if r["publication_date"] >= b.SINCE})
    gap = max((dt.date.fromisoformat(y) - dt.date.fromisoformat(x)).days for x, y in zip(days, days[1:]))
    check("the longest gap between decisions from FY2025 on is the 44 days the budget names", gap == 44, str(gap))
    check("no title or link carries an invented person's surname whole",
          not any(re.search(r"Sampleman|Testerly|Samplewood", (r["title"] or "") + (r["pdf_url"] or ""))
                  for r in allr))

    # --- writing ----------------------------------------------------------
    db = SqliteTurso()
    rc = b.run(db, fetch=fetcher(), sleep=no_sleep)
    first = rows(db)
    check("a run writes every row for the page", rc == 0 and len(first) == len(allr), f"rc={rc} {len(first)}/{len(allr)}")
    check("and holds the rest off the page", len(cc.held_rows(db, b.SOURCE)) == len(held))
    fresh = query_dicts(db, "SELECT as_of, max_age_days FROM data_freshness WHERE dataset = ?", [b.DATASET], typed=True)
    check("freshness is the newest decision, budget 170", fresh and fresh[0]["as_of"] == "2026-01-29"
          and int(fresh[0]["max_age_days"]) == 170, str(fresh))
    check("a held run is a recorded ok run naming the held", runs(db)[-1]["status"] == "ok"
          and "held" in runs(db)[-1]["note"], str(runs(db)[-1]))
    before = [r["fetched_at"] for r in first]
    rc = b.run(db, fetch=fetcher(), sleep=no_sleep)
    check("an unchanged run writes nothing", rc == 0 and [r["fetched_at"] for r in rows(db)] == before)
    check("and records no second run row inside the quiet window (nothing new was held)", len(runs(db)) == 1,
          str(runs(db)))
    cc.rule_on(db, b.SOURCE, "balca-2025-TLN-00074-20250514", "organization")
    b.release(db, "balca-2025-TLN-00074-20250514", "organization")
    got = {r["document_number"]: r for r in rows(db)}
    check("a ruling of organization prints the caption", got.get("balca-2025-TLN-00074-20250514", {}).get("title")
          == "Climate Control, 2025-TLN-00074", str(got.get("balca-2025-TLN-00074-20250514")))
    b.release(db, "balca-2025-TLN-00078-20250519", "person")
    got = {r["document_number"]: r for r in rows(db)}
    r78 = got.get("balca-2025-TLN-00078-20250519", {})
    check("a ruling of person prints initials and drops the PDF",
          r78.get("title") == "S.H., 2025-TLN-00078" and not r78.get("pdf_url"), str(r78))

    # --- trouble ----------------------------------------------------------
    for label, err in (("a 403", http(403)), ("a 429", http(429)), ("a timeout", TimeoutError("timed out")),
                       ("a socket timeout", socket.timeout("timed out"))):
        db = SqliteTurso()
        rc = b.run(db, fetch=fetcher({"LIBINA": err}), sleep=no_sleep)
        r = runs(db)
        check(f"{label} on the library is a warning and an ok run, nothing written",
              rc == 0 and r and r[-1]["status"] == "ok" and "unread" in r[-1]["note"] and rows(db) == [], f"rc={rc} {r}")
    db = SqliteTurso()
    rc = b.run(db, fetch=fetcher({"TLN_DECISIONS": http(503)}), sleep=no_sleep)
    r = runs(db)
    check("one caselist refused: the others are written, the run ok with the refusal named",
          rc == 0 and rows(db) and r[-1]["status"] == "ok" and "TLN_DECISIONS unread" in r[-1]["note"], f"rc={rc} {r[-1]}")
    db = SqliteTurso()
    rc = b.run(db, fetch=fetcher({"LIBINA": "<html><body>nothing here</body></html>"}), sleep=no_sleep)
    check("a library with no caselists exits 1 with a failed run", rc == 1 and runs(db)[-1]["status"] == "failed")
    db = SqliteTurso()
    rc = b.run(db, fetch=fetcher({"PWD_DECISIONS": EMPTY}), sleep=no_sleep)
    r = runs(db)
    check("a caselist with no decisions exits 1 after writing the others",
          rc == 1 and r[-1]["status"] == "failed" and "PWD_DECISIONS" in r[-1]["note"] and rows(db), f"rc={rc} {r[-1]}")
    try:
        b.run(SqliteTurso(), fetch=fetcher({"PWD_DECISIONS": KeyError("defect")}), sleep=no_sleep)
        crashed = False
    except KeyError:
        crashed = True
    check("a defect crashes", crashed)

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
