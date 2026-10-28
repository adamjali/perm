"""build_eb_split: the EB-2 bar from a job's own requirements."""
from __future__ import annotations

import sys

import build_eb_split as B

FAILS = []


def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        FAILS.append(name)


check("a master's meets the bar", B.eb2_bar("Master's", None, None, None) is True)
check("a bachelor's and five years meets it", B.eb2_bar("Bachelor's", "60", None, None) is True)
check("a bachelor's and four years doesn't", B.eb2_bar("Bachelor's", "48", None, None) is False)
check("a bachelor's with no experience doesn't", B.eb2_bar("Bachelor's", None, None, None) is False)
check("an associate's doesn't", B.eb2_bar("Associate's", "120", None, None) is False)
check("a doctorate or a JD meets it", B.eb2_bar("Doctorate (PhD)", None, None, None) and B.eb2_bar("Other degree (JD, MD, etc.)", None, None, None))
check("a master's or a bachelor's and five years: still the bar", B.eb2_bar("Master's", None, "Bachelor's", "60") is True)
check("a master's or a bachelor's and two years: the minimum is below it", B.eb2_bar("Master's", None, "Bachelor's", "24") is False)
check("DOL's file printed 'None' for no alternative", B.eb2_bar("Master's", None, "None", None) is True)
check("no requirement in the file: unknown", B.eb2_bar(None, None, None, None) is None)
check("a year of determinations, from the first of the month", B.window_start("2026-06-30") == "2025-07-01")
s = B.summarize([("Master's", None, None, None), ("Bachelor's", "24", None, None), (None, None, None, None)], "2025-07-01", "2026-06-30")
check("the split counts each", (s["requests"], s["eb2"], s["eb3"], s["unknown"]) == (3, 1, 1, 1))

sys.exit(1 if FAILS else 0)
