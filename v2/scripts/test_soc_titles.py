#!/usr/bin/env python3
"""Gates for build_soc_titles.py: one title key in both languages, the keeping rules,
the display title, the page floor, and O*NET read from a real slice of release 31.0."""
from __future__ import annotations

import io
import json
import pathlib
import sys
import zipfile
from collections import Counter

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_soc_titles as B  # noqa: E402

fails: list[str] = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


# ── the key, held to the shared fixture (the TypeScript twin reads the same file) ──
cases = json.loads((HERE / "fixtures" / "soc_title_keys.json").read_text())["cases"]
check(len(cases) >= 15, f"the key fixture holds {len(cases)} cases")
for raw, want in cases:
    got = B.title_key(raw)
    check(got == want, f"title_key({raw!r}) = {got!r}, want {want!r}")

# ── a readable title ──
check(B.nice_case("SR. SOFTWARE ENGINEER") == "Sr. Software Engineer", "capitals read as a title")
check(B.nice_case("IT PROJECT MANAGER") == "IT Project Manager", "an acronym stays in capitals")
check(B.nice_case("DIRECTOR OF ENGINEERING") == "Director of Engineering", "a small word after the first is lower case")
check(B.nice_case("FULL-STACK DEVELOPER") == "Full-Stack Developer", "each part of a compound is capitalised")
check(B.nice_case(".NET DEVELOPER") == ".NET Developer", "a dotted name stays as written")
check(B.nice_case("Data Scientist (NLP)") == "Data Scientist (NLP)", "mixed case is kept as typed")

# ── O*NET, from a real slice of release 31.0 ──
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as z:
    for f in (HERE / "fixtures" / "soc_titles").glob("*.csv"):
        z.write(f, f"db_31_0_csv/{f.name}")
onet = B.onet_release(buf.getvalue())
check(onet["release"] == "31.0", "the release is read from the zip's folder")
check(onet["code_titles"].get("15-1252") == "Software Developers", "a code's title is O*NET's .00 title")
check(onet["code_titles"].get("15-2051") == "Data Scientists", "a code with several O*NET codes takes the .00 one")
check(onet["zones"].get("15-1252") == 4, "the Job Zone is read for the .00 code")
check(("software engineer", "15-1252") in onet["titles"], "O*NET's own titles are keyed")

# ── joining DOL's filings to O*NET (real counts, Oct 29 2026, cut down) ──
dol = {
    "perm": Counter({("SOFTWARE ENGINEER", "15-1252"): 900, ("SENIOR SOFTWARE ENGINEER", "15-1252"): 400,
                     ("DATA SCIENTIST", "15-2051"): 300, ("DATA SCIENTIST", "15-1252"): 2,
                     ("DATA SCIENTIST", "15-2041"): 40, ("DATA SCIENTIST", "15-1111"): 3,
                     ("RARE TITLE", "11-1021"): 4}),
    "pwd": Counter({("SOFTWARE ENGINEER", "15-1251"): 30, ("DATA SCIENTIST", "15-2031"): 2}),
    "lca": Counter({("SOFTWARE ENGINEER III", "15-1252"): 100, ("SOFTWARE ENGINEER", "15-1132"): 20}),
}
rows, keys = B.build(dol, onet)
by = {(r[0], r[1]): r for r in rows}
se = by.get(("software engineer", "15-1252"))
check(se is not None and se[4] == 1400 and se[5] == 1300 and se[7] == 100,
      "seniority and level spellings count under one key, by program")
check(se is not None and se[3] == "both", "a pair O*NET also lists is marked both")
check(se is not None and se[2] == "Software Engineer", "the display title is O*NET's spelling when O*NET has the key")
check(json.loads(se[8])[0] == ["SOFTWARE ENGINEER", 900], "the commonest spellings are kept, busiest first")
check(("data scientist", "15-2031") not in by, "a pair under its own minimum (2 filings) is dropped")
check(("data scientist", "15-1111") not in by, "a pair over its minimum but under 1% of the key's filings is dropped")
check(("data scientist", "15-2041") in by, "a real second code is kept")
check(("software engineer", "15-1132") in by, "a 2010 code filed often enough is kept, as filed")
check(("rare title", "11-1021") not in by, "a title under five filings in all is dropped")
check(keys["software engineer"]["total"] == 1450, "a key's total counts every filing, kept pairs or not")
check(se is not None and se[9] == 1450, "each row carries its title's total, the share's denominator")
onet_only = [r for r in rows if r[3] == "onet"]
check(onet_only and all(r[4] == 0 and r[8] is None for r in onet_only), "O*NET-only titles carry no filings")
check(all(len(r) == len(B.COLS) for r in rows), "every row has a value for every column")
check(len({(r[0], r[1]) for r in rows}) == len(rows), "one row per title and code")

# A DOL-only title takes its commonest bare spelling, not the senior one.
dol2 = {"perm": Counter({("SENIOR WIDGET ANALYST", "13-1111"): 50, ("WIDGET ANALYST", "13-1111"): 10}),
        "pwd": Counter(), "lca": Counter()}
rows2, keys2 = B.build(dol2, {"titles": {}, "code_titles": {}, "zones": {}, "release": "31.0"})
check(keys2["widget analyst"]["title"] == "Widget Analyst", "the display title is the spelling that is the key")

# ── pages and codes ──
pages = B.title_pages({"a b": {"total": B.PAGE_MIN, "title": "A B"}, "c": {"total": B.PAGE_MIN - 1, "title": "C"},
                       "d": {"total": 500, "title": "D"}})
check([p[0] for p in pages] == ["d", "a-b"], "a page from the floor up, busiest first, slug from the key")
check(keys["data scientist"]["top"] == "15-2051" and keys["data scientist"]["topN"] == 300,
      "each title carries the code employers used most for it")
page_rows = B.title_pages(keys)
check(next(p for p in page_rows if p[0] == "software-engineer")[3:] == ["15-1252", 1400], "a page row names its top code")
codes = B.code_list(rows, onet, {"15-1251": Counter({"Computer Programmers": 5})}, {"15-1252": "software-developers"})
c1252 = next(c for c in codes if c[0] == "15-1252")
check(c1252[1] == "Software Developers" and c1252[2] == 4 and c1252[6] == "software-developers",
      "a code carries its title, Job Zone and occupation page")
c1251 = next(c for c in codes if c[0] == "15-1251")
check(c1251[1] == "Computer Programmers", "a code O*NET lacks takes DOL's title")
codes2 = B.code_list(rows, onet, {"15-1132": Counter({"SOFTWARE DEVS": 9})}, {}, B.crosswalk_titles())
c1132 = next(c for c in codes2 if c[0] == "15-1132")
check(c1132[1] == "Software Developers, Applications", "a 2010 code takes BLS's title from the crosswalk before DOL's spelling")

# ── each code's occupation page ──
slugs = B.choose_slugs([
    ("15-2051.01", "business-intelligence-analysts", "Business Intelligence Analysts", 900),
    ("15-2051.00", "data-scientists", "Data Scientists", 400),
    ("15-2031.00", "n-a-3", "N/A", 50),
    ("15-2031", "operations-research-analysts", "Operations Research Analysts", 30),
    ("15-1252.00", "software-developers", "Software Developers", 76524),
    ("bad", "x", "X", 1),
])
check(slugs == {"15-2051": "data-scientists", "15-2031": "operations-research-analysts", "15-1252": "software-developers"},
      "a code's page is its own code's, never a finer O*NET job or a row named N/A")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
