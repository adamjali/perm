"""lib_perm_line holds the same rule as src/lib/permLine.ts: the shared fixture and the two constants."""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import lib_perm_line as pl  # noqa: E402

fails = 0


def check(name: str, ok: bool) -> None:
    global fails
    print(("ok   " if ok else "FAIL ") + name)
    if not ok:
        fails += 1


for case in json.loads((HERE / "fixtures/perm_line.json").read_text())["cases"]:
    check(case["name"], pl.perm_line_month(case["matrix"]) == case["month"])

src = HERE.parent / "src/lib"
front = re.search(r"export const FRONT_MIN_CASES = (\d+)", (src / "liveQueue.ts").read_text())
below = re.search(r"export const WORKING_BELOW = ([\d.]+)", (src / "pwdLine.ts").read_text())
check("FRONT_MIN_CASES matches liveQueue.ts", bool(front) and int(front.group(1)) == pl.FRONT_MIN_CASES)
check("WORKING_BELOW matches pwdLine.ts", bool(below) and float(below.group(1)) == pl.WORKING_BELOW)

print("perm line:", "FAIL" if fails else "ok")
sys.exit(1 if fails else 0)
