#!/usr/bin/env python3
"""daily_monitor.py: the pure parts, and the one rule that keeps it safe in a
public repository (stdout carries status words, never a figure).

    python3 scripts/test_daily_monitor.py
"""
from __future__ import annotations

import contextlib
import io
import json
import pathlib
import re
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import daily_monitor as dm  # noqa: E402

FAILS: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        FAILS.append(msg)


def main() -> int:
    # The ranking is shared with convex/lib/dailyReportCompose.ts.
    ts = (HERE.parent / "convex" / "lib" / "dailyReportCompose.ts").read_text()
    ts_rank = dict(re.findall(r"^\s{2}(\w+): (\d),$", ts, re.M))
    check({k: int(v) for k, v in ts_rank.items()} == dm.RANK, f"RANK matches STATUS_RANK in TypeScript ({ts_rank})")
    check(dm.worst(["ok", "off"]) == "off" and dm.worst(["warn", "fail"]) == "fail" and dm.worst([]) == "ok",
          "worst() picks the worst status")

    runs = [
        {"name": "Case status (direct from DOL)", "status": "completed", "conclusion": "failure", "run_attempt": 1},
        {"name": "Case status (direct from DOL)", "status": "completed", "conclusion": "success", "run_attempt": 2},
        {"name": "Tests", "status": "completed", "conclusion": "cancelled", "run_attempt": 1},
        {"name": "Tests", "status": "in_progress", "conclusion": None, "run_attempt": 1},
    ]
    by = dm.summarize_runs(runs)
    check(by["Case status (direct from DOL)"] == {"runs": 2, "failed": 1, "cancelled": 0, "reruns": 1, "running": 0},
          "a failure and a re-run are both counted")
    check(by["Tests"]["cancelled"] == 1 and by["Tests"]["running"] == 1, "cancelled and still-running are told apart")
    check(dm.summarize_runs([{"name": "npm_and_yarn in /v2 for next - Update #1", "status": "completed"}]) == {},
          "Dependabot version-update runs are left out")
    check(dm.et_time("2026-09-27T19:54:52+00:00") == "Sep 27, 3:54 PM EDT"
          and dm.et_time("2026-12-01T12:00:00Z") == "Dec 1, 7:00 AM EST" and dm.et_time("x") is None,
          "times read in Eastern, 12-hour, with the zone")
    check(all(w in dm.DATA_WORKFLOWS for w in ["Case status (direct from DOL)", "Ingest health"]),
          "the data workflows are named as the YAML names them")
    names = {m.group(1).strip().strip('"') for f in (HERE.parent.parent / ".github" / "workflows").glob("*.yml")
             for m in [re.search(r"^name:\s*(.+)$", f.read_text(), re.M)] if m}
    missing = sorted(dm.DATA_WORKFLOWS - names)
    check(not missing, f"every DATA_WORKFLOWS name exists as a workflow (missing: {missing})")

    check(dm.spike_note(210, [100, 90, 110, 100], "rows") is not None, "a day at 2.1x the median is unusual")
    check(dm.spike_note(150, [100, 90, 110, 100], "rows") is None, "a day at 1.5x is not")
    check(dm.spike_note(40, [100, 90, 110], "views") is None, "a fall is ignored unless asked for")
    check(dm.spike_note(40, [100, 90, 110], "views", drop=True) is not None, "a fall is flagged for traffic")
    check(dm.spike_note(500, [100, 100], "rows") is None, "two prior days are not a baseline")

    check(dm.turso_cost(2_500_000_000, 25_000_000) == 0, "usage inside the plan costs nothing")
    check(abs(dm.turso_cost(110_896_118_519, 59_727_078) - 143.12) < 0.01,
          "the Sep 27 cycle reproduces the $143.12 the report printed")

    out = ("datasets registered : 40\n::warning::i485-inventory is 53 days old against a 45-day budget\n"
           "ok row\nOUR INGEST HAS STOPPED for: lca-status (has not RUN).\n")
    lines = dm.health_lines(out)
    check(lines == ["Watching: i485-inventory is 53 days old against a 45-day budget",
                    "OUR INGEST HAS STOPPED for: lca-status (has not RUN)."], f"health lines kept: {lines}")

    # stdout: one status word per section, nothing numeric.
    fake = {"day": "2026-09-28", "generatedAt": 1, "sections": [
        dm.section("turso", "Turso", "warn", "$143.12 over so far", ["9.29B rows read"]),
        dm.section("site", "Site", "ok", "8 of 8", [])]}
    orig = dm.build
    dm.build = lambda now: fake
    buf = io.StringIO()
    with tempfile.TemporaryDirectory() as d, contextlib.redirect_stdout(buf):
        sys.argv = ["daily_monitor.py", "--out", str(pathlib.Path(d) / "r.json")]
        dm.main()
        written = json.loads((pathlib.Path(d) / "r.json").read_text())
    dm.build = orig
    printed = buf.getvalue()
    check(printed.strip() == "turso=warn site=ok", f"stdout is status words only: {printed!r}")
    check(not re.search(r"\d", printed), "no digit reaches the public log")
    check(written == fake, "the full report goes to the file")

    print(f"\n{len(FAILS)} failure(s)")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
