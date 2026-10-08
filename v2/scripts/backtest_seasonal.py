"""The standing backtest of "When DOL usually decides" for H-2A, H-2B and CW-1.

The case page places a pending application against DOL's own past
certifications (src/lib/seasonalTiming.ts, from perm_docs['seasonal_timing']):
an H-2A application with a known first day of work by how long before that
day DOL decided, everything else by how long after filing. It prints the
middle half as a date range and the median as "most often around".

This rebuilds those numbers as they stood at the start of each past quarter,
from the certifications DOL had decided by then, and checks them against the
applications received in that quarter. Three ways of choosing the past cases
are compared, so a better one shows if there is one:

    pooled       every certification decided before the quarter (what the page does)
    trailing     only those decided in the 365 days before it
    same-season  only those received in the same three calendar months a year earlier

Graded on certifications, like for like with the page, which says "half of the
applications DOL certified". A test quarter is used only once it is complete:
at most MAX_PENDING_SHARE of its applications still have no decision anywhere
(waiting in the live table, and absent from DOL's file), because the files
hold decided cases only and a quarter graded early is graded on its fast
cases. A fixed margin of 120 days threw away the January 2026 cap season,
which was 96% decided at 90 days.

Read-only unless `--write`, which stores the summary in
`perm_docs['seasonal_backtest']` for /estimate-scorecard and the admin page.

    python3 scripts/backtest_seasonal.py
    python3 scripts/backtest_seasonal.py --write
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_turso import Turso, query_rows, write_doc  # noqa: E402

VISAS = ("H-2A", "H-2B", "CW-1")
PREFIX = {"H-2A": "H-300-", "H-2B": "H-400-", "CW-1": "C-500-"}
GRANTED = "case_status LIKE '%CERTIFICATION%' AND case_status NOT LIKE '%WITHDRAWN%'"
# build_seasonal_timing.py's floor: no percentile over fewer certifications.
MIN_N = 50
# A test quarter must end at least this long before DOL's newest decision in
# the files, and have no more than this share of its applications undecided.
MIN_DAYS = 60
MAX_PENDING_SHARE = 0.05
METHODS = ("pooled", "trailing", "same-season")


def pctl(values: list[int], p: int) -> int:
    """Nearest rank, as build_seasonal_timing.py computes it."""
    s = sorted(values)
    rank = max(1, -(-p * len(s) // 100))
    return s[rank - 1]


def fit(values: list[int]) -> dict | None:
    if len(values) < MIN_N:
        return None
    return {"n": len(values), **{f"p{p}": pctl(values, p) for p in (10, 25, 50, 75, 90)}}


def quarter_starts(first: date, last: date) -> list[date]:
    out = []
    d = date(first.year, ((first.month - 1) // 3) * 3 + 1, 1)
    while d <= last:
        out.append(d)
        m = d.month + 3
        d = date(d.year + (m - 1) // 12, (m - 1) % 12 + 1, 1)
    return out


def add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, 1)


def training(rows: list[dict], origin: date, method: str, clock: str) -> list[int]:
    """The past certifications a method would have used at `origin`, as day counts."""
    out = []
    for r in rows:
        if r["decided"] >= origin:
            continue
        if method == "trailing" and r["decided"] < origin - timedelta(days=365):
            continue
        if method == "same-season":
            lo = date(origin.year - 1, origin.month, 1)
            if not (lo <= r["received"] < add_months(lo, 3)):
                continue
        v = r["lead"] if clock == "start" else r["waited"]
        if v is not None:
            out.append(v)
    return out


def score(test: list[dict], p: dict, clock: str) -> dict:
    """Error is decided minus the predicted decision day: positive means DOL was later."""
    errs, mid, wide = [], 0, 0
    for r in test:
        if clock == "start":
            v = r["lead"]
            err = p["p50"] - v  # predicted day is start - p50; actual is start - lead
            mid += p["p25"] <= v <= p["p75"]
            wide += p["p10"] <= v <= p["p90"]
        else:
            v = r["waited"]
            err = v - p["p50"]
            mid += p["p25"] <= v <= p["p75"]
            wide += p["p10"] <= v <= p["p90"]
        errs.append(err)
    n = len(errs)
    return {
        "cases": n,
        "middleHalfShare": round(mid / n, 3),
        "wideShare": round(wide / n, 3),
        "typicalMissDays": round(statistics.median(abs(e) for e in errs), 1),
        "biasDays": round(statistics.median(errs), 1),
        "within7Share": round(sum(abs(e) <= 7 for e in errs) / n, 3),
    }


def load(db: Turso, visa: str) -> list[dict]:
    rows = []
    for rec, dec, beg in query_rows(
        db,
        f"SELECT received_date, decision_date, begin_date FROM seasonal_cases WHERE visa_class = ? AND {GRANTED}",
        [visa],
    ):
        if not rec or not dec:
            continue
        received, decided = date.fromisoformat(str(rec)[:10]), date.fromisoformat(str(dec)[:10])
        begin = date.fromisoformat(str(beg)[:10]) if beg else None
        rows.append({
            "received": received,
            "decided": decided,
            "waited": (decided - received).days,
            "lead": (begin - decided).days if begin else None,
        })
    return rows


def still_pending(db: Turso, visa: str, lo: date, hi: date) -> int:
    """Applications filed in [lo, hi) with no decision anywhere: pending in the
    live table, and not in DOL's file (which would hold their decision)."""
    got = query_rows(
        db,
        "SELECT COUNT(*) FROM seasonal_case_status s LEFT JOIN seasonal_cases c ON c.case_number = s.case_number "
        "WHERE s.is_final = 0 AND c.case_number IS NULL AND s.case_number LIKE ? "
        "AND substr(COALESCE(s.submitted_date, s.filing_date), 1, 10) >= ? "
        "AND substr(COALESCE(s.submitted_date, s.filing_date), 1, 10) < ?",
        [PREFIX[visa] + "%", lo.isoformat(), hi.isoformat()],
    )
    return int(got[0][0] or 0) if got else 0


