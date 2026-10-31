#!/usr/bin/env python3
"""The OSHA loader keeps a sponsor's inspections and counts their violations OSHA's way (ingest_osha.py).

The join rule (lib_dol_records.sponsor_rule) is the one every DOL record shares:

* a national sponsor takes an inspection from any state;
* a smaller one only from a state its PERM filings name, and only under a name of two words or more;
* a one-word name joins only a national sponsor.

And OSHA's counting: a deleted violation doesn't count, grouped items (01001A, 01001B) count once, each type is
counted by its group's first item, both penalties are summed, an old inspection and a "no inspection" are left out,
and a changed layout refuses the file.

Run: python3 scripts/test_osha.py
"""
from __future__ import annotations

import csv
import io
import pathlib
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ingest_osha as o  # noqa: E402
import lib_dol_records as dol  # noqa: E402
from entity_identity import program_key  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


INSP_HEADER = ["ACTIVITY_NR", "REPORTING_ID", "STATE_FLAG", "ESTAB_NAME", "SITE_ADDRESS", "SITE_CITY", "SITE_STATE",
               "SITE_ZIP", "OWNER_TYPE", "OWNER_CODE", "ADV_NOTICE", "SAFETY_HLTH", "SIC_CODE", "NAICS_CODE",
               "INSP_TYPE", "INSP_SCOPE", "WHY_NO_INSP", "UNION_STATUS", "NR_IN_ESTAB", "OPEN_DATE",
               "CASE_MOD_DATE", "CLOSE_CONF_DATE", "CLOSE_CASE_DATE", "LOAD_DT"]
VIOL_HEADER = ["ACTIVITY_NR", "CITATION_ID", "DELETE_FLAG", "STANDARD", "VIOL_TYPE", "ISSUANCE_DATE", "ABATE_DATE",
               "ABATE_COMPLETE", "CURRENT_PENALTY", "INITIAL_PENALTY", "CONTEST_DATE", "FINAL_ORDER_DATE",
               "NR_INSTANCES", "NR_EXPOSED", "LOAD_DT"]


def insp(nr, name, state, *, opened="2024-03-04", closed="2024-09-01", scope="A", kind="H"):
    v = dict.fromkeys(INSP_HEADER, "")
    v.update({"ACTIVITY_NR": nr, "ESTAB_NAME": name, "SITE_CITY": "SPRINGFIELD", "SITE_STATE": state,
              "SITE_ZIP": "62701-1234", "NAICS_CODE": "493110", "INSP_TYPE": kind, "INSP_SCOPE": scope,
              "SAFETY_HLTH": "S", "NR_IN_ESTAB": "250", "OPEN_DATE": f"{opened} 00:00:00+00:00",
              "CLOSE_CASE_DATE": f"{closed} 00:00:00+00:00" if closed else "NaT", "LOAD_DT": "2025-01-01"})
    return [v[h] for h in INSP_HEADER]


def viol(nr, cid, kind, current, initial, deleted=""):
    v = dict.fromkeys(VIOL_HEADER, "")
    v.update({"ACTIVITY_NR": nr, "CITATION_ID": cid, "DELETE_FLAG": deleted, "VIOL_TYPE": kind,
              "CURRENT_PENALTY": current, "INITIAL_PENALTY": initial, "NR_INSTANCES": "1"})
    return [v[h] for h in VIOL_HEADER]


def archive(header, rows, name="2026-10-31_chunk_1.csv") -> zipfile.ZipFile:
    text = io.StringIO()
    out = csv.writer(text)
    out.writerow(header)
    out.writerows(rows)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr(name, "﻿" + text.getvalue())  # DOL's files start with a byte-order mark
    buf.seek(0)
    return zipfile.ZipFile(buf)


SPONSORS = [  # (merge_key, slug, total), busiest first
    (program_key("Amazon.com Services LLC"), "amazon-com-services-llc", 9000),
    ("target", "target-corporation", 120),
    ("bluebird cleaning", "bluebird-cleaning", 74),
    ("costco wholesale", "costco-wholesale-corporation", 111),
    ("7 eleven", "7-eleven-inc", 80),
    ("linde", "linde-inc", 12),
    ("johnson controls", "johnson-controls-inc", 41),
]
MANY = {"WA", "CA", "TX", "NY", "IL", "MN"}
STATES = {"amazon-com-services-llc": MANY, "target-corporation": MANY, "bluebird-cleaning": {"TN"},
          "7-eleven-inc": {"OH", "TX"}, "costco-wholesale-corporation": {"WA", "CA"}, "linde-inc": {"PA", "NJ"}, "johnson-controls-inc": {"FL", "WI"}}
match = dol.sponsor_rule(SPONSORS, STATES, bare_needs_national=True, national_states=dol.NATIONAL_STATES)

check("a national sponsor takes an inspection in a state it never filed in",
      match("AMAZON.COM SERVICES LLC", "OH") == "amazon-com-services-llc")
check("a one-word name joins a national sponsor", match("Target Corporation", "TX") == "target-corporation")
check("many cases in one state isn't national: a namesake in another state stays off the page",
      match("BLUEBIRD CLEANING", "OH") is None)
check("a bare brand doesn't join a sponsor that isn't national, even in its state (a franchisee's store)",
      match("7 ELEVEN", "TX") is None and match("7 ELEVEN", "MI") is None)
