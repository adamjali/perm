"""The standing backtest of the decision-pace estimate.

This rebuilds the PERM queue as it stood on a past day (T0), predicts every
in-line case near the front the way the site does, and scores the
predictions against what DOL actually decided between T0 and END. It is why
the site counts only analyst-review cases as "ahead" (see `inLine` in
src/lib/queueAhead.ts): counting holds, RFIs and appeals made every date
about a week late.

HOW THE PAST QUEUE IS REBUILT. `perm_case_status` holds today's status. A
case's status on T0 is the `from_status` of its first event after T0, or its
current status when nothing has happened since. A case was pending on T0 when
it is pending now or its first final event came after T0. Decision day = the
first final event, as an Eastern date (the sweep's own observation, so a
decision is dated to within the half day between sweeps).

THE PREDICTION, AS THE SITE MAKES IT. Cases ahead = analyst-review cases in
earlier filing months plus the same month prorated by filing day (the
`casesAheadOfDay` arithmetic); date = T0 + ahead / pace, where pace is the
calendar mean of DOL decisions over the observed days in the 28 before T0, from
`daily_decisions` (sweep-observed). The site's `measurePace` also drops a
shutdown-length collapse; none falls in a normal window. The previous rule
(every pending case ahead) is scored alongside, so a regression shows.

THE LEFT-BEHIND SECTION (Oct 7 2026). A case still in analyst review whose
filing month DOL's queue has already passed is dated by the rate DOL is
finishing exactly that group at (scripts/build_straggler_rates.py), not by
DOL's published average. `passed` re-measures that rule weekly against the two
it replaced or could: DOL's average (filed + its average days) and the cases
ahead at the pace. A case still waiting at END counts as late by at least END
minus its date; a case that left the line another way (an RFI, a hold, a
withdrawal) is not on this clock and is left out.

Read-only unless `--write`, which stores the summary in
`perm_docs['estimator_backtest']` for /estimate-scorecard.

    python3 scripts/backtest_queue.py                 # T0 = 21 days ago
    python3 scripts/backtest_queue.py --t0 2026-09-13 --end 2026-09-25 --write
"""

from __future__ import annotations

import argparse
import collections
import json
import math
import statistics
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_turso import ET, Turso, query_rows, write_doc  # noqa: E402
import ingest_case_status_direct as c  # noqa: E402

FINAL = ("CERTIFIED", "DENIED", "WITHDRAWN")
IN_LINE = "ANALYST REVIEW"


