#!/usr/bin/env python3
"""daily_monitor.py: the pure parts, and the one rule that keeps it safe in a
public repository (stdout carries status words, never a figure).

    python3 scripts/test_daily_monitor.py
"""
from __future__ import annotations

import contextlib
import datetime as dt
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
    import inspect
    check("toDate(toTimeZone(" in inspect.getsource(dm.traffic_section),
          "the traffic query shifts the zone before toDate (HogQL's toDate takes one argument)")
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

    # The server section: judge the doc the server writes every 10 minutes.
    now = dt.datetime(2026, 9, 28, 11, 30, tzinfo=dt.timezone.utc)
    now_ms = int(now.timestamp() * 1000)

    def doc(**over):
        d = {"at": "2026-09-28T11:25:00Z",
             "now": {"cpuPct": 3.0, "memPct": 35.0, "diskPct": 15.0, "dbBytes": 6_500_000_000},
             "idle": {"hours": 168, "cpuP95": 6.0, "memP95": 36.0, "memMin": 33.0},
             "backup": {"lastOk": {"at": "2026-09-28T07:16:00Z"}, "count": 7,
                        "offsiteOk": {"at": "2026-09-28T07:18:00Z"},
                        "restoreOk": {"at": "2026-09-02T09:40:00Z", "tables": 44, "rows": 6_509_035}},
             "services": {u: "active" for u in ["permtracker-db", "permtracker-dbcache", "permtracker-web@blue",
                                                "permtracker-web@green", "nginx", "cloudflared"]},
             "failedUnits": [], "slot": {"active": "blue", "release": "abc-1"}}
        for k, v in over.items():
            d[k] = {**d[k], **v} if isinstance(d.get(k), dict) and isinstance(v, dict) else v
        return d

    v = dm.server_verdict
    check(v(None, now_ms)["status"] == "off", "no doc: the section is off, not a failure")
    check(v(doc(), now_ms)["status"] == "ok", "a healthy server reads ok")
    check(v(doc(at="2026-09-28T09:00:00Z"), now_ms)["status"] == "fail", "a server silent for 2.5 h fails")
    check(v(doc(services={"nginx": "failed"}), now_ms)["status"] == "fail", "nginx down fails")
    check(v(doc(services={"permtracker-web@blue": "failed"}), now_ms)["status"] == "fail",
          "the LIVE copy down fails")
    check(v(doc(services={"permtracker-web@green": "inactive"}), now_ms)["status"] == "ok",
          "the idle copy down does not")
    check(v(doc(services={"permtracker-dbcache": "inactive"}), now_ms)["status"] == "warn",
          "the database falling out of memory warns")
    check(v(doc(idle={"memP95": 12.0, "cpuP95": 4.0}), now_ms)["status"] == "fail",
          "memory and CPU both under 20% for the window fails (Oracle can reclaim it)")
    check(v(doc(idle={"memP95": 22.0, "cpuP95": 4.0}), now_ms)["status"] == "warn", "under 25% warns")
    check(v(doc(idle={"memP95": 12.0, "cpuP95": 40.0}), now_ms)["status"] == "ok",
          "busy CPU keeps it above the line")
    check(v(doc(idle={"hours": 3, "memP95": 12.0, "cpuP95": 4.0}), now_ms)["status"] == "ok",
          "three hours of samples is not a window")
    check(v(doc(backup={"lastOk": {"at": "2026-09-27T03:00:00Z"}}), now_ms)["status"] == "warn",
          "a 32 h old backup warns")
    check(v(doc(backup={"lastOk": {"at": "2026-09-26T03:00:00Z"}}), now_ms)["status"] == "fail",
          "a 56 h old backup fails")
    check(v(doc(backup={"lastOk": None}), now_ms)["status"] == "fail", "no backup fails")
    # The off-site copy (R2) and the monthly restore test.
    check(v(doc(backup={"offsiteOk": None}), now_ms)["status"] == "fail",
          "no off-site copy fails, so a missing R2 key cannot read as fine")
    check(v(doc(backup={"offsiteOk": {"at": "2026-09-27T03:00:00Z"}}), now_ms)["status"] == "warn",
          "a 32 h old off-site copy warns")
    check(v(doc(backup={"offsiteOk": {"at": "2026-09-26T03:00:00Z"}}), now_ms)["status"] == "fail",
          "a 56 h old off-site copy fails")
    check(v(doc(backup={"restoreOk": None}), now_ms)["status"] == "warn",
          "an off-site copy never restore-tested warns")
    check(v(doc(backup={"restoreOk": {"at": "2026-08-10T09:40:00Z", "tables": 44, "rows": 6_500_000}}),
            now_ms)["status"] == "warn", "a restore test 49 days old warns")
    check(any("Off-site copy" in ln for ln in v(doc(), now_ms)["lines"]), "the report names the off-site copy")
    check(v(doc(backup={"offsiteOk": {"at": "2026-09-28T07:18:00Z", "bucketBytes": 8_600_000_000}}),
            now_ms)["status"] == "warn", "an R2 bucket past 8 GB warns")
    check(v(doc(backup={"offsiteOk": {"at": "2026-09-28T07:18:00Z", "bucketBytes": 9_700_000_000}}),
            now_ms)["status"] == "fail", "an R2 bucket about to pass the free 10 GB fails")
    check(v(doc(now={"diskPct": 85.0}), now_ms)["status"] == "warn", "disk over 80% warns")
    check("GB" in " ".join(v(doc(), now_ms)["lines"]) and "BB" not in " ".join(v(doc(), now_ms)["lines"]),
          "database size reads in GB")
    check("server" in inspect.getsource(dm.build), "build() includes the server section")
    rep = v(doc(repairCount24h=2, repairs24h=["2026-09-28T17:35:39Z web_blue: restarted"]), now_ms)
    check(rep["status"] == "warn" and any("Repair:" in ln for ln in rep["lines"]),
          "a watchdog repair in the last day warns and names it")
    check(v(doc(now={"dbBytes": 7_000_000_000, "dbDataBytes": 3_300_000_000}), now_ms)["status"] == "ok",
          "a database folder at 2.1x its data file is normal (one snapshot)")
    check(v(doc(now={"dbBytes": 11_000_000_000, "dbDataBytes": 3_300_000_000}), now_ms)["status"] == "warn",
          "past 3x its data file, the folder is growing and warns")

    print(f"\n{len(FAILS)} failure(s)")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
