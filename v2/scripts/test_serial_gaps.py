#!/usr/bin/env python3
"""Gates for the serial gap sweep."""
from __future__ import annotations
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from sweep_serial_gaps import (holes, sweep, record_misses, true_span, prefix_order,
                               MISS_LIMIT, MAX_PLAUSIBLE_SPAN)
from lib_flag_serials import (ALL_FLAG_PREFIXES as PREFIXES, PERM_OFFICE_PREFIXES,
                              RARE_PREFIXES, WALK_PREFIXES)
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
# A prefix that is asked but routed nowhere produces a case that DOL confirms
# and no table stores, and that isn't recorded as a miss either, so it is
# re-found and re-dropped every night while the log reads "confirmed 1,
# inserted 0" like an already-known case.
from ingest_pwd_status_direct import PREFIX_TO_PROGRAM  # noqa: E402
_homeless = [p for p in PREFIXES
             if p not in PERM_OFFICE_PREFIXES and p not in PREFIX_TO_PROGRAM]
check(not _homeless,
      f"every asked prefix routes to a table (homeless: {_homeless})")
# ---- the prefix list: complete, unique, and split for the walk ----------
# DOL's published wage file carried P-200 to P-203 and P-500 numbers on this
# counter, and DOL answered each live (Oct 3 2026). Unasked, every one of them
# was recorded as "no case" by this sweep.
for _p in ("P-200-", "P-201-", "P-202-", "P-203-", "P-500-"):
    check(_p in PREFIXES, f"{_p} is asked")
check(len(set(PREFIXES)) == len(PREFIXES), "no prefix is listed twice")
check(set(WALK_PREFIXES) <= set(PREFIXES), "the walk asks nothing the sweep doesn't know")
check(set(WALK_PREFIXES) | set(RARE_PREFIXES) == set(PREFIXES) and
      not set(WALK_PREFIXES) & set(RARE_PREFIXES),
      "walk and rare prefixes split the full list exactly")

# ---- prefix_order(): the day's own mix first --------------------------
_o = prefix_order({"H-300-": {1, 2, 3}, "G-100-": {4}}, PREFIXES)
check(_o[:2] == ["H-300-", "G-100-"], f"the prefixes a day already holds most are asked first (got {_o[:2]})")
check(sorted(_o) == sorted(PREFIXES), "every prefix is still asked")
check(prefix_order({}, PREFIXES) == list(PREFIXES), "a day we hold nothing for uses the overall order")
check("G-300-" in PERM_OFFICE_PREFIXES,
      "G-300 is a PERM office code and is stored as one")
check("G-400-" in PERM_OFFICE_PREFIXES,
      "G-400 is a PERM office code and is stored as one")


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
    if "sqlite_master" in sql:                    # case_tables()
        return [["perm_case_status"], ["perm_cases"]]
    if "perm_serial_misses" in sql:
        return [[str(s)] for s in db.misses]
    if "GROUP BY d" in sql:                       # day_bounds()
        return [[str(d), str(lo), str(hi), str(n)] for d, lo, hi, n in db.bounds]
    return [["G-100-", str(s)] for s in db.serials]  # held_by_prefix()

