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
    # "Today": a rival's answer for these cases is the day it was asked. It wins
    # the first decisions and carries every case still waiting, so it is scored
    # here on the same set, waiting cases counted, to keep the rate honest.
    by_today = {x["cn"]: t0 for x in keep}
    return {
        "frontierMonth": frontier,
        "medianDays": round(median, 1),
        "rate": score_floor(by_rate, outcome, end),
        "dolAverage": score_floor(by_avg, outcome, end) if by_avg else None,
        "casesAhead": score_floor(by_ahead, outcome, end),
        "today": score_floor(by_today, outcome, end),
    }


MIN_BAND_DAYS = 7          # decisionPace.ts
MIN_BAND_FRACTION = 0.55   # decisionPace.ts
MAX_BAND_DAYS = 60         # decisionPace.ts: no range is wider


def bound_range(day: int, early: int, late: int, floor: int) -> tuple[int, int]:
    """boundRange in decisionPace.ts, in days from T0."""
    e = min(day, max(floor, early))
    l = max(day, late)
    if l - e > MAX_BAND_DAYS:
        before = min(day - e, int(MAX_BAND_DAYS / 3 + 0.5))
        e = day - before
        l = min(l, day + MAX_BAND_DAYS - before)
    return e, l


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
    early, late = bound_range(raw, early, late, 1)
    return t0 + timedelta(days=early), t0 + timedelta(days=late)


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
    for cn, fd, cur, isf, ini in query_rows(
        db,
        # The employer's first two letters, for rival C's alphabetical order
        # (two, because a name can start with a quote or a space).
        "SELECT case_number, filing_date, current_status, is_final, upper(substr(trim(employer_name), 1, 2)) "
        "FROM perm_case_status WHERE filing_date >= '2015-01-01' AND filing_date < ?",
        [(t0 + timedelta(days=1)).isoformat()],
    ):
        st0 = ((first_after[cn][0] if cn in first_after else cur) or "").upper()
        # Pending on T0 means its status that day was not final. "Final now or
        # decided later" is not enough: a certification that expired after T0
        # logs a final event after T0 without having been pending.
        if is_final_status(st0) or not fd:
            continue
        cases.append({"cn": cn, "fd": fd, "m": fd[:7], "st0": st0, "l": initial_of(ini)})
    return cases, decided_at


class Record:
    """The status table and the event log read ONCE, then rebuilt as of any start day.

    `rebuild` asks the database again for every start day; testing a dozen of
    them each night would read the 430,000-row status table a dozen times.
    This reads it once, and the events since the earliest start day once, and
    answers `at(t0)` in memory with exactly rebuild's rules (pinned by
    test_backtest_queue.py)."""

    def __init__(self, status_rows: list, event_rows: list):
        self.status = [(cn, fd, (cur or "").upper(), initial_of(ini)) for cn, fd, cur, _isf, ini in status_rows
                       if fd and fd >= "2015-01-01"]
        # (changed_at ms, from_status, to_status, to_final) per case, oldest first.
        self.events: dict[str, list[tuple[int, str, str, int]]] = collections.defaultdict(list)
        for cn, fr, to, tf, at in sorted(event_rows, key=lambda r: int(r[4])):
            self.events[cn].append((int(at), (fr or "").upper(), (to or "").upper(), int(tf or 0)))

    @classmethod
    def load(cls, db: Turso, earliest: date) -> "Record":
        e_ms = int(datetime(earliest.year, earliest.month, earliest.day, tzinfo=ET).timestamp() * 1000)
        status = query_rows(
            db,
            "SELECT case_number, filing_date, current_status, is_final, upper(substr(trim(employer_name), 1, 2)) "
            "FROM perm_case_status WHERE filing_date >= '2015-01-01' AND filing_date < '2099-01-01'",
            [],
        )
        events = query_rows(
            db,
            "SELECT case_number, from_status, to_status, to_final, changed_at FROM perm_case_events "
            "WHERE changed_at >= ? AND source = ?",
            [e_ms, c.SOURCE],
        )
        return cls(status, events)

    def at(self, t0: date) -> tuple[list[dict], dict[str, date], dict[str, str]]:
        t0_ms = int(datetime(t0.year, t0.month, t0.day, tzinfo=ET).timestamp() * 1000)
        limit = (t0 + timedelta(days=1)).isoformat()
        cases, decided, how = [], {}, {}
        for cn, fd, cur, ini in self.status:
            evs = self.events.get(cn)
            after = [e for e in evs if e[0] >= t0_ms] if evs else []
            if fd < limit:
                st0 = after[0][1] if after else cur
                if not is_final_status(st0):
                    cases.append({"cn": cn, "fd": fd, "m": fd[:7], "st0": st0, "l": ini})
            for at, fr, to, tf in after:
                if tf and not is_final_status(fr):
                    decided[cn] = datetime.fromtimestamp(at / 1000, ET).date()
                    how[cn] = to
                    break
        return cases, decided, how


