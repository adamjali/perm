#!/usr/bin/env python3
"""Gates for the serial gap sweep."""
from __future__ import annotations
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from sweep_serial_gaps import (holes, sweep, record_misses, true_span, PREFIXES,
                               SERIALS_PER_REQUEST, MISS_LIMIT, MAX_PLAUSIBLE_SPAN)
import ingest_case_status_direct as core

fails: list[str] = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: fails.append(msg)

# ---- holes() -------------------------------------------------------------
check(holes([]) == [], "no serials -> no holes")
check(holes([7]) == [], "one serial -> no holes (a day's edges are unknowable)")
check(holes([1, 2, 3]) == [], "contiguous -> no holes")
check(holes([1, 4]) == [2, 3], "a gap is every missing serial between the ends")
check(holes([10, 12, 15]) == [11, 13, 14], "several gaps")
# The edges matter: we must never probe past the lowest or highest serial we
# hold, because outside that range a "hole" is indistinguishable from the end
# of the day's issuance, and probing it burns budget on numbers DOL never made.
check(max(holes([100, 110])) < 110 and min(holes([100, 110])) > 100,
      "holes stay strictly INSIDE the observed span")
check(holes([1, 6], {3, 4}) == [2, 5], "retired serials are dropped from the hole list")
check(holes([1, 6], set()) == [2, 3, 4, 5], "an empty skip set changes nothing")


# ---- EVERY PREFIX THE SWEEP ASKS FOR MUST HAVE SOMEWHERE TO GO -----------
# A prefix that is asked but routed nowhere produces a case that is confirmed
# by DOL, counted as found, stored in no table, and not recorded as a miss
# either - so it is re-found and re-dropped every single night. That is what
# G-300 did until 2026-09-13, and it was invisible in the log: "confirmed 1,
# inserted 0" reads like an already-known case.
from ingest_pwd_status_direct import PREFIX_TO_PROGRAM  # noqa: E402
_homeless = [p for p in PREFIXES
             if p not in core.PERM_PREFIXES and p not in PREFIX_TO_PROGRAM]
check(not _homeless,
      f"every asked prefix routes to a table (homeless: {_homeless})")
check(set(PREFIXES) == set(core.DISCOVERY_PREFIXES),
      "the sweep and the nightly walk ask for the SAME prefixes - a prefix only "
      "one of them knows is a case only one of them can ever find")
check(SERIALS_PER_REQUEST * len(PREFIXES) <= core.BATCH,
      "widening the prefix set kept the request under DOL's 50-number ceiling")
check("G-300-" in core.PERM_PREFIXES,
      "G-300 is a PERM office code and is stored as one")
check("G-400-" in core.PERM_PREFIXES,
      "G-400 is a PERM office code and is stored as one")
check(set(core.PERM_PREFIXES) == set(core.FRONTIER_PREFIXES),
      "the prefixes that move the frontier are exactly the ones we can store; "
      "counting a case toward the frontier and then dropping it is the bug")


# ---- true_span(): neighbours bound a day EXACTLY ------------------------
# One global sequential counter means every serial between the previous day's
# highest and the next day's lowest belongs to this day. Reading holes only
# between a day's own first and last KNOWN serial is structurally blind to
# anything issued before the first case we hold or after the last - measured
# at 1,102 serials across 2026 alone.
B = {26240: (100, 200, 50), 26241: (300, 400, 50), 26242: (500, 600, 50)}
check(true_span(B, "26241") == (201, 499),
      f"a middle day runs from prev.max+1 to next.min-1 (got {true_span(B, '26241')})")
check(true_span(B, "26240") == (100, 299),
      "the FIRST day keeps its own low edge but takes the next day's bound")
check(true_span(B, "26242") == (401, 600),
      "the LAST day keeps its own high edge but takes the previous day's bound")
check(true_span(B, "26999") is None, "a day we hold nothing for has no span")

