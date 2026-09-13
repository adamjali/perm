#!/usr/bin/env python3
"""Gates for the serial gap sweep."""
from __future__ import annotations
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from sweep_serial_gaps import (holes, sweep, record_misses, PREFIXES,
                               SERIALS_PER_REQUEST, MISS_LIMIT)
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
check("G-300-" in core.PERM_PREFIXES,
      "G-300 is a PERM office code and is stored as one")
check("G-400-" in core.PERM_PREFIXES,
      "G-400 is a PERM office code and is stored as one")
check(set(core.PERM_PREFIXES) == set(core.FRONTIER_PREFIXES),
      "the prefixes that move the frontier are exactly the ones we can store; "
      "counting a case toward the frontier and then dropping it is the bug")

# ---- request shape -------------------------------------------------------
check(SERIALS_PER_REQUEST * len(PREFIXES) <= core.BATCH,
      f"a request stays under DOL's batch ceiling ({SERIALS_PER_REQUEST}x{len(PREFIXES)} <= {core.BATCH})")
check(SERIALS_PER_REQUEST >= 1, "at least one serial per request")

# ---- sweep(), against a fake DOL -----------------------------------------
class FakeDB:
    def __init__(self, serials, misses=()):
        self.serials = serials
        self.misses = list(misses)
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
finally:
    core._rows = _real_rows

print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAILURE(S)'}")
raise SystemExit(1 if fails else 0)