def decided_how(db: Turso, t0: date) -> dict[str, str]:
    """The status each case's first decision after t0 went TO. A withdrawal is
    the employer's act, so the range test leaves it out like the scorecard."""
    t0_ms = int(datetime(t0.year, t0.month, t0.day, tzinfo=ET).timestamp() * 1000)
    return {
        r[0]: (r[1] or "").upper()
        for r in query_rows(
            db,
            "SELECT case_number, to_status, MIN(changed_at) FROM perm_case_events WHERE changed_at >= ? "
            "AND source = ? AND to_final = 1 AND from_status NOT LIKE 'CERTIFIED%' "
            "AND from_status NOT LIKE 'DENIED%' AND from_status NOT LIKE 'WITHDRAWN%' "
            "GROUP BY case_number",
            [t0_ms, c.SOURCE],
        )
    }


def initial_of(prefix: str | None) -> str:
    """The first letter or digit of an employer name, as rival C sorts it (src/lib/scorecard/rivals.ts)."""
    for ch in (prefix or "").upper():
        if ch.isalnum():
            return ch
    return "M"


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


# ---- the range, measured by how far out the date is (Oct 8 2026) ---------
#
# The printed range used to be a fixed share of the horizon (decisionPace.ts:
# at least 7 days, 0.55 of the days ahead, a third before the date and two
# thirds after). On real decisions it held 29%: about a week wide near the
# front, drawn mostly AFTER the date, while DOL usually decided a few days
# before it. So each distance out now gets its range from what actually
# happened at that distance: the middle 80% of the cases DOL decided, from the
# start days of the last month. A distance with too few decided cases keeps the
# fixed rule and says so (`measured: false`), and switches on by itself once
# enough cases have been followed that far. The date itself is not moved.
#
# OUT OF SAMPLE. The coverage reported for a start day uses only the start days
# before it, so the figure the page quotes was never fitted to the cases it
# grades.

HORIZON_BUCKETS = ((0, 14), (15, 30), (31, 60), (61, 90), (91, 180), (181, 100_000))
RANGE_MIN_DECIDED = 300
RANGE_QUANTILES = (0.10, 0.90)
RANGE_ORIGINS_KEPT = 4
# A date is judged once it is this many days old. At 7, a case decided 8 days
# late counted as still waiting, and the range's late edge came out at
# exactly +7 because nothing later could be seen; at 14 it is +13 (Oct 8 2026).
RANGE_JUDGE_DAYS = 14
# Weekly start days tested each night, newest back; about three months.
MAX_START_DAYS = 13


def bucket_of(h: int) -> int:
    for i, (lo, hi) in enumerate(HORIZON_BUCKETS):
        if lo <= h <= hi:
            return i
    return len(HORIZON_BUCKETS) - 1


def quantile(vals: list[int], p: float) -> int:
    """Nearest rank on a sorted list."""
    return vals[min(len(vals) - 1, max(0, int(round(p * (len(vals) - 1)))))]


def range_samples(pred: dict[str, date], decided: dict[str, date], how: dict[str, str],
                  t0: date, end: date) -> list[dict]:
    """Per distance bucket: the decided cases' errors, and the judged cases still waiting."""
    out = [{"errors": [], "stuck": 0, "judged": 0} for _ in HORIZON_BUCKETS]
    for cn, p in pred.items():
        if (end - p).days < RANGE_JUDGE_DAYS:
            continue  # not yet judgeable: its date is too recent
        d = decided.get(cn)
        if d is not None and d <= end and how.get(cn, "").startswith("WITHDRAWN"):
            continue  # the employer withdrew: not DOL deciding
        b = out[bucket_of((p - t0).days)]
        b["judged"] += 1
        if d is not None and d <= end:
            b["errors"].append((d - p).days)
        else:
            b["stuck"] += 1
    return out


