#!/usr/bin/env python3
"""Write a `failed` row to the ingest audit trail from a workflow's failure hook.

    python3 scripts/record_ingest_failure.py \
        --script ingest_case_status_direct.py --status failed \
        --note "full pass: step failed, run <url>"

WHY A SEPARATE ENTRY POINT. The ingest scripts now record their own outcome,
including a `partial` when some tail step failed. What they cannot record is a
death that leaves no Python running: `timeout 105m` firing (exit 124), the
runner being reclaimed, a `SystemExit` from a shape assertion, or the job being
cancelled. Those are precisely the failures that today go entirely unnoticed -
GitHub sends nothing for a cancellation, and the Actions log ages out.

WHAT MAKES THIS VISIBLE rather than just recorded: `check_ingest_health.py`
reads `ingest_runs` at 10:00 UTC daily and exits non-zero when an ingest's most
recent run did not finish clean, which turns THAT scheduled run red and fires
GitHub's own notification. So this needs no new alerting service and no
credential the repo does not already hold - it rides `TURSO_AUTH_TOKEN`, which
every ingest workflow already has.

IT NEVER FAILS THE JOB. It is only ever running because something else already
failed, and a bookkeeping error on top of a real error is noise that buries the
signal. Every path here exits 0.
"""
from __future__ import annotations

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--script", required=True,
                    help="The ingest's filename, e.g. ingest_case_status_direct.py. "
                         "check_ingest_health.py keys on the filename, so this "
                         "must match what the script's own record_run writes.")
    ap.add_argument("--status", default="failed",
                    help="failed | cancelled. Anything but 'ok' trips the health check.")
    ap.add_argument("--note", default="", help="Mode, step and a link to the run.")
    args = ap.parse_args()

    if args.status == "ok":
        # A hook that could write 'ok' is a hook that can silence the check it
        # exists to feed. Refuse, loudly, without failing the job.
        print("::error::record_ingest_failure refuses to write status 'ok'")
        return 0

    try:
        from lib_turso import Turso, record_run
        record_run(Turso(), args.script, status=args.status,
                   note=args.note[:500])
        print(f"recorded {args.status} for {args.script}")
    except Exception as exc:  # noqa: BLE001 - see the docstring
        print(f"::warning::could not record the failure: "
              f"{type(exc).__name__}: {exc}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
