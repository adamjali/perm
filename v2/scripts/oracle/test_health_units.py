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

# How much the page caches may still grow (the morning report needs it to tell
# a cache refilling after a deploy from the disk filling; Oct 12 2026).
_rel = [{"role": "live", "gb": 8.2, "budgetGB": 30.0, "serverGB": 9.0},
        {"role": "live", "gb": 6.9, "budgetGB": 30.0, "serverGB": 7.5},
        {"role": "standby", "gb": 3.0, "budgetGB": 3.0}, {"role": "old", "gb": 0.0, "budgetGB": 0.0}]
check("headroom adds what each cache may still grow", health.cache_headroom(_rel) == 44.9, str(health.cache_headroom(_rel)))
check("a cache over its budget adds nothing, never a negative",
      health.cache_headroom([{"gb": 33.0, "budgetGB": 30.0}, {"gb": 1.0, "budgetGB": 3.0}]) == 2.0)
check("an unreadable budget makes the headroom unknown", health.cache_headroom([{"gb": 1.0}]) is None)
check("pages the cap can't see make it unknown",
      health.cache_headroom([{"gb": 2.0, "budgetGB": 30.0, "serverGB": 40.0}]) is None)
check("no releases on record is unknown, never zero", health.cache_headroom([]) is None)

# The LCA database's newest backup (Oct 19 2026: read before the live
# signature existed, every run failed once the first copy was written).
import tempfile  # noqa: E402
with tempfile.TemporaryDirectory() as tmp:
    rec = pathlib.Path(tmp) / "LCA_OK"
    check("no LCA backup record is None", health.lca_backup(rec, "1:2:3") is None)
    rec.write_text("2026-10-19T18:17:49Z 136426620 lca-20261019-1813.sql.zst 2468593664:1792431532:2483058144\n")
    got = health.lca_backup(rec, "2468593664:1792431532:2483058144")
    check("a backup taken at the live signature is current",
          got == {"at": "2026-10-19T18:17:49Z", "bytes": 136426620, "file": "lca-20261019-1813.sql.zst", "current": True})
    check("one taken before a change is not", health.lca_backup(rec, "2468593664:1792999999:2483058144")["current"] is False)
    check("with no LCA database it still reads, as not current", health.lca_backup(rec, None)["current"] is False)
src = (HERE / "bin" / "permtracker-health").read_text()
check("the backup is judged after the live signature is computed",
      src.index('lca_sig = f"{st.st_size}') < src.index("lca_ok = lca_backup("))

print(f"\n{len(failures)} failure(s)" if failures else "\nall passed")
sys.exit(1 if failures else 0)
