"""Assert the shape of the data, not the health of the jobs.

WHY THIS EXISTS BESIDE check_ingest_health.py. That script answers "did every
job run, exit clean, and move its frontier". It cannot see data that is
present and WRONG: two P-100 rows counted as a PERM review stage for four
days; 284 terminal statuses stored as pending because a vocabulary did not
know them; 62 alias rows pointing live pages at slugs that never existed;
four duplicate indexes doubling every write to a table. Each of those was
found by hand on Sep 6 2026 and each is a query. So they run daily.

Every check is bounded (samples by primary-key range, small tables read in
full, DISTINCT only on leading index columns) because Turso bills rows read.
Every check prints its finding before its verdict, so a check that could not
see its subject is distinguishable from one that found nothing.

    python3 scripts/check_invariants.py
"""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso  # noqa: E402
from lib_flag_serials import code_to_date, code_of, recent_day_codes  # noqa: E402
from ingest_case_status_direct import FINAL_STATUSES as PERM_FINAL  # noqa: E402
from ingest_pwd_status_direct import PROGRAMS  # noqa: E402
from reconcile_entity_aliases import classify as classify_aliases  # noqa: E402

# Statuses PERM rows may carry while open. The sweep treats anything outside
# FINAL as pending, so an unknown status is invisible unless listed here.
PERM_PENDING = {
    "ANALYST REVIEW", "RFI ISSUED", "APPLICATION ON HOLD", "RECONSIDERATION APPEALS",
    "BALCA APPEALS", "NORD ISSUED", "AUDIT", "SUPERVISED RECRUITMENT",
    "RECONSIDERATION REQUEST", "IN PROCESS", "NORD RESPONSE", "AUDIT RESPONSE",
    "BALCA APPEAL", "REMANDED", "CERTIFIED - PENDING", "PENDING",
}
FOREIGN_PREFIXES = ("P-100-", "I-200-", "I-203-", "I-201-", "I-202-")
SAMPLE_DAYS = 4          # newest rows: an unknown status appears on new rows first
MAX_DATE_DRIFT_DAYS = 2  # the counter rolls at a moment that is not midnight
MAX_DRIFT_SHARE = 0.02


def _cells(res) -> list[list]:
    return [[None if c["type"] == "null" else c["value"] for c in r]
            for r in res["response"]["result"]["rows"]]


def check_no_foreign_prefixes(rows) -> tuple[bool, str]:
    """perm_case_status and perm_live_recent hold PERM numbers only."""
    bad = []
    for table in ("perm_case_status", "perm_live_recent"):
        for p in FOREIGN_PREFIXES:
            n = int(rows(f"SELECT COUNT(*) FROM {table} WHERE case_number >= ? AND case_number < ?",
                         [p, p[:-1] + "~"])[0][0] or 0)
            if n:
                bad.append(f"{table} {p}{n}")
    return (not bad, "no foreign prefixes in the PERM tables" if not bad else
            "foreign rows in PERM tables: " + ", ".join(bad))


def _newest_sample(rows, table: str, prefixes: tuple[str, ...], today: datetime.date) -> list[list]:
    out: list[list] = []
    for code in recent_day_codes(today, SAMPLE_DAYS):
        for p in prefixes:
            out += rows(f"SELECT case_number, filing_date, current_status, typeof(is_final) "
                        f"FROM {table} WHERE case_number >= ? AND case_number < ? LIMIT 500",
                        [f"{p}{code}-", f"{p}{code}-~"])
    return out


