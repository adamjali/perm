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



def says(sec: dict) -> list[str]:
    """Everything a section says: its summary, then its lines (the lead warning
    is the summary and isn't repeated under it)."""
    return [sec["summary"], *sec["lines"]]

def check(ok: bool, msg: str, detail: str = "") -> None:
    print(("PASS " if ok else "FAIL ") + msg + ("" if ok or not detail else f"\n    {detail[:600]}"))
    if not ok:
        FAILS.append(msg)


def main() -> int:
    # The ranking is shared with convex/lib/dailyReportCompose.ts.
    ts = (HERE.parent / "convex" / "lib" / "dailyReportCompose.ts").read_text()
    ts_rank = dict(re.findall(r"^\s{2}(\w+): (\d),$", ts, re.M))
    check({k: int(v) for k, v in ts_rank.items()} == dm.RANK, f"RANK matches STATUS_RANK in TypeScript ({ts_rank})")
    check(dm.worst(["ok", "off"]) == "off" and dm.worst(["warn", "fail"]) == "fail" and dm.worst([]) == "ok",
          "worst() picks the worst status")

    # Page speed (bin/permtracker-perf writes perm_docs['server_perf'] hourly).
    pnow = 1_800_000_000_000
    healthy = {"computedAt": pnow - 600_000, "errors": {}, "day": {"runs": 24, "warnings": [], "failedRuns": 0},
               "pages": {"entityBuilds": {"n": 300, "p50": 0.34, "p90": 0.56}, "cached": {"n": 900, "p50": 0.016}},
               "preloads": {"share": 0.21, "requests": 30000},
               "profile": {"busyShare": 0.25, "seconds": 30, "self": [{"what": "Node (write)", "share": 0.15}],
                           "ours": [{"what": "src/lib/db/client.ts", "share": 0.02}]},
               "database": {"totalSeconds": 60.0, "top": [{"runs": 9000, "meanMs": 1.1, "sql": "SELECT slug"}]}}
    v = dm.perf_verdict(healthy, pnow)
    check(v["status"] == "ok" and "340 ms" in v["summary"], "perf: a healthy hour is OK and says the build time", str(v))
    check(any("busy 25%" in ln for ln in v["lines"]), "perf: the profile's busy share is reported", str(v["lines"]))
    check(dm.perf_verdict(None, pnow)["status"] == "warn", "perf: no readings at all is a warning")
    stale = dict(healthy, computedAt=pnow - 4 * 3_600_000)
    check(dm.perf_verdict(stale, pnow)["status"] == "fail", "perf: readings 4 hours old mean the job stopped: FAIL")
    hot = dict(healthy, day={"runs": 24, "warnings": ["src/lib/content/index.ts is under 75% of the copy's busy time."]})
    v = dm.perf_verdict(hot, pnow)
    check(v["status"] == "warn" and "index.ts" in v["summary"], "perf: a warning from any hour of the day is raised", str(v))
    # The real job keeps its time in perm_docs' computed_at column, not in the document (Oct 22 2026: the report
    # called fresh readings 497,963 hours old). Shaped like the real row: no computedAt inside.
    as_written = {k: v for k, v in healthy.items() if k != "computedAt"}
    check(dm.perf_verdict(dm.with_computed_at(as_written, str(pnow - 600_000)), pnow)["status"] == "ok",
          "perf: the time comes from the row's computed_at when the document has none")
    check(dm.with_computed_at(healthy, "1")["computedAt"] == healthy["computedAt"],
          "perf: a time inside the document wins over the column")
    check(dm.with_computed_at(as_written, None) == as_written and dm.with_computed_at(None, "5") is None,
          "perf: no column time and no document leave things as they are")
    broke = dict(healthy, errors={"profile": "the copy's inspector didn't open"})
    v = dm.perf_verdict(broke, pnow)
    check(v["status"] == "warn" and "inspector" in v["summary"], "perf: a failed reading is said, never skipped", str(v))

    runs = [
        {"name": "Case status (direct from DOL)", "status": "completed", "conclusion": "failure", "run_attempt": 1,
         "updated_at": "2026-09-29T08:30:00Z"},
        {"name": "Case status (direct from DOL)", "status": "completed", "conclusion": "success", "run_attempt": 2,
         "updated_at": "2026-09-29T13:30:00Z"},
        {"name": "Tests", "status": "completed", "conclusion": "cancelled", "run_attempt": 1},
        {"name": "Tests", "status": "in_progress", "conclusion": None, "run_attempt": 1},
        {"name": "Oracle build and deploy", "status": "completed", "conclusion": "success", "run_attempt": 1,
         "updated_at": "2026-09-30T09:00:00Z"},
        {"name": "Oracle build and deploy", "status": "completed", "conclusion": "failure", "run_attempt": 1,
         "updated_at": "2026-09-30T11:00:00Z"},
    ]
    by = dm.summarize_runs(runs)
    case = by["Case status (direct from DOL)"]
    check({k: case[k] for k in ("runs", "failed", "cancelled", "reruns", "running")}
          == {"runs": 2, "failed": 1, "cancelled": 0, "reruns": 1, "running": 0},
          "a failure and a re-run are both counted")
    check(dm.recovered(case), "a failure followed by a pass is recovered, so it does not rank as FAILING")
    check(not dm.recovered(by["Oracle build and deploy"]), "a pass followed by a failure is still failing")
    check(not dm.recovered(by["Tests"]), "a workflow that never failed is not 'recovered'")
    check(by["Tests"]["cancelled"] == 1 and by["Tests"]["running"] == 1, "cancelled and still-running are told apart")
    check(dm.summarize_runs([{"name": "npm_and_yarn in /v2 for next - Update #1", "status": "completed"}]) == {},
          "Dependabot version-update runs are left out")
    # One workflow file, three titles: the name before a rename, and per-file
    # titles after it (Oct 3 2026). Grouped by the file, the old title's
    # failure is followed by the newer passes, so nothing reads still failing.
    renamed = [
        {"name": "PW and LCA disclosure ingest", "path": ".github/workflows/flag-disclosure-ingest.yml",
         "status": "completed", "conclusion": "failure", "updated_at": "2026-10-03T17:05:00Z"},
        {"name": "FLAG disclosure ingest (lca) LCA_Disclosure_Data_FY2020_Q2.xlsx",
         "path": ".github/workflows/flag-disclosure-ingest.yml",
         "status": "completed", "conclusion": "success", "updated_at": "2026-10-03T20:00:00Z"},
        {"name": "FLAG disclosure ingest (h2a) H-2A_Disclosure_Data_FY2025_Q4.xlsx",
         "path": ".github/workflows/flag-disclosure-ingest.yml",
         "status": "completed", "conclusion": "success", "updated_at": "2026-10-03T21:00:00Z"},
    ]
    names = {".github/workflows/flag-disclosure-ingest.yml": "FLAG disclosure ingest"}
    grouped = dm.summarize_runs(renamed, names)
    check(list(grouped) == ["FLAG disclosure ingest"], f"one line per workflow file, under its current name ({list(grouped)})")
    check(dm.recovered(grouped["FLAG disclosure ingest"]), "the renamed workflow's old failure reads as passed since")
    check("FLAG disclosure ingest" in dm.DATA_WORKFLOWS, "its name is the one the data-workflow list knows")
    import inspect
    # Traffic separates likely people from single-page crawler visits.
    yday = (dt.datetime.now(dm.ET).date() - dt.timedelta(days=1)).isoformat()
    real_http, real_key = dm.http_json, __import__("os").environ.get("POSTHOG_PERSONAL_API_KEY")
    try:
        __import__("os").environ["POSTHOG_PERSONAL_API_KEY"] = "test"
        dm.http_json = lambda *a, **k: {"results": [[yday, 4000, 1000, 700]]}
        t = dm.traffic_section()
    finally:
        dm.http_json = real_http
        if real_key is None:
            __import__("os").environ.pop("POSTHOG_PERSONAL_API_KEY", None)
        else:
            __import__("os").environ["POSTHOG_PERSONAL_API_KEY"] = real_key
    blob = json.dumps(t)
    check("about 700 people" in blob and "1,000 visitors" in blob,
          "traffic reports likely people beside raw visitors")
    # Browser errors live in PostHog; one seen in 2+ sessions warns.
    real_http = dm.http_json
    try:
        __import__("os").environ["POSTHOG_PERSONAL_API_KEY"] = "test"
        many = [['["Minified React error #185"]', 3, 3, 0, "/perm-wages"],
                ['["Brand new thing"]', 1, 1, 1, "/tools"]]
        many += [[f'["one-off {i}"]', 1, 1, 0, "/x"] for i in range(20)]
        dm.http_json = lambda *a, **k: {"results": many}
        b = dm.browser_errors_section()
        dm.http_json = lambda *a, **k: {"results": [['["Rejected"]', 1, 1, 0, "/login"]]}
        quiet = dm.browser_errors_section()
    finally:
        dm.http_json = real_http
        if real_key is None:
            __import__("os").environ.pop("POSTHOG_PERSONAL_API_KEY", None)
        else:
            __import__("os").environ["POSTHOG_PERSONAL_API_KEY"] = real_key
    check(b["status"] == "warn" and "24 error events in 24 h, 22 kinds" in b["summary"]
          and "Minified React error #185" in json.dumps(b), "a browser error seen in 2+ sessions warns, with the message")
    check(any(l.startswith("NEW Brand new thing") for l in b["lines"]), "an error kind never seen before is marked NEW")
    check(b["lines"][-1] == "and 20 more kinds, each seen in one session",
          "kinds not listed are counted, never silently dropped")
    check(quiet["status"] == "ok", "a one-off browser error stays ok")
    check("browser_errors_section" in inspect.getsource(dm.build), "the report includes the browser-errors section")
    check("toDateTime('2026-10-01 02:42:00')" in inspect.getsource(dm.browser_errors_section),
          "browser errors from before the fix deploy are not reported as new")
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
    stalled = dm.health_lines("frontier          : 26280:1 6d  budget 5d  STALLED\n"
                              "  live_census            MISSING - the case lookup's queue position is being served\n"
                              "  month_detail           2.1d ago  ok\n")
    check(len(stalled) == 2 and "STALLED" in stalled[0] and "MISSING" in stalled[1],
          f"a stalled frontier and a missing doc are kept, an ok row is not: {stalled}")

    # stdout: one status word per section, nothing numeric.
    fake = {"day": "2026-09-28", "generatedAt": 1, "sections": [
        dm.section("bills", "Bills", "warn", "$143.12 over so far", ["9.29B rows read"]),
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
    check(printed.strip() == "bills=warn site=ok", f"stdout is status words only: {printed!r}")
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
                        "serverOk": {"at": "2026-09-28T07:35:00Z"}, "convexOk": {"at": "2026-09-28T07:52:00Z"},
                        "restoreOk": {"at": "2026-09-02T09:40:00Z", "tables": 44, "rows": 6_509_035},
                        "diskCopy": {"at": "2026-09-28T07:50:00Z", "count": 4, "free": "yes"}},
             "services": {u: "active" for u in ["permtracker-db", "permtracker-dbcache", "permtracker-web@blue",
                                                "permtracker-web@green", "nginx", "cloudflared"]},
             "failedUnits": [], "slot": {"active": "blue", "release": "abc-1"},
             "pageCache": {"at": "2026-09-28T11:05:00Z", "liveGB": 3.2, "standbyGB": 4.0, "tight": False},
             "timers": dm.repo_timers()}
        for k, v in over.items():
            d[k] = {**d[k], **v} if isinstance(d.get(k), dict) and isinstance(v, dict) else v
        return d

    v = dm.server_verdict
    check(v(None, now_ms)["status"] == "off", "no doc: the section is off, not a failure")
    check(v(doc(), now_ms)["status"] == "ok", "a healthy server reads ok")
    check(v(doc(timers=[]), now_ms)["status"] == "fail", "an empty timer list fails: it can't be read as all enabled")
    check(v(doc(now={"diskPct": 93.0}), now_ms)["status"] == "fail", "a disk over 90% full fails")
    _no_timers = doc(); _no_timers.pop("timers")
    check(v(_no_timers, now_ms)["status"] == "fail", "so does a report with no timer list")
    check(v(doc(timers=dm.repo_timers()[1:]), now_ms)["status"] == "fail", "a timer missing from the list fails")
    check(v(doc(at="2026-09-28T09:00:00Z"), now_ms)["status"] == "fail", "a server silent for 2.5 h fails")
    check(v(doc(services={"nginx": "failed"}), now_ms)["status"] == "fail", "nginx down fails")
    check(v(doc(services={"permtracker-web@blue": "failed"}), now_ms)["status"] == "fail",
          "the LIVE copy down fails")
    check(v(doc(services={"permtracker-web@green": "inactive"}), now_ms)["status"] == "ok",
          "the idle copy down does not")
    live = (doc().get("slot") or {}).get("active") or "blue"
    check(v(doc(services={f"permtracker-web@{live}2": "failed"}), now_ms)["status"] == "warn",
          "the live slot's second copy down warns (one copy still serves)")
    check(v(doc(services={f"permtracker-web@{live}2": "active"}), now_ms)["status"] == "ok",
          "both copies up reads ok")
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
    # The disk's trend (Oct 10 2026: full overnight from 50%, which a daily
    # percentage could not see coming).
    check(v(doc(now={"diskHoursToFull": 23.6}), now_ms)["status"] == "fail",
          "the disk full within a day at the current rate fails")
    check(v(doc(now={"diskHoursToFull": 60}), now_ms)["status"] == "warn",
          "the disk full within three days warns")
    check(v(doc(now={"diskHoursToFull": None}), now_ms)["status"] == "ok",
          "no fall in free disk reads ok")
    # A cache refilling toward its cap isn't the disk filling (Oct 12 2026:
    # "full in about 47 hours" with 81 GB free and 45 GB of cache headroom).
    _refill = v(doc(now={"diskHoursToFull": 47, "diskFreeGB": 81.4}, pageCache={"headroomGB": 45.0}), now_ms)
    check(_refill["status"] == "ok", "a fall the cache cap stops with 25 GB to spare is no warning")
    check(any("leaves about 36 GB" in ln for ln in _refill.get("lines", [])),
          "and the report says what the cap leaves", str(_refill.get("lines")))
    check(v(doc(now={"diskHoursToFull": 47, "diskFreeGB": 60.0}, pageCache={"headroomGB": 45.0}), now_ms)["status"] == "warn",
          "a fall that would leave under 25 GB with every cache full still warns")
    check(v(doc(now={"diskHoursToFull": 47, "diskFreeGB": 81.4}, pageCache={"headroomGB": None}), now_ms)["status"] == "warn",
          "unknown headroom keeps the plain trend")
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
    ua = v(doc(underAttack24h=2, defenseCount24h=4,
               defense24h=["2026-10-02T21:38:35Z defend: Under Attack Mode on (no single source)"]), now_ms)
    said = " ".join(ua["lines"]) + " " + str(ua.get("summary", ""))
    check(ua["status"] == "warn" and "restarted" not in said
          and "Under Attack Mode 2 time(s)" in said and any("Defense:" in ln for ln in ua["lines"]),
          "the defense is reported as the defense, never as restarts")
    check(v(doc(now={"dbBytes": 7_000_000_000, "dbDataBytes": 3_300_000_000}), now_ms)["status"] == "ok",
          "a database folder at 2.1x its data file is normal (one snapshot)")
    # Oct 11 2026, the morning that read "3.1x ... not being trimmed": sqld
    # inside both of its own rules. Judged by its parts and by the old total.
    oct11 = {"dbBytes": 20_300_000_000, "dbDataBytes": 6_471_090_176,
             "dbSnapshotBytes": 11_600_000_000, "dbLogBytes": 2_386_543_024}
    healthy_db = v(doc(now=oct11), now_ms)
    check(healthy_db["status"] == "ok", "sqld inside its own log and merge rules is ok (Oct 11: 3.1x)",
          str(healthy_db.get("lines")))
    check(any(ln.startswith("Database parts: data 6.5 GB, snapshots 11.6 GB") for ln in healthy_db["lines"]),
          "the report names the database's parts", str(healthy_db["lines"]))
    old_doc = {"dbBytes": 20_300_000_000, "dbDataBytes": 6_471_090_176}
    check(v(doc(now=old_doc), now_ms)["status"] == "ok", "an older report with only the total reads 3.1x as ok")
    check(v(doc(now={"dbBytes": 25_000_000_000, "dbDataBytes": 3_300_000_000}), now_ms)["status"] == "warn",
          "an older report past the summed ceiling still warns")
    unmerged = v(doc(now={**oct11, "dbSnapshotBytes": 25_000_000_000}), now_ms)
    check(unmerged["status"] == "warn" and any("isn't merging" in w for w in says(unmerged)),
          "snapshots past 3x the data plus one log warn that sqld isn't merging", str(unmerged))
    stuck_log = v(doc(now={**oct11, "dbLogBytes": 6_000_000_000}), now_ms)
    check(stuck_log["status"] == "warn" and any("isn't compacting" in w for w in says(stuck_log)),
          "a log past its cap warns that sqld isn't compacting", str(stuck_log))
    cap = int(re.search(r"--max-log-size (\d+)", (HERE / "oracle/systemd/permtracker-db.service").read_text()).group(1))
    check(dm.SQLD_LOG_CAP_BYTES == cap * 1_000_000, "the report's log cap is the server's --max-log-size",
          f"{dm.SQLD_LOG_CAP_BYTES} vs {cap}")
    # Swap judged by use (Oct 11 2026: 1,253 MB held, 7,171 MB free, idle).
    held = v(doc(now={"swapUsedMb": 1253, "memAvailableMb": 7171, "swapPagesPerS": 0.03}), now_ms)
    check(held["status"] == "ok" and any(ln.startswith("Swap: 1,253 MB holds pages set aside earlier") for ln in held["lines"]),
          "swap holding old pages with memory free is a line, not a warning", str(held))
    check(v(doc(now={"swapUsedMb": 1253, "memAvailableMb": 7171}), now_ms)["status"] == "ok",
          "an older report with no swap rate and memory free is ok")
    moving = v(doc(now={"swapUsedMb": 1253, "memAvailableMb": 7171, "swapPagesPerS": 450.0}), now_ms)
    check(moving["status"] == "warn" and "pages a second moving" in (moving.get("summary") or ""),
          "swap pages moving fast warns", str(moving))
    short = v(doc(now={"swapUsedMb": 1500, "memAvailableMb": 1800}), now_ms)
    check(short["status"] == "warn" and "1,800 MB of memory available" in (short.get("summary") or ""),
          "swap held while memory is short warns", str(short))
    # Oct 11 2026: the wage-request line summed every method, the retired
    # one included, and read 83 days where the method in use missed by 8.
    priv = {"pwd": {"bySource": {"ours": {"all": {"recorded": 306, "graded": 52, "typicalMissDays": 83}, "byModel": {
        "pwd-workday": {"recorded": 54, "graded": 0, "typicalMissDays": None},
        "pwd-day": {"recorded": 210, "graded": 120, "typicalMissDays": 2},
        "pwd-queue": {"recorded": 108, "graded": 15, "typicalMissDays": 8},
        "pwd-queue-request-month": {"recorded": 144, "graded": 37, "typicalMissDays": 84}}}}},
        "bulletin": {"bySource": {"ours": {"all": {"recorded": 4, "graded": 0}}}}}
    est = dm.estimate_lines(priv)
    check(est == ["Scorecard, wage-request days: 54 recorded, 0 graded",
                  "Scorecard, wage-request months: 108 recorded, 15 graded, typical miss 8 days",
                  "Scorecard, visa bulletin release days: 4 recorded, 0 graded"],
          "the wage-request lines read each method in use, never the retired one", str(est))
    verdict_ts = (HERE.parent / "src/lib/scorecard/verdict.ts").read_text()
    ts_retired = set(re.findall(r'^\s+"([\w-]+)": "[A-Z][a-z]+ \d{1,2}, \d{4}",$', verdict_ts.split("RETIRED_METHODS")[1].split("};")[0], re.M))
    check(ts_retired == dm.RETIRED_METHODS and len(ts_retired) >= 2,
          "the report's retired methods are the site's", f"{ts_retired} vs {dm.RETIRED_METHODS}")
    stopped = v(doc(stoppedUnits=["pmlogger.service"]), now_ms)
    check(stopped["status"] == "warn" and "pmlogger.service" in " ".join(says(stopped)),
          "a service stopped after an error (not marked failed) warns by name", str(stopped))
    check(v(doc(backup={"convexOk": None}), now_ms)["status"] == "warn", "no sealed Convex copy on record warns")
    check(v(doc(backup={"serverOk": {"at": "2026-09-26T03:00:00Z"}}), now_ms)["status"] == "fail",
          "a sealed server copy 56 h old fails")
    check(v(doc(backup={"convexOk": {"at": "2026-09-27T03:00:00Z"}}), now_ms)["status"] == "warn",
          "a sealed Convex copy 32 h old warns")
    check(any("Convex copy" in ln for ln in v(doc(), now_ms)["lines"]), "the report names the Convex copy")
    check(v(doc(backup={"diskCopy": None}), now_ms)["status"] == "warn", "no Oracle disk copy on record warns")
    check(v(doc(backup={"diskCopy": {"at": "2026-09-26T03:00:00Z", "count": 4, "free": "yes"}}), now_ms)["status"]
          == "fail", "an Oracle disk copy 56 h old fails")
    check(v(doc(backup={"diskCopy": {"at": "2026-09-28T07:50:00Z", "count": 4, "free": "no"}}), now_ms)["status"]
          == "fail", "a disk copy Oracle didn't mark free fails")
    check(v(doc(backup={"diskCopy": {"at": "2026-09-28T07:50:00Z", "count": 6, "free": "yes"}}), now_ms)["status"]
          == "fail", "six disk copies, over the free five, fails")
    check(any("Oracle disk copies: 4 held" in ln and "all free" in ln for ln in v(doc(), now_ms)["lines"]),
          "the report names the disk copies")
    all_timers = dm.repo_timers()
    check(len(all_timers) >= 20 and "permtracker-prune.timer" in all_timers, "the repo's timers are found")
    check(v(doc(timers=all_timers), now_ms)["status"] == "ok", "every repo timer enabled reads ok")
    gone = v(doc(timers=[t for t in all_timers if t != "permtracker-backup-server.timer"]), now_ms)
    check(gone["status"] == "fail" and any("permtracker-backup-server.timer" in f for f in says(gone)),
          "a repo timer missing on the server fails and is named")
    check(v(doc(pageCache=None), now_ms)["status"] == "warn", "no page-cache result on record warns")
    check(v(doc(pageCache={"at": "2026-09-28T08:05:00Z"}), now_ms)["status"] == "warn",
          "a page-cache cap silent for 3.4 h warns")
    check(v(doc(pageCache={"tight": True}), now_ms)["status"] == "fail",
          "free disk below the cap's floor fails")
    check(v(doc(now={"memAvailableMb": 700}), now_ms)["status"] == "warn", "under 1 GB of memory available warns")
    check(v(doc(now={"swapUsedMb": 1800, "memAvailableMb": 1500}), now_ms)["status"] == "warn",
          "1.8 GB of swap held with 1.5 GB of memory available warns")
    check(v(doc(now={"memAvailableMb": 5300, "swapUsedMb": 20}), now_ms)["status"] == "ok",
          "a roomy machine reads ok")

    # People shown a refusal page (the server's count of the pages' image).
    def busy(last_busy, days, people=None):
        return {"last24h": {"busyPeople": last_busy, "people": people if people is not None else last_busy},
                "days": [{"day": f"2026-09-{d:02d}", "busyPeople": n} for d, n in days]}
    check(v(doc(), now_ms)["status"] == "ok" and not any("busy" in ln for ln in v(doc(), now_ms)["lines"]),
          "a doc from before the count says nothing about it")
    check(v(doc(busySeen=None), now_ms)["status"] == "warn", "a count the server can't read warns, never zero")
    quiet = v(doc(busySeen=busy(2, [(26, 0), (27, 4), (28, 2)], people=5)), now_ms)
    check(quiet["status"] == "ok" and any("2 in 24 h" in ln and "0, 0, 0, 0, 0, 4, 2" in ln and "one moment" in ln
                                           for ln in quiet["lines"]),
          "a few people on a day reads ok and prints the week, oldest first, zeros filled")
    check(v(doc(busySeen=busy(12, [(28, 12)])), now_ms)["status"] == "warn",
          "10+ people shown busy in 24 h warns: the server is too small")
    check(v(doc(busySeen=busy(4, [(26, 3), (27, 5), (28, 4)])), now_ms)["status"] == "warn",
          "people shown busy three days running warns")
    check(v(doc(busySeen=busy(4, [(25, 6), (26, 0), (27, 5), (28, 4)])), now_ms)["status"] == "ok",
          "a quiet day in between breaks the streak")

    # The busy hours, set against deploy switches (Oct 19 2026).
    hrs = [{"hour": "2026-09-28T06:00:00Z", "busyPeople": 8}, {"hour": "2026-09-28T09:00:00Z", "busyPeople": 4}]
    b12 = busy(12, [(28, 12)])
    b12["busyHours"] = hrs
    def ms(*a):
        return int(dt.datetime(*a, tzinfo=dt.timezone.utc).timestamp() * 1000)
    near = dm.server_verdict(doc(busySeen=b12), now_ms, [ms(2026, 9, 28, 6, 20)])
    check(near["status"] == "warn" and any("8 of them within an hour of a deploy" in ln for ln in says(near)),
          "busy people mostly in a deploy's hour are put down to the deploy")
    check(any(ln == "By hour (Eastern): Mon 2 AM 8, Mon 5 AM 4" for ln in near["lines"]), "the hours are named, Eastern")
    far = dm.server_verdict(doc(busySeen=b12), now_ms, [ms(2026, 9, 27, 18, 0)])
    check(any("the most around Mon 2 AM (none near a deploy): the server is too small" in ln for ln in says(far)),
          "busy people away from any deploy still say the server is too small, and when")
    blind = dm.server_verdict(doc(busySeen=b12), now_ms, None)
    check(any("the most around Mon 2 AM: the server is too small" in ln for ln in says(blind)),
          "no deploy record says nothing about deploys")
    check(any(ln.startswith("12 people were shown \"busy\" in 24 h: the server is too small")
              for ln in says(v(doc(busySeen=busy(12, [(28, 12)])), now_ms))),
          "a doc from before the hours keeps the plain sentence")
    steps = {1: [{"name": "Build", "conclusion": "success", "completed_at": "2026-10-19T06:05:00Z"},
                 {"name": dm.SHIP_STEP, "conclusion": "success", "completed_at": "2026-10-19T06:11:20Z"}],
             2: [{"name": dm.SHIP_STEP, "conclusion": "skipped", "completed_at": "2026-10-18T14:30:00Z"}]}
    check(dm.switch_times(steps) == [ms(2026, 10, 19, 6, 11, 20)], "only a run whose ship step ran has a switch time")

    # The database's RAM lock (Oct 19 2026: off since Oct 9, unnoticed).
    on = {"permtracker-dbcache": "active"}
    off_line = dm.ram_lock_line(on, {"dbDataBytes": 6_682_112_000, "lockedMb": 0})
    check(off_line is not None and "6.7 GB" in off_line and "6 GB cap" in off_line, "a database over the lock cap is said")
    check(dm.ram_lock_line(on, {"dbDataBytes": 3_000_000_000, "lockedMb": 2900}) is None, "a locked database says nothing")
    check(dm.ram_lock_line(on, {"dbDataBytes": 6_682_112_000}) is None, "no locked figure, no claim")
    script = (HERE / "oracle" / "bin" / "permtracker-dbcache").read_text()
    check("$((6*1024*1024*1024))" in script and dm.DBCACHE_CAP_BYTES == 6 * 1024 ** 3,
          "the report's cap is the lock script's cap")

    # The H-1B LCA filings' own database (Oct 19 2026).
    now_ms = int(dt.datetime(2026, 10, 20, 11, 30, tzinfo=dt.timezone.utc).timestamp() * 1000)
    base = {"services": {"permtracker-db-lca": "active"},
            "now": {"lcaDataBytes": 2_468_593_664, "lcaSnapshotBytes": 0, "lcaLogBytes": 2_483_058_144},
            "backup": {"lcaOk": {"at": "2026-10-20T07:20:00Z", "current": True}}}
    f, w, ln = dm.lca_db_checks(base, now_ms)
    check(f == [] and w == [] and any("LCA database parts" in x for x in ln), f"a healthy LCA database is a line ({f}, {w})")
    check(dm.lca_db_checks({"services": {}, "now": {}}, now_ms) == ([], [], []), "no LCA database, nothing said")
    down = {**base, "services": {"permtracker-db-lca": "failed"}}
    check(any("permtracker-db-lca" in x for x in dm.lca_db_checks(down, now_ms)[0]), "a stopped LCA database fails")
    stale = {**base, "backup": {"lcaOk": {"at": "2026-10-18T07:20:00Z", "current": False}}}
    check(any("changed after its newest backup" in x for x in dm.lca_db_checks(stale, now_ms)[1]),
          "an LCA database changed since a two-day-old backup warns")
    fresh = {**base, "backup": {"lcaOk": {"at": "2026-10-20T07:20:00Z", "current": False}}}
    check(dm.lca_db_checks(fresh, now_ms)[1] == [], "changed since this morning's backup: not yet a warning")
    none = {**base, "backup": {}}
    check(any("no backup of the H-1B LCA database" in x for x in dm.lca_db_checks(none, now_ms)[1]),
          "no LCA backup on record warns")
    big = {**base, "now": {**base["now"], "lcaLogBytes": 6_000_000_000}}
    check(any(x.startswith("LCA database replication log") for x in dm.lca_db_checks(big, now_ms)[1]),
          "an LCA log past sqld's cap warns, by the main database's rule")
    backup = (HERE / "oracle" / "bin" / "permtracker-backup").read_text()
    health = (HERE / "oracle" / "bin" / "permtracker-health").read_text()
    check('stat -c %s:%Y "$L/data"):$(stat -c %s "$L/wallog"' in backup
          and 'f"{st.st_size}:{int(st.st_mtime)}:{lca_log or 0}"' in health,
          "the backup and the health report build the LCA signature the same way")

    # Traffic against the same weekday (Oct 19 2026: a Sunday read as a drop).
    views = {}
    d0 = dt.date(2026, 9, 14)
    for i in range(35):
        day = d0 + dt.timedelta(days=i)
        views[day.isoformat()] = 3400 if day.weekday() == 6 else 7100
    prior, usual = dm.usual_prior(views, "2026-10-18")
    check(usual == "Sunday" and prior == [3400] * 4, f"a Sunday is judged against Sundays ({usual}, {prior})")
    check(dm.spike_note(3409, prior, "pageviews", drop=True, usual=usual) is None, "an ordinary Sunday isn't a drop")
    check(dm.spike_note(1500, prior, "pageviews", drop=True, usual=usual).endswith(
          "of the usual Sunday (1.50K pageviews against a median of 3.40K)"), "a real drop names the weekday")
    week = [v7 for k, v7 in sorted(views.items()) if k < "2026-10-18"][-7:]
    check(dm.spike_note(3409, week, "pageviews", drop=True) is not None, "control: against every day the Sunday read as a drop")
    few = {k: v7 for k, v7 in views.items() if k >= "2026-10-05"}
    check(dm.usual_prior(few, "2026-10-18")[1] == "day", "under three of that weekday falls back to the week")

    # A slow page is timed again.
    cold = dm.slow_verdict("/llms.txt", 8700, 300)
    check(cold == ("/llms.txt 8.7s on the first load, 0.3s once cached", False), f"slow once, fast after, doesn't warn: {cold}")
    check(dm.slow_verdict("/x", 8700, 5200)[1] and dm.slow_verdict("/x", 8700, None)[1], "slow twice, or no second answer, warns")

    data_section_reads_the_scorecard_alarms()
    long_lines_end_at_a_sentence()
    busy_replies_are_tried_again()

    # The API and the assistants: keyed calls by account, keyless ones by bucket.
    rows = [("2026-10-07", "acct_a", "k1", 30), ("2026-10-07", "acct_b", "k2", 5), ("2026-10-07", "anonymous", "mcp", 12),
            ("2026-10-07", "anonymous", "lookup", 4), ("2026-10-06", "acct_a", "k1", 9), ("2026-10-08", "acct_a", "k1", 100)]
    summ, alines = dm.api_lines(rows, "2026-10-08")
    check(summ == "35 keyed calls from 2 accounts yesterday", "yesterday's keyed calls, today's partial day left out")
    check("Without a key yesterday: lookup 4, mcp 12" in alines, "keyless calls by bucket")
    check("Last 2 days: 44 keyed calls from 2 accounts" in alines, "the week's keyed calls")
    check(dm.api_lines([], "2026-10-08")[0] == "No API calls recorded yet", "an empty table says so")

    # Live DOL lookups through the API, against the ceiling every account shares.
    ts_cap = re.search(r"export const API_LIVE_DAILY_CAP = ([\d_]+);", (HERE.parent / "convex" / "lib" / "apiPlans.ts").read_text())
    check(ts_cap is not None and int(ts_cap.group(1).replace("_", "")) == dm.API_LIVE_DAILY_CAP,
          "the report's live-lookup ceiling is the one the API enforces")
    line, warn = dm.live_lookup_line({"all": 120, "acct_a": 100, "acct_b": 20}, 20_000)
    check(line == "Live DOL lookups yesterday: 120 of the 20,000 a day every account shares, from 2 accounts" and not warn,
          f"live lookups yesterday ({line})")
    line, warn = dm.live_lookup_line({"all": 17_000, "acct_a": 17_000}, 20_000)
    check(warn and "17,000 of the 20,000" in line and "from 1 account" in line, "near the ceiling asks for a look")
    line, warn = dm.live_lookup_line(None, 20_000)
    check(line == "No live DOL lookups through the API yesterday" and not warn, "a day without any says so")

    # How long things take: passing runs only, a deploy split into its steps.
    T, D = dm.TESTS_PATH, dm.DEPLOY_PATH
    sruns = [
        {"path": T, "status": "completed", "conclusion": "success", "run_started_at": "2026-10-08T17:43:00Z", "updated_at": "2026-10-08T17:45:00Z"},
        {"path": T, "status": "completed", "conclusion": "success", "run_started_at": "2026-10-08T12:00:00Z", "updated_at": "2026-10-08T12:03:00Z"},
        {"path": T, "status": "completed", "conclusion": "failure", "run_started_at": "2026-10-08T10:00:00Z", "updated_at": "2026-10-08T10:30:00Z"},
        {"path": D, "status": "completed", "conclusion": "success", "id": 7, "run_started_at": "2026-10-08T17:43:00Z", "updated_at": "2026-10-08T17:53:00Z"},
        {"path": D, "status": "in_progress", "conclusion": None, "id": 8, "run_started_at": "2026-10-08T18:00:00Z"},
    ]
    steps = {7: [{"name": "Build", "started_at": "2026-10-08T17:44:00Z", "completed_at": "2026-10-08T17:48:00Z"},
                 {"name": "Wait for the full test suite to pass for this commit", "started_at": "2026-10-08T17:48:00Z", "completed_at": "2026-10-08T17:48:00Z"},
                 {"name": "Deploy to the idle copy, health-check, switch", "started_at": "2026-10-08T17:48:00Z", "completed_at": "2026-10-08T17:53:00Z"}]}
    ssum, slines = dm.speed_lines(sruns, steps)
    check(ssum == "1 deploy, run to live typically 10.0 min, tests 2.5 min", f"the speed summary ({ssum})")
    # A push held for the night builds and stops; a night run with nothing new
    # builds nothing. Neither is a deploy, and only the first is counted as held.
    held_runs = sruns + [
        {"path": D, "status": "completed", "conclusion": "success", "id": 9, "run_started_at": "2026-10-08T19:00:00Z", "updated_at": "2026-10-08T19:06:00Z"},
        {"path": D, "status": "completed", "conclusion": "success", "id": 10, "run_started_at": "2026-10-09T06:00:00Z", "updated_at": "2026-10-09T06:01:00Z"},
    ]
    held_steps = {**steps,
                  9: [{"name": "Build", "conclusion": "success"}, {"name": "Deploy to the idle copy, health-check, switch", "conclusion": "skipped"}],
                  10: [{"name": "Build", "conclusion": "skipped"}, {"name": "Deploy to the idle copy, health-check, switch", "conclusion": "skipped"}]}
    hsum, hlines = dm.speed_lines(held_runs, held_steps)
    check(hsum.startswith("1 deploy,") and "Pushes built and held for the night deploy: 1" in hlines,
          f"held and empty runs aren't deploys ({hsum}; {hlines[-1]})")
    check("Tests: 2 runs, typically 2.5 min (slowest 3.0)" in slines, "a failed test run is not timed")
    check(any("build 4.0, waiting for tests 0.0, server 5.0" in x for x in slines), "the deploy's parts, by step name")
    deploy_yml = (HERE.parent.parent / ".github" / "workflows" / "oracle-deploy.yml").read_text()
    check(all(f"name: {n}\n" in deploy_yml for n, _ in dm.DEPLOY_STEPS), "every timed step name is one oracle-deploy.yml has")
    check(dm.speed_lines([], {})[0] == "No deploys or test runs", "an empty day says so")

    print(f"\n{len(FAILS)} failure(s)")
    return 1 if FAILS else 0


