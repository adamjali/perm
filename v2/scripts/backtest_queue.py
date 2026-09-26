"""The standing backtest of the decision-pace estimate.

WHY THIS EXISTS (2026-09-26). The estimate's scorecard used to rest on five
hand-picked cases. This rebuilds the PERM queue as it stood on a past day (T0),
predicts every in-line case near the front the way the site does, and scores
the predictions against what DOL actually decided between T0 and END. On its
first run (T0 = 2026-09-13) it scored 7,112 real decisions and showed that
counting cases on hold, at an RFI or on appeal as "ahead" made every date
about a week late; the site now counts analyst review only (see `inLine` in
src/lib/queueAhead.ts and .planning/estimator-backtest-2026-09-26.md).

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

Read-only unless `--write`, which stores the summary in
`perm_docs['estimator_backtest']` for /estimate-scorecard.

    python3 scripts/backtest_queue.py                 # T0 = 21 days ago
    python3 scripts/backtest_queue.py --t0 2026-09-13 --end 2026-09-25 --write
"""

from __future__ import annotations

import argparse
import collections
import json
import statistics
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_turso import Turso  # noqa: E402
import ingest_case_status_direct as c  # noqa: E402

ET = ZoneInfo("America/New_York")
FINAL = ("CERTIFIED", "DENIED", "WITHDRAWN")
IN_LINE = "ANALYST REVIEW"


def days_in_month(y: int, m: int) -> int:
    nxt = date(y + (m // 12), m % 12 + 1, 1)
    return (nxt - timedelta(days=1)).day


def is_final_status(s: str) -> bool:
    return s.startswith(FINAL)


def pace_before(db: Turso, t0: date) -> float | None:
    rows = c._rows(
        db,
        "SELECT total FROM daily_decisions WHERE source = 'sweep-observed' AND date >= ? AND date < ?",
        [(t0 - timedelta(days=28)).isoformat(), t0.isoformat()],
    )
    vals = [float(r[0]) for r in rows if r[0] is not None]
    if len(vals) < 14:
        return None
    # Over the days actually observed, like `measurePace`: the series began on
    # 2026-08-26, and dividing a partial window by 28 halved the first run's pace.
    return sum(vals) / len(vals)


MIN_BAND_DAYS = 7          # decisionPace.ts
MIN_BAND_FRACTION = 0.55   # decisionPace.ts


def weekday_spread(db: Turso, t0: date, pace: float) -> tuple[float, float] | None:
    """(fast, slow) calendar rates from the weekday p90/p10, scaled onto the
    calendar pace the way `measurePace` does it."""
    rows = c._rows(
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
        for r in c._rows(
            db,
            "SELECT case_number, from_status, MIN(changed_at) FROM perm_case_events "
            "WHERE changed_at >= ? AND source = ? GROUP BY case_number",
            [t0_ms, c.SOURCE],
        )
    }
    decided_at = {
        r[0]: datetime.fromtimestamp(int(r[1]) / 1000, ET).date()
        for r in c._rows(
            db,
            "SELECT case_number, MIN(changed_at) FROM perm_case_events WHERE changed_at >= ? "
            "AND source = ? AND to_final = 1 AND from_status NOT LIKE 'CERTIFIED%' "
            "AND from_status NOT LIKE 'DENIED%' AND from_status NOT LIKE 'WITHDRAWN%' "
            "GROUP BY case_number",
            [t0_ms, c.SOURCE],
        )
    }
    cases = []
    for cn, fd, cur, isf in c._rows(
        db,
        "SELECT case_number, filing_date, current_status, is_final FROM perm_case_status "
        "WHERE filing_date >= '2015-01-01' AND filing_date < ?",
        [(t0 + timedelta(days=1)).isoformat()],
    ):
        st0 = ((first_after[cn][0] if cn in first_after else cur) or "").upper()
        # PENDING ON T0 means its status THAT DAY was not final. "Final now or
        # decided later" is not enough: a CERTIFIED case whose certification
        # EXPIRED after T0 logs a final event after T0, and counting it made
        # 6,500 long-certified cases "pending" on the first run.
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
    print(json.dumps(result, indent=2))
    if a.write:
        db.execute(
            "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES ('estimator_backtest', ?, ?)",
            [json.dumps(result), int(time.time() * 1000)],
        )
        print("wrote perm_docs['estimator_backtest']")
    return 0


if __name__ == "__main__":
    sys.exit(main())
