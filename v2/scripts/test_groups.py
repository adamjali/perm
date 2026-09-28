#!/usr/bin/env python3
"""build_groups.py's aggregation, on rows built here.

Asserts: a group under the floor gets no row; cities pool spellings and take
the mixed-case label; an industry needs a 6-digit code; a country's page
carries no country list of its own; the median wage reads certified cases
only; years and top lists land in the detail JSON.

Run:  python3 scripts/test_groups.py
"""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_groups as g  # noqa: E402

FAILS: list[str] = []


def check(label: str, ok: bool) -> None:
    print(("PASS " if ok else "FAIL ") + label)
    if not ok:
        FAILS.append(label)


def row(**over) -> dict:
    base = {"status": "certified", "fiscal_year": "2021", "employer_slug": "acme-inc",
            "employer_name": "ACME INC", "state": "VA", "soc_code": "15-1252.00",
            "soc_title": "Software Developers", "wage": 100000, "naics": "541511",
            "worksite_city": "MCLEAN", "citizenship": "INDIA", "education": "Master's",
            "visa_class": "H-1B"}
    base.update(over)
    return base


def main() -> int:
    g.FLOOR = 3
    rows = ([row() for _ in range(3)]
            + [row(worksite_city="McLean", status="denied", wage=10)]
            + [row(worksite_city="Tiny", state="TX", naics="5415", citizenship="CHINA")])
    groups, votes, titles = g.aggregate(rows)
    out = {(r[0], r[1]): r for r in g.build_rows(groups, votes, titles, {"15-1252": "software-developers"})}
    city = out.get(("city", "mclean-va"))
    check(f"McLean pools four rows under the mixed-case label (got {city and city[3:8]})",
          city is not None and city[3] == "McLean, VA" and city[4:8] == (4, 3, 1, 0))
    check("median wage reads certified cases only", city is not None and city[8] == 100000)
    check("a city under the floor gets no row", ("city", "tiny-tx") not in out)
    check("an industry needs a 6-digit code (5415 is not one)",
          ("industry", "541511") in out and not any(k[0] == "industry" and k[1] == "5415" for k in out))
    ind = out[("industry", "541511")]
    check("industry label is Census's title", ind[3] == "Custom Computer Programming Services")
    detail = json.loads(ind[11])
    check("industry detail: years, employers, occupations with the entity slug",
          detail["years"] == [{"fy": 2021, "certified": 3, "denied": 1, "withdrawn": 0}]
          and detail["employers"][0] == {"slug": "acme-inc", "name": "ACME INC", "n": 4}
          and detail["occupations"][0]["slug"] == "software-developers")
    country = out.get(("country", "india"))
    check("country page: title-cased label, no country list of its own",
          country is not None and country[3] == "India" and json.loads(country[11])["countries"] == [])
    guarded = {(r[0], r[1]): r for r in g.build_rows(
        *g.aggregate(rows + [row(employer_slug="acme-systems-old", employer_name="ACME SYSTEMS OLD")] * 1),
        {"15-1252": "software-developers"}, {"acme-inc"})}
    emps = json.loads(guarded[("industry", "541511")][11])["employers"]
    check("a sponsor links only when its slug is an employer page",
          {e["name"]: e["slug"] for e in emps} == {"ACME INC": "acme-inc", "ACME SYSTEMS OLD": None})
    fields = {c: g.Counter() for c in g.FIELD_OPTIONS}
    g.aggregate(rows + [row(status="pending", visa_class="L-1")], fields)
    doc = g.field_options_doc(fields)
    check("field options: busiest first, values as stored, keys as the search reads them",
          doc["citizenship"] == [{"value": "INDIA", "n": 4}, {"value": "CHINA", "n": 1}]
          and doc["visaClass"] == [{"value": "H-1B", "n": 5}]
          and set(doc) == {"citizenship", "birthCountry", "visaClass", "education", "jobEducation"}
          and doc["birthCountry"] == [])
    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