# What the case page uses for each visa (src/lib/seasonalTiming.ts, from
# build_seasonal_timing.py): H-2A against the first day of work, pooled; H-2B
# forward from filing, from the same quarter a year earlier; CW-1 forward from
# filing, pooled. Every method on both clocks is tested for every visa, so the
# choice is measured rather than assumed; these three won (Oct 7 2026).
PAGE_METHOD = {"H-2A": "pooled/start", "H-2B": "same-season/filed", "CW-1": "pooled/filed"}
CLOCKS = ("start", "filed")


def backtest_visa(rows: list[dict], visa: str, pending_in) -> dict:
    newest = max(r["decided"] for r in rows)
    oldest = min(r["decided"] for r in rows)
    quarters = []
    for origin in quarter_starts(oldest + timedelta(days=1), newest):
        end = add_months(origin, 3)
        if end + timedelta(days=MIN_DAYS) > newest:
            continue
        # One test set for every method and clock: applications received in the
        # quarter with a first day of work, so the comparison is like for like.
        test = [r for r in rows if origin <= r["received"] < end and r["lead"] is not None]
        if len(test) < MIN_N:
            continue
        waiting = pending_in(origin, end)
        if waiting > MAX_PENDING_SHARE * (len(test) + waiting):
            continue
        q: dict = {"from": origin.isoformat(), "to": (end - timedelta(days=1)).isoformat(), "methods": {}}
        for clock in CLOCKS:
            for m in METHODS:
                p = fit(training(rows, origin, m, clock))
                if p:
                    q["methods"][f"{m}/{clock}"] = {"fit": p, **score(test, p, clock)}
        if not q["methods"]:
            continue
        q["stillPending"] = waiting
        quarters.append(q)
    totals = {}
    for key in [f"{m}/{c}" for c in CLOCKS for m in METHODS]:
        cells = [q["methods"][key] for q in quarters if key in q["methods"]]
        if not cells:
            continue
        n = sum(c["cases"] for c in cells)
        totals[key] = {
            "quarters": len(cells),
            "cases": n,
            # Weighted by cases, so a busy season counts for what it is.
            "middleHalfShare": round(sum(c["middleHalfShare"] * c["cases"] for c in cells) / n, 3),
            "wideShare": round(sum(c["wideShare"] * c["cases"] for c in cells) / n, 3),
            "typicalMissDays": round(statistics.median(c["typicalMissDays"] for c in cells), 1),
        }
    page = PAGE_METHOD[visa]
    return {"pageMethod": page, "page": totals.get(page), "quarters": quarters, "totals": totals}