def range_model(samples: list[list[dict]]) -> list[dict]:
    """Pool start days per bucket into a range: the middle 80% of decided errors.

    Each bucket takes the newest RANGE_ORIGINS_KEPT start days that judged
    anything at that distance, so a near bucket reads the last month while a
    far one reads the older start days, the only ones whose dates have come due."""
    model = []
    for i, (lo, hi) in enumerate(HORIZON_BUCKETS):
        use = [s for s in samples if s[i]["judged"]][-RANGE_ORIGINS_KEPT:]
        errs = sorted(e for s in use for e in s[i]["errors"])
        judged = sum(s[i]["judged"] for s in use)
        stuck = sum(s[i]["stuck"] for s in use)
        row = {"fromDays": lo, "toDays": hi, "decided": len(errs), "judged": judged,
               "stuckShare": round(stuck / judged, 3) if judged else None,
               "measured": len(errs) >= RANGE_MIN_DECIDED}
        if row["measured"]:
            row["earlyDays"] = min(0, quantile(errs, RANGE_QUANTILES[0]))
            row["lateDays"] = max(0, quantile(errs, RANGE_QUANTILES[1]))
            # On the cases it was drawn from: what the page quotes until the
            # out-of-sample test has enough cases of its own.
            row["insideShare"] = round(
                sum(1 for e in errs if row["earlyDays"] <= e <= row["lateDays"]) / judged, 3)
        model.append(row)
    return model


def served_range(t0: date, p: date, ahead: float, pace: float, spread, model: list[dict] | None):
    """The range the site would print: the measured one for this distance, else the fixed rule."""
    h = (p - t0).days
    row = model[bucket_of(h)] if model else None
    if row and row.get("measured"):
        e, l = bound_range(h, h + row["earlyDays"], h + row["lateDays"], 1)
        return t0 + timedelta(days=e), t0 + timedelta(days=l)
    if not spread:
        return None
    return band(t0, ahead, pace, *spread)


def served_coverage(ranges: dict[str, tuple[date, date]], pred: dict[str, date], decided: dict[str, date],
                    how: dict[str, str], end: date) -> dict:
    judged = inside = stuck = 0
    for cn, p in pred.items():
        if cn not in ranges or (end - p).days < RANGE_JUDGE_DAYS:
            continue
        d = decided.get(cn)
        if d is not None and d <= end and how.get(cn, "").startswith("WITHDRAWN"):
            continue
        judged += 1
        if d is None or d > end:
            stuck += 1
        elif ranges[cn][0] <= d <= ranges[cn][1]:
            inside += 1
    return {"judged": judged,
            "insideShare": round(inside / judged, 3) if judged else None,
            "stuckShare": round(stuck / judged, 3) if judged else None}


# ---- rival C's published method, re-run on the same cases ----------------
# Month order, then employer A to Z, every pending case counted, 616 a day
# (src/lib/scorecard/rivals.ts). Re-running it over every decided case gives a
# head-to-head far larger than the daily sample of live answers can.
RIVAL_C_PACE = 616


def rival_c(cases: list[dict], t0: date, chosen: set[str]) -> dict[str, date]:
    by_month: dict[str, list[dict]] = collections.defaultdict(list)
    for x in cases:
        by_month[x["m"]].append(x)
    before, run = {}, 0
    for m in sorted(by_month):
        before[m] = run
        run += len(by_month[m])
    letters = {m: collections.Counter(x["l"] for x in xs) for m, xs in by_month.items()}
    out = {}
    for x in cases:
        if x["cn"] not in chosen:
            continue
        cnt = letters[x["m"]]
        within = sum(n for l, n in cnt.items() if l < x["l"]) + cnt[x["l"]] / 2
        out[x["cn"]] = t0 + timedelta(days=round((before[x["m"]] + within) / RIVAL_C_PACE))
    return out


def origin_run(db: Turso, rec: Record, t0: date, end: date, prior_model: list[dict] | None) -> dict | None:
    """One start day: our dates, the fixed range, the range the prior start days measured, rival C."""
    pace = pace_before(db, t0)
    if pace is None:
        return None
    cases, decided, how = rec.at(t0)
    ahead: dict[str, float] = {}
    current = predict(cases, t0, pace, True, ahead)
    chosen = near_set(current, end, (end - t0).days)
    spread = weekday_spread(db, t0, pace)
    fixed = {cn: band(t0, a, pace, *spread) for cn, a in ahead.items() if a > 0} if spread else {}
    measured = {}
    for cn, a in ahead.items():
        if a > 0:
            r = served_range(t0, current[cn], a, pace, spread, prior_model)
            if r:
                measured[cn] = r
    rc = rival_c(cases, t0, chosen)
    return {
        "t0": t0.isoformat(), "pace": round(pace, 1),
        "ours": score(current, decided, end, chosen),
        "rivalC": score(rc, decided, end, chosen),
        "fixedRange": served_coverage(fixed, current, decided, how, end),
        "measuredRange": served_coverage(measured, current, decided, how, end) if prior_model else None,
        "_samples": range_samples(current, decided, how, t0, end),
    }


