#!/usr/bin/env python3
"""Whether a run of oracle-deploy.yml builds the site, and whether it ships it.

WHY THE SITE GOES LIVE AT NIGHT. Every deploy starts the page cache empty, and
Googlebot and the AI search crawlers keep asking while it refills, so each page
is built again on two CPUs (Oracle's free plan allows 2 for the whole account).
Measured Oct 18 2026: 8 of the 13 people shown the "busy" page in 36 hours came
within an hour of a deploy, and Saturday had 15 deploys. So (owner's call, Oct 18):

  a push outside the night window   builds (a broken build shows in the day) and holds
  a push inside it (1 to 5 AM ET)   builds and ships
  the 2 AM run (`when=night`)       ships main if the site changed since what's live
  a hand dispatch (`when=now`)      builds and ships at once: the way out for an urgent fix

Nothing builds when nothing the site is built from changed since the live
commit, unless the run was asked for `now`.

The live commit comes from the server (`permtracker-deploy status`), because
a successful run no longer means a deploy: a held push succeeds too.

    python3 scripts/deploy_plan.py   # reads EVENT, WHEN, STATUS_FILE, PUSH_BEFORE; writes GITHUB_OUTPUT
"""
from __future__ import annotations

import datetime
import os
import re
import subprocess
import sys
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
# Ships from 1:00 to 4:59 AM Eastern, the hours with the fewest people on the
# site, so a cold page cache meets crawlers more than visitors.
NIGHT_HOURS = range(1, 5)
# Eastern clock time the night run starts (the server's
# permtracker-cron@dispatch-night-deploy timer, 06:00 UTC: 2 AM EDT, 1 AM EST).
NIGHT_RUN = "about 2 AM Eastern (1 AM in winter)"

# The files a site build reads: oracle-deploy.yml's `paths`, entry for entry
# (test_deploy_plan.py holds them equal), read as GitHub reads them: in order,
# the last pattern that matches a file deciding, a leading "!" leaving it out.
PATHS = [
    "**",
    "!**/*.md",
    "!v2/scripts/**",
    "!v2/workers/**",
    "!v2/**/__tests__/**",
    "!v2/**/*.test.ts",
    "!v2/**/*.test.tsx",
    "!.planning/**",
    "!docs/**",
    "!v2/docs/**",
    "!.github/**",
    ".github/workflows/oracle-deploy.yml",
]


def glob_re(pattern: str) -> re.Pattern[str]:
    """GitHub's path glob: `**` crosses folders, `*` stays inside one."""
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out += r"(?:.*/)?"
            i += 3
        elif pattern.startswith("**", i):
            out += r".*"
            i += 2
        elif pattern[i] == "*":
            out += r"[^/]*"
            i += 1
        else:
            out += re.escape(pattern[i])
            i += 1
    return re.compile(out + r"\Z")


PATH_RES = [(not p.startswith("!"), glob_re(p.lstrip("!"))) for p in PATHS]


def site_changes(files: list[str]) -> list[str]:
    """The changed files a build of the site reads."""
    def counts(f: str) -> bool:
        keep = False
        for include, rx in PATH_RES:
            if rx.match(f):
                keep = include
        return keep
    return [f for f in files if f and counts(f)]


def live_release(status: str) -> str | None:
    """The live commit's short hash from `permtracker-deploy status`, or None.

    It prints `active: <slot>` and then `<slot>: <release> <state>` per copy,
    the release named `<12-char sha>-<run number>`."""
    m = re.search(r"^active:\s*(\S+)\s*$", status, re.M)
    if not m:
        return None
    line = re.search(rf"^{re.escape(m.group(1))}:\s*([0-9a-f]{{7,40}})(?:-\d+)?(?:\.w2)?(?:\s|$)", status, re.M)
    return line.group(1) if line else None


def plan(event: str, when: str, hour: int, changed: list[str] | None) -> tuple[bool, bool, str]:
    """(build, ship, reason). `changed` is every file changed since the live
    commit, or None when the live commit couldn't be read."""
    if event == "workflow_dispatch" and when != "night":
        return True, True, "asked for now: ships as soon as the tests pass"
    if changed is not None and not site_changes(changed):
        return False, False, "nothing the site is built from changed since the live commit"
    if event == "workflow_dispatch":
        return True, True, "the night run: ships what changed since the live commit"
    if hour in NIGHT_HOURS:
        return True, True, "a push inside the night window (1 to 5 AM Eastern): ships now"
    return True, False, f"held for the night run, {NIGHT_RUN}"


def git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=False).stdout.strip()


def main() -> int:
    event = os.environ.get("EVENT", "")
    when = os.environ.get("WHEN", "") or "now"
    status = ""
    path = os.environ.get("STATUS_FILE", "")
    if path and os.path.exists(path):
        status = open(path).read()
    short = live_release(status)
    live = git("rev-parse", "--verify", "--quiet", f"{short}^{{commit}}") if short else ""
    changed = git("diff", "--name-only", "--no-renames", live, "HEAD").splitlines() if live else None
    hour = datetime.datetime.now(ET).hour
    build, ship, reason = plan(event, when, hour, changed)
    since = live or os.environ.get("PUSH_BEFORE", "")
    print(f"live now: {live[:12] or 'unknown'}; {len(site_changes(changed)) if changed is not None else 'unknown'} "
          f"site files changed since; {reason}")
    if build and not ship:
        print(f"::notice::Built, not shipped: {reason}.")
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as fh:
            fh.write(f"build={'true' if build else 'false'}\nship={'true' if ship else 'false'}\nsince={since}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
