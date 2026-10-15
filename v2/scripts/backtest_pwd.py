"""The standing backtest of the prevailing wage (PWD) month estimate.

The site names the MONTH DOL should issue a PERM wage determination
(`estimatePwdQueue`, convex/lib/perm/calculators/pwdQueue.ts): the requests
still pending from earlier receipt months, plus half of the request's own
month, divided by the clearance DOL measured between two of its snapshots,
counted from DOL's own as-of date. This rebuilds that estimate as it stood the
day each DOL snapshot was first read, for every PERM wage request then in
process, and grades it against what DOL actually did by END.

GRADED AGAINST THE MONTH. The estimate names a month, so the hit is "decided
inside that month"; the error in days is measured from the month's middle, the
way the daily sample grades it (src/lib/db/predictions.ts). A request still
in process at END is a miss once its month has ended, counted at the days
since. A request that left the line another way (an RFI, a redetermination,
a withdrawal) is not on this clock and is left out.

Read-only unless `--write`, which stores the summary in
`perm_docs['pwd_backtest']` for /estimate-scorecard and the admin page.

    python3 scripts/backtest_pwd.py
    python3 scripts/backtest_pwd.py --end 2026-10-06 --write
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_db import ET, Database, query_rows, write_doc  # noqa: E402
from lib_holidays import add_workdays, decided_on, is_dol_workday, workdays_between  # noqa: E402

IN_LINE = "IN PROCESS"
PREFIX = "P-100-"


def month_add(ym: str, n: int) -> str:
    y, m = int(ym[:4]), int(ym[5:7])
    t = y * 12 + (m - 1) + n
    return f"{t // 12:04d}-{t % 12 + 1:02d}"


def months_between(a: str, b: str) -> int:
    """Whole calendar months from a (YYYY-MM-DD) to b, like date-fns differenceInCalendarMonths."""
    return (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])


def days_in(ym: str) -> int:
    y, m = int(ym[:4]), int(ym[5:7])
    nxt = date(y + (m // 12), m % 12 + 1, 1)
    return (nxt - timedelta(days=1)).day


def clearance(earlier: dict, later: dict) -> float | None:
    """measurePwdClearance: the same receipt months in both snapshots, how far each fell, per month."""
    months = months_between(earlier["asOf"], later["asOf"])
    if months < 1:
        return None
    before = {r["receiptMonth"]: r["remainingRequests"] for r in earlier["backlog"]}
    cleared = 0
    for r in later["backlog"]:
        b = before.get(r["receiptMonth"])
        if b is None:
            continue
        if b > r["remainingRequests"]:
            cleared += b - r["remainingRequests"]
    return cleared / months if cleared > 0 else None


def estimated_month(request_month: str, backlog: list[dict], as_of: str, rate: float) -> str:
    """estimatePwdQueue's estimatedMonth, for a positive rate."""
    ahead = sum(r["remainingRequests"] for r in backlog if r["receiptMonth"] < request_month)
    same = sum(r["remainingRequests"] for r in backlog if r["receiptMonth"] == request_month)
    remaining = (ahead + same / 2) / rate
    as_of_month = as_of[:7]
    into = int(as_of[8:10]) / days_in(as_of_month) + remaining
    return month_add(as_of_month, max(0, math.ceil(into - 1e-9) - 1))


def snapshots(db: Database) -> list[dict]:
    """One per DOL wage as-of date: its backlog, and the day we first read it."""
    seen: dict[str, dict] = {}
    for perm_as_of, pwd_as_of, js, fetched in query_rows(
        db, "SELECT perm_as_of, pwd_as_of, json, fetched_at FROM processing_time_readings ORDER BY fetched_at", []
    ):
        if not pwd_as_of or pwd_as_of in seen:
            continue
        j = json.loads(js)
        seen[pwd_as_of] = {
            "asOf": pwd_as_of,
            "backlog": j.get("pwdPermBacklog") or [],
            "readOn": datetime.fromtimestamp(int(fetched) / 1000, ET).date(),
        }
    return sorted(seen.values(), key=lambda s: s["asOf"])


