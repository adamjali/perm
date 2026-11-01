#!/usr/bin/env python3
"""The nightly database refresh (bin/permtracker-db-refresh): it restarts sqld only when sqld's own
memory (in RAM plus in swap) passes the line, never during a deploy, and counts no file-backed page.
Run: python3 scripts/oracle/test_db_refresh.py"""
import importlib.machinery
import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
loader = importlib.machinery.SourceFileLoader("pt_db_refresh", str(HERE / "bin" / "permtracker-db-refresh"))
spec = importlib.util.spec_from_loader("pt_db_refresh", loader)
dr = importlib.util.module_from_spec(spec)
loader.exec_module(dr)

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


# sqld on Nov 1 2026: 4.1 GB in RAM, 1.4 GB in swap, and its file-backed pages beside them.
STATUS = """Name:\tsqld
VmRSS:\t 4102000 kB
RssAnon:\t 4089200 kB
RssFile:\t 12800 kB
RssShmem:\t 0 kB
VmSwap:\t 1426860 kB
"""
mb = dr.memory_mb(STATUS)
check("memory counts RAM and swap, not file pages", mb == (4089200 + 1426860) // 1024, str(mb))
check("a fresh sqld reads small", dr.memory_mb("RssAnon:\t 300000 kB\nVmSwap:\t 0 kB\n") == 292)
go, why = dr.decide(5386, 4096, deploying=False)
check("over the line restarts", go and "restarting" in why, why)
go, why = dr.decide(3000, 4096, deploying=False)
check("under the line does nothing", not go and "nothing to do" in why, why)
go, why = dr.decide(9000, 4096, deploying=True)
check("never during a deploy", not go and "deploy" in why, why)
check("the default line is 4 GB", dr.LIMIT_MB == 4096 or "DB_REFRESH_LIMIT_MB" in __import__("os").environ)
timer = (HERE / "systemd" / "permtracker-db-refresh.timer").read_text()
check("the timer runs at 1:35 AM Eastern", "01:35:00 America/New_York" in timer)

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
