#!/usr/bin/env python3
"""deploy_plan.py: when a run builds, when it ships, and how it reads the live commit."""
from __future__ import annotations

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import deploy_plan as dp  # noqa: E402

FAILS: list[str] = []


def check(ok: bool, what: str) -> None:
    print(("PASS " if ok else "FAIL ") + what)
    if not ok:
        FAILS.append(what)


def main() -> int:
    code = ["v2/src/app/page.tsx"]
    docs = ["v2/scripts/daily_monitor.py", "README.md", "v2/src/lib/__tests__/x.test.ts", ".planning/a.md"]

    # A push builds always; it ships only inside the night window.
    check(dp.plan("push", "", 14, code) == (True, False, dp.plan("push", "", 14, code)[2]), "a 2 PM push builds and holds")
    check(dp.plan("push", "", 2, code)[:2] == (True, True), "a 2 AM push ships")
    check(dp.plan("push", "", 0, code)[:2] == (True, False), "midnight is outside the window")
    check(dp.plan("push", "", 5, code)[:2] == (True, False), "5 AM is outside the window")
    check(dp.plan("push", "", 4, code)[:2] == (True, True), "4 AM is inside it")
    check(dp.plan("push", "", 14, None)[:2] == (True, False), "an unreadable live commit still builds a push")

    # The night run ships only what changed.
    check(dp.plan("workflow_dispatch", "night", 2, code)[:2] == (True, True), "the night run ships a code change")
    check(dp.plan("workflow_dispatch", "night", 2, docs)[:2] == (False, False), "and builds nothing for scripts and docs")
    check(dp.plan("workflow_dispatch", "night", 2, [])[:2] == (False, False), "or when the live commit is main")
    check(dp.plan("workflow_dispatch", "night", 2, None)[:2] == (True, True), "an unreadable live commit ships")
    check(dp.plan("workflow_dispatch", "night", 14, code)[:2] == (True, True), "a late night run still ships (it was asked for)")

    # Now means now, whatever the hour and whatever changed.
    for when in ("now", ""):
        check(dp.plan("workflow_dispatch", when, 14, docs)[:2] == (True, True), f"a hand dispatch ({when or 'no input'}) ships at once")

    # The ignore list is oracle-deploy.yml's paths-ignore, entry for entry.
    wf = open(os.path.join(HERE, "..", "..", ".github", "workflows", "oracle-deploy.yml")).read()
    block = wf[wf.index("paths-ignore:"):wf.index("workflow_dispatch:")]
    yml = re.findall(r'^\s*-\s*"([^"]+)"', block, re.M)
    check(yml == dp.IGNORED, f"the ignore list matches the workflow's paths-ignore ({len(yml)} entries)")

    # The globs, as GitHub reads them.
    check(dp.site_changes(docs) == [], "scripts, tests, planning and markdown are not the site")
    check(dp.site_changes(["v2/src/a.ts", "README.md", "v2/convex/x.ts"]) == ["v2/src/a.ts", "v2/convex/x.ts"], "code and Convex are")
    check(dp.site_changes(["v2/scriptsx/a.ts"]) == ["v2/scriptsx/a.ts"], "a folder named like scripts is not scripts")
    check(dp.site_changes(["v2/src/a.test.tsx", "v2/src/a.tsx"]) == ["v2/src/a.tsx"], "a test file is not the page beside it")
    check(dp.site_changes([".github/workflows/oracle-deploy.yml"]) == [".github/workflows/oracle-deploy.yml"],
          "the deploy workflow itself counts")

    # The live commit, from the server's own answer.
    status = ("active: blue\nblue: 0f8583afce3b-207 active\nblue2: 0f8583afce3b-207.w2 active\n"
              "green: d3dbc150f241-206 active\ngreen2: d3dbc150f241-206.w2 inactive\n")
    check(dp.live_release(status) == "0f8583afce3b", "the live slot's release, not the standby's")
    check(dp.live_release(status.replace("active: blue", "active: green")) == "d3dbc150f241", "after a rollback, the other slot")
    check(dp.live_release("") is None and dp.live_release("Permission denied") is None, "no answer is unknown, not a commit")

    print(f"\n{len(FAILS)} failure(s)")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
