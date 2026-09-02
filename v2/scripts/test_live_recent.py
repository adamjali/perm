#!/usr/bin/env python3
"""The diff that decides `perm_live_recent`'s nightly write cost.

WHY THIS FILE EXISTS. `perm_live_recent` holds every live case the published
disclosure files do not, which is ~137k rows. Rebuilt wholesale each night that
is ~4.1M writes a month against a 10M plan, to express the few hundred facts
that actually changed. So the writer diffs - and a diff that silently never
matches is not a slow diff, it is NO diff, while still logging "ok".

That is exactly what shipped for one run: libSQL returns integers as STRINGS to
protect precision, so a stored `is_final` came back as '0' and the freshly built
row held int 0. Every row compared unequal and all 136,886 were rewritten on a
night when nothing had changed. Caught by reading the log line - "136,886
written" on a second identical run - not by the code looking correct.

    python3 scripts/test_live_recent.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from build_entity_detail import LIVE_COLS, live_norm  # noqa: E402

FAILURES: list[str] = []


def check(name: str, got, want) -> None:
    if got == want:
        print(f"  ok   {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL {name}\n         got  {got!r}\n         want {want!r}")


def libsql_row(case: str, filing: str, status: str, is_final: int,
               emp: str, slug: str, title: str, seen: str | None = None) -> list[dict]:
    """A row shaped the way libSQL actually returns one: integers as strings."""
    return [
        {"type": "text", "value": case},
        {"type": "text", "value": filing},
        {"type": "text", "value": status},
        {"type": "integer", "value": str(is_final)},
        {"type": "text", "value": emp},
        {"type": "text", "value": slug},
        {"type": "text", "value": title},
        {"type": "null"} if seen is None else {"type": "text", "value": seen},
    ]


def built_row(case: str, filing: str, status: str, is_final: int,
              emp: str, slug: str, title: str, seen: str | None = None) -> dict:
    """A row shaped the way `build_live_recent` produces one."""
    return {
        "case_number": case, "filing_date": filing, "status": status,
        "is_final": is_final, "employer_name": emp,
        "employer_slug": slug, "job_title": title, "decided_seen": seen,
    }


ARGS = ("G-100-26077-713598", "2026-03-09", "ANALYST REVIEW", 0,
        "Syracuse University", "syracuse-university", "Lecturer")


def main() -> int:
    print("live_recent diff normaliser")

    # THE REGRESSION. These two describe the same row and must compare equal;
    # they did not, and that was the whole bug.
    check("a stored row equals the identical built row",
          live_norm(libsql_row(*ARGS)), live_norm(built_row(*ARGS)))

    # is_final specifically: the column whose type differs across the two
    # sources, and therefore the one the bug lived in.
    check("is_final normalises to an int from both sides",
          (live_norm(libsql_row(*ARGS))[3], live_norm(built_row(*ARGS))[3]),
          (0, 0))

    # A real change must still be seen, or the diff is cheap and useless.
    moved = list(ARGS)
    moved[2] = "CERTIFIED"
    moved[3] = 1
    check("a status change is detected",
          live_norm(libsql_row(*ARGS)) != live_norm(libsql_row(*moved)), True)

    renamed = list(ARGS)
    renamed[4] = "Syracuse University, Inc."
    check("an employer rename is detected",
          live_norm(libsql_row(*ARGS)) != live_norm(libsql_row(*renamed)), True)

    # NULL is not the string "None". A job title arriving null on one side and
    # empty on the other must not read as a change every single night.
    null_title = libsql_row(*ARGS[:6], "")
    null_title[6] = {"type": "null"}
    check("a null and an empty string agree",
          live_norm(null_title), live_norm(built_row(*ARGS[:6], "")))

    check("the tuple covers every stored column",
          len(live_norm(libsql_row(*ARGS))), len(LIVE_COLS))

    # decided_seen: a null on the stored side and None on the built side must
    # agree (every pending row, every night), and a date appearing must read
    # as a change exactly once.
    check("a null decided_seen agrees with None",
          live_norm(libsql_row(*ARGS)), live_norm(built_row(*ARGS, None)))
    decided = list(ARGS)
    decided[2], decided[3] = "CERTIFIED", 1
    check("a decision date appearing is a change",
          live_norm(libsql_row(*decided)) != live_norm(libsql_row(*decided, "2026-09-01")), True)
    check("the same decision date on both sides is not a change",
          live_norm(libsql_row(*decided, "2026-09-01")),
          live_norm(built_row(*decided, "2026-09-01")))

    print()
    if FAILURES:
        print(f"{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