# ---- the RFI clock (Oct 8 2026) -------------------------------------------------
# An RFI is not in filing order, so the cases-ahead date doesn't apply. What the
# record shows instead, for cases watched from the day they entered RFI: they
# leave it on day 30 to 32 (the response window, which AILA's notes of an OFLC
# panel give as 30 days; our sweep sees it a day late), most go back to analyst
# review, and DOL decides them a few days later. The case page dates an RFI case
# from its own RFI day with these, re-measured every night; the slow end after
# the 30 days is the attorney's two weeks until the record measures its own.
RFI = "RFI ISSUED"
ATTORNEY_SLOW_DAYS = 14
RFI_MIN_ELIGIBLE = 50


def rfi_followups(db: Turso) -> tuple[list[dict], date | None]:
    """Each case watched entering RFI (after the log's first day, so the entry is
    real): when it entered, when it left and to what, when DOL decided it."""
    rows = query_rows(
        db,
        "SELECT case_number, from_status, to_status, to_final, changed_at FROM perm_case_events "
        "WHERE source = ? AND case_number IN (SELECT case_number FROM perm_case_events WHERE source = ? AND to_status = ?) "
        "ORDER BY changed_at",
        [c.SOURCE, c.SOURCE, RFI],
    )
    first = query_rows(db, "SELECT MIN(changed_at) FROM perm_case_events WHERE source = ?", [c.SOURCE])
    if not first or first[0][0] is None:
        return [], None
    log_day = datetime.fromtimestamp(int(first[0][0]) / 1000, ET).date()
    ev: dict[str, list] = collections.defaultdict(list)
    for cn, fr, to, tf, at in rows:
        ev[cn].append((datetime.fromtimestamp(int(at) / 1000, ET).date(), (fr or "").upper(), (to or "").upper(), int(tf or 0)))
    out = []
    for cn, es in ev.items():
        i = next((k for k, e in enumerate(es) if e[2] == RFI and e[1] != RFI and e[0] > log_day), None)
        if i is None:
            continue
        entered = es[i][0]
        left = next(((e[0], e[2]) for e in es[i + 1:] if e[1] == RFI), None)
        dec = next(((e[0], e[2]) for e in es[i + 1:] if e[3] and not is_final_status(e[1])), None)
        out.append({"cn": cn, "entered": entered, "left": left[0] if left else None, "leftTo": left[1] if left else None,
                    "decided": dec[0] if dec else None, "decidedTo": dec[1] if dec else None})
    return out, log_day


def survival_pct(pairs: list[tuple[date, date | None]], asof: date, p: int) -> int | None:
    """The first day d by which p% of the starts watched at least d days had ended,
    counting only what was known by `asof`."""
    for d in range(0, 120):
        elig = [(s, e) for s, e in pairs if (asof - s).days >= d]
        if len(elig) < RFI_MIN_ELIGIBLE:
            return None
        ended = sum(1 for s, e in elig if e is not None and e <= asof and (e - s).days <= d)
        if ended * 100 >= p * len(elig):
            return d
    return None


def rfi_clock(follow: list[dict], asof: date) -> dict | None:
    """Days in RFI, and days from leaving it (back to a pending status) to DOL's decision."""
    stay = [(f["entered"], f["left"]) for f in follow if f["entered"] <= asof]
    after = [(f["left"], f["decided"]) for f in follow
             if f["left"] and f["left"] <= asof and f["leftTo"] and not is_final_status(f["leftTo"])]
    leave = {f"p{q}": survival_pct(stay, asof, q) for q in (25, 50, 75)}
    post = {f"p{q}": survival_pct(after, asof, q) for q in (25, 50, 75, 90)}
    if leave["p50"] is None or post["p50"] is None:
        return None
    # The slow end is the record's own 90th percentile once enough cases have
    # been watched that long; until then the attorney's two weeks.
    measured = post["p90"] is not None
    return {"watched": len(stay), "leaveDays": leave, "afterLeaveDays": post, "afterLeaveWatched": len(after),
            "slowEndDays": post["p90"] if measured else ATTORNEY_SLOW_DAYS,
            "slowEndFrom": "measured" if measured else "an immigration attorney's estimate"}


