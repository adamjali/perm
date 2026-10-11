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
# Oct 10 2026: the live cache refilling toward its 60 GB budget fell 5.5 GB an
# hour with 66.9 GB free, which the plain trend read as full in 12 hours. The
# cap stops it with 36 GB free, so the trend alone raises nothing.
check("a fall the page-cache cap will stop raises nothing",
      "disk" not in alarm.evaluate(healthy(disk_free_gb=66.9, cache_headroom_gb=30.6), 5.5))
check("...but a fall that would pass the low line even with the caches full still does",
      "disk" in alarm.evaluate(healthy(disk_free_gb=66.9, cache_headroom_gb=50.0), 5.5))
check("...and Oct 9's blind cap (66 GB of headroom it couldn't see filling) still does",
      "disk" in alarm.evaluate(healthy(disk_free_gb=82.6, cache_headroom_gb=66.0), 3.5))
check("...and a cache the cap can't count keeps the plain trend",
      "disk" in alarm.evaluate(healthy(disk_free_gb=66.9, cache_headroom_gb=30.6, uncounted=["abc-1 (42 GB)"]), 5.5))
check("...and the low line itself never waits on headroom",
      "disk" in alarm.evaluate(healthy(disk_free_gb=20.0, cache_headroom_gb=0.0), None))
check("headroom adds what each release may still grow",
      alarm.cache_headroom({"releases": [{"budgetGB": 30.0, "gb": 16.2}, {"budgetGB": 30.0, "gb": 13.3},
                                         {"budgetGB": 3.0, "gb": 3.0}, {"budgetGB": 0.0, "gb": 0.0}]}) == 30.5)
check("unreadable headroom is None", alarm.cache_headroom({"releases": [{"gb": 1.0}]}) is None)
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
_, cleared = alarm.compose([("disk", "clear", "66.9 GB free")], healthy(disk_free_gb=66.6, cache_headroom_gb=30.6), 5.4,
                           [], T0)
check("a clear says which way the disk is moving, and where the cap stops it",
      "falling 5.4 GB an hour" in cleared and "leave about 36 GB free" in cleared, cleared)
# Oct 10 2026, 3:37 PM EDT: "back to normal (the disk is filling)" with
# "CLEARED: the disk is filling. ... full in about 12 hours" read as still filling.
clear_subject, _ = alarm.compose([("disk", "clear", "66.5 GB free, falling 5.4 GB an hour: full in about 12 hours")],
                                 healthy(disk_free_gb=66.2, cache_headroom_gb=30.6), 5.3, [], T0)
check("a clear's subject says the good news, never the alarm's name",
      clear_subject == "PERM Tracker server: back to normal, the disk is no longer on course to fill", clear_subject)
_, clear_text = alarm.compose([("disk", "clear", "66.5 GB free, falling 5.4 GB an hour: full in about 12 hours")],
                              healthy(disk_free_gb=66.2, cache_headroom_gb=30.6), 5.3, [], T0)
check("...and the body marks the old reason as what it had said",
      "CLEARED: the disk is no longer on course to fill. (It had said: 66.5 GB free" in clear_text, clear_text)
check("every alarm has its cleared wording", set(alarm.CLEARED) == set(alarm.TITLES), str(set(alarm.TITLES) ^ set(alarm.CLEARED)))
mixed_subject, _ = alarm.compose([("disk", "clear", "x"), ("memory", "start", "300 MB")], healthy(), None, [], T0)
check("a mixed email's subject names only what is wrong now", mixed_subject == "PERM Tracker server: memory is low", mixed_subject)

# Swap that only holds old pages, with memory to spare, is no alarm (Oct 11 2026).
check("2.5 GB of swap with 7 GB of memory free is no alarm",
      "memory" not in alarm.evaluate(healthy(swap_used_mb=2500, mem_available_mb=7000), None))
check("...but with under 2 GB free it is", "memory" in alarm.evaluate(healthy(swap_used_mb=2500, mem_available_mb=1500), None))
check("under 500 MB available is an alarm whatever swap holds",
      "memory" in alarm.evaluate(healthy(swap_used_mb=0, mem_available_mb=400), None))

