#!/usr/bin/env python3
"""SBA's PPP loans join a sponsor's page only on strict rules (ingest_ppp.py).

* a loan to a person (sole proprietor, self-employed) is never kept, unless its name is a company's
  ("PLEASANT PLACES, INC." is filed as a sole proprietorship);
* a loan joins only in a city the sponsor's own PERM filings name, unless the sponsor is national;
* a blank borrower state falls back to the project's (SBA left 13 large loans so);
* SBA's demographic columns are never read; a changed layout is refused.

Run: python3 scripts/test_ppp.py
"""
from __future__ import annotations

import csv
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ingest_ppp as p  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


HEADER = p.NEED + ["Race", "Ethnicity", "Gender", "Veteran"]


def loan(lid, name, city, state, btype="Corporation", project_state="", amount="769358.78", jobs="62"):
    r = dict.fromkeys(HEADER, "")
    r.update({"LoanNumber": lid, "DateApproved": "05/01/2020", "ProcessingMethod": "PPP", "BorrowerName": name,
              "BorrowerCity": city, "BorrowerState": state, "ProjectState": project_state,
              "CurrentApprovalAmount": amount, "ForgivenessAmount": "773553.37", "ForgivenessDate": "11/20/2020",
              "JobsReported": jobs, "NAICSCode": "325510", "BusinessType": btype, "Race": "Unanswered", "Gender": "Male Owned"})
    return [r[h] for h in HEADER]


check("SBA's dates read", p.day("05/01/2020") == "2020-05-01" and p.day("") is None)
check("amounts and jobs read as numbers, or none", p.money("769,358.78") == 769358.78 and p.count("62") == 62 and p.count("x") is None)

SPONSORS = {"SUMTER COATINGS, INC.": "sumter", "PLEASANT PLACES, INC.": "pleasant", "JANE DOE": "jane",
            "ACME INC": "acme", "BIG NATIONAL INC": "big"}
with tempfile.TemporaryDirectory() as tmp:
    f = pathlib.Path(tmp) / "public_up_to_150k_1_240930.csv"
    with open(f, "w", newline="") as out:
        w = csv.writer(out)
        w.writerow(HEADER)
        w.writerows([
            loan("1", "SUMTER COATINGS, INC.", "Sumter", "", project_state="SC"),
            loan("2", "PLEASANT PLACES, INC.", "North Charleston", "SC", btype="Sole Proprietorship"),
            loan("3", "Jane Doe", "Sumter", "SC", btype="Sole Proprietorship"),
            loan("4", "Acme Inc", "Elsewhere", "SC"),
            loan("5", "Big National Inc", "Anywhere", "OH"),
        ])
    states_seen = []

    def match(name, state):
        states_seen.append(state)
        return SPONSORS.get(name.upper())

    seen: dict = {}
    first = p.select(p.loans(f), match, None, seen)
    cities = {"sumter": {"SUMTER"}, "pleasant": {"NORTH"}, "acme": {"MIAMI"}, "jane": {"SUMTER"}}
    ok = p.dol.same_city(cities, {"big": 300})
    keep = [r for r in first if ok(r[-1], r[2])]
    by = {r[0]: r for r in keep}
    check("a loan to a person is never kept", "3" not in {r[0] for r in first})
    check("a company filed as a sole proprietorship is kept", "2" in by)
    check("a blank borrower state falls back to the project's", by["1"][3] == "SC" and "SC" in states_seen)
    check("a loan in a city its sponsor never names stays off", "4" not in by)
    check("a national sponsor joins from any city", "5" in by)
    check("no demographic value is read", not any(v in ("Unanswered", "Male Owned") for r in keep for v in r))
    check("the record keys its page last", p.COLS[-1] == "employer_slug" and all(r[-1] for r in keep))

    bad = pathlib.Path(tmp) / "public_bad.csv"
    with open(bad, "w", newline="") as out:
        csv.writer(out).writerow([h for h in HEADER if h != "JobsReported"])
    try:
        list(p.loans(bad))
        check("a changed layout is refused", False, "it was read")
    except RuntimeError as exc:
        check("a changed layout is refused", "layout changed" in str(exc), str(exc))

print(f"\n{len(failures)} failure(s)" if failures else "\nall passed")
sys.exit(1 if failures else 0)