def data_section_reads_the_scorecard_alarms() -> None:
    """The scorecard's alarms, worked out by the site (scorecard/alarms.ts),
    reach the email and turn the data section amber; the other estimates get
    a line each."""
    import os
    import types

    priv = {
        "alarms": ["Wage-request months: no case graded yet, though 12 predicted dates passed a week ago or more."],
        "pwd": {"bySource": {"ours": {"all": {"recorded": 234, "graded": 12, "typicalMissDays": 9},
                                      "byModel": {"pwd-queue": {"recorded": 234, "graded": 12, "typicalMissDays": 9}}}}},
        "seasonal": {"bySource": {"ours": {"all": {"recorded": 30, "graded": 0, "typicalMissDays": None}}}},
    }

    def query_rows(_db, sql, _args=None):
        if "COUNT(*)" in sql:
            return [[5]]
        if "scorecard_rivals" in sql:
            return [[json.dumps(priv)]]
        return []

    fake = types.ModuleType("lib_db")
    fake.Database = lambda *a, **k: None
    fake.query_rows = query_rows
    saved = sys.modules.get("lib_db")
    sys.modules["lib_db"] = fake
    os.environ.setdefault("DATABASE_URL", "http://x")
    os.environ.setdefault("DATABASE_AUTH_TOKEN", "x")
    try:
        sec = dm.data_section(0)
    finally:
        if saved is not None:
            sys.modules["lib_db"] = saved
        else:
            del sys.modules["lib_db"]
    lines = sec["lines"]
    check(sec["status"] == "warn", "a scorecard alarm turns the data section amber")
    check(any(l.startswith("Scorecard alarm: Wage-request months: no case graded yet") for l in lines),
          "the alarm is printed in the site's own words")
    check("Scorecard, wage-request months: 234 recorded, 12 graded, typical miss 9 days" in lines,
          "the wage-request estimate gets its own line")
    check("Scorecard, H-2A, H-2B and CW-1 dates: 30 recorded, 0 graded" in lines,
          "a seasonal record with no grade yet says so without a miss")


