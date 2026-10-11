#!/usr/bin/env python3
"""The health check's list of services stopped after an error that systemd
never marked failed (bin/permtracker-health, stopped_after_error).
Run: python3 scripts/oracle/test_health_units.py"""
import importlib.machinery
import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
loader = importlib.machinery.SourceFileLoader("pt_health", str(HERE / "bin" / "permtracker-health"))
spec = importlib.util.spec_from_loader("pt_health", loader)
health = importlib.util.module_from_spec(spec)
loader.exec_module(health)

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


# The real blocks `systemctl show` printed on the server on Oct 11 2026 at
# 8:55 AM EDT, a day after the disk filled: pmlogger had crashed into its
# start limit and sat "inactive", which `systemctl --failed` never lists.
SHOW = """Id=pmlogger.service
ActiveState=inactive
UnitFileState=enabled
Result=exit-code

Id=pmcd.service
ActiveState=active
UnitFileState=enabled
Result=success

Id=pmlogger_farm.service
ActiveState=failed
UnitFileState=disabled
Result=exit-code

Id=pmie.service
ActiveState=inactive
UnitFileState=disabled
Result=success

Id=permtracker-cron@processing.service
ActiveState=inactive
UnitFileState=static
Result=success

Id=apt-daily.service
ActiveState=inactive
UnitFileState=static
Result=exit-code
"""

got = health.stopped_after_error(SHOW)
check("an enabled service left inactive after an error is listed", "pmlogger.service" in got, str(got))
check("a running one isn't", "pmcd.service" not in got, str(got))
check("a failed one isn't (systemctl --failed already lists it)", "pmlogger_farm.service" not in got, str(got))
check("a switched-off one that stopped cleanly isn't", "pmie.service" not in got, str(got))
check("a timer's job that finished isn't", not any(u.startswith("permtracker-cron") for u in got), str(got))
check("a static job that failed once and isn't switched on isn't", "apt-daily.service" not in got, str(got))
check("nothing else is listed", got == ["pmlogger.service"], str(got))
check("empty output lists nothing", health.stopped_after_error("") == [])

# The PCP units restart forever, a minute apart: five fast tries into a
# full disk is what left pmlogger dead for a day.
pcp = (HERE / "systemd" / "dropins" / "resources-pcp.conf").read_text()
check("PCP's drop-in lifts systemd's start limit", "StartLimitIntervalSec=0" in pcp)
check("...and waits between tries so a full disk can't make it spin", "RestartSec=60" in pcp)

print(f"\n{len(failures)} failure(s)" if failures else "\nall passed")
sys.exit(1 if failures else 0)