def check_status_vocabulary(rows, today: datetime.date) -> tuple[bool, str]:
    """Every status on the newest rows is one the code knows how to treat."""
    unknown: dict[str, set[str]] = {}
    sets = {
        "perm_case_status": (("G-100-", "G-200-", "G-300-", "G-400-"), PERM_FINAL | PERM_PENDING),
        "pwd_case_status": (tuple(PROGRAMS["pwd"]["prefixes"]),
                            PROGRAMS["pwd"]["final"] | PROGRAMS["pwd"]["pending"]),
        "lca_case_status": (tuple(PROGRAMS["lca"]["prefixes"]),
                            PROGRAMS["lca"]["final"] | PROGRAMS["lca"]["pending"]),
    }
    seen = 0
    for table, (prefixes, known) in sets.items():
        for _cn, _fd, status, _t in _newest_sample(rows, table, prefixes, today):
            seen += 1
            s = (status or "").strip().upper()
            if s and s not in known:
                unknown.setdefault(table, set()).add(s)
    if not seen:
        return False, "status vocabulary: sample was EMPTY (no rows in the last days: discovery dead?)"
    if unknown:
        return False, "unknown statuses on new rows: " + "; ".join(
            f"{t}: {sorted(v)}" for t, v in unknown.items())
    return True, f"status vocabulary: {seen:,} newest rows, every status known"


def check_filing_date_matches_code(rows, today: datetime.date) -> tuple[bool, str]:
    """filing_date agrees with the number's own YYDDD (within the roll)."""
    total = drift = 0
    for table, prefixes in (("perm_case_status", ("G-100-", "G-200-")),
                            ("pwd_case_status", ("P-100-",)),
                            ("lca_case_status", ("I-200-",))):
        for cn, fd, _s, _t in _newest_sample(rows, table, prefixes, today):
            d = code_to_date(code_of(cn) or "")
            if not d or not fd:
                continue
            total += 1
            try:
                if abs((datetime.date.fromisoformat(str(fd)[:10]) - d).days) > MAX_DATE_DRIFT_DAYS:
                    drift += 1
            except ValueError:
                drift += 1
    if not total:
        return False, "filing_date vs day code: sample EMPTY"
    share = drift / total
    return (share <= MAX_DRIFT_SHARE,
            f"filing_date vs day code: {drift}/{total} rows drift over {MAX_DATE_DRIFT_DAYS}d ({share:.1%})")


def check_aliases_consistent(db) -> tuple[bool, str]:
    b = classify_aliases(db)
    bad = len(b["reverse"]) + len(b["drop_both_live"]) + len(b["drop_both_dead"])
    return (bad == 0, f"entity aliases: {len(b['keep'])} consistent, {bad} inconsistent"
            + ("" if bad == 0 else " (run scripts/reconcile_entity_aliases.py)"))


def check_no_duplicate_indexes(rows) -> tuple[bool, str]:
    """Two indexes with one definition double every write to that table."""
    defs: dict[tuple[str, str], list[str]] = {}
    for name, tbl, sql in rows("SELECT name, tbl_name, sql FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL"):
        body = str(sql)[str(sql).find("("):].replace(" ", "")
        defs.setdefault((str(tbl), body), []).append(str(name))
    dups = [names for names in defs.values() if len(names) > 1]
    return (not dups, "indexes: no duplicates" if not dups else
            "duplicate indexes: " + "; ".join("=".join(n) for n in dups))


def main(today: datetime.date | None = None) -> int:
    db = Turso()
    today = today or datetime.date.today()

    def rows(sql: str, args: list | None = None) -> list[list]:
        return _cells(db.execute(sql, args or []))

    checks = [
        check_no_foreign_prefixes(rows),
        check_status_vocabulary(rows, today),
        check_filing_date_matches_code(rows, today),
        check_aliases_consistent(db),
        check_no_duplicate_indexes(rows),
    ]
    rc = 0
    for ok, msg in checks:
        print(f"  {'ok  ' if ok else 'FAIL'} {msg}")
        rc |= 0 if ok else 1
    print("all invariants hold" if rc == 0 else "\nAn invariant is broken: data is present and wrong. "
          "The jobs may all be green; this is the check that says so.")
    return rc


if __name__ == "__main__":
    sys.exit(main())