# Our services stopped after an error without being marked failed (a crash
# into systemd's start limit leaves a unit "inactive").
SHOW = ("Id=permtracker-web@blue2.service\nActiveState=inactive\nUnitFileState=enabled\nResult=exit-code\n\n"
        "Id=permtracker-web@green2.service\nActiveState=inactive\nUnitFileState=enabled\nResult=success\n\n"
        "Id=permtracker-cron@scorecard.service\nActiveState=inactive\nUnitFileState=static\nResult=exit-code\n")
check("a switched-on unit left inactive after an error is caught",
      alarm.stopped_after_error(SHOW) == ["permtracker-web@blue2.service"], str(alarm.stopped_after_error(SHOW)))
check("...and raises the units alarm, named as stopped",
      "stopped after an error: permtracker-web@blue2.service"
      in alarm.evaluate(healthy(stopped_units=["permtracker-web@blue2.service"]), None).get("units", ""))
import importlib.machinery as _m, importlib.util as _u
_l = _m.SourceFileLoader("pt_health_for_alarm", str(HERE / "bin" / "permtracker-health"))
_h = _u.module_from_spec(_u.spec_from_loader("pt_health_for_alarm", _l)); _l.exec_module(_h)
check("the alarm and the morning report's sampler read stopped units the same way",
      _h.stopped_after_error(SHOW) == alarm.stopped_after_error(SHOW))
check("...and what was done", "Done automatically" in text and "page-cache cap" in text, text)

# A release holding far more than the cap counted is an alarm (Oct 7 to 10 2026).
blind = alarm.uncounted_releases({"releases": [
    {"release": "abc-1", "serverGB": 42.0, "gb": 0.0},
    {"release": "def-2", "serverGB": 20.0, "gb": 18.0}]})
check("a release with 42 GB on disk and 0 counted is named; one that matches is not",
      len(blind) == 1 and blind[0].startswith("abc-1"), str(blind))
check("...and it raises the cap-can't-see alarm",
      "page-cache-blind" in alarm.evaluate(healthy(uncounted=blind), None))

# The disk-critical cleanup drops other releases' route caches, never the live slot's.
import tempfile as _tf2
_t = pathlib.Path(_tf2.mkdtemp())
for _rel in ("a", "a.w2", "b"):
    (_t / "app" / "releases" / _rel / ".next" / "server" / "route-cache" / "x").mkdir(parents=True)
(_t / "app" / "slots").mkdir()
for _slot, _rel in (("blue", "a"), ("blue2", "a.w2"), ("green", "b")):
    (_t / "app" / "slots" / _slot).symlink_to(_t / "app" / "releases" / _rel)
(_t / "app" / "active").write_text("blue")
_saved_app, _saved_dry = alarm.APP, alarm.DRY_RUN
alarm.APP, alarm.DRY_RUN = _t, False
try:
    dropped = alarm.drop_route_caches()
    check("only the standby release's cache goes", dropped == ["b"], str(dropped))
    check("the live slot's two folders keep theirs",
          (_t / "app/releases/a/.next/server/route-cache").is_dir() and (_t / "app/releases/a.w2/.next/server/route-cache").is_dir())
    (_t / "app" / "active").unlink()
    check("without knowing the live slot it deletes nothing", alarm.drop_route_caches() == [])
finally:
    alarm.APP, alarm.DRY_RUN = _saved_app, _saved_dry

# An email that was due and couldn't go makes the run fail, so systemd shows it.
import os as _os, tempfile as _tf
_d = _tf.mkdtemp()
alarm.RUN = pathlib.Path(_d)
alarm.STATE = alarm.RUN / "alarm.json"
alarm.DRY_RUN = False
alarm.snapshot = lambda now: healthy(disk_free_gb=5.0)
alarm.heal = lambda on: []
alarm.send = lambda subject, text: False
check("a due email that couldn't be sent exits 1", alarm.main() == 1)
alarm.send = lambda subject, text: True
_os.remove(alarm.STATE)
check("a due email that went exits 0", alarm.main() == 0)

sys.exit(1 if failures else 0)