def days_in_month(y: int, m: int) -> int:
    nxt = date(y + (m // 12), m % 12 + 1, 1)
    return (nxt - timedelta(days=1)).day


def is_final_status(s: str) -> bool:
    return s.startswith(FINAL)


def pace_before(db: Turso, t0: date) -> float | None:
    rows = query_rows(
        db,
        "SELECT total FROM daily_decisions WHERE source = 'sweep-observed' AND date >= ? AND date < ?",
        [(t0 - timedelta(days=28)).isoformat(), t0.isoformat()],
    )
    vals = [float(r[0]) for r in rows if r[0] is not None]
    if len(vals) < 14:
        return None
    # Over the days actually observed, like `measurePace`: a window the series
    # doesn't yet fill must not be divided by 28.
    return sum(vals) / len(vals)


def frontier_at(db: Turso, t0: date) -> tuple[str | None, int | None]:
    """DOL's Analyst Review month and its average days, from the newest reading on or before t0."""
    rows = query_rows(
        db,
        "SELECT json FROM processing_time_readings WHERE perm_as_of <= ? ORDER BY perm_as_of DESC LIMIT 1",
        [t0.isoformat()],
    )
    if not rows or not rows[0][0]:
        return None, None
    j = json.loads(rows[0][0])
    month = next((q["priorityDate"] for q in j.get("permQueues", []) if q.get("queue") == "Analyst Review"), None)
    avg = next((a["calendarDays"] for a in j.get("permAverageDays", [])
                if a.get("determination") == "Analyst Review"), None)
    return month, (int(avg) if avg else None)


def first_moves(db: Turso, t0: date) -> dict[str, tuple[date, str, bool]]:
    """Each case's first status change on or after t0: (day, new status, final)."""
    t0_ms = int(datetime(t0.year, t0.month, t0.day, tzinfo=ET).timestamp() * 1000)
    return {
        r[0]: (datetime.fromtimestamp(int(r[3]) / 1000, ET).date(), (r[1] or "").upper(), bool(int(r[2] or 0)))
        for r in query_rows(
            db,
            "SELECT case_number, to_status, to_final, MIN(changed_at) FROM perm_case_events "
            "WHERE changed_at >= ? AND source = ? GROUP BY case_number",
            [t0_ms, c.SOURCE],
        )
    }


def straggler_rate(cases_lo: list[dict], moves_lo: dict[str, tuple[date, str, bool]],
                   lo: date, hi: date, frontier: str) -> float | None:
    """build_straggler_rates.py over [lo, hi): decided / exposure among in-line
    cases filed before the frontier month. A withdrawal is the employer's act
    and isn't counted as DOL deciding."""
    decided = exposure = 0.0
    span = (hi - lo).days
    for x in cases_lo:
        if x["st0"] != IN_LINE or x["m"] >= frontier:
            continue
        mv = moves_lo.get(x["cn"])
        if mv and mv[0] < hi:
            exposure += (mv[0] - lo).days + 0.5
            if mv[2] and not mv[1].startswith("WITHDRAWN"):
                decided += 1
        else:
            exposure += span
    return decided / exposure if exposure else None


def score_floor(pred: dict[str, date], outcome: dict[str, date | None], end: date) -> dict:
    """Errors on decided cases, and a floor for the ones still waiting: a case
    waiting at END is at least END minus its date late once that date passed."""
    errs, floors = [], []
    for cn, p in pred.items():
        o = outcome[cn]
        if o is not None:
            errs.append((o - p).days)
            floors.append(abs((o - p).days))
        else:
            floors.append(max(0, (end - p).days))
    return {
        "cases": len(pred),
        "decided": len(errs),
        "typicalMissDays": round(statistics.median([abs(e) for e in errs]), 1) if errs else None,
        "biasDays": round(statistics.median(errs), 1) if errs else None,
        "missAtLeastDays": round(statistics.median(floors), 1) if floors else None,
        "within7Share": round(sum(1 for f in floors if f <= 7) / len(floors), 3) if floors else None,
    }


def passed_section(cases: list[dict], moves: dict[str, tuple[date, str, bool]], t0: date, end: date,
                   frontier: str, avg_days: int | None, rate: float | None, pace: float) -> dict | None:
    """The left-behind cases on t0, dated three ways and scored on one set."""
    keep: list[dict] = []
    outcome: dict[str, date | None] = {}
    in_line = sorted((x for x in cases if x["st0"] == IN_LINE), key=lambda x: x["fd"])
    rank = {x["cn"]: i for i, x in enumerate(in_line)}
    for x in in_line:
        if x["m"] >= frontier:
            continue
        mv = moves.get(x["cn"])
        if mv is None or mv[0] > end:
            outcome[x["cn"]] = None
        elif mv[2] and not mv[1].startswith("WITHDRAWN"):
            outcome[x["cn"]] = mv[0]
        else:
            continue  # left the line another way: not on this clock
        keep.append(x)
    if not keep or not rate:
        return None
    median = math.log(2) / rate
    by_rate = {x["cn"]: t0 + timedelta(days=round(median)) for x in keep}
    by_ahead = {x["cn"]: t0 + timedelta(days=max(1, round(rank[x["cn"]] / pace))) for x in keep}
    by_avg = {x["cn"]: date.fromisoformat(x["fd"]) + timedelta(days=avg_days) for x in keep} if avg_days else {}
    return {
        "frontierMonth": frontier,
        "medianDays": round(median, 1),
        "rate": score_floor(by_rate, outcome, end),
        "dolAverage": score_floor(by_avg, outcome, end) if by_avg else None,
        "casesAhead": score_floor(by_ahead, outcome, end),
    }


MIN_BAND_DAYS = 7          # decisionPace.ts
MIN_BAND_FRACTION = 0.55   # decisionPace.ts


def weekday_spread(db: Turso, t0: date, pace: float) -> tuple[float, float] | None:
    """(fast, slow) calendar rates from the weekday p90/p10, scaled onto the
    calendar pace the way `measurePace` does it."""
    rows = query_rows(
        db,
        "SELECT date, total FROM daily_decisions WHERE source = 'sweep-observed' AND date >= ? AND date < ?",
        [(t0 - timedelta(days=28)).isoformat(), t0.isoformat()],
    )
    wd = sorted(float(r[1]) for r in rows if r[1] is not None and date.fromisoformat(r[0]).weekday() < 5)
    if len(wd) < 6:
        return None
    med = wd[len(wd) // 2]
    active = [x for x in wd if x >= med * 0.15]
    mean = sum(active) / len(active)
    q = lambda p: active[int(p * (len(active) - 1))]  # noqa: E731
    return q(0.9) * pace / mean, q(0.1) * pace / mean


def band(t0: date, ahead: float, pace: float, fast: float, slow: float) -> tuple[date, date]:
    """The range the site prints, from decisionPace.ts: fast/slow ends, then
    a floor of 55% of the horizon grown one third early, two thirds late."""
    raw = round(ahead / pace)
    early = round(ahead / fast)
    late = round(ahead / slow)
    floor = max(MIN_BAND_DAYS, round(raw * MIN_BAND_FRACTION))
    if late - early < floor:
        grow = floor - (late - early)
        early -= round(grow / 3)
        late += round(grow * 2 / 3)
    early = max(1, early)
    return t0 + timedelta(days=min(early, raw)), t0 + timedelta(days=max(late, raw))


def coverage(bands: dict[str, tuple[date, date]], decided: dict[str, date], end: date,
             pred: dict[str, date]) -> dict:
    """Of the cases DATED at least a week before END, how many DOL decided
    inside their printed range. The judged set is fixed by the prediction, not
    by the range, so a different range shape is scored on the same cases; a
    case still pending at END is a miss (no survivorship)."""
    judged = [cn for cn, p in pred.items() if cn in bands and (end - p).days >= 7]
    inside = sum(1 for cn in judged if cn in decided and bands[cn][0] <= decided[cn] <= bands[cn][1])
    return {"judged": len(judged), "insideShare": round(inside / len(judged), 3) if judged else None}


def rebuild(db: Turso, t0: date) -> tuple[list[dict], dict[str, date]]:
    t0_ms = int(datetime(t0.year, t0.month, t0.day, tzinfo=ET).timestamp() * 1000)
    first_after = {
        r[0]: (r[1], r[2])
        for r in query_rows(
            db,
            "SELECT case_number, from_status, MIN(changed_at) FROM perm_case_events "
            "WHERE changed_at >= ? AND source = ? GROUP BY case_number",
            [t0_ms, c.SOURCE],
        )
    }
    decided_at = {
        r[0]: datetime.fromtimestamp(int(r[1]) / 1000, ET).date()
        for r in query_rows(
            db,
            "SELECT case_number, MIN(changed_at) FROM perm_case_events WHERE changed_at >= ? "
            "AND source = ? AND to_final = 1 AND from_status NOT LIKE 'CERTIFIED%' "
            "AND from_status NOT LIKE 'DENIED%' AND from_status NOT LIKE 'WITHDRAWN%' "
            "GROUP BY case_number",
            [t0_ms, c.SOURCE],
        )
    }
    cases = []
    for cn, fd, cur, isf in query_rows(
        db,
        "SELECT case_number, filing_date, current_status, is_final FROM perm_case_status "
        "WHERE filing_date >= '2015-01-01' AND filing_date < ?",
        [(t0 + timedelta(days=1)).isoformat()],
    ):
        st0 = ((first_after[cn][0] if cn in first_after else cur) or "").upper()
        # Pending on T0 means its status that day was not final. "Final now or
        # decided later" is not enough: a certification that expired after T0
        # logs a final event after T0 without having been pending.
        if is_final_status(st0) or not fd:
            continue
        cases.append({"cn": cn, "fd": fd, "m": fd[:7], "st0": st0})
    return cases, decided_at


def predict(cases: list[dict], t0: date, pace: float, in_line_only: bool,
            ahead_out: dict[str, float] | None = None) -> dict[str, date]:
    keep = (lambda x: x["st0"] == IN_LINE) if in_line_only else (lambda x: True)
    by_month: dict[str, list[dict]] = collections.defaultdict(list)
    for x in cases:
        if keep(x):
            by_month[x["m"]].append(x)
    months = sorted(by_month)
    cum, run = {}, 0
    for m in months:
        cum[m] = run
        run += len(by_month[m])
    out = {}
    for m in months:
        n_same = len(by_month[m])
        for x in by_month[m]:
            if x["st0"] != IN_LINE:
                continue  # only in-line cases get a date on the site
            y, mo, d = int(x["fd"][:4]), int(x["fd"][5:7]), int(x["fd"][8:10])
            within = round(n_same * (d - 1) / days_in_month(y, mo))
            if ahead_out is not None:
                ahead_out[x["cn"]] = cum[m] + within
            out[x["cn"]] = t0 + timedelta(days=(cum[m] + within) / pace)
    return out


def near_set(pred: dict[str, date], end: date, horizon_days: int) -> set[str]:
    """The cases the CURRENT rule dates within `horizon_days` after END.

    Both rules are scored on this one set. Selecting each rule's own near set
    compared them on different cases (the old rule dates everything later, so
    its "near" cases were a different, smaller population)."""
    return {cn for cn, p in pred.items() if (p - end).days <= horizon_days}


def score(pred: dict[str, date], decided: dict[str, date], end: date, cases: set[str]) -> dict:
    near = {cn: pred[cn] for cn in cases if cn in pred}
    dec = {cn: decided[cn] for cn in near if cn in decided and decided[cn] <= end}
    errs = [(dec[cn] - near[cn]).days for cn in dec]
    right = sum(1 for cn, p in near.items() if (p <= end) == (cn in dec))
    return {
        "cases": len(near),
        "decided": len(dec),
        "typicalMissDays": round(statistics.median([abs(e) for e in errs]), 1) if errs else None,
        "biasDays": round(statistics.median(errs), 1) if errs else None,
        "within7Share": round(sum(1 for e in errs if abs(e) <= 7) / len(errs), 3) if errs else None,
        "decidedByEndRight": round(right / len(near), 3) if near else None,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    today = datetime.now(ET).date()
    ap.add_argument("--t0", default=(today - timedelta(days=21)).isoformat())
    ap.add_argument("--end", default=(today - timedelta(days=1)).isoformat())
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    t0, end = date.fromisoformat(a.t0), date.fromisoformat(a.end)
    db = Turso()
    pace = pace_before(db, t0)
    if pace is None:
        print("::warning::backtest: fewer than 14 days of decisions before T0; nothing scored")
        return 0
    cases, decided = rebuild(db, t0)
    window = (end - t0).days
    ahead: dict[str, float] = {}
    current = predict(cases, t0, pace, True, ahead)
    everyone = predict(cases, t0, pace, False)
    chosen = near_set(current, end, window)
    spread = weekday_spread(db, t0, pace)
    bands = ({cn: band(t0, a, pace, *spread) for cn, a in ahead.items() if a > 0}
             if spread else {})
    result = {
        "t0": t0.isoformat(),
        "end": end.isoformat(),
        "pace": round(pace, 1),
        "pendingAtT0": len(cases),
        "inLineAtT0": sum(1 for x in cases if x["st0"] == IN_LINE),
        "current": score(current, decided, end, chosen),
        "allPending": score(everyone, decided, end, chosen),
        "rangeCoverage": coverage(bands, decided, end, current),
        "method": "analyst review ahead, prorated by filing day, over the calendar mean of the 28 days before T0",
    }
    frontier, avg_days = frontier_at(db, t0)
    if frontier:
        lo = t0 - timedelta(days=14)
        cases_lo, _ = rebuild(db, lo)
        rate = straggler_rate(cases_lo, first_moves(db, lo), lo, t0, frontier)
        result["passed"] = passed_section(cases, first_moves(db, t0), t0, end, frontier, avg_days, rate, pace)
    print(json.dumps(result, indent=2))
    if a.write:
        write_doc(db, "estimator_backtest", json.dumps(result))
        print("wrote perm_docs['estimator_backtest']")
    return 0


if __name__ == "__main__":
    sys.exit(main())
