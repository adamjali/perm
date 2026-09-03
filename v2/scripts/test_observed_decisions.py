#!/usr/bin/env python3
"""The observed-decision series, and the three ways it could publish a lie.

    python3 scripts/test_observed_decisions.py

NO NETWORK and no production database. The end-to-end cases run the REAL SQL
against in-memory SQLite through `lib_sqlite_shim`, because the defects here
live inside the statements: a `NOT IN` over a grouped subquery, a `GROUP BY`
on a timestamp, and a `DELETE ... NOT IN` that empties a table if the set it
was given is empty.

WHAT THIS FILE IS ABOUT. `daily_decisions` held three sources and read one.
`dol-disclosure` is DOL's own dating and stops at the last published quarter;
`permtrack` was the rival's series, backfilled once, overlapping ours on 88
dates; `flag-live` was labelled as our own per-case scan and was in fact
mirrored from permtrack's `daily-summary` endpoint on 2026-08-27T03:25Z, two
days before our first sweep ever ran. Both are deleted. `sweep-observed`
replaces them with our own observations out of `perm_case_events`.

Three things have to hold and each was measured, not assumed:

  1. THE FILTERS MATCH THE FEED. `src/lib/turso/changes.ts` renders the same
     rows per case. If it and the chart disagreed about which rows count, a
     reader could click a day on one and find a different day on the other.
  2. A CONTAMINATED DAY IS WITHHELD, NOT TRIMMED. 2026-08-28 carries two
     timestamps, 58 rows and 94,523. Dropping the second leaves 57 decisions,
     which is a plausible number and a lie.
  3. NOTHING UNIONS THE SOURCES. `sum(total) GROUP BY date` across this table
     was already wrong before today: permtrack overlapped `dol-disclosure` on
     88 dates and injected 42,056 phantom decisions into it.
"""
from __future__ import annotations

import datetime
import importlib.util
import json
import pathlib
import re
import sqlite3
import sys

HERE = pathlib.Path(__file__).resolve().parent
V2 = HERE.parent
sys.path.insert(0, str(HERE))

from lib_sqlite_shim import SqliteTurso  # noqa: E402

spec = importlib.util.spec_from_file_location("csd", HERE / "ingest_case_status_direct.py")
csd = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(csd)

FAILURES: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{'' if cond else f': {detail}'}")
    if not cond:
        FAILURES.append(label)


# ---------------------------------------------------------------------------
# A database shaped like production's, with the real backfill in it
# ---------------------------------------------------------------------------

EVENTS_DDL = """CREATE TABLE perm_case_events (
    case_number TEXT NOT NULL, changed_at INTEGER NOT NULL,
    from_status TEXT NOT NULL, to_status TEXT NOT NULL,
    to_final INTEGER NOT NULL, source TEXT NOT NULL,
    PRIMARY KEY (case_number, changed_at))"""

DAILY_DDL = """CREATE TABLE daily_decisions (
    date TEXT NOT NULL, source TEXT NOT NULL,
    total INTEGER, certified INTEGER, denied INTEGER, withdrawn INTEGER,
    fetched_at INTEGER NOT NULL, PRIMARY KEY (date, source))"""

DOCS_DDL = """CREATE TABLE perm_docs (
    key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)"""


def ts(day: str, hour: int = 8) -> int:
    """Epoch ms at `hour` UTC on an ISO day."""
    d = datetime.date.fromisoformat(day)
    return int(datetime.datetime(d.year, d.month, d.day, hour,
                                 tzinfo=datetime.timezone.utc).timestamp() * 1000)