def long_lines_end_at_a_sentence() -> None:
    """Convex keeps LINE_MAX characters of a line and drops the rest wherever
    it falls; the report shortens a longer line itself, at a sentence."""
    ts = (HERE.parent / "convex" / "lib" / "dailyReportCompose.ts").read_text()
    cap = re.search(r"\.map\(\(l\) => String\(l\)\.slice\(0, (\d+)\)\)", ts)
    check(cap is not None and int(cap.group(1)) == dm.LINE_MAX,
          f"LINE_MAX matches the cap Convex puts on each line ({cap.group(1) if cap else None})")
    scap = re.search(r"summary: String\(x\.summary \?\? \"\"\)\.slice\(0, (\d+)\)", ts)
    check(scap is not None and int(scap.group(1)) == dm.SUMMARY_MAX,
          f"SUMMARY_MAX matches the cap Convex puts on a summary ({scap.group(1) if scap else None})")
    once = dm.section("perf", "Page speed", "warn", "Pages are slow.", ["Pages are slow.", "Last hour: fine."])
    check(once["lines"] == ["Last hour: fine."], f"a section's lead warning isn't printed twice ({once['lines']})")
    long_warn = "A warning that runs long. " * 20
    kept = dm.section("perf", "Page speed", "warn", long_warn, [long_warn])
    check(len(kept["summary"]) <= dm.SUMMARY_MAX and len(kept["lines"]) == 1,
          "a lead warning too long for the summary keeps its line under it")
    short = "Scorecard, ours: typically 4 days off."
    check(dm.fit(short) == short, "a short line is left alone")
    # The shape that was cut on Oct 9 2026: a headline, then one sentence per point.
    rival = ("Scorecard, Rival A: Rival A leads so far, not clearly yet. "
             + " ".join(f"Point {i} says something about the cases both of us dated and how far each was off." for i in range(9)))
    out = dm.fit(rival)
    check(len(rival) > dm.LINE_MAX and len(out) <= dm.LINE_MAX, f"a long line fits the cap ({len(out)})")
    check(out.endswith("off." + dm.MORE), f"it ends at a whole sentence and points to the admin page ({out[-50:]!r})")
    words = "word " * 120
    w = dm.fit(words.strip())
    check(len(w) <= dm.LINE_MAX and w.endswith("word..."), "a line with no sentence to end at stops at a whole word")
    sec = dm.section("data", "The data", "ok", "s", [short, rival])
    check(sec["lines"][0] == short and len(sec["lines"][1]) <= dm.LINE_MAX, "every section line is fitted")


