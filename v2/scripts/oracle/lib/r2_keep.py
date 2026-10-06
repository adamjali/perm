#!/usr/bin/env python3
"""Which off-site backup copies may go, decided only after a newer one landed.

Until Oct 5 2026 the bucket deleted every copy 15 days after upload. A server
that dies uploads nothing more, so 15 days later its last copies would have
deleted themselves. Copies are now removed only by permtracker-r2-prune, which
the three backup jobs run right after a new copy's upload and size check. No
new copy, nothing deleted.

Kept: the newest 15 copies, the first copy of each of the 3 newest months, and
anything under 8 days old (the bucket's 7-day lock refuses those deletes
anyway). Nothing is deleted unless the copy just uploaded is the newest one
listed, so a stale or partial listing deletes nothing.

Reads `rclone lsjson` of one folder on stdin and prints one name per line to
delete:

  rclone lsjson r2:permtracker-backups/db/ | python3 r2_keep.py db-20261005-0715.sql.zst
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone

KEEP_NEWEST = 15
KEEP_MONTHS = 3
MIN_AGE = timedelta(days=8)
# db-20261005-0715.sql.zst, server-20261005-0735.tar.zst.cms, convex-...zip.cms
STAMP = re.compile(r"-(\d{8})-(\d{4})\.")


def stamp(name: str) -> datetime | None:
    m = STAMP.search(name)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def to_delete(names: list[str], just_uploaded: str, now: datetime) -> list[str]:
    # A name without a readable stamp is never a candidate: kept, whatever it is.
    dated = sorted(((t, n) for n in names if (t := stamp(n)) is not None), reverse=True)
    if not dated or dated[0][1] != just_uploaded:
        return []
    keep = {n for _, n in dated[:KEEP_NEWEST]}
    first_of_month: dict[tuple[int, int], str] = {}
    for t, n in dated:  # newest first, so the last write per month is its first copy
        first_of_month[(t.year, t.month)] = n
    for month in sorted(first_of_month, reverse=True)[:KEEP_MONTHS]:
        keep.add(first_of_month[month])
    return [n for t, n in dated if n not in keep and now - t >= MIN_AGE]


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: rclone lsjson <folder> | r2_keep.py <name just uploaded>", file=sys.stderr)
        return 2
    listing = json.load(sys.stdin)
    names = [e["Name"] for e in listing if not e.get("IsDir")]
    for name in to_delete(names, argv[1], datetime.now(timezone.utc)):
        print(name)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