# The sweep and the walk's insert path each read through their own import.
import sweep_serial_gaps as _sweep_mod  # noqa: E402
_real_rows = (_sweep_mod.query_rows, core.query_rows)
_sweep_mod.query_rows = core.query_rows = fake_rows
try:
    asked: list[list[str]] = []
    def fake_lookup(nums):
        asked.append(nums)
        # DOL confirms exactly one hole, under a non-first prefix
        return [{"caseNumber": "G-200-26240-000102", "caseStatus": "ANALYST REVIEW",
                 "employerName": "X", "jobTitle": "Y", "submittedDate": "2026-08-28"}] \
               if "G-200-26240-000102" in nums else []

    # ---- held means live OR published, read by number range -------------
    seen: list[tuple[str, list]] = []
    def spy_rows(db, sql, args=None):
        seen.append((sql, list(args or [])))
        return fake_rows(db, sql, args)
    _sweep_mod.query_rows = spy_rows
    try:
        held = _sweep_mod.held_serials(FakeDB([100, 105]), "26240")
        q = [(sql, args) for sql, args in seen if "case_number >= ?" in sql]
        check(held == [100, 105], f"held serials come back as sorted numbers (got {held})")
        check(q and "FROM perm_cases " in q[0][0],
              "DOL's published file is read as held, so its cases are never re-asked")
        check(q and "G-100-26240-" in q[0][1] and "G-100-26240." in q[0][1],
              "each day is read as a range on the case number (an index seek, not a table scan)")
        seen.clear()
        sweep(FakeDB([100, 105]), ["26240"], cap=99, lookup=lambda n: [], dry=True, settle_after=1)
        miss_args = [args for sql, args in seen if "perm_serial_misses" in sql]
        check(miss_args and miss_args[0][-1] == 1,
              "settle_after=1 retires a number after one empty answer (old days only)")
    finally:
        _sweep_mod.query_rows = fake_rows

    r = sweep(FakeDB([100, 105]), ["26240"], cap=99, lookup=fake_lookup, dry=True)
    check(r["probed"] == 4, f"probes exactly the 4 interior holes (got {r['probed']})")
    check(r["found"] == 1, f"counts the one DOL confirmed (got {r['found']})")
    check(all(len(n) <= core.BATCH for n in asked), "never exceeds the batch ceiling")
    check({n[:6] for b in asked for n in b} == set(PREFIXES),
          "a hole no prefix claims is asked under every prefix, not just the busiest")
    check(all(len({n[:6] for n in b}) == 1 for b in asked),
          "each request asks one prefix, so it carries up to 50 serials")
    _want = prefix_order({"G-100-": {100, 105}}, PREFIXES).index("G-200-") + 1
    _got = sum("-000102" in n for b in asked for n in b)
    check(_got == _want,
          f"a serial is asked until its own prefix claims it and never after ({_got} asks, expected {_want})")

    # A serial is asked again only until one prefix claims it.
    asked.clear()
    def first_round_lookup(nums):
        asked.append(nums)
        return [{"caseNumber": n, "caseStatus": "ANALYST REVIEW", "employerName": "X",
                 "jobTitle": "Y", "submittedDate": "2026-08-28"} for n in nums if n == "G-100-26240-000101"]
    rf = sweep(FakeDB([100, 105]), ["26240"], cap=99, lookup=first_round_lookup, dry=True)
    check(sum(n.endswith("-000101") for b in asked for n in b) == 1,
          "a serial the first prefix claims is asked exactly once")
    check(sum(n.endswith("-000102") for b in asked for n in b) == len(PREFIXES),
          "an unclaimed serial is asked under every prefix once")
    check(rf["missed"] == 3, f"and only the unclaimed serials count as misses (got {rf['missed']})")
    check(r["inserted_perm"] == 0, "a dry run inserts nothing")

    # A DRY RUN DOES NOT EXERCISE THE INSERT PATH, AND THAT IS HOW THE FIRST
    # REAL RUN DIED: `core.prefix_of` does not exist (it lives in
    # lib_flag_serials), and dry mode returns before ever touching it. A gate
    # that only ever runs the safe branch is not a gate.
    rw = sweep(FakeDB([100, 105]), ["26240"], cap=99, lookup=fake_lookup, dry=False)
    check(rw["found"] == 1, "the WRITING path runs end to end against a fake DOL")
    check(rw["inserted_perm"] + rw["inserted_other"] >= 1,
          f"a confirmed hit is actually inserted (got {rw['inserted_perm']}+{rw['inserted_other']})")

    # ---- near matches are not finds -------------------------
    # DOL's endpoint is a search: for numbers that do not exist it returns
    # scored neighbours. A catch-up over 17,545 empty holes reported 497
    # "real" because those were counted and stored. Exact matches only.
    def neighbour_lookup(nums):
        return [{"caseNumber": "G-100-26265-252001", "caseStatus": "ANALYST REVIEW",
                 "employerName": "Elsewhere", "jobTitle": "Z", "submittedDate": "2026-09-22"}]
    rn = sweep(FakeDB([100, 105]), ["26240"], cap=99, lookup=neighbour_lookup, dry=False)
    check(rn["found"] == 0, f"a near match DOL volunteers is not counted as found (got {rn['found']})")
    check(rn["inserted_perm"] + rn["inserted_other"] == 0,
          f"and is not stored (got {rn['inserted_perm']}+{rn['inserted_other']})")
    check(rn["missed"] == 4, f"so every asked hole still counts as a miss (got {rn['missed']})")

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

    # ---- a DOL refusal is a STOP, not a crash ----------------
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
    check(rr["probed"] == core.BATCH,
          f"only serials DOL actually answered count as probed (got {rr['probed']})")
    # A serial is a miss only once EVERY prefix has been asked about it; a day
    # cut short by a refusal retires nothing, and the next run asks it again.
    check(rr["missed"] == 0,
          f"a day a refusal cut short retires no serial (got {rr['missed']})")
    check(not rr["capped"], "a refusal is not reported as the cap")
    check(not any("INSERT INTO perm_serial_misses" in w for w in rdb.writes),
          "and writes nothing to the miss ledger")
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

    # ---- the re-ask for prefixes added later -----------------
    # Serials the ledger retired were retired under the OLD prefix set, so
    # the one-off backfill re-asks them, asks only the new prefixes, and
    # writes no misses (three empty prefixes say nothing about the others).
    seen: list[list[str]] = []
    def h2a_lookup(nums):
        seen.append(nums)
        return [{"caseNumber": n, "caseStatus": "FULL CERTIFICATION", "visaType": "H-2A",
                 "employerName": "Farm Co", "jobTitle": "Farmworker"}
                for n in nums if n == "H-300-26240-000103"]
    db_r = FakeDB([100, 105], misses=[101, 102, 103, 104])
    rr = sweep(db_r, ["26240"], cap=99, lookup=h2a_lookup, dry=True,
               prefixes=("H-300-", "H-400-", "P-400-"), recheck=True)
    check(rr["probed"] == 4, f"a recheck re-asks retired serials (got {rr['probed']})")
    check(rr["found"] == 1, f"and finds the case the old prefixes could not (got {rr['found']})")
    check(all(n[:6] in ("H-300-", "H-400-", "P-400-") for b in seen for n in b),
          "a recheck asks only the prefixes it was given")
    # This fake models neither DDL nor pipelines; the walk's test owns the
    # schema step, so it is marked done here and the insert is counted.
    core._OTHER_SCHEMA_READY = True
    db_w = FakeDB([100, 105], misses=[101, 102, 103, 104])
    db_w.pipeline = lambda reqs, **k: {"results": [
        {"response": {"result": {"affected_row_count": 1}}}
        for r in reqs if r.get("type") == "execute"]}
    rw = sweep(db_w, ["26240"], cap=99, lookup=h2a_lookup, dry=False,
               prefixes=("H-300-", "H-400-", "P-400-"), recheck=True)
    check(rw["inserted_other"] == 1, f"the H-2A case is inserted (got {rw['inserted_other']})")
    check(not any("perm_serial_misses" in w for w in db_w.writes),
          f"a recheck leaves the miss ledger alone ({sum('perm_serial_misses' in w for w in db_w.writes)} writes)")
    # The nightly sweep, by contrast, still skips what the ledger retired.
    rn2 = sweep(FakeDB([100, 105], misses=[101, 102, 103, 104]), ["26240"], cap=99,
                lookup=h2a_lookup, dry=True)
    check(rn2["probed"] == 0, f"the nightly sweep still skips retired serials (got {rn2['probed']})")
finally:
    _sweep_mod.query_rows, core.query_rows = _real_rows

# --- A stop on the cap records `ok` and names the cap
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


