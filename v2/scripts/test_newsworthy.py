#!/usr/bin/env python3
"""The newsworthy check: what counts as a move, and how each is said.

    python3 scripts/test_newsworthy.py
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys
from zoneinfo import ZoneInfo

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import lib_newsworthy as nw  # noqa: E402

ET = ZoneInfo("America/New_York")
FAILS: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def ms(y: int, m: int, d: int, h: int = 12, mi: int = 0) -> int:
    return int(dt.datetime(y, m, d, h, mi, tzinfo=ET).timestamp() * 1000)


AC29 = {"rin": "1205-AC29", "title": "Modernizing the Labor Market Test and Improving Protections for U.S. Workers "
        "in the PERM Immigrant Visa Program (NPRM)", "agency": "DOL's Employment and Training Administration",
        "comments_close": None, "effective_on": None}


def reading(at: int, analyst: str, recon: str, pwd: str, perm_as_of: str, pwd_as_of: str) -> dict:
    return {"fetched_at": at, "snapshot": {
        "permAsOf": perm_as_of, "pwdAsOf": pwd_as_of,
        "permQueues": [{"queue": "Analyst Review", "priorityDate": analyst},
                       {"queue": "Audit Review", "priorityDate": "2025-12"},
                       {"queue": "Reconsideration Request to the CO", "priorityDate": recon}],
        "pwdQueues": [{"program": "PERM", "oewsReceiptDate": pwd, "nonOewsReceiptDate": pwd},
                      {"program": "H-1B", "oewsReceiptDate": "2026-01", "nonOewsReceiptDate": None}]}}


def weekdays(end: str, n: int, total: int) -> list[dict]:
    out, d = [], dt.date.fromisoformat(end)
    while len(out) < n:
        d -= dt.timedelta(days=1)
        if d.weekday() < 5:
            out.append({"date": d.isoformat(), "total": total})
    return out


def main() -> int:
    now = ms(2026, 10, 27, 20, 30)
    morning = ms(2026, 10, 27, 7, 0)

    # --- rules ---------------------------------------------------------------
    events = [
        {**AC29, "kind": "oira-completed", "on_date": "2026-10-23", "detail": "Consistent with Change", "seen_at": ms(2026, 10, 27, 9, 10)},
        {**AC29, "kind": "oira-received", "on_date": "2026-09-14", "detail": "Proposed Rule", "seen_at": ms(2026, 10, 27, 9, 10)},
        {**AC29, "rin": "1615-AD25", "title": "Amending the Premium Processing Timeframe", "agency": "USCIS",
         "kind": "oira-received", "on_date": "2026-10-26", "detail": "Proposed Rule", "seen_at": ms(2026, 10, 26, 17, 10)},
    ]
    items = nw.newsworthy(nw.Inputs(rule_events=events), morning, now)
    check("a step seen today and dated this week is news; one dated in September isn't, though seen today",
          [i["what"] for i in items] == [
              'OIRA finished its review of "Modernizing the Labor Market Test and Improving Protections for U.S. '
              'Workers in the PERM Immigrant Visa Program" on Oct 23, 2026. Its decision: "Consistent with Change".'],
          str([i["what"] for i in items]))
    check("a step seen before the window isn't repeated", all("Premium" not in i["what"] for i in items))
    check("each line says the source", nw.line(items[0]).endswith("Source: OIRA's review lists on reginfo.gov."))
    check("the sentence matches the site's wording for a received rule",
          nw.rule_sentence(events[2]) == 'USCIS sent "Amending the Premium Processing Timeframe" to OIRA for review on Oct 26, 2026 (proposed rule).')

    # --- DOL's months --------------------------------------------------------
    r1 = reading(ms(2026, 10, 2, 3), "2025-12", "2026-04", "2026-05", "2026-09-22", "2026-08-31")
    r2 = reading(ms(2026, 10, 27, 15), "2026-01", "2026-05", "2026-06", "2026-10-26", "2026-10-26")
    dol = nw.newsworthy(nw.Inputs(readings=[r1, r2]), morning, now)
    whats = [i["what"] for i in dol]
    check("analyst review, reconsideration and the PERM wage requests moving are each news",
          any("analyst review moved: DOL is reviewing cases filed in January 2026, up from December 2025" in w for w in whats)
          and any("reconsideration review moved" in w for w in whats)
          and any("PERM wage requests (OEWS) moved: DOL is issuing determinations on requests filed in June 2026" in w for w in whats)
          and not any("audit" in w for w in whats) and not any("H-1B" in w for w in whats), str(whats))
    check("an older reading isn't news again", nw.newsworthy(nw.Inputs(readings=[r1, r2]), ms(2026, 10, 27, 16), now) == [])
    back = reading(ms(2026, 10, 27, 15), "2025-11", "2026-04", "2026-05", "2026-10-26", "2026-08-31")
    check("a month going back is said as going back", any("went back" in i["what"] for i in
                                                         nw.newsworthy(nw.Inputs(readings=[r1, back]), morning, now)))

    # --- the bulletin --------------------------------------------------------
    b = nw.newsworthy(nw.Inputs(bulletins=[{"bulletin_month": "2026-12", "first_seen_at": ms(2026, 10, 27, 9, 12)},
                                           {"bulletin_month": "2026-11", "first_seen_at": ms(2026, 10, 9, 9, 12)}]), morning, now)
    check("a bulletin first held today is news, with the time", [i["what"] for i in b] ==
          ["The December 2026 visa bulletin is out; this site first held it at 9:12 AM EDT Oct 27."], str(b))

    # --- employers -----------------------------------------------------------
    stages = {"holdMoves": [
        {"date": "2026-10-27", "name": "Microsoft Corporation", "dir": "on", "to": "APPLICATION ON HOLD", "n": 598},
        {"date": "2026-10-27", "name": "Small Co", "dir": "on", "to": "APPLICATION ON HOLD", "n": 8},
        {"date": "2026-10-20", "name": "Old Co", "dir": "on", "to": "APPLICATION ON HOLD", "n": 400}],
        "decisionMoves": [{"date": "2026-10-27", "name": "Upshift Work LLC", "to": "CERTIFIED", "n": 61},
                          {"date": "2026-10-27", "name": "By the Sea", "to": "WITHDRAWN", "n": 19}]}
    e = [i["what"] for i in nw.newsworthy(nw.Inputs(employer_stages=stages), morning, now)]
    check("big employer moves today are news, small and old ones aren't", e == [
        "DOL put 598 of Microsoft Corporation's PERM cases on hold on Oct 27, 2026.",
        "DOL certified 61 of Upshift Work LLC's PERM cases in one day, Oct 27, 2026."], str(e))

    # --- a decision day ------------------------------------------------------
    days = weekdays("2026-10-27", 25, 700) + [{"date": "2026-10-27", "total": 1500}]
    d = [i["what"] for i in nw.newsworthy(nw.Inputs(decision_days=days), morning, now)]
    check("a weekday at twice the typical is news", d == [
        "Our sweep recorded 1,500 PERM decisions on Oct 27, 2026, 2.1 times a typical weekday (700)."], str(d))
    days[-1] = {"date": "2026-10-27", "total": 1390}
    check("just under twice isn't", nw.newsworthy(nw.Inputs(decision_days=days), morning, now) == [])
    weekend = weekdays("2026-10-25", 25, 700) + [{"date": "2026-10-25", "total": 5000}]
    check("a weekend day is never compared with weekdays", nw.newsworthy(nw.Inputs(decision_days=weekend), ms(2026, 10, 25, 1), now) == [])
    check("too short a history says nothing", nw.typical_weekday(weekdays("2026-10-27", 5, 700), "2026-10-27") is None)

    # --- the same words as the site ------------------------------------------
    fx = json.loads((HERE / "fixtures" / "rule_step_sentences.json").read_text())
    for c in fx["cases"]:
        r = c.get("rule") or fx["rule"]
        e = {"rin": r["rin"], "title": r["title"], "agency": r["agency"], "comments_close": r["commentsClose"],
             "effective_on": r["effectiveOn"], "kind": c["event"]["kind"], "on_date": c["event"]["onDate"],
             "detail": c["event"]["detail"]}
        check(f"worded as the site words it: {c['event']['kind']} {c['event']['detail']}", nw.rule_sentence(e) == c["sentence"],
              nw.rule_sentence(e))

    # --- together ------------------------------------------------------------
    allin = nw.newsworthy(nw.Inputs(rule_events=events, readings=[r1, r2], employer_stages=stages, decision_days=days), morning, now)
    check("newest first, and every line has a date and a source",
          [i["when"] for i in allin] == sorted([i["when"] for i in allin], reverse=True)
          and all(re.search(r"\d{4}", nw.line(i)) and "Source: " in nw.line(i) for i in allin))
    check("nothing moved is an empty list", nw.newsworthy(nw.Inputs(), morning, now) == [])

    # --- documents and announcements (Oct 27 2026) ---------------------------
    seen = ms(2026, 10, 27, 9, 30)
    docs = [
        {"document_number": "2026-22001", "publication_date": "2026-10-28", "type": "Rule",
         "title": "Temporary Increase in H-2B Nonimmigrant Visas", "agencies": '["Homeland Security Department"]',
         "source": "public-inspection", "status": "public-inspection", "pi_filed": "2026-10-27", "first_seen_at": seen},
        {"document_number": "wh-2026-10-x", "publication_date": "2026-10-27", "type": "Presidential action",
         "title": "Restriction on Entry of Certain Nonimmigrant Workers", "agencies": [], "source": "white-house",
         "action": "Proclamation", "first_seen_at": seen},
        {"document_number": "uscis-old", "publication_date": "2026-03-01", "type": "USCIS announcement",
         "title": "An old release a first run loaded", "source": "uscis-news", "first_seen_at": seen},
        {"document_number": "2026-99901", "publication_date": "2026-10-27", "type": "Proposed Rule",
         "title": "A rule the rule watch follows", "source": "federal-register", "first_seen_at": seen},
        {"document_number": "oflc-early", "publication_date": "2026-10-27", "type": "OFLC announcement",
         "title": "Seen before the window", "source": "oflc", "first_seen_at": morning - 1},
    ]
    got = nw.newsworthy(nw.Inputs(documents=docs, rule_documents={"2026-99901"}), morning, now)
    words = [i["what"] for i in got]
    check("a filing for public inspection is news, with both its days",
          any("DHS filed a rule for public inspection on Oct 27, 2026, to be published Oct 28, 2026" in w for w in words), str(words))
    check("a White House action is news", any(w.startswith("The White House posted a proclamation on Oct 27, 2026") for w in words), str(words))
    check("an old document a first run loaded isn't", not any("old release" in w for w in words))
    check("a rule the rule watch already reports isn't repeated", not any("rule watch follows" in w for w in words))
    check("a document seen before the window isn't", not any("before the window" in w for w in words))
    check("each names its source", all(nw.line(i).endswith(("public inspection list.", "whitehouse.gov.")) for i in got),
          str([nw.line(i) for i in got]))

    # --- State Department news and bills in Congress ---------------------------
    st = {"document_number": "state-x", "publication_date": "2026-10-27", "type": "State Department visa news",
          "title": "Visa Bond Pilot Program Expanded", "source": "state-news", "first_seen_at": seen}
    old_bill = {"document_number": "bill-119-hr-2315", "publication_date": "2025-03-25", "type": "Bill",
                "title": "Fairness for High-Skilled Americans Act of 2025", "source": "congress",
                "action": "Passed House.", "dates": "2026-10-27", "first_seen_at": morning - 86_400_000 * 30,
                "fetched_at": seen}
    quiet_bill = dict(old_bill, document_number="bill-119-s-1233", fetched_at=morning - 1)
    backfilled = dict(old_bill, document_number="bill-119-s-2759", dates="2025-09-10", first_seen_at=seen)
    got = nw.newsworthy(nw.Inputs(documents=[st, old_bill, quiet_bill, backfilled]), morning, now)
    words = [nw.line(i) for i in got]
    check("State Department news is worded as the State Department's",
          "The State Department posted visa news on Oct 27, 2026: \"Visa Bond Pilot Program Expanded\". "
          "Source: the State Department's newsroom." in words, str(words))
    check("a bill introduced long ago is news the day it moves",
          'H.R. 2315, "Fairness for High-Skilled Americans Act of 2025", moved on Oct 27, 2026: Passed House. '
          "Source: congress.gov." in words, str(words))
    check("a bill nothing happened to in the window isn't", not any("S. 1233" in w for w in words), str(words))
    check("a backfill's old action isn't", not any("S. 2759" in w for w in words), str(words))
    court = {"document_number": "cl-1", "publication_date": "2026-10-26", "type": "Court opinion",
             "title": "E. v. U.S. Department of State", "agencies": '["District Court, District of Columbia"]',
             "source": "courtlistener", "first_seen_at": seen}
    balca = {"document_number": "balca-x", "publication_date": "2026-10-23", "type": "BALCA decision",
             "title": "Acme Farms LLC, 2026-TLC-00012", "agencies": '["Board of Alien Labor Certification Appeals"]',
             "source": "balca", "first_seen_at": seen}
    words = [nw.line(i) for i in nw.newsworthy(nw.Inputs(documents=[court, balca]), morning, now)]
    check("a court opinion names the court",
          'A federal court (District Court, District of Columbia) decided "E. v. U.S. Department of State" on Oct 26, 2026. '
          "Source: CourtListener." in words, str(words))
    check("a BALCA decision names BALCA",
          'BALCA decided "Acme Farms LLC, 2026-TLC-00012" on Oct 23, 2026. Source: OALJ\'s caselists.' in words, str(words))
    shared = json.loads((HERE / "fixtures" / "bill_numbers.json").read_text())["cases"]
    check("bill numbers match the site's", all(nw.bill_number(k) == v for k, v in shared.items()),
          str({k: nw.bill_number(k) for k in shared}))

    # --- a new Unified Agenda edition: one line, not one per rule -------------
    ag_seen = ms(2026, 10, 27, 9, 30)
    agenda = [{"rin": f"1615-AD{i:02d}", "kind": "agenda", "on_date": "2026-10-24", "seen_at": ag_seen,
               "title": f"Rule {i}", "agency": "USCIS",
               "detail": '{"action": "NPRM", "date": "12/00/2026", "edition": "Fall 2026", "stage": "Proposed Rule Stage"}'}
              for i in range(12)]
    old_ed = [{**agenda[0], "rin": "1205-AC29", "on_date": "2026-07-03"}]
    got = nw.newsworthy(nw.Inputs(rule_events=agenda + old_ed), morning, now)
    lines = [i["what"] for i in got]
    check("a new agenda edition is one line", len(lines) == 1, str(lines))
    check("it counts the edition's rules and names three",
          bool(lines) and lines[0].startswith("The Fall 2026 Unified Agenda, dated Oct 24, 2026, sets a timetable for 12 rules")
          and lines[0].count('"') == 6 and "and 9 more" in lines[0], str(lines))
    check("an older edition seen today isn't news", not any("1205-AC29" in w or "Jul 3" in w for w in lines), str(lines))
    check("its source is the agenda", bool(got) and got[0]["source"] == "reginfo.gov's Unified Agenda", str(got))

    # A followed rule published: the evening check names the articles whose text needs the document.
    pub = {"rin": "1205-AC29", "kind": "proposed-published", "on_date": "2026-10-27", "detail": "91 FR 70000",
           "seen_at": ms(2026, 10, 27, 12), "title": "Modernizing the Labor Market Test (NPRM)", "agency": "DOL",
           "comments_close": "2026-12-28", "effective_on": None}
    got = nw.newsworthy(nw.Inputs(rule_events=[pub], articles={"1205-AC29": ["/blog/proposed-perm-rule-rin-1205-ac29"]}), morning, now)
    check("a published rule names the article to update",
          len(got) == 1 and "update /blog/proposed-perm-rule-rin-1205-ac29" in got[0]["what"])
    review = dict(pub, kind="oira-completed", detail="Consistent with Change")
    got = nw.newsworthy(nw.Inputs(rule_events=[review], articles={"1205-AC29": ["/blog/x"]}), morning, now)
    check("a review step names no article: the status updates itself", len(got) == 1 and "update" not in got[0]["what"])
    found = nw.articles_by_rin()
    check("the real article is found by its RIN", "/blog/proposed-perm-rule-rin-1205-ac29" in found.get("1205-AC29", []))
    check("a compared rule is found too", "/blog/proposed-perm-rule-rin-1205-ac29" in found.get("1205-AC30", []))

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())

