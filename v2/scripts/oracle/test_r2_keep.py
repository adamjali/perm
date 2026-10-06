#!/usr/bin/env python3
"""Off-site copies go only after a newer copy has landed, and never the last ones.

lib/r2_keep.py decides which R2 backup copies permtracker-r2-prune removes. The
rules that matter, each from the Oct 5 2026 question "if the server ever goes
down, would the backups delete themselves?":

* the copy just uploaded must be the newest one listed, or nothing goes;
* the newest 15 always stay, and so does the first copy of each of the 3
  newest months;
* nothing under 8 days old is a candidate (the bucket locks those for 7);
* a name without a readable stamp is never deleted.

Run: python3 scripts/oracle/test_r2_keep.py
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import subprocess
import sys
from datetime import datetime, timedelta, timezone

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("r2_keep", HERE / "lib" / "r2_keep.py")
assert spec and spec.loader
r2_keep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r2_keep)

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


NOW = datetime(2026, 12, 20, 12, 0, tzinfo=timezone.utc)


def daily(n: int, end: datetime = NOW, prefix: str = "db", ext: str = "sql.zst") -> list[str]:
    """n nightly copies, the newest on `end`'s day at 07:15 UTC."""
    out = []
    for i in range(n):
        t = (end - timedelta(days=i)).replace(hour=7, minute=15)
        out.append(f"{prefix}-{t:%Y%m%d}-{t:%H%M}.{ext}")
    return out


# 1. A normal night after months of uploads.
names = daily(90)
newest = names[0]
gone = r2_keep.to_delete(names, newest, NOW)
kept = set(names) - set(gone)
check("the newest 15 stay", set(names[:15]) <= kept)
check("the copy just uploaded stays", newest in kept)
check("the first copy of the 3 newest months stays",
      {"db-20261201-0715.sql.zst", "db-20261101-0715.sql.zst", "db-20261001-0715.sql.zst"} <= kept)
check("a fourth month's first copy goes", "db-20260922-0715.sql.zst" in gone)
# Dec 6 to 20 are the newest 15; Dec 1, Nov 1 and Oct 1 are the monthly firsts.
check("90 nightly copies keep 15 + 3 monthly firsts", len(kept) == 18, f"kept {len(kept)}: {sorted(kept)}")

# 2. The server died: the newest copy listed is NOT the one being reported.
# (Nothing runs then, but a stale call must still delete nothing.)
check("a name that is not the newest deletes nothing", r2_keep.to_delete(names, names[3], NOW) == [])
check("an empty listing deletes nothing", r2_keep.to_delete([], newest, NOW) == [])
check("a listing missing the new copy deletes nothing", r2_keep.to_delete(names[1:], newest, NOW) == [])

# 3. Long after the last upload, the copies that are left are never candidates
# for anything but a newer upload.
frozen = daily(15, end=NOW - timedelta(days=200))
check("a long-dead server's copies: nothing goes unless a newer one is named",
      r2_keep.to_delete(frozen, "db-20991231-0000.sql.zst", NOW) == [])

# 4. Many copies in one day (hand runs): nothing under 8 days old goes.
burst = [f"db-20261220-{h:02d}{m:02d}.sql.zst" for h in range(12) for m in (0, 30)]
burst_sorted = sorted(burst, reverse=True)
check("24 copies from today: none deleted (all under 8 days)",
      r2_keep.to_delete(burst + daily(5, end=NOW - timedelta(days=1)), burst_sorted[0], NOW) == [])

# 5. Fewer than 15 copies: nothing goes.
check("10 copies: nothing goes", r2_keep.to_delete(daily(10), daily(10)[0], NOW) == [])

# 6. Names without a stamp are never touched.
odd = names + ["README.txt", "db-manual.sql.zst"]
check("unstamped names are kept", not ({"README.txt", "db-manual.sql.zst"} & set(r2_keep.to_delete(odd, newest, NOW))))

# 7. The other two folders' names parse the same way.
for prefix, ext in (("server", "tar.zst.cms"), ("convex", "zip.cms")):
    ns = daily(40, prefix=prefix, ext=ext)
    g = r2_keep.to_delete(ns, ns[0], NOW)
    check(f"{prefix}: newest 15 stay and something older goes", set(ns[:15]).isdisjoint(g) and len(g) > 0)

# 8. The command line, as permtracker-r2-prune calls it: rclone lsjson on stdin.
listing = json.dumps([{"Name": n, "Size": 1, "IsDir": False} for n in daily(30, end=datetime.now(timezone.utc))])
p = subprocess.run([sys.executable, str(HERE / "lib" / "r2_keep.py"), daily(30, end=datetime.now(timezone.utc))[0]],
                   input=listing, capture_output=True, text=True)
out = [l for l in p.stdout.splitlines() if l]
check("the command prints only names older than the newest 15", p.returncode == 0 and 10 <= len(out) <= 15, f"rc {p.returncode}, {len(out)} lines, {p.stderr[:200]}")
p = subprocess.run([sys.executable, str(HERE / "lib" / "r2_keep.py"), "x"], input="not json", capture_output=True, text=True)
check("unreadable input fails (the caller then deletes nothing)", p.returncode != 0 and not p.stdout.strip())

print(f"\n{len(failures)} failed")
sys.exit(1 if failures else 0)