# ---- H-2B assignment groups (Oct 8 2026) --------------------------------------
# A season DOL has finished, dated per case the way the page would have dated it
# before any of that season was decided (last same-month season's groups, spread
# by this season's applications: ingest_h2b_groups.group_estimate), against the
# page's current H-2B method on the same cases (the same receipt quarter a year
# earlier, pooled).
GROUP_SEASON_DONE = 0.9   # a season is scored once this share of it is decided


def h2b_group_test(db: Turso) -> list[dict]:
    import ingest_h2b_groups as g
    have = query_rows(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'h2b_groups'", [])
    if not have:
        return []
    doc = g.build(db)
    peaks = doc["peaks"]
    out = []
    for peak, info in sorted(peaks.items()):
        prev = g.previous_peak(peaks, peak)
        groups = info["groups"]
        cases = sum(x["cases"] for x in groups.values())
        decided = sum(x["decided"] for x in groups.values())
        if not prev or not cases or decided / cases < GROUP_SEASON_DONE:
            continue
        blank = {k: {"cases": v["cases"], "decided": 0} for k, v in groups.items()}
        est = g.group_estimate(peaks[prev]["groups"], peaks[prev]["applications"], blank, info["applications"])
        rows = query_rows(db, "SELECT case_number, grp, submitted FROM h2b_groups WHERE peak = ?", [peak])
        lookup = {cn: (grp, sub) for cn, grp, sub in rows}
        dec = g.decisions(db, {cn: {"submitted": sub} for cn, (_, sub) in lookup.items()})
        # The page's current method on the same cases: certified H-2B filed in the same
        # receipt quarter a year earlier.
        y, m = int(peak[:4]) - 1, int(peak[5:7])
        q_lo, q_hi = f"{y}-{m:02d}-01", f"{y}-{m + 3:02d}-01"
        base = sorted(int(d) for (d,) in query_rows(
            db, "SELECT CAST(julianday(decision_date) - julianday(received_date) AS INTEGER) FROM seasonal_cases "
                "WHERE visa_class = 'H-2B' AND case_status LIKE '%CERTIFICATION%' AND received_date >= ? AND received_date < ?",
            [q_lo, q_hi]) if d is not None)
        bp = {k: base[min(len(base) - 1, int(k / 100 * len(base)))] for k in (25, 50, 75)} if len(base) >= 50 else None
        errs, inside, berrs, binside = [], 0, [], 0
        for cn, (grp, _sub) in lookup.items():
            days, withdrawn = dec.get(cn, (None, False))
            if days is None or withdrawn or grp not in est:
                continue
            e = est[grp]
            errs.append(abs(days - e["p50"]))
            inside += e["p25"] <= days <= e["p75"]
            if bp:
                berrs.append(abs(days - bp[50]))
                binside += bp[25] <= days <= bp[75]
        if not errs:
            continue
        med = lambda v: sorted(v)[len(v) // 2]
        out.append({
            "season": peak, "from": prev, "decided": len(errs),
            "groups": {"typicalMissDays": med(errs), "middleHalfShare": round(inside / len(errs), 3)},
            "pageMethod": ({"typicalMissDays": med(berrs), "middleHalfShare": round(binside / len(berrs), 3)}
                           if berrs else None),
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    db = Turso()
    out: dict = {"method": "DOL's past certifications at each quarter's start, tested on the quarter's applications",
                 "visas": {}}
    for visa in VISAS:
        rows = load(db, visa)
        if len(rows) < MIN_N:
            continue
        out["visas"][visa] = backtest_visa(rows, visa, lambda lo, hi, v=visa: still_pending(db, v, lo, hi))
    groups = h2b_group_test(db)
    if groups:
        out["h2bGroups"] = groups
    print(json.dumps(out, indent=2))
    if a.write and any(v["quarters"] for v in out["visas"].values()):
        write_doc(db, "seasonal_backtest", json.dumps(out))
        print("wrote perm_docs['seasonal_backtest']")
    return 0


if __name__ == "__main__":
    sys.exit(main())