check("the company itself, in a state it files in, does", match("7-ELEVEN, INC.", "TX") == "7-eleven-inc")
check("a big sponsor's legal name in another state joins when OSHA inspected that name in five states",
      match("COSTCO WHOLESALE CORPORATION", "NJ", spread={"costco wholesale": 30}) == "costco-wholesale-corporation")
check("but not when the name is in fewer states", match("COSTCO WHOLESALE CORPORATION", "NJ", spread={"costco wholesale": 3}) is None)
check("and never as a bare brand", match("COSTCO WHOLESALE", "NJ", spread={"costco wholesale": 30}) is None)
check("a sponsor under the big-sponsor size gets no spread rule",
      match("JOHNSON CONTROLS, INC.", "NV", spread={"johnson controls": 30}) is None)
check("a one-word name doesn't join a smaller sponsor, even in its state", match("LINDE CORPORATION", "PA") is None)
check("a smaller sponsor takes an inspection in a state it files in", match("Johnson Controls, Inc.", "FL") == "johnson-controls-inc")
check("and not one in a state it never filed in", match("Johnson Controls, Inc.", "NV") is None)
check("a name no sponsor holds joins nothing", match("Nobody Anywhere LLC", "FL") is None)
check("an empty name joins nothing", match("", "FL") is None)

z = archive(INSP_HEADER, [
    insp("100", "AMAZON.COM SERVICES LLC", "OH"),
    insp("101", "Johnson Controls, Inc.", "FL", closed=None, kind="M"),
    insp("102", "AMAZON.COM SERVICES LLC", "OH", opened="2015-05-01"),   # before SINCE
    insp("103", "AMAZON.COM SERVICES LLC", "OH", scope="D"),             # no inspection
    insp("104", "Nobody Anywhere LLC", "OH"),
])
keep, seen = o.inspections(z, match)
check("keeps joined inspections since SINCE, drops old, no-inspection and unjoined ones",
      sorted(keep) == ["100", "101"], str(sorted(keep)))
check("counts what it read", seen == {"inspections": 5, "recent": 3, "matched": 2}, str(seen))
check("an open inspection has no close date", keep["101"]["close_date"] is None)
check("the city reads in title case and the ZIP as five digits",
      keep["100"]["city"] == "Springfield" and keep["100"]["zip"] == "62701")
check("the byte-order mark is read off the first column", "100" in keep)

# The spread is counted over the file itself: a big sponsor's legal name inspected in five states joins out of state.
spread_file = archive(INSP_HEADER, [insp(str(200 + i), "COSTCO WHOLESALE CORPORATION", st) for i, st in enumerate(["NJ", "NY", "OR", "AZ", "TX"])]
                      + [insp("300", "BLUEBIRD CLEANING, LLC", "OH")])
wide, _ = o.inspections(spread_file, match)
check("the file's own spread lets a big sponsor's name in five states join, each one",
      sorted(wide) == ["200", "201", "202", "203", "204"], str(sorted(wide)))
narrow, _ = o.inspections(archive(INSP_HEADER, [insp("210", "COSTCO WHOLESALE CORPORATION", "NJ")]), match)
check("and a name inspected in one state doesn't", narrow == {}, str(sorted(narrow)))

items = o.add_violations(archive(VIOL_HEADER, [
    viol("100", "01001A", "S", "5000.00", "7000.00"),
    viol("100", "01001B", "S", "", "1000.00"),          # same group: counted once
    viol("100", "01002", "O", "0", "0"),
    viol("100", "02001", "W", "70000", "150000"),
    viol("100", "02002", "R", "1,200.50", "1,200.50"),
    viol("100", "01003", "S", "9999", "9999", deleted="X"),  # deleted by settlement
    viol("101", "01001", "U", "nan", ""),
    viol("999", "01001", "S", "100", "100"),             # an inspection not kept
]), keep)
a, b = keep["100"], keep["101"]
check("reads every violation item in the file", items == 8, str(items))
check("grouped items count once and a deleted one not at all", a["violations"] == 4, str(a["violations"]))
check("each type is counted", (a["serious"], a["willful"], a["repeat"], a["other"]) == (1, 1, 1, 1),
      str((a["serious"], a["willful"], a["repeat"], a["other"])))
check("penalties sum current and initial, a deleted item left out",
      (a["current_penalty"], a["initial_penalty"]) == (76200.5, 159200.5), str((a["current_penalty"], a["initial_penalty"])))
check("an unclassified violation counts as a violation of no listed type",
      b["violations"] == 1 and b["serious"] + b["willful"] + b["repeat"] + b["other"] == 0)
check("a penalty OSHA printed as nan reads as nothing", b["current_penalty"] == 0.0)

try:
    next(o.chunks(archive([h for h in VIOL_HEADER if h != "VIOL_TYPE"], []), o.VIOLATION_COLS))
    check("a missing column refuses the file", False)
except RuntimeError as exc:
    check("a missing column refuses the file", "VIOL_TYPE" in str(exc))
except StopIteration:
    check("a missing column refuses the file", False, "read on with the column missing")
check("the file date comes from the chunk's name", dol.file_date(z.namelist()) == "2026-10-31")
check("every kept row has a value for every column", all(set(o.COLS) <= set(r) for r in keep.values()))

print(f"\n{len(failures)} failure(s)" if failures else "\nall passed")
sys.exit(1 if failures else 0)
