#!/usr/bin/env python3
"""Every check in the repository is run by something, or says why it isn't.

On Oct 25 2026 twelve page audits, the phone-width sweep, axe, eslint and the
browser flows turned out to run nowhere: each was run by hand when someone
remembered. Two had broken unseen (the registration audit crashed on a file moved
Oct 1; the staleness audit read a Convex function deleted Oct 1 and printed
"skipped" while passing), and the browser flows had gone stale.

A check here is a file whose job is to find something wrong: scripts/audit_*,
scripts/check_*, the phone sweep, the browser flows, and the server's own jobs.
Each must be named by a runner (a workflow, scripts/check.sh,
scripts/page_checks.py, a server unit or script, the cron dispatcher's table)
or be listed in HAND_ONLY with the reason it runs by hand. Adding a check
without wiring it fails CI, and so does a HAND_ONLY entry for a file that's gone.

    python3 scripts/test_check_registry.py
"""
from __future__ import annotations

import pathlib
import re
import sys

V2 = pathlib.Path(__file__).resolve().parent.parent
REPO = V2.parent

# The files that run things. package.json is not one: a script there runs only
# when someone types it.
RUNNERS = [
    *sorted((REPO / ".github" / "workflows").glob("*.yml")),
    V2 / "scripts" / "check.sh",
    V2 / "scripts" / "page_checks.py",
    V2 / "src" / "app" / "api" / "cron" / "dispatch" / "jobs.ts",
    *sorted(p for p in (V2 / "scripts" / "oracle" / "systemd").rglob("*") if p.is_file()),
    *sorted(p for p in (V2 / "scripts" / "oracle" / "bin").iterdir() if p.is_file()),
]

# Run by hand on purpose, each with its reason. Keep this short.
HAND_ONLY = {
    "scripts/audit_visible_text.py": "a measurement for design work (words a reader faces against the DOM, prose "
    "against data); it has no pass or fail",
    "scripts/oracle/bin/permtracker-db-compact": "the database's offline compaction, run once by hand in the night "
    "window when the data file has shrunk (Oct 21 2026); never on a timer",
    "scripts/oracle/bin/permtracker-db-stats": "prints the database's costliest statements for a person reading them",
    "run-e2e-tests.sh": "starts a local server and runs the browser flows against it; the same flows run each "
    "morning against the live site (scripts/page_checks.py)",
}


# Workflows that start only by hand, on purpose, each with its reason (each says so in its own header too).
MANUAL_WORKFLOWS = {
    "dol-perm-files.yml": "fetches DOL's newest PERM workbooks for the owner's Mac on request",
    "perm-history-ingest.yml": "loads DOL's closed years once; run again only to retry a year that failed",
    "indexnow.yml": "the full send of every URL, allowed only after a migration; deploys send changed pages",
    "social-post.yml": "a scaffold that posts nothing until the X and LinkedIn credentials exist",
    "watched-cases.yml": "the hand-run fallback; the server checks watched cases every 5 minutes",
}


def triggers(text: str) -> list[str]:
    m = re.search(r"^on:[ \t]*\n((?:[ \t]+.*\n|[ \t]*\n)+)", text, re.M)
    if m:
        return re.findall(r"^  ([a-z_]+):", m.group(1), re.M)
    m = re.search(r"^on:\s*\[?([^\n\]]+)", text, re.M)
    return [k.strip() for k in m.group(1).split(",")] if m else []


def dispatched(name: str, texts: dict[str, str]) -> bool:
    jobs = texts.get("v2/src/app/api/cron/dispatch/jobs.ts", "")
    if re.search(rf'workflow:\s*"{re.escape(name)}"', jobs):
        return True
    for runner, text in texts.items():
        if runner.endswith("/" + name):
            continue
        code = "\n".join(ln for ln in text.splitlines() if not ln.lstrip().startswith("#"))
        if re.search(rf"(gh workflow run {re.escape(name)}|workflows/{re.escape(name)}/dispatches)", code):
            return True
    return False


def checks() -> list[str]:
    found = [
        *V2.glob("scripts/audit_*.py"),
        *V2.glob("scripts/audit_*.mjs"),
        *V2.glob("scripts/check_*.py"),
        V2 / "scripts" / "phone_sweep.mjs",
        V2 / "scripts" / "page_checks.py",
        V2 / "scripts" / "every_test_file_runs.mjs",
        V2 / "run-e2e-tests.sh",
        *V2.glob("tests/e2e/*.spec.ts"),
        *(p for p in (V2 / "scripts" / "oracle" / "bin").iterdir() if p.is_file()),
    ]
    return sorted({str(p.relative_to(V2)) for p in found if p.exists()})


def named_by_runner(check: str, texts: dict[str, str]) -> list[str]:
    name = pathlib.PurePath(check).name
    # The browser flows run as a whole through Playwright, which reads every spec in tests/.
    if check.startswith("tests/e2e/"):
        return [r for r, t in texts.items() if re.search(r"playwright[\"', ]+test", t)]
    pattern = re.compile(rf"(?<![\w.-]){re.escape(name)}(?![\w-])")
    return [r for r, t in texts.items() if not r.endswith("/" + name) and pattern.search(t)]


def main() -> int:
    texts = {str(p.relative_to(REPO)): p.read_text(errors="replace") for p in RUNNERS if p.exists()}
    found = checks()
    fails: list[str] = []
    print(f"{len(found)} checks found, {len(texts)} runner files read")
    if len(found) < 25 or len(texts) < 40:
        print("FAIL: too few checks or runners seen; the globs are wrong, so this can't judge")
        return 2
    for c in found:
        by = named_by_runner(c, texts)
        if by:
            continue
        if c in HAND_ONLY:
            print(f"  hand only: {c} ({HAND_ONLY[c]})")
            continue
        fails.append(f"nothing runs {c}: wire it into a runner (CI, check.sh, page_checks.py, a server unit) "
                     f"or list it in HAND_ONLY with the reason")
    for c in HAND_ONLY:
        if c not in found:
            fails.append(f"HAND_ONLY lists {c}, which no longer exists")
        elif named_by_runner(c, texts):
            fails.append(f"HAND_ONLY lists {c}, but a runner runs it now: take it off the list")
    workflows = sorted((REPO / ".github" / "workflows").glob("*.yml"))
    for w in workflows:
        on = triggers(w.read_text())
        if not on:
            fails.append(f"{w.name}: no triggers read; this test's parser is wrong for it")
        elif set(on) == {"workflow_dispatch"} and not dispatched(w.name, texts):
            if w.name in MANUAL_WORKFLOWS:
                print(f"  by hand: {w.name} ({MANUAL_WORKFLOWS[w.name]})")
            else:
                fails.append(f"{w.name} starts only by hand and nothing dispatches it: give it a schedule, add it to "
                             f"the cron dispatcher (jobs.ts), or list it in MANUAL_WORKFLOWS with the reason")
    for name in MANUAL_WORKFLOWS:
        if not (REPO / ".github" / "workflows" / name).exists():
            fails.append(f"MANUAL_WORKFLOWS lists {name}, which no longer exists")
        elif dispatched(name, texts):
            fails.append(f"MANUAL_WORKFLOWS lists {name}, but something dispatches it now: take it off the list")
    for f in fails:
        print("FAIL " + f)
    if not fails:
        print("PASS every check is run by something or says why not")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