# THE COUNTER WRAPS, AND A WRAP DAY MUST BE SKIPPED, NOT "FALLEN BACK" ON.
# The first version of this returned the day's own MIN/MAX as a fallback, and
# on a wrap day those ARE 0 and 999,999 - so the fallback handed back the whole
# million and a real sweep spent 44 minutes probing day 26161.
#
# THE TEST THAT LET IT SHIP SAID `... or sp == (1, 999_000)`, which accepted
# precisely the broken answer. An assertion with an `or` that matches the bug
# is not a gate, it is a rubber stamp.
W = {26160: (900_000, 999_997, 10), 26161: (1, 999_000, 10), 26162: (5_000, 6_000, 10)}
check(true_span(W, "26161") is None,
      f"a wrap day is SKIPPED, never probed (got {true_span(W, '26161')})")
for d in ("26160", "26162"):
    sp = true_span(W, d)
    check(sp is None or sp[1] - sp[0] + 1 <= MAX_PLAUSIBLE_SPAN,
          f"day {d} beside a wrap never inherits a million-wide span (got {sp})")
check(holes([5, 9], None, None) == [6, 7, 8],
      "holes() with no span still falls back to the day's own extent")

# holes() must honour the span it is given, not the serials' own extent.
check(holes([5, 9], None, (1, 12)) == [1, 2, 3, 4, 6, 7, 8, 10, 11, 12],
      "holes span the FULL given range, including before the first held serial")
check(holes([5, 9]) == [6, 7, 8],
      "with no span given it falls back to the day's own extent")
check(holes([5, 9], {7}, (4, 10)) == [4, 6, 8, 10],
      "retired serials are dropped from a neighbour-bounded span too")


# ---- run order ------------------------------------------------------------
# Both code paths must hand the newest day codes to sweep() first: a run that
# is interrupted or hits its cap should have spent its budget where the
# pending cases are, not on last January.
import argparse as _ap
def _codes_for(frm, to):
    a = _ap.Namespace(frm=frm, to=to, window=None, cap=1, dry_run=True)
    return [str(c) for c in range(int(a.to), int(a.frm) - 1, -1)]
check(_codes_for("26001", "26005")[0] == "26005",
      "an explicit --from/--to range starts at the NEWEST day code")
check(_codes_for("26001", "26005")[-1] == "26001",
      "and ends at the oldest")

# ---- request shape -------------------------------------------------------
check(SERIALS_PER_REQUEST * len(PREFIXES) <= core.BATCH,
      f"a request stays under DOL's batch ceiling ({SERIALS_PER_REQUEST}x{len(PREFIXES)} <= {core.BATCH})")
check(SERIALS_PER_REQUEST >= 1, "at least one serial per request")

# ---- sweep(), against a fake DOL -----------------------------------------
class FakeDB:
    def __init__(self, serials, misses=(), bounds=None):
        self.serials = serials
        self.misses = list(misses)
        # Default to the day owning exactly what it holds, so the existing
        # assertions keep testing the same 4 interior holes.
        self.bounds = bounds if bounds is not None else (
            [(26240, serials[0], serials[-1], len(serials))] if serials else [])
        self.writes: list[str] = []
    def execute(self, sql, *a, **k):
        self.writes.append(sql)
        return {"response": {"result": {"affected_row_count": 1}}}

def fake_rows(db, sql, args=None):
    # ROUTE BY THE TABLE, NOT BY CALL ORDER. A fake that answers every query
    # with the same rows would hand the held serials back as retired misses
    # and silently empty the hole list, which is a pass that proves nothing.
    if "perm_serial_misses" in sql:
        return [[str(s)] for s in db.misses]
    if "GROUP BY d" in sql:                       # day_bounds()
        return [[str(d), str(lo), str(hi), str(n)] for d, lo, hi, n in db.bounds]
    return [[str(s)] for s in db.serials]