def seeded_db(rows: list[tuple[int, str, str, int]]) -> SqliteTurso:
    """`rows` is (changed_at, from_status, to_status, n) - n identical events."""
    db = SqliteTurso()
    db.script([EVENTS_DDL, DAILY_DDL, DOCS_DDL])
    i = 0
    payload = []
    for changed_at, frm, to, n in rows:
        for _ in range(n):
            i += 1
            payload.append((f"G-100-26200-{i:06d}", changed_at, frm, to,
                            1 if to.upper() in csd.FINAL_STATUSES else 0,
                            csd.SOURCE))
    db.conn.executemany(
        "INSERT INTO perm_case_events VALUES (?,?,?,?,?,?)", payload)
    db.conn.commit()
    return db


def series(db: SqliteTurso) -> dict[str, tuple[int, int, int, int]]:
    rows = db.execute(
        "SELECT date, total, certified, denied, withdrawn FROM daily_decisions "
        "WHERE source = ? ORDER BY date", [csd.OBSERVED_SOURCE]
    )["response"]["result"]["rows"]
    return {r[0]["value"]: tuple(int(c["value"]) for c in r[1:]) for r in rows}


def doc(db: SqliteTurso) -> dict | None:
    j = db.scalar("SELECT json FROM perm_docs WHERE key = 'observed_decisions'")
    return json.loads(j) if j else None


