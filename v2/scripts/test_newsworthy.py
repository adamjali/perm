#!/usr/bin/env python3
"""The newsworthy check: what counts as a move, and how each is said.

    python3 scripts/test_newsworthy.py
"""
from __future__ import annotations

import datetime as dt
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
    import json  # noqa: PLC0415
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

    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