def rfi_dates(entered: date, clock: dict) -> tuple[date, date, date]:
    """The case page's date and range for a case entered into RFI on `entered`."""
    lv, af = clock["leaveDays"], clock["afterLeaveDays"]
    day = entered + timedelta(days=lv["p50"] + af["p50"])
    early = entered + timedelta(days=(lv["p25"] if lv["p25"] is not None else lv["p50"]) + (af["p25"] or 0))
    late = entered + timedelta(days=(lv["p75"] if lv["p75"] is not None else lv["p50"]) + clock["slowEndDays"])
    return min(early, day), day, max(late, day)


def rfi_test(follow: list[dict], end: date) -> dict | None:
    """Out of sample: at each weekly start day, the clock measured from what was
    known then, put to the cases then in RFI; judged two weeks after each date."""
    if not follow:
        return None
    first = min(f["entered"] for f in follow)
    errs, inside, stuck, judged = [], 0, 0, 0
    t = first + timedelta(days=35)
    while t <= end - timedelta(days=14):
        clock = rfi_clock([f for f in follow if f["entered"] <= t], t)
        if clock:
            for f in follow:
                if f["entered"] > t or (f["left"] and f["left"] <= t) or (f["decided"] and f["decided"] <= t):
                    continue
                if f["decidedTo"] and f["decidedTo"].startswith("WITHDRAWN") and f["decided"] <= end:
                    continue
                lo, day, hi = rfi_dates(f["entered"], clock)
                if (end - day).days < 14:
                    continue
                judged += 1
                if f["decided"] and f["decided"] <= end:
                    errs.append((f["decided"] - day).days)
                    inside += lo <= f["decided"] <= hi
                else:
                    stuck += 1
        t += timedelta(days=7)
    if not judged:
        return None
    a = sorted(abs(e) for e in errs)
    return {"judged": judged, "decided": len(errs),
            "typicalMissDays": a[len(a) // 2] if a else None,
            "biasDays": sorted(errs)[len(errs) // 2] if errs else None,
            "insideShare": round(inside / judged, 3), "stuckShare": round(stuck / judged, 3)}


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
    # Every weekly start day the record can test, oldest first, each scored
    # with the range the start days before it measured (out of sample). The
    # model the site reads pools the last month of start days.
    starts, t = [], end - timedelta(days=14)
    while len(starts) < MAX_START_DAYS and pace_before(db, t) is not None:
        starts.append(t)
        t -= timedelta(days=7)
    runs, model = [], None
    rec = Record.load(db, min(starts)) if starts else None
    for t in sorted(starts):
        r = origin_run(db, rec, t, end, model)
        if r is None:
            continue
        runs.append(r)
        model = range_model([x["_samples"] for x in runs])
    if runs:
        result["rangeModel"] = {
            "buckets": model,
            "quantiles": list(RANGE_QUANTILES),
            "minDecided": RANGE_MIN_DECIDED,
            "judgeDays": RANGE_JUDGE_DAYS,
            "startDays": [x["t0"] for x in runs],
        }
        result["origins"] = [{k: v for k, v in x.items() if k != "_samples"} for x in runs]
        tested = [x for x in runs if x.get("measuredRange") and x["measuredRange"]["judged"]]
        if tested:
            # The pooled out-of-sample figure the page quotes for the range it prints.
            j = sum(x["measuredRange"]["judged"] for x in tested)
            result["servedRange"] = {
                "judged": j,
                "insideShare": round(sum(x["measuredRange"]["insideShare"] * x["measuredRange"]["judged"]
                                         for x in tested) / j, 3),
                "stuckShare": round(sum(x["measuredRange"]["stuckShare"] * x["measuredRange"]["judged"]
                                        for x in tested) / j, 3),
                "startDays": [x["t0"] for x in tested],
            }
    follow, log_day = rfi_followups(db)
    clock = rfi_clock(follow, end)
    if clock and log_day:
        clock["test"] = rfi_test(follow, end)
        clock["watchedFrom"] = log_day.isoformat()
        result["rfiClock"] = clock
    print(json.dumps(result, indent=2, default=str))
    if a.write:
        write_doc(db, "estimator_backtest", json.dumps(result))
        print("wrote perm_docs['estimator_backtest']")
    return 0


if __name__ == "__main__":
    sys.exit(main())
