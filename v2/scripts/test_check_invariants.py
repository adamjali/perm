"""Probe check_invariants with deliberately broken inputs. A gate's first run
is mostly the gate: each check must go red on the defect it exists for and
green on a clean fixture. Stdlib only; no network."""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import check_invariants as ci  # noqa: E402

FAILURES: list[str] = []


def check(name: str, got, want) -> None:
    if got == want:
        print(f"  ok   {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL {name}\n         got  {got!r}\n         want {want!r}")


TODAY = datetime.date(2026, 9, 7)


def fake_rows(*, foreign=0, sample=None, indexes=None):
    """A `rows(sql, args)` that answers the exact shapes the checks issue."""
    sample = sample if sample is not None else []
    indexes = indexes if indexes is not None else []

    def rows(sql, args=None):
        args = args or []
        if sql.startswith("SELECT COUNT(*) FROM perm_case_status") or sql.startswith("SELECT COUNT(*) FROM perm_live_recent"):
            return [[foreign]]
        if "typeof(is_final)" in sql:
            lo = args[0]
            return [r for r in sample if r[0].startswith(lo[:12])]
        if sql.startswith("SELECT name, tbl_name, sql FROM sqlite_schema"):
            return indexes
        raise AssertionError("unexpected sql: " + sql[:60])
    return rows


def main() -> int:
    code = "26250"  # today, so the newest-rows sample includes them
    clean = [[f"G-100-{code}-000001", "2026-09-07", "ANALYST REVIEW", "integer"],
             [f"P-100-{code}-000002", "2026-09-07", "IN PROCESS", "integer"],
             [f"I-200-{code}-000003", "2026-09-07", "CERTIFIED", "integer"]]

    ok, msg = ci.check_no_foreign_prefixes(fake_rows(foreign=0))
    check("no foreign prefixes: clean passes", ok, True)
    ok, msg = ci.check_no_foreign_prefixes(fake_rows(foreign=2))
    check("no foreign prefixes: two P-100 rows fail", ok, False)
    check("  ...and the message names the table", "perm_case_status" in msg, True)

    ok, msg = ci.check_status_vocabulary(fake_rows(sample=clean), TODAY)
    check("status vocabulary: known statuses pass", ok, True)
    bad = clean + [[f"P-100-{code}-000009", "2026-09-07", "RETURNED TO SENDER", "integer"]]
    ok, msg = ci.check_status_vocabulary(fake_rows(sample=bad), TODAY)
    check("status vocabulary: an unknown status fails and is named", ok is False and "RETURNED TO SENDER" in msg, True)
    ok, msg = ci.check_status_vocabulary(fake_rows(sample=[]), TODAY)
    check("status vocabulary: an EMPTY sample fails (a dead feed must not read as clean)", ok, False)

    ok, msg = ci.check_filing_date_matches_code(fake_rows(sample=clean), TODAY)
    check("filing date vs code: agreeing rows pass", ok, True)
    off = [[f"G-100-{code}-000001", "2026-08-01", "ANALYST REVIEW", "integer"]] * 10
    ok, msg = ci.check_filing_date_matches_code(fake_rows(sample=off), TODAY)
    check("filing date vs code: a month of drift fails", ok, False)

    idx = [["a_emp", "t", "CREATE INDEX a_emp ON t (employer_slug, filing_date)"],
           ["b_emp", "t", "CREATE INDEX b_emp ON t (employer_slug, filing_date)"]]
    ok, msg = ci.check_no_duplicate_indexes(fake_rows(indexes=idx))
    check("duplicate indexes: two identical definitions fail", ok is False and "a_emp=b_emp" in msg, True)
    ok, msg = ci.check_no_duplicate_indexes(fake_rows(indexes=idx[:1]))
    check("duplicate indexes: one definition passes", ok, True)

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("\nall checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
