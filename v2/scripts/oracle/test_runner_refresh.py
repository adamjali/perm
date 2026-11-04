#!/usr/bin/env python3
"""Every runner case whose script asks the site to rebuild pages sets the refresh secret first.

    python3 scripts/oracle/test_runner_refresh.py

A reader that refreshes pages (lib_policy_feed.expire_policy_page, or REVALIDATE_SECRET read directly) takes a
missing secret for a local run and asks nothing, with no error. The embassy and visa news loads did exactly that
on Nov 4 2026: their rows were written and the pages kept the old render. `bin/permtracker-uscis` sets the
secret with `site_refresh_env`; this reads each `case` branch and the scripts it runs.
"""
from __future__ import annotations

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.dirname(os.path.dirname(HERE))
RUNNER = os.path.join(HERE, "bin", "permtracker-uscis")
FAILS: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def refreshes(script: str) -> bool:
    """Whether a data script asks the site to rebuild pages, itself or through the policy feed's helper."""
    path = os.path.join(V2, "scripts", script)
    if not os.path.exists(path):
        return False
    src = open(path, encoding="utf-8").read()
    return "expire_policy_page(" in src or "REVALIDATE_SECRET" in src


def branches(src: str) -> dict[str, str]:
    """The runner's top-level `case "$job"` branches: name -> body."""
    body = src[src.index('case "$job" in'):]
    out: dict[str, str] = {}
    # A top-level branch starts at two spaces of indent with `name)` and runs to the next one.
    starts = [(m.group(1), m.start()) for m in re.finditer(r"^  ([a-z0-9-]+)\)", body, re.M)]
    for i, (name, at) in enumerate(starts):
        end = starts[i + 1][1] if i + 1 < len(starts) else len(body)
        out[name] = body[at:end]
    return out


def unguarded(src: str) -> list[str]:
    """Branches that run a refreshing script without `site_refresh_env` (or the old inline export)."""
    bad = []
    for name, body in branches(src).items():
        scripts = set(re.findall(r"scripts/([a-z0-9_]+\.py)", body))
        # state-page names its script in a variable.
        scripts |= set(re.findall(r"\bs=([a-z0-9_]+\.py)", body))
        if any(refreshes(s) for s in scripts) and "site_refresh_env" not in body and "export REVALIDATE_SECRET" not in body:
            bad.append(name)
    return bad


def main() -> int:
    src = open(RUNNER, encoding="utf-8").read()
    found = branches(src)
    check("the runner's branches are read (control)", {"embassy-notices", "state-page", "policy-watch", "whd"} <= set(found),
          str(sorted(found))[:300])
    check("a script known to refresh is seen as refreshing (control)", refreshes("ingest_embassy_notices.py"))
    check("every branch whose script refreshes pages sets the secret first", unguarded(src) == [], str(unguarded(src)))
    # Probe: the embassy branch with its helper call removed must be caught.
    probe = src.replace("    site_refresh_env\n    if ! timeout 10m python3 scripts/ingest_embassy_notices.py",
                        "    if ! timeout 10m python3 scripts/ingest_embassy_notices.py")
    check("a branch that drops the helper is caught (probe)", probe != src and "embassy-notices" in unguarded(probe))
    check("the helper sets both settings", re.search(
        r"site_refresh_env\(\)\{[\s\S]*?export REVALIDATE_BASE=[\s\S]*?export REVALIDATE_SECRET[\s\S]*?\}", src) is not None)
    print(f"\n{len(FAILS)} failed" if FAILS else "\nall passed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
