#!/usr/bin/env python3
"""The cross-check skips clean when the third party is down, and only then.
No network: urllib and the database are stood in for."""
from __future__ import annotations

import pathlib
import sys
import urllib.error

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cross_check_sources as cc  # noqa: E402

fails: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


def refuse(*_a, **_k):
    raise urllib.error.URLError("connection refused")


cc.BASE = "https://third-party.example/api"
cc.Database = lambda: None
real_open = cc.urllib.request.urlopen
cc.urllib.request.urlopen = refuse
try:
    try:
        cc.get("stats/summary")
        check(False, "an unreachable third party raises ThirdPartyDown")
    except cc.ThirdPartyDown:
        check(True, "an unreachable third party raises ThirdPartyDown")
    check(cc.main() == 0, "and the cross-check skips clean")
finally:
    cc.urllib.request.urlopen = real_open

# Our own failure is not the third party's: it still propagates.
cc.compare = lambda: (_ for _ in ()).throw(RuntimeError("SQLITE_BUSY"))
try:
    cc.main()
    check(False, "a failure on our side is not swallowed as the third party being down")
except RuntimeError:
    check(True, "a failure on our side is not swallowed as the third party being down")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