def score_months(pred: dict[str, str], outcome: dict[str, date | None], end: date) -> dict:
    """Graded against the predicted month: inside it, and days from its middle.
    The inside share is judged on requests whose month ended a week before END."""
    errs, floors, judged, inside = [], [], 0, 0
    for cn, ym in pred.items():
        mid = date(int(ym[:4]), int(ym[5:7]), 15)
        last = date(int(ym[:4]), int(ym[5:7]), days_in(ym))
        o = outcome[cn]
        if o is not None:
            errs.append((o - mid).days)
            floors.append(abs((o - mid).days))
        else:
            floors.append(max(0, (end - last).days))
        if (end - last).days >= 7:
            judged += 1
            inside += o is not None and o.strftime("%Y-%m") == ym
    return {
        "cases": len(pred),
        "decided": len(errs),
        "typicalMissDays": round(statistics.median([abs(e) for e in errs]), 1) if errs else None,
        "biasDays": round(statistics.median(errs), 1) if errs else None,
        "missAtLeastDays": round(statistics.median(floors), 1) if floors else None,
        "judged": judged,
        "insideMonthShare": round(inside / judged, 3) if judged else None,
    }


# ---- the day method (Oct 8 2026) ------------------------------------------
# The same shape as the PERM date: requests in process filed before this one,
# divided by DOL's measured rate of finishing them. DOL works wage requests by
# receipt date, and the live table carries every request's filing day, so the
# count ahead is exact rather than prorated. Tested here before the site uses it.
#
# ON DOL'S DAYS (Oct 15 2026): estimatePwdDay counts the days DOL works,
# weekdays that aren't federal holidays, and dates every exit by the day DOL
# decided it (lib_holidays.decided_on: our morning sweep reads the day before's
# decisions). This rebuilds it exactly: the queue as the morning sweep left it
# on the start day, DOL's pace a working day over the 28 days before, the date
# that many working days on, each outcome on DOL's day. The calendar-day walk
# on the sweep's own clock it replaced read about 2 days late (0 here).
DAY_PACE_DAYS = 28
DAY_MIN_WORKDAYS = 10  # PWD_MIN_WORKDAYS
DAY_COLLAPSE = 0.15  # COLLAPSE_FRACTION (decisionPace.ts)
DAY_EDGE_WORKDAYS = 5  # PWD_EDGE_WORKDAYS
DAY_JUDGE_DAYS = 7
# By WORKING days out: about two, four, eight and sixteen weeks.
DAY_BUCKETS = ((0, 10), (11, 20), (21, 40), (41, 80), (81, 100_000))
DAY_RANGE_MIN = 300
DAY_RANGE_STARTS = 2
DAY_RANGE_PER_START = 50


def js_round(x: float) -> int:
    """Math.round: half rounds up (Python's round goes to the even number)."""
    return math.floor(x + 0.5)


