#!/usr/bin/env python3
"""The pure parts of the PWD ingest: day codes, serials, batching, finality.

    python3 scripts/test_pwd_status.py
"""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from ingest_pwd_status_direct import (  # noqa: E402
    BATCH, PREFIX, PWD_FINAL, RESUME_QUIET_HOURS, candidate_batches, day_code,
    is_final, resume_decision, serial_of,
)

FAILURES: list[str] = []


def check(name: str, got, want) -> None:
    if got == want:
        print(f"  ok   {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL {name}\n         got  {got!r}\n         want {want!r}")


def main() -> int:
    print("pwd status ingest")
    # The day code is YYDDD from a real date, year boundary included.
    check("day code for 2026-08-28 is 26240", day_code(datetime.date(2026, 8, 28)), "26240")
    check("day code for 2026-01-01 is 26001", day_code(datetime.date(2026, 1, 1)), "26001")
    check("day code for 2025-12-31 is 25365", day_code(datetime.date(2025, 12, 31)), "25365")

    # The serial is the last segment, for either prefix.
    check("serial of a P- number", serial_of("P-100-26240-200135"), 200135)
    check("serial of a G- number", serial_of("G-100-26240-200246"), 200246)
    check("serial of junk is None", serial_of("A-23043-00641"), None)

    # Batching skips serials already held and never exceeds the DOL ceiling.
    batches = list(candidate_batches("26240", 1, 120, known={5, 6, 7}))
    flat = [n for b in batches for n in b]
    check("batches never exceed the ceiling", max(len(b) for b in batches), BATCH)
    check("known serials are skipped", all(f"{PREFIX}26240-{s}" not in flat for s in (5, 6, 7)), True)
    check("every other serial is present exactly once", len(flat), 117)
    # Padded: DOL issues "P-100-26240-000001". Bare "-1" was a number DOL had
    # never seen, which is why the post-wrap half of June 2026 stayed empty.
    check("candidates carry the P- prefix, the day code and a padded serial", flat[0], "P-100-26240-000001")

    # Finality: the observed vocabulary, and unknown statuses stay pending.
    check("issued is final", is_final("DETERMINATION ISSUED"), 1)
    check("in process is pending", is_final("IN PROCESS"), 0)
    check("case and whitespace do not matter", is_final("  withdrawn "), 1)
    check("an unseen status is pending, not final", is_final("CENTER DIRECTOR REVIEW"), 0)
    check("the final set names the observed outcomes",
          {"DETERMINATION ISSUED", "REDETERMINATION AFFIRMED", "REDETERMINATION MODIFIED",
           "WITHDRAWN"} <= PWD_FINAL, True)

    print("backfill resumer")
    H = 3_600_000
    now = 1_788_800_000_000
    doc = {"lastDayDone": "26194", "from": "2026-06-10", "to": "2026-09-08", "complete": False}
    check("no record: noop", resume_decision({}, None, now)[0], "noop")
    check("complete: noop", resume_decision({**doc, "complete": True}, None, now)[0], "noop")
    check("no range recorded (pre-resumer doc): noop",
          resume_decision({"lastDayDone": "26194"}, None, now)[0], "noop")
    check("a leg ran 2h ago: noop, the chain is alive",
          resume_decision(doc, now - 2 * H, now)[0], "noop")
    check("a leg ran just inside the quiet window: still noop",
          resume_decision(doc, now - (RESUME_QUIET_HOURS * H - 1), now)[0], "noop")
    check("a leg ran 26h ago and the range is incomplete: dispatch",
          resume_decision(doc, now - 26 * H, now)[0], "dispatch")
    check("no leg ever recorded but a range exists: dispatch",
          resume_decision(doc, None, now)[0], "dispatch")
    check("the dispatch reason names the frontier and the target",
          resume_decision(doc, None, now)[1], "incomplete: last day done 26194, target 2026-09-08")

    print()
    if FAILURES:
        print(f"{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
