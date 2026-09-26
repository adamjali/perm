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

from build_entity_detail import (  # noqa: E402
    LIVE_COLS, employer_waits, et_date, live_norm, live_only_rows, pending_diff, pending_norm, wait_summary)

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


def check_live_only_rows() -> None:
    """The sitemap's live-only family: published slugs excluded, ranks dense,
    ordered by first filing then slug, name by majority spelling."""
    live = [
        {"employer_slug": "acme-llc", "employer_name": "ACME LLC", "filing_date": "2026-05-02", "changed_on": "2026-09-20"},
        {"employer_slug": "acme-llc", "employer_name": "Acme LLC", "filing_date": "2026-04-30", "changed_on": "2026-08-27"},
        {"employer_slug": "acme-llc", "employer_name": "ACME LLC", "filing_date": "2026-06-01", "changed_on": None},
        {"employer_slug": "big-published-co", "employer_name": "Big Published Co", "filing_date": "2026-01-01"},
        {"employer_slug": "zeta-inc", "employer_name": "Zeta Inc", "filing_date": "2026-04-30"},
        {"employer_slug": "", "employer_name": "no slug", "filing_date": "2026-01-01"},
    ]
    rows = live_only_rows(live, {"big-published-co"})
    check("published employers are excluded, no-slug rows dropped", [r[0] for r in rows], ["acme-llc", "zeta-inc"])
    check("ranks dense from 1, by first filing then slug", [(r[0], r[4]) for r in rows], [("acme-llc", 1), ("zeta-inc", 2)])
    check("cases counted", rows[0][2], 3)
    check("majority spelling kept", rows[0][1], "ACME LLC")
    check("first filing kept", rows[0][3], "2026-04-30")
    # The sitemap's lastmod: the newest day any case changed, per employer.
    check("last_changed is the newest change among the employer's cases", rows[0][5], "2026-09-20")
    check("a case with no change stamp falls back to its filing date", rows[1][5], "2026-04-30")


def check_et_date() -> None:
    """fetched_at is epoch milliseconds, dated on the site's Eastern clock."""
    import datetime as dt
    late = int(dt.datetime(2026, 9, 24, 3, 30, tzinfo=dt.timezone.utc).timestamp() * 1000)
    check("11:30 PM Eastern stays on the Eastern date, not UTC's tomorrow", et_date(late), "2026-09-23")
    check("seconds are tolerated", et_date(late // 1000), "2026-09-23")
    check("an absent stamp is None", (et_date(None), et_date("")), (None, None))


def pending_row(slug: str, tracked: int, pending: int, stages: str,
                oldest: str | None = "2025-07-02") -> list[dict]:
    """A stored perm_entity_pending row, integers as strings as libSQL returns them."""
    return [
        {"type": "text", "value": "employer"},
        {"type": "text", "value": slug},
        {"type": "integer", "value": str(tracked)},
        {"type": "integer", "value": str(pending)},
        {"type": "text", "value": stages},
        {"type": "null"} if oldest is None else {"type": "text", "value": oldest},
    ]


def check_wait_summary() -> None:
    import datetime as _dt
    # 2026-09-01 12:00 Eastern, in milliseconds; filings 300 to 319 days before.
    noon = int(_dt.datetime(2026, 9, 1, 16, 0, tzinfo=_dt.timezone.utc).timestamp() * 1000)
    pairs = [((_dt.date(2026, 9, 1) - _dt.timedelta(days=300 + k)).isoformat(), noon) for k in range(20)]
    s = wait_summary(pairs)
    check("the median of 300..319 is 310", s and s["p50"], 310)
    check("n counts every usable decision", s and s["n"], 20)
    check("under 20 decisions is no summary", wait_summary(pairs[:19]), None)
    # 1 AM UTC on Sep 2 is still Sep 1 in the East: the day comes from Eastern time.
    late = int(_dt.datetime(2026, 9, 2, 1, 0, tzinfo=_dt.timezone.utc).timestamp() * 1000)
    check("the decision day is Eastern", wait_summary([("2025-11-05", late)] * 20)["p50"], 300)
    fast = [((_dt.date(2026, 9, 1) - _dt.timedelta(days=280)).isoformat(), noon)] * 25
    slow = [((_dt.date(2026, 9, 1) - _dt.timedelta(days=400)).isoformat(), noon)] * 25
    few = [((_dt.date(2026, 9, 1) - _dt.timedelta(days=100)).isoformat(), noon)] * 5
    ranked = employer_waits({"s": slow, "f": fast, "x": few}, {"f": "Fast Co", "s": "Slow Co"})
    check("employers under the minimum are not ranked", [r["slug"] for r in ranked], ["f", "s"])
    check("fastest first, with its median", (ranked[0]["name"], ranked[0]["p50"]), ("Fast Co", 280))


def check_pending_diff() -> None:
    """The queue band's table, refreshed nightly since 2026-09-26."""
    print("perm_entity_pending diff")
    stored = [
        pending_row("adobe-inc", 968, 199, '{"ANALYST REVIEW":197,"RFI ISSUED":2}'),
        pending_row("steady-co", 10, 3, '{"ANALYST REVIEW":3}'),
        pending_row("gone-co", 4, 1, '{"ANALYST REVIEW":1}'),
    ]
    built = [
        # Adobe on Sep 26: 216 went on hold.
        {"kind": "employer", "slug": "adobe-inc", "tracked": 987, "pending": 218,
         "stages": '{"APPLICATION ON HOLD":216,"ANALYST REVIEW":2}', "oldest": "2025-07-02"},
        # The same facts as stored, built as ints with the JSON keys reordered:
        # must NOT read as a change, or every row is rewritten every night.
        {"kind": "employer", "slug": "steady-co", "tracked": 10, "pending": 3,
         "stages": '{"ANALYST REVIEW": 3}', "oldest": "2025-07-02"},
        {"kind": "employer", "slug": "new-co", "tracked": 2, "pending": 2,
         "stages": '{"ANALYST REVIEW":2}', "oldest": "2026-09-20"},
    ]
    changed, gone, moved = pending_diff(stored, built)
    check("only the rows that moved are written",
          sorted(r["slug"] for r in changed), ["adobe-inc", "new-co"])
    check("an employer no longer in the mirror is deleted", gone, [("employer", "gone-co")])
    check("every page whose band moved is expired",
          sorted(moved), ["adobe-inc", "gone-co", "new-co"])
    check("the big move outranks the small ones",
          max(moved, key=moved.get), "adobe-inc")
    check("string integers and reordered JSON normalise alike",
          pending_norm(stored[1]), pending_norm(built[1]))
    check("a null oldest agrees with None",
          pending_norm(pending_row("x", 1, 0, "{}", None)),
          pending_norm({"kind": "employer", "slug": "x", "tracked": 1, "pending": 0,
                        "stages": "{}", "oldest": None}))


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

    # Every group runs BEFORE the verdict. These three used to run after it,
    # so a failure in them printed FAIL and still exited 0 (found 2026-09-26).
    check_live_only_rows()
    check_et_date()
    check_pending_diff()
    check_wait_summary()

    print()
    if FAILURES:
        print(f"{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