def busy_replies_are_tried_again() -> None:
    """A busy or failed reply (429, 5xx) is tried again; a refusal (404) is
    not; and a section that still fails names the status code."""
    import email.message
    import urllib.error

    def fail(code):
        hdrs = email.message.Message()
        return urllib.error.HTTPError("https://example.test", code, "x", hdrs, None)

    class Body(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    real_open, real_sleep = dm.urllib.request.urlopen, dm.time.sleep
    slept: list[float] = []
    try:
        dm.time.sleep = slept.append
        answers = [fail(503), fail(504), Body(b'{"results": [1]}')]

        def opener(*_a, **_k):
            a = answers.pop(0)
            if isinstance(a, Exception):
                raise a
            return a

        dm.urllib.request.urlopen = opener
        try:
            got = dm.http_json("https://example.test")
        except urllib.error.HTTPError as e:
            got = f"HTTP {e.code} raised"
        check(got == {"results": [1]} and slept == [5, 15],
              f"two busy replies are waited out and the third answer is read (got {got}, waits {slept})")
        calls = []

        def refuse(*_a, **_k):
            calls.append(1)
            raise fail(404)

        dm.urllib.request.urlopen = refuse
        try:
            dm.http_json("https://example.test")
            check(False, "a 404 raises")
        except urllib.error.HTTPError:
            check(len(calls) == 1, "a 404 is not tried again")

        def always_busy(*_a, **_k):
            raise fail(504)

        dm.urllib.request.urlopen = always_busy
        sec = dm.guarded("traffic", "Traffic", lambda: dm.http_json("https://example.test"))
        check(sec["status"] == "unknown" and sec["summary"] == "could not be read (HTTP 504)",
              f"a section that still fails names the status code ({sec['summary']})")
    finally:
        dm.urllib.request.urlopen, dm.time.sleep = real_open, real_sleep


if __name__ == "__main__":
    sys.exit(main())
