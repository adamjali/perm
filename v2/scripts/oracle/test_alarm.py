#!/usr/bin/env python3
"""The server alarm warns before the disk fills, and says so once, not every 5 minutes.

bin/permtracker-alarm runs every 5 minutes. On Oct 10 2026 free disk fell at a
steady 3.5 GB an hour for a day (82.6 GB free at 4:10 AM EDT Oct 9) and filled
at about 5:20 AM Oct 10; the only reading was the 7:30 AM report. These hold:

* the rate is a least-squares slope over the last two hours, and none is given
  under an hour of readings;
* Oct 9's readings raise the disk alarm (full in under 24 hours) while 82 GB is
  still free, and 96 GB free with no trend raises nothing;
* under 10 GB free is critical;
* an alarm emails when it starts, again after 6 hours, once when it clears,
  and not in between;
* a job or service of ours in systemd's failed state is an alarm; the OS's own
  units (fwupd, PCP's loggers) are not;
* the daily email cap holds.

Run: python3 scripts/oracle/test_alarm.py
"""
from __future__ import annotations

import importlib.machinery
import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
loader = importlib.machinery.SourceFileLoader("alarm", str(HERE / "bin" / "permtracker-alarm"))
spec = importlib.util.spec_from_loader("alarm", loader)
assert spec
alarm = importlib.util.module_from_spec(spec)
loader.exec_module(alarm)

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


def healthy(**over) -> dict:
    snap = {"disk_free_gb": 96.0, "mem_available_mb": 4000, "swap_used_mb": 200,
            "failed_units": [], "sampler_age_s": 300, "prune_age_s": 900, "backup_age_s": 3600 * 5}
    snap.update(over)
    return snap


T0 = 1_791_500_000.0

# The rate: Oct 9's measured fall, 3.5 GB an hour, one reading every 5 minutes.
pts = [[T0 + i * 300, 82.6 - 3.5 * (i * 300 / 3600)] for i in range(25)]
rate = alarm.rate_gb_per_hour(pts, T0 + 24 * 300)
check("the rate reads Oct 9's 3.5 GB an hour", rate is not None and abs(rate - 3.5) < 0.01, str(rate))
check("no rate under an hour of readings",
      alarm.rate_gb_per_hour(pts[:6], T0 + 5 * 300) is None)
check("readings older than two hours are left out",
      alarm.rate_gb_per_hour([[T0 - 4 * 3600, 200.0]] + pts, T0 + 24 * 300) == rate)

# What Oct 9 would have said: 82.6 GB at 3.5 GB an hour is full in 23.6 hours.
on = alarm.evaluate(healthy(disk_free_gb=82.6), 3.5)
check("Oct 9: the disk alarm fires with 82 GB still free", "disk" in on, str(on))
check("...and says when it will be full", "full in about 24 hours" in on.get("disk", ""), on.get("disk", ""))
check("a healthy server raises nothing", alarm.evaluate(healthy(), None) == {},
      str(alarm.evaluate(healthy(), None)))
check("a slow fall far from full raises nothing", alarm.evaluate(healthy(), 0.5) == {})
check("under 25 GB raises the disk alarm with no trend", "disk" in alarm.evaluate(healthy(disk_free_gb=20), None))
crit = alarm.evaluate(healthy(disk_free_gb=6), None)
check("under 10 GB is critical too", "disk-crit" in crit and "disk" in crit, str(crit))

# Our units only.
check("a failed job of ours is an alarm",
      "units" in alarm.evaluate(healthy(failed_units=["permtracker-cron@scorecard.service"]), None))
check("the filter keeps ours and drops the OS's",
      [u for u in ["fwupd-refresh.service", "pmlogger_check.service", "permtracker-prune.service",
                   "nginx.service"] if u.startswith(alarm.OUR_UNITS)]
      == ["permtracker-prune.service", "nginx.service"])
check("a sampler silent for an hour is an alarm", "sampler" in alarm.evaluate(healthy(sampler_age_s=3600), None))
check("a page-cache cap that never finished is an alarm",
      "page-cache" in alarm.evaluate(healthy(prune_age_s=None), None))

# Start, quiet, reminder, clear.
on = {"disk": "20 GB free"}
mail, st = alarm.plan(on, {}, T0)
check("a new alarm emails at once", [(k, kind) for k, kind, _ in mail] == [("disk", "start")], str(mail))
mail, st = alarm.plan(on, st, T0 + 300)
check("...and not again five minutes later", mail == [], str(mail))
mail, st = alarm.plan(on, st, T0 + alarm.REMIND_S)
check("...but again after six hours", [(k, kind) for k, kind, _ in mail] == [("disk", "still")], str(mail))
mail, st = alarm.plan({}, st, T0 + alarm.REMIND_S + 300)
check("...and once when it clears", [(k, kind) for k, kind, _ in mail] == [("disk", "clear")], str(mail))
check("...after which nothing is held", st.get("alarms") == {}, str(st))

# The daily cap.
st = {}
for i in range(alarm.EMAILS_PER_DAY):
    st = alarm.count_email(st, T0 + i)
check("the twelfth email of a day is the last", alarm.under_cap(st, T0 + 100) is False)
check("a new day starts the count again", alarm.under_cap(st, T0 + 86_400) is True)

subject, text = alarm.compose([("disk", "start", "20.0 GB free")], healthy(disk_free_gb=20.0), 3.5,
                              ["started the page-cache cap"], T0)
check("the email names the trouble in its subject", "the disk is filling" in subject, subject)
check("...and what was done", "Done automatically" in text and "page-cache cap" in text, text)

sys.exit(1 if failures else 0)
