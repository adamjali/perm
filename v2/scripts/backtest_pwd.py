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
way the daily sample grades it (src/lib/turso/predictions.ts). A request still
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
from lib_turso import ET, Turso, query_rows, write_doc  # noqa: E402

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


def snapshots(db: Turso) -> list[dict]:
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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    today = datetime.now(ET).date()
    ap.add_argument("--end", default=(today - timedelta(days=1)).isoformat())
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    end = date.fromisoformat(a.end)
    db = Turso()
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
    print(json.dumps(result, indent=2))
    if a.write and origins:
        write_doc(db, "pwd_backtest", json.dumps(result))
        print("wrote perm_docs['pwd_backtest']")
    return 0


if __name__ == "__main__":
    sys.exit(main())