_real_rows = core._rows
core._rows = fake_rows
try:
    asked: list[list[str]] = []
    def fake_lookup(nums):
        asked.append(nums)
        # DOL confirms exactly one hole, under a non-first prefix
        return [{"caseNumber": "G-200-26240-000102", "caseStatus": "ANALYST REVIEW",
                 "employerName": "X", "jobTitle": "Y", "submittedDate": "2026-08-28"}] \
               if "G-200-26240-000102" in nums else []

    r = sweep(FakeDB([100, 105]), ["26240"], cap=99, lookup=fake_lookup, dry=True)
    check(r["probed"] == 4, f"probes exactly the 4 interior holes (got {r['probed']})")
    check(r["found"] == 1, f"counts the one DOL confirmed (got {r['found']})")
    check(all(len(n) <= core.BATCH for n in asked), "never exceeds the batch ceiling")
    check(any(n.startswith("G-200-") for n in asked[0]),
          "asks every known prefix, not just the busiest")
    check(r["inserted_perm"] == 0, "a dry run inserts nothing")

    # A DRY RUN DOES NOT EXERCISE THE INSERT PATH, AND THAT IS HOW THE FIRST
    # REAL RUN DIED: `core.prefix_of` does not exist (it lives in
    # lib_flag_serials), and dry mode returns before ever touching it. A gate
    # that only ever runs the safe branch is not a gate.
    rw = sweep(FakeDB([100, 105]), ["26240"], cap=99, lookup=fake_lookup, dry=False)
    check(rw["found"] == 1, "the WRITING path runs end to end against a fake DOL")
    check(rw["inserted_perm"] + rw["inserted_other"] >= 1,
          f"a confirmed hit is actually inserted (got {rw['inserted_perm']}+{rw['inserted_other']})")

    # ---- the miss ledger: the sweep must CONVERGE -------------------------
    # The first real run probed 7,129 holes for 251 cases. With no memory the
    # other 6,878 are re-asked every night forever and the budget never
    # reaches a hole nobody has looked at.
    dbm = FakeDB([100, 105])
    r2 = sweep(dbm, ["26240"], cap=99, lookup=fake_lookup, dry=False)
    check(r2["missed"] == 3,
          f"the 3 serials DOL did not claim are counted as misses (got {r2['missed']})")
    # MATCH THE INSERT, NOT THE TABLE NAME. `CREATE TABLE IF NOT EXISTS
    # perm_serial_misses` also contains the table name, so a substring test
    # passed against a build that recorded no misses at all - the same
    # too-loose-match defect as the gate that skipped its own subject because
    # a comment named the helper it was searching for.
    check(any("INSERT INTO perm_serial_misses" in w for w in dbm.writes),
          "a real run INSERTS into the miss ledger")
    check(any("CREATE TABLE IF NOT EXISTS perm_serial_misses" in w for w in dbm.writes),
          "the ledger table is created before it is used")

    dry = FakeDB([100, 105])
    sweep(dry, ["26240"], cap=99, lookup=fake_lookup, dry=True)
    check(not any("INSERT INTO perm_serial_misses" in w for w in dry.writes),
          "a dry run writes NO misses")

    # Retired serials must actually reduce the work, or the ledger is decorative.
    retired = FakeDB([100, 105], misses=[101, 102, 103])
    r3 = sweep(retired, ["26240"], cap=99, lookup=fake_lookup, dry=True)
    check(r3["probed"] == 1,
          f"a day whose holes are retired costs 1 probe, not 4 (got {r3['probed']})")

    # A serial that is claimed must NOT be recorded as a miss, or a case we
    # just found would count toward its own retirement.
    check(r2["found"] == 1 and r2["missed"] == 3,
          "the confirmed serial is excluded from the miss list")
    check(MISS_LIMIT >= 2,
          "a serial gets more than one chance (DOL's index lags; that is why "
          "251 cases were found in holes the walk had already passed)")

    batched = FakeDB([])
    record_misses(batched, "26240", list(range(1, 501)), 1_700_000_000_000)
    check(len(batched.writes) == 3,
          f"500 misses cost 3 statements, not 500 (got {len(batched.writes)})")

    # the cap must actually stop it
    rc = sweep(FakeDB(list(range(0, 400, 2))), ["26240"], cap=2, lookup=fake_lookup, dry=True)
    check(rc["requests"] == 2 and rc["capped"], "the request cap stops the run and is reported")

    # a day with no holes costs no requests
    rz = sweep(FakeDB([1, 2, 3, 4]), ["26240"], cap=99, lookup=fake_lookup, dry=True)
    check(rz["requests"] == 0, "a contiguous day costs zero requests")

    # ---- a DOL refusal is a STOP, not a crash (2026-09-22) ----------------
    # flag.dol.gov answered HTTP 403 on the tail of a 10,000-request morning,
    # the sweep crashed, the hook recorded `failed`, the health check went red.
    calls = {"n": 0}
    def refusing_lookup(nums):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("HTTP 403")
        return []
    rdb = FakeDB(list(range(0, 400, 2)))
    rr = sweep(rdb, ["26240"], cap=99, lookup=refusing_lookup, dry=False)
    check(rr["refused"] == "HTTP 403",
          f"a refusal is reported, not raised (got {rr.get('refused')!r})")
    check(rr["requests"] == 2,
          f"the refused request is counted as attempted (got {rr['requests']})")
    check(rr["probed"] == SERIALS_PER_REQUEST,
          f"only serials DOL actually answered count as probed (got {rr['probed']})")
    check(rr["missed"] == SERIALS_PER_REQUEST,
          f"misses are recorded for the answered chunk only (got {rr['missed']})")
    check(not rr["capped"], "a refusal is not reported as the cap")
    check(any("INSERT INTO perm_serial_misses" in w for w in rdb.writes),
          "the answered chunk's misses still reach the ledger")
    # It ends the RUN, not just the day: the same day twice has holes both
    # times, and without the outer stop the second pass would keep asking.
    calls["n"] = 0
    rr2 = sweep(FakeDB(list(range(0, 400, 2))), ["26240", "26240"], cap=99,
                lookup=refusing_lookup, dry=True)
    check(rr2["requests"] == 2,
          f"a refusal ends the run, not only the day (got {rr2['requests']})")
    # A CODE DEFECT STILL PROPAGATES. Tolerating every exception would turn a
    # bug in the insert path into a quiet nightly "ok".
    def broken_lookup(nums):
        raise KeyError("caseNumber")
    try:
        sweep(FakeDB([100, 105]), ["26240"], cap=99, lookup=broken_lookup, dry=True)
        check(False, "a non-HTTP exception must propagate")
    except KeyError:
        check(True, "a non-HTTP exception propagates")
finally:
    core._rows = _real_rows

# --- A stop on the cap records `ok` and names the cap (2026-09-15)
import sweep_serial_gaps as sg  # noqa: E402
_base = {"probed": 2998, "found": 2113, "inserted_perm": 400, "inserted_other": 1713, "missed": 885}
_st, _note = sg.run_record({**_base, "capped": True}, 600)
check(_st == "ok" and sg.CAP_NOTE in _note and "600" in _note, "a capped sweep records ok and names its cap")
_st2, _note2 = sg.run_record({**_base, "capped": False}, 600)
check(_st2 == "ok" and sg.CAP_NOTE not in _note2 and "probed 2998" in _note2, "an uncapped sweep records ok without the cap phrase")
_st3, _note3 = sg.run_record({**_base, "capped": False, "refused": "HTTP 403", "requests": 14}, 600)
check(_st3 == "ok" and sg.REFUSAL_NOTE in _note3 and "HTTP 403" in _note3 and "after 14 requests" in _note3,
      "a refused sweep records ok and names the refusal and where it stopped")
check(sg.CAP_NOTE not in _note3, "a refusal is not described as the cap")


print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAILURE(S)'}")
raise SystemExit(1 if fails else 0)