def workday_pace(days: list[tuple[date, int]]) -> dict | None:
    """measureWorkdayPace (pwdQueue.ts): every exit in the window over its
    working days, a run of three or more low working days left out, and the
    edges DOL's fastest and slowest stretch of DAY_EDGE_WORKDAYS working days
    (90th and 10th percentile), on the same scale."""
    days = sorted(days)
    work = [(d, n) for d, n in days if is_dol_workday(d)]
    if len(work) < DAY_MIN_WORKDAYS:
        return None
    srt = sorted(n for _, n in work)
    median = srt[len(srt) // 2]
    if not median > 0:
        return None
    dropped: set[date] = set()
    i = 0
    while i < len(work):
        j = i
        while j < len(work) and work[j][1] < median * DAY_COLLAPSE:
            j += 1
        if j - i >= 3:
            dropped.update(d for d, _ in work[i:j])
        i = j if j > i else i + 1
    kept = [(d, n) for d, n in days if d not in dropped]
    kept_work = [n for d, n in kept if is_dol_workday(d)]
    if len(kept_work) < DAY_MIN_WORKDAYS:
        return None
    per = sum(n for _, n in kept) / len(kept_work)
    mean = sum(kept_work) / len(kept_work)
    scale = per / mean if mean > 0 else 1
    weeks = sorted(sum(kept_work[k:k + DAY_EDGE_WORKDAYS]) / DAY_EDGE_WORKDAYS * scale
                   for k in range(len(kept_work) - DAY_EDGE_WORKDAYS + 1))
    q = lambda p: weeks[math.floor(p * (len(weeks) - 1))]
    if not (per > 0 and q(0.1) > 0):
        return None
    return {"perWorkday": per, "fast": q(0.9), "slow": q(0.1), "workdaysUsed": len(kept_work)}


def exit_days(events: dict, t0: date, days: int) -> list[tuple[date, int]]:
    """Requests leaving IN PROCESS for a final status, by DOL's day, on each
    of the `days` days before t0 (from the first day the log holds)."""
    lo = t0 - timedelta(days=days)
    counts: dict[date, int] = {}
    first = None
    for evs in events.values():
        for at, fr, to, tf in evs:
            d = decided_on(at)
            first = d if first is None or d < first else first
            if lo <= d < t0 and tf and fr == IN_LINE:
                counts[d] = counts.get(d, 0) + 1
                break
    if first is None:
        return []
    return [(lo + timedelta(days=i), counts.get(lo + timedelta(days=i), 0))
            for i in range(days) if lo + timedelta(days=i) >= first]


def day_predictions(in_line: list[tuple[str, str]], t0: date, pace: float) -> dict[str, tuple[date, int]]:
    """(case, filing day) in process on t0 -> (date, working days out). Same-day
    filings count half; the count covers DOL's day before t0."""
    by_day: dict[str, int] = {}
    for _, fd in in_line:
        by_day[fd] = by_day.get(fd, 0) + 1
    before, run = {}, 0
    for fd in sorted(by_day):
        before[fd] = run + by_day[fd] / 2
        run += by_day[fd]
    counted = t0 - timedelta(days=1)
    out = {}
    for cn, fd in in_line:
        h = max(1, js_round(before[fd] / pace))
        out[cn] = (add_workdays(counted, h), h)
    return out


def day_bucket(h: int) -> int:
    return next((i for i, (lo, hi) in enumerate(DAY_BUCKETS) if lo <= h <= hi), len(DAY_BUCKETS) - 1)


def day_score(pred: dict[str, tuple[date, int]], outcome: dict[str, date | None], end: date,
              ranges: dict[int, tuple[int, int]] | None = None) -> dict:
    """Errors in calendar days (what a reader feels) and in working days (what
    the range is drawn in); the range is judged in working days."""
    errs, werrs, judged, stuck, inside = [], [], 0, 0, 0
    for cn, (p, h) in pred.items():
        if (end - p).days < DAY_JUDGE_DAYS:
            continue
        judged += 1
        o = outcome[cn]
        if o is None or o > end:
            stuck += 1
            continue
        errs.append((o - p).days)
        w = workdays_between(p, o)
        werrs.append(w)
        if ranges and day_bucket(h) in ranges:
            lo, hi = ranges[day_bucket(h)]
            inside += lo <= w <= hi
    a = sorted(abs(e) for e in errs)
    out = {
        "judged": judged, "decided": len(errs),
        "typicalMissDays": round(statistics.median(a), 1) if a else None,
        "biasDays": round(statistics.median(errs), 1) if errs else None,
        "typicalMissWorkdays": round(statistics.median(sorted(abs(w) for w in werrs)), 1) if werrs else None,
        "biasWorkdays": round(statistics.median(werrs), 1) if werrs else None,
        "within7Share": round(sum(1 for x in a if x <= 7) / len(a), 3) if a else None,
        "stuckShare": round(stuck / judged, 3) if judged else None,
    }
    if ranges is not None:
        out["insideShare"] = round(inside / judged, 3) if judged else None
    return out


def day_range_model(samples: list[dict[int, list[int]]]) -> dict[int, tuple[int, int]]:
    """Per distance bucket, the middle 80% of decided errors in working days,
    over the start days given. A bucket needs DAY_RANGE_MIN errors from at
    least DAY_RANGE_STARTS start days: one start day only reaches its bucket's
    nearest edge (on Oct 15 2026 the 11-to-20 bucket rested on requests 11
    working days out alone)."""
    out = {}
    for i in range(len(DAY_BUCKETS)):
        errs = sorted(e for s in samples for e in s.get(i, []))
        starts = sum(1 for s in samples if len(s.get(i, [])) >= DAY_RANGE_PER_START)
        if len(errs) >= DAY_RANGE_MIN and starts >= DAY_RANGE_STARTS:
            q = lambda p: errs[min(len(errs) - 1, max(0, int(round(p * (len(errs) - 1)))))]
            out[i] = (min(0, q(0.10)), max(0, q(0.90)))
    return out


def day_section(rows: list, events: dict, end: date) -> dict | None:
    """Weekly start days, oldest first; each start day's range comes from the ones before it."""
    starts, t = [], end - timedelta(days=14)
    while workday_pace(exit_days(events, t, DAY_PACE_DAYS)) is not None:
        starts.append(t)
        t -= timedelta(days=7)
    runs, samples = [], []
    for t0 in sorted(starts):
        pace = workday_pace(exit_days(events, t0, DAY_PACE_DAYS))
        # The queue as the start day's morning sweep left it.
        t_ms = int(datetime(t0.year, t0.month, t0.day, 12, tzinfo=ET).timestamp() * 1000)
        in_line, outcome = [], {}
        for cn, fd, cur in rows:
            if not fd or fd > t0.isoformat():
                continue
            after = [e for e in events.get(cn, []) if e[0] >= t_ms]
            st0 = after[0][1] if after else (cur or "").upper()
            if st0 != IN_LINE:
                continue
            mv = after[0] if after else None
            if mv is None:
                outcome[cn] = None
            elif mv[3] and not mv[2].startswith("WITHDRAWN"):
                outcome[cn] = decided_on(mv[0])
            elif mv[3]:
                outcome[cn] = "withdrawn"
            else:
                outcome[cn] = "left"
            in_line.append((cn, fd))
        # Every request in process is ahead of the later ones, whatever became of it.
        pred_all = day_predictions(in_line, t0, pace["perWorkday"])
        pred = {cn: v for cn, v in pred_all.items() if outcome[cn] not in ("withdrawn", "left")}
        model = day_range_model(samples[-4:]) if samples else None
        run = {"t0": t0.isoformat(), "pace": round(pace["perWorkday"], 1), "inLine": len(in_line),
               "day": day_score(pred, outcome, end, model if model else None)}
        runs.append(run)
        sample: dict[int, list[int]] = {}
        for cn, (p, h) in pred.items():
            o = outcome[cn]
            if (end - p).days >= DAY_JUDGE_DAYS and isinstance(o, date) and o <= end:
                sample.setdefault(day_bucket(h), []).append(workdays_between(p, o))
        samples.append(sample)
    if not runs:
        return None
    model = day_range_model(samples[-4:])
    return {
        "method": ("requests in process filed earlier (same day counted half), over DOL's measured exits a "
                   "working day, counted in the days DOL works"),
        "unit": "workday",
        "origins": runs,
        "rangeModel": [{"fromDays": DAY_BUCKETS[i][0], "toDays": DAY_BUCKETS[i][1], "earlyDays": lo, "lateDays": hi}
                       for i, (lo, hi) in sorted(model.items())],
        "judgeDays": DAY_JUDGE_DAYS,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    today = datetime.now(ET).date()
    ap.add_argument("--end", default=(today - timedelta(days=1)).isoformat())
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    end = date.fromisoformat(a.end)
    db = Database()
    snaps = snapshots(db)
    events: dict[str, list[tuple[int, str, str, int]]] = {}
    for cn, at, fr, to, tf in query_rows(
        db,
        "SELECT case_number, changed_at, from_status, to_status, to_final FROM pwd_case_events "
        "WHERE case_number LIKE ? ORDER BY changed_at",
        [PREFIX + "%"],
    ):
        events.setdefault(cn, []).append((int(at), (fr or "").upper(), (to or "").upper(), int(tf or 0)))
    rows = query_rows(
        db, "SELECT case_number, filing_date, current_status FROM pwd_case_status WHERE case_number LIKE ?",
        [PREFIX + "%"],
    )
    origins = []
    for i, snap in enumerate(snaps):
        rate = None
        for older in snaps[:i]:
            rate = clearance(older, snap)
            if rate:
                break
        if not rate or snap["readOn"] >= end:
            continue
        t0 = snap["readOn"]
        t_ms = int(datetime(t0.year, t0.month, t0.day, tzinfo=ET).timestamp() * 1000)
        pred: dict[str, str] = {}
        outcome: dict[str, date | None] = {}
        for cn, fd, cur in rows:
            if not fd or fd > t0.isoformat():
                continue
            evs = events.get(cn, [])
            after = [e for e in evs if e[0] >= t_ms]
            st0 = after[0][1] if after else (cur or "").upper()
            if st0 != IN_LINE:
                continue
            mv = after[0] if after else None
            if mv is None or datetime.fromtimestamp(mv[0] / 1000, ET).date() > end:
                outcome[cn] = None
            elif mv[3] and not mv[2].startswith("WITHDRAWN"):
                outcome[cn] = datetime.fromtimestamp(mv[0] / 1000, ET).date()
            else:
                continue  # left the line another way
            pred[cn] = estimated_month(fd[:7], snap["backlog"], snap["asOf"], rate)
        if pred:
            origins.append({
                "asOf": snap["asOf"], "readOn": t0.isoformat(), "clearancePerMonth": round(rate),
                **score_months(pred, outcome, end),
            })
    result = {"end": end.isoformat(), "origins": origins,
              "method": "requests ahead plus half the same month, over DOL's measured clearance, from DOL's as-of date"}
    day = day_section(rows, events, end)
    if day:
        result["day"] = day
    print(json.dumps(result, indent=2))
    if a.write and origins:
        write_doc(db, "pwd_backtest", json.dumps(result))
        print("wrote perm_docs['pwd_backtest']")
    return 0


if __name__ == "__main__":
    sys.exit(main())
