#!/usr/bin/env python3
"""Every check that reads rendered pages, run against the live site each morning.

These checks existed and nothing ran them: each was run by hand when someone
remembered, so a page could break the day after its last run and stay broken.
Found Oct 25 2026, when the browser flows had gone stale for weeks unnoticed. The
morning report's workflow (daily-monitor.yml) runs this first, after the night
deploy, and the report prints one line per check ("The live pages, checked").

    python3 scripts/page_checks.py --base https://permtracker.app --out checks.json
    python3 scripts/page_checks.py --only glued,headings   # a few, by key

Each check is a separate command with its own time limit. A check that fails,
times out or can't start is a failure: a check that didn't run never reads as a
pass. The JSON holds, per check, whether it passed, its exit code, how long it
took and the last lines it printed. Everything it reads is public pages, so its
output is safe in the public Actions log.

Which checks run nowhere else, and why some run only by hand, is listed in
scripts/test_check_registry.py, which fails on a check that nothing runs.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# One page per kind of page, for the browser checks. Each loads in two widths
# (and axe in two themes), so this stays short: never production in bulk.
PAGES = [
    "/",
    "/perm-case-status",
    "/perm-queue",
    "/perm-by-the-numbers",
    "/layoffs",
    "/visa-bulletin",
    "/perm-employers/google-llc",
    "/perm-processing-times",
    "/tools/perm-deadline-calculator",
    "/h1b-employers",
    "/guides/getting-started",
    "/case-search",
]


def checks(base: str) -> list[dict]:
    py = sys.executable
    return [
        {"key": "glued", "title": "Words run together", "cmd": [py, "scripts/audit_glued_text.py", "--base", base], "limit": 600},
        {"key": "hidden", "title": "Content hidden until scripts run", "cmd": [py, "scripts/audit_ssr_visibility.py", "--base", base, "--limit", "150"], "limit": 600},
        {"key": "headings", "title": "Headings", "cmd": [py, "scripts/audit_headings.py", "--base", base], "limit": 600},
        {"key": "pages", "title": "Titles, descriptions, canonicals, dates", "cmd": [py, "scripts/audit_all_pages.py", "--base", base], "limit": 900},
        {"key": "links", "title": "Internal links", "cmd": [py, "scripts/audit_internal_links.py", "--base", base, "--pages", "40"], "limit": 900},
        # Not a page check, but it needs the public database's credentials, which this job has: figures
        # typed into the copy with no date beside them go stale when DOL's next file loads.
        {"key": "figures", "title": "Figures typed into the copy", "cmd": [py, "scripts/audit_staleness.py"], "limit": 300},
        {"key": "axe", "title": "Accessibility (axe, WCAG AA)", "cmd": ["node", "scripts/audit_axe.mjs", base, *PAGES], "limit": 900},
        {"key": "phone", "title": "Phone widths (overflow, text size, tap size)", "cmd": ["node", "scripts/phone_sweep.mjs", base, *PAGES], "limit": 600,
         # A page with nothing wrong prints a line too; the report keeps the lines with findings.
         "clean": r"overflow=0px\s+small=0\s+taps=0\s*$"},
        {
            "key": "flows",
            "title": "Browser flows (Playwright)",
            "cmd": ["pnpm", "exec", "playwright", "test", "--reporter=line"],
            "env": {"BASE_URL": base},
            "limit": 900,
        },
    ]


def run(check: dict) -> dict:
    started = time.monotonic()
    env = {**os.environ, **check.get("env", {})}
    try:
        done = subprocess.run(check["cmd"], cwd=ROOT, env=env, capture_output=True, text=True, timeout=check["limit"])
        code = done.returncode
        out = (done.stdout or "") + (done.stderr or "")
    except subprocess.TimeoutExpired as e:
        code = -1
        out = ((e.stdout or b"").decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or "")) + f"\ntimed out after {check['limit']} s"
    except OSError as e:
        code = -2
        out = f"could not start: {e}"
    lines = [ln.rstrip() for ln in out.splitlines() if ln.strip()]
    # A failing check's report keeps its findings, not merely its last lines:
    # the phone sweep prints a line for every page at both widths, and on Oct 26
    # 2026 its last 12 lines were the clean 320 pass while the problem sat at 390.
    if code != 0 and check.get("clean"):
        lines = [ln for ln in lines if not re.search(check["clean"], ln)] or lines
    return {
        "key": check["key"],
        "title": check["title"],
        "ok": code == 0,
        "exit": code,
        "seconds": round(time.monotonic() - started),
        "tail": [ln[:300] for ln in lines[-12:]],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://permtracker.app")
    ap.add_argument("--out", default=None)
    ap.add_argument("--only", default="", help="comma-separated keys")
    args = ap.parse_args()
    wanted = {k for k in args.only.split(",") if k}
    todo = [c for c in checks(args.base.rstrip("/")) if not wanted or c["key"] in wanted]
    if wanted and len(todo) != len(wanted):
        print(f"unknown check key(s): {sorted(wanted - {c['key'] for c in todo})}", file=sys.stderr)
        return 2
    results = []
    for c in todo:
        r = run(c)
        results.append(r)
        print(f"{'pass' if r['ok'] else 'FAIL'}  {r['key']}  ({r['seconds']} s, exit {r['exit']})", flush=True)
        if not r["ok"]:
            for ln in r["tail"]:
                print(f"    {ln}")
    doc = {"base": args.base, "checkedAt": int(time.time() * 1000), "checks": results}
    if args.out:
        Path(args.out).write_text(json.dumps(doc))
    failed = sum(1 for r in results if not r["ok"])
    print(f"{len(results) - failed} of {len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