def main() -> int:
    print("observed-decision series")

    # -----------------------------------------------------------------------
    # 1. The constants the chart shares with the per-case feed.
    #
    # These live in two languages and there is no compiler between them. The
    # RFI funnel already had to learn this: a drifted source string silently
    # zeroed half a published figure forever.
    # -----------------------------------------------------------------------
    changes_ts = (V2 / "src/lib/turso/changes.ts").read_text()

    def ts_const(name: str) -> str | None:
        m = re.search(rf'^const {name} = (.+);$', changes_ts, re.M)
        return m.group(1).strip() if m else None

    check("changes.ts is readable and still declares the three constants",
          all(ts_const(n) for n in ("EXPIRY_FROM", "EXPIRY_TO", "BULK_WRITE_ROWS")),
          "one of EXPIRY_FROM / EXPIRY_TO / BULK_WRITE_ROWS is gone or renamed")
    check("EXPIRY_FROM matches the feed",
          ts_const("EXPIRY_FROM") == f'"{csd.EXPIRY_FROM}"',
          f'changes.ts {ts_const("EXPIRY_FROM")} vs python {csd.EXPIRY_FROM!r}')
    check("EXPIRY_TO matches the feed",
          ts_const("EXPIRY_TO") == f'"{csd.EXPIRY_TO}"',
          f'changes.ts {ts_const("EXPIRY_TO")} vs python {csd.EXPIRY_TO!r}')
    check("BULK_WRITE_ROWS matches the feed",
          ts_const("BULK_WRITE_ROWS") == str(csd.BULK_WRITE_ROWS),
          f'changes.ts {ts_const("BULK_WRITE_ROWS")} vs python {csd.BULK_WRITE_ROWS}')

    # -----------------------------------------------------------------------
    # 2. Every final status has a column.
    #
    # FINAL_STATUSES is the canonical set, reused by the sweep to set is_final.
    # A member with no bucket would drop its decisions into no column and
    # under-count the series with nothing to see.
    # -----------------------------------------------------------------------
    check("DECISION_BUCKETS covers FINAL_STATUSES exactly",
          set(csd.DECISION_BUCKETS) == set(csd.FINAL_STATUSES),
          f"unbucketed {set(csd.FINAL_STATUSES) - set(csd.DECISION_BUCKETS)}, "
          f"extra {set(csd.DECISION_BUCKETS) - set(csd.FINAL_STATUSES)}")
    check("every bucket is a real column of daily_decisions",
          set(csd.DECISION_BUCKETS.values()) <= {"certified", "denied", "withdrawn"},
          str(set(csd.DECISION_BUCKETS.values())))

    # -----------------------------------------------------------------------
    # 3. The day fold agrees with SQLite's own UTC bucketing.
    #
    # `DATE(changed_at / 1000, 'unixepoch')` is what this replaced and what the
    # feed's UTC midnight bounds still mean. A local-time fold would move every
    # evening-ET event onto the previous day on one surface only.
    # -----------------------------------------------------------------------
    conn = sqlite3.connect(":memory:")
    probe = [1787858206944, 1787947868892, 1788011326075, 1788439693479,
             ts("2026-08-30", 23), ts("2026-08-30", 0)]
    mismatched = [
        t for t in probe
        if conn.execute("SELECT DATE(?/1000,'unixepoch')", (t,)).fetchone()[0]
        != csd.observed_day(t)]
    check("observed_day() equals SQLite's DATE(x/1000,'unixepoch')",
          not mismatched, f"{mismatched} disagree")

    # -----------------------------------------------------------------------
    # 4. The fold, on production's actual shape.
    #
    # 08-28 is the real backfill day: a 58-row stamp beside a 94,523-row one.
    # -----------------------------------------------------------------------
    S = csd.SOURCE
    stamps = [
        (ts("2026-08-28", 3), S, 58),
        (ts("2026-08-28", 22), S, 94_523),   # the backfill
        (ts("2026-08-30", 3), S, 912),
        (ts("2026-08-31", 3), S, 1_090),
        (ts("2026-09-01", 3), S, 938),       # "today" in the cases below
    ]
    decisions = [
        (ts("2026-08-28", 3), "CERTIFIED", 56),
        (ts("2026-08-28", 22), "CERTIFIED", 40_000),
        (ts("2026-08-30", 3), "CERTIFIED", 240),
        (ts("2026-08-30", 3), "DENIED", 13),
        (ts("2026-08-30", 3), "WITHDRAWN", 3),
        (ts("2026-08-31", 3), "CERTIFIED", 769),
        (ts("2026-09-01", 3), "CERTIFIED", 861),
    ]
    days, withheld = csd.fold_observed_decisions(stamps, decisions, "2026-09-01")

    check("a day contaminated by a catch-up sweep is withheld whole",
          "2026-08-28" not in days and "2026-08-28" in withheld,
          f"days={sorted(days)} withheld={sorted(withheld)}")
    check("the withheld day says why, with the size of the bulk write",
          "94,523" in withheld.get("2026-08-28", ""),
          withheld.get("2026-08-28", "<absent>"))
    check("the run's own day is withheld as incomplete",
          "2026-09-01" not in days and "incomplete" in withheld.get("2026-09-01", ""),
          withheld.get("2026-09-01", "<absent>"))
    check("the days in between are published",
          sorted(days) == ["2026-08-30", "2026-08-31"], str(sorted(days)))
    check("total is the sum of the three buckets",
          days["2026-08-30"] == {"certified": 240, "denied": 13,
                                 "withdrawn": 3, "total": 256},
          str(days["2026-08-30"]))

    # A day the sweep ran and saw nothing decided is a REAL zero. A day it did
    # not run at all is absent. Storing the second as zero draws a trough that
    # is indistinguishable from a holiday - the lesson ingest_rfi_funnel.py
    # already had to learn from permtrack's `has_data` flag.
    quiet, _ = csd.fold_observed_decisions(
        [(ts("2026-08-30"), csd.SOURCE, 4), (ts("2026-08-31"), csd.SOURCE, 7)],
        [(ts("2026-08-31"), "CERTIFIED", 2)], "2026-09-01")
    check("a day the sweep observed with no decisions is published as zero",
          quiet.get("2026-08-30", {}).get("total") == 0, str(quiet.get("2026-08-30")))
    check("a day the sweep never ran on has no row at all",
          "2026-08-29" not in quiet, str(sorted(quiet)))

    # A DAY ONLY THE RETIRED MIRROR WROTE IS NOT A DAY WE OBSERVED. This is
    # production's 2026-08-27 exactly: one 48-row timestamp from
    # permtrack.app's watchlist diff, and no DOL sweep of our own until the
    # next UTC day. Publishing it put a 0 at the head of the series.
    MIRROR = "permtrack.app/api/watchlist (mirror; underlying: flag.dol.gov case status)"
    mixed, _ = csd.fold_observed_decisions(
        [(ts("2026-08-27", 3), MIRROR, 48), (ts("2026-08-28", 3), csd.SOURCE, 6)],
        [(ts("2026-08-27", 3), "CERTIFIED", 2),
         (ts("2026-08-28", 3), "CERTIFIED", 6)], "2026-08-29")
    check("a day only the retired mirror wrote is not published at all",
          "2026-08-27" not in mixed and mixed.get("2026-08-28", {}).get("total") == 6,
          str(mixed))

    # An unmapped final status must stop the step, not quietly vanish - and it
    # must raise a RuntimeError, NOT a SystemExit. `run_independently` catches
    # `Exception`; SystemExit is a BaseException and would sail past it and
    # kill the process before `record_run` writes the audit row, leaving
    # check_ingest_health.py nothing to turn red. Asserting the TYPE is the
    # only way that distinction is checkable, and with the guard deleted the
    # dict lookup raises KeyError, which this also rejects.
    outcome = "no error at all"
    try:
        csd.fold_observed_decisions(
            [(ts("2026-08-30"), csd.SOURCE, 3)],
            [(ts("2026-08-30"), "CERTIFIED - REVOKED", 3)], "2026-09-01")
    except RuntimeError:
        outcome = "RuntimeError"
    except BaseException as e:  # noqa: BLE001 - the probe is the point
        outcome = f"{type(e).__name__}: {e}"
    check("a final status with no bucket raises RuntimeError, not a crash "
          "and not a SystemExit run_independently cannot catch",
          outcome == "RuntimeError", outcome)

    # -----------------------------------------------------------------------
    # 5. End to end, through the real SQL.
    # -----------------------------------------------------------------------
    yday = (datetime.datetime.now(datetime.timezone.utc).date()
            - datetime.timedelta(days=1)).isoformat()
    two = (datetime.datetime.now(datetime.timezone.utc).date()
           - datetime.timedelta(days=2)).isoformat()
    db = seeded_db([
        (ts(two, 3), "ANALYST REVIEW", "CERTIFIED", 5),
        (ts(two, 3), "ANALYST REVIEW", "DENIED", 2),
        (ts(two, 3), "ANALYST REVIEW", "RFI ISSUED", 9),      # not a decision
        (ts(two, 3), "CERTIFIED", "CERTIFIED - EXPIRED", 30),  # not a decision
        (ts(yday, 3), "ANALYST REVIEW", "WITHDRAWN", 4),
    ])
    csd.write_observed_decisions(db)
    got = series(db)
    check("only transitions into a final status are counted as decisions",
          got.get(two) == (7, 5, 2, 0), str(got.get(two)))
    check("the expiry pair is excluded from the count",
          got.get(two, (0,))[0] == 7, str(got.get(two)))
    check("both complete days are written and today is not",
          sorted(got) == sorted([two, yday]), str(sorted(got)))
    check("the doc records the dating so the label cannot be lost",
          "not DOL" in (doc(db) or {}).get("dating", ""), str(doc(db)))

    # A day that BECOMES unpublishable loses its row, or the series keeps a
    # number this run has just decided it cannot stand behind.
    db.conn.executemany(
        "INSERT INTO perm_case_events VALUES (?,?,?,?,?,?)",
        [(f"G-100-26299-{i:06d}", ts(two, 22), "CERTIFIED",
          "CERTIFIED - EXPIRED", 1, csd.SOURCE)
         for i in range(csd.BULK_WRITE_ROWS + 1)])
    db.conn.commit()
    csd.write_observed_decisions(db)
    after = series(db)
    check("a day contaminated by a later backfill loses its published row",
          two not in after and yday in after, str(sorted(after)))

    # THE READ-BACK GUARD. A write that does not land must not be reported as
    # a success - the same discipline `write_live_census` applies. Only a
    # driver that swallows the write can demonstrate it, so here is one.
    class Swallows(SqliteTurso):
        def pipeline(self, reqs, **kw):
            return {"results": []}          # accepts everything, stores nothing

    mute = Swallows()
    mute.script([EVENTS_DDL, DAILY_DDL, DOCS_DDL])
    mute.conn.executemany(
        "INSERT INTO perm_case_events VALUES (?,?,?,?,?,?)",
        [(f"G-100-26300-{i:06d}", ts(yday, 3), "ANALYST REVIEW", "CERTIFIED",
          1, csd.SOURCE) for i in range(3)])
    mute.conn.commit()
    swallowed = None
    try:
        csd.write_observed_decisions(mute)
    except RuntimeError as e:
        swallowed = str(e)
    check("a write that silently does not land fails instead of logging ok",
          swallowed is not None and "read-back" in (swallowed or ""),
          str(swallowed))

    # AN EMPTY COMPUTATION MUST NOT WIPE A GOOD SERIES. Every write path here
    # deletes what it did not just write.
    db.conn.execute("DELETE FROM perm_case_events")
    db.conn.commit()
    crashed = None
    try:
        csd.write_observed_decisions(db)
    except BaseException as e:  # noqa: BLE001 - without the guard this is an
        crashed = f"{type(e).__name__}: {e}"   # IndexError on dates[0], and a
    check("an empty computation leaves the previous series in place",  # crash
          crashed is None and series(db) == after,      # is not a clean refusal
          crashed or str(series(db)))

    # -----------------------------------------------------------------------
    # 6. Nothing unions the sources.
    #
    # SCOPE: the modules that RUN queries - every ingest and the server-only
    # read layer. Test fixtures that quote SQL as prose are not executed and
    # are out of scope; `src/components/queue/__tests__/OctoberNote.test.tsx`
    # carries one such string.
    # -----------------------------------------------------------------------
    scanned, offenders = 0, []
    files = sorted(HERE.glob("*.py")) + sorted((V2 / "src/lib/turso").glob("*.ts"))
    for f in files:
        # This file itself is skipped: it carries the pattern as its own
        # subject (the regex literal below, and the prose above), and its two
        # real reads both filter on source - `series()` and the read-back in
        # write_observed_decisions. Any other skip is a hole in the gate.
        if f.name == pathlib.Path(__file__).name:
            continue
        text = f.read_text()
        if "daily_decisions" not in text:
            continue
        scanned += 1
        # A CRUDE EXTRACTION MIS-PARSES A CONCATENATED STRING, and this repo
        # has already been bitten by it once. `publicData.ts` splits the query
        # across two literals with the `WHERE source = ?` in the second, so a
        # scan that stops at the first closing quote reports the one correct
        # reader in the codebase as an offender. Join adjacent literals first;
        # this covers TS `"a" + "b"` and Python implicit `"a" "b"`.
        joined = re.sub(r"""["']\s*\+?\s*["']""", "", text)
        for m in re.finditer(r"(?is)\bFROM\s+daily_decisions\b(.{0,200})", joined):
            tail = m.group(1)
            # The clause has to name `source` before the statement ends. A
            # GROUP BY / ORDER BY / closing quote ends it.
            head = re.split(r"""(?i)\bGROUP\s+BY\b|\bORDER\s+BY\b|["'`]""", tail)[0]
            if "source" not in head.lower():
                offenders.append(f"{f.name}: ...FROM daily_decisions{head[:60]}")
    check("every executed read of daily_decisions filters on source",
          not offenders, "; ".join(offenders))
    check("the union scan actually looked at some files",
          scanned >= 3, f"only {scanned} file(s) mention daily_decisions")
    print(f"  ---  union scan read {scanned} file(s) that mention daily_decisions")

    print(f"\n  {len(FAILURES)} failure(s)")
    for f in FAILURES:
        print(f"    - {f}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
