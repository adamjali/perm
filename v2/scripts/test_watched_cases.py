#!/usr/bin/env python3
"""Gates for the hourly watched-case check. No network: the SQL runs on an
in-memory SQLite with the same table shapes, so the conditional writes are
exercised for real."""
from __future__ import annotations
import pathlib, sqlite3, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from check_watched_cases import plan_changes, split_programs

fails: list[str] = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: fails.append(msg)

# ---- routing ---------------------------------------------------------------
g = split_programs(["g-100-26001-000001", "G-100-26001-000001", "P-100-26001-000002",
                    "I-200-26001-000003", "X-999-1", "  G-300-26002-000004 "])
check(g["perm"] == ["G-100-26001-000001", "G-300-26002-000004"], "PERM numbers deduped, uppercased, every office code")
check(g["pwd"] == ["P-100-26001-000002"] and g["lca"] == ["I-200-26001-000003"], "PWD and LCA routed by prefix")
check(sum(len(v) for v in g.values()) == 4, "an unknown prefix is dropped, not guessed")

# ---- planning ---------------------------------------------------------------
stored = {"G-100-26001-000001": ["ANALYST REVIEW", "ACME", "Engineer"],
          "G-100-26001-000009": ["ANALYST REVIEW", "ACME", "Engineer"]}
answers = [
    {"caseNumber": "G-100-26001-000001", "caseStatus": "CERTIFIED", "employerName": "ACME", "jobTitle": "Engineer"},
    {"caseNumber": "G-100-26001-000009", "caseStatus": "ANALYST REVIEW"},   # unchanged
    {"caseNumber": "G-100-26001-000009", "caseStatus": ""},                 # blank answer
    {"caseNumber": "G-100-26001-000555", "caseStatus": "CERTIFIED"},        # not stored
]
plan = plan_changes("perm", stored, answers, 1_790_000_000_000)
check(len(plan) == 2, "one UPDATE and one guarded INSERT for the one case that moved")
check("AND current_status=?" in plan[0]["sql"] and plan[0]["args"][-1] == "ANALYST REVIEW",
      "the UPDATE applies only while the row still holds the status it read")
check("WHERE changes() > 0" in plan[1]["sql"], "the event is inserted only when that UPDATE changed a row")

# ---- the SQL, for real -----------------------------------------------------
def db():
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE perm_case_status (case_number TEXT PRIMARY KEY, current_status TEXT, is_final INTEGER,"
              " employer_name TEXT, job_title TEXT, source TEXT, fetched_at INTEGER)")
    c.execute("CREATE TABLE perm_case_events (case_number TEXT, changed_at INTEGER, from_status TEXT,"
              " to_status TEXT, to_final INTEGER, source TEXT, PRIMARY KEY (case_number, changed_at))")
    c.execute("INSERT INTO perm_case_status VALUES ('G-100-26001-000001','ANALYST REVIEW',0,'ACME','Engineer','x',0)")
    return c

def run(c, stmts):
    for s in stmts:
        c.execute(s["sql"], s["args"])

c = db()
run(c, plan)
row = c.execute("SELECT current_status, is_final FROM perm_case_status").fetchone()
ev = c.execute("SELECT from_status, to_status, to_final FROM perm_case_events").fetchall()
check(row == ("CERTIFIED", 1), "the move is written, final flag set")
check(ev == [("ANALYST REVIEW", "CERTIFIED", 1)], "exactly one event for it")

# A sweep got there first: the row already reads CERTIFIED when this runs.
c = db()
c.execute("UPDATE perm_case_status SET current_status='CERTIFIED', is_final=1")
c.execute("INSERT INTO perm_case_events VALUES ('G-100-26001-000001', 1, 'ANALYST REVIEW', 'CERTIFIED', 1, 'sweep')")
run(c, plan)
n = c.execute("SELECT COUNT(*) FROM perm_case_events").fetchone()[0]
check(n == 1, "no second event when a sweep already recorded the move")

# Running the same plan twice (a retried pipeline) is a no-op the second time.
c = db()
run(c, plan); run(c, plan)
check(c.execute("SELECT COUNT(*) FROM perm_case_events").fetchone()[0] == 1, "a replay adds nothing")

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
