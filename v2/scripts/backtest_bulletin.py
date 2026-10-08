"""The standing backtest of "months until your date is current".

The green card line and the I-485 tool say how long a priority date has to
wait (src/lib/bulletinNext.ts `monthsToReach`): the gap between the
final-action cutoff and the date, divided by the pace the cutoff has moved
since October 2014 (src/lib/turso/bulletin.ts, BOARD_MEASURED_FROM). The
archive reaches back to 2005, so the arithmetic can be replayed on every past
bulletin and checked against what the State Department actually did.

For each bulletin from October 2016 (two years of pace behind it), each
employment category and country with a dated cutoff, and a reader whose date
is GAP days past that cutoff, it compares the months the site's arithmetic
gives with the months until the cutoff first reached the date (or the
category went current). A reader still waiting at the newest bulletin is
counted at the months already waited when that is past the estimate: a floor,
the same rule the PERM scorecard uses for a case still waiting past its date.

Read-only unless `--write`, which stores the summary in
`perm_docs['bulletin_backtest']` for /estimate-scorecard and the line pages.

    python3 scripts/backtest_bulletin.py
    python3 scripts/backtest_bulletin.py --write
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_turso import Turso, query_rows, write_doc  # noqa: E402

MEASURED_FROM = "2014-10"   # BOARD_MEASURED_FROM in src/lib/turso/bulletin.ts
FIRST_ORIGIN = "2016-10"    # two years of pace behind the first estimate
CATEGORIES = ("EB1", "EB2", "EB3", "EW3", "EB4", "EB5")
COUNTRIES = ("worldwide", "china", "india", "mexico", "philippines")
GAPS = (90, 180, 365, 730)  # days past the cutoff: about 3, 6, 12 and 24 months
MONTHS = {m: i + 1 for i, m in enumerate(
    ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"))}


def parse_cutoff(cell) -> tuple[str, date | None] | None:
    """("date", d), ("current", None), ("unavailable", None), or None for a blank cell."""
    if not isinstance(cell, str) or not cell.strip():
        return None
    s = cell.strip().upper()
    if s == "C":
        return ("current", None)
    if s == "U":
        return ("unavailable", None)
    if len(s) == 7 and s[:2].isdigit() and s[2:5] in MONTHS and s[5:].isdigit():
        yy = int(s[5:])
        try:
            return ("date", date(2000 + yy if yy < 50 else 1900 + yy, MONTHS[s[2:5]], int(s[:2])))
        except ValueError:
            return None
    return None


def months_between(a: str, b: str) -> int:
    return (int(b[:4]) - int(a[:4])) * 12 + int(b[5:7]) - int(a[5:7])


# How far back the pace is measured. "since-2014" is what the site prints;
# the trailing windows are tested beside it so a better one shows if there is one.
WINDOWS = {"since-2014": None, "trailing-12": 12, "trailing-24": 24, "trailing-36": 36, "trailing-60": 60}
SITE_WINDOW = "since-2014"


def per_month(series: list[tuple[str, tuple]], i: int, window: int | None = None) -> float | None:
    """The pace at bulletin i: days moved from the first dated cutoff since
    MEASURED_FROM (or `window` months back) to this one, over the months between."""
    origin = series[i][0]
    floor = MEASURED_FROM
    if window:
        y, m = int(origin[:4]), int(origin[5:7]) - window
        while m <= 0:
            y, m = y - 1, m + 12
        floor = max(floor, f"{y:04d}-{m:02d}")
    dated = [(m, c[1]) for m, c in series[: i + 1] if m >= floor and c[0] == "date"]
    if len(dated) < 2:
        return None
    (m0, d0), (m1, d1) = dated[0], dated[-1]
    span = months_between(m0, m1)
    moved = (d1 - d0).days
    return moved / span if span > 0 and moved > 0 else None


def months_to_reach(series: list[tuple[str, tuple]], i: int, target: date) -> tuple[int, bool]:
    """(months, reached): until the cutoff first reached `target` or went
    current, or the months to the newest bulletin when it never did."""
    origin = series[i][0]
    for m, c in series[i + 1:]:
        if c[0] == "current" or (c[0] == "date" and c[1] >= target):
            return months_between(origin, m), True
    return months_between(origin, series[-1][0]), False


def score(pairs: list[tuple[float, int, bool]]) -> dict:
    """pairs: (estimated months, actual or waited months, reached)."""
    resolved = [(e, a) for e, a, r in pairs if r]
    floors = []
    for e, a, r in pairs:
        if r:
            floors.append(a - e)
        elif a > e:
            floors.append(a - e)   # still waiting past the estimate: at least this late
    errs = [a - e for e, a in resolved]
    return {
        "readers": len(pairs),
        "reached": len(resolved),
        "typicalMissMonths": round(statistics.median(abs(x) for x in errs), 1) if errs else None,
        "biasMonths": round(statistics.median(errs), 1) if errs else None,
        "withinQuarterShare": round(sum(1 for e, a in resolved if abs(a - e) <= max(3, e / 4)) / len(resolved), 3)
        if resolved else None,
        "missAtLeastMonths": round(statistics.median(abs(x) for x in floors), 1) if floors else None,
        "stillWaitingPastEstimate": sum(1 for e, a, r in pairs if not r and a > e),
    }


def backtest(bulletins: list[tuple[str, dict]]) -> dict:
    by_gap: dict[int, list] = {g: [] for g in GAPS}
    by_country: dict[str, list] = {c: [] for c in COUNTRIES}
    # Every window on the same readers: a reader counts only where every
    # window has a pace, so no window is scored on an easier sample.
    by_window: dict[str, dict[int, list]] = {w: {g: [] for g in GAPS} for w in WINDOWS}
    for cat in CATEGORIES:
        for country in COUNTRIES:
            series = []
            for month, chart in bulletins:
                c = parse_cutoff(((chart or {}).get(cat) or {}).get(country))
                if c:
                    series.append((month, c))
            for i, (month, c) in enumerate(series[:-1]):
                if month < FIRST_ORIGIN or c[0] != "date":
                    continue
                paces = {w: per_month(series, i, n) for w, n in WINDOWS.items()}
                if not paces[SITE_WINDOW]:
                    continue
                every = all(paces.values())
                for g in GAPS:
                    actual, reached = months_to_reach(series, i, date.fromordinal(c[1].toordinal() + g))
                    est = g / paces[SITE_WINDOW]
                    by_gap[g].append((est, actual, reached))
                    if g == 365:
                        by_country[country].append((est, actual, reached))
                    if every:
                        for w, pace in paces.items():
                            by_window[w][g].append((g / pace, actual, reached))
    return {
        "siteWindow": SITE_WINDOW,
        "byGap": {str(g): score(v) for g, v in by_gap.items() if v},
        "byCountryAtOneYear": {c: score(v) for c, v in by_country.items() if v},
        "byWindow": {w: {str(g): score(v) for g, v in gaps.items() if v} for w, gaps in by_window.items()},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    db = Turso()
    rows = query_rows(db, "SELECT bulletin_month, final_action FROM visa_bulletins ORDER BY bulletin_month", [])
    bulletins = [(str(m), json.loads(j) if j else {}) for m, j in rows]
    out = {
        "method": "gap past the final-action cutoff over the pace since October 2014, against the months the cutoff took",
        "bulletins": [bulletins[0][0], bulletins[-1][0]] if bulletins else None,
        **backtest(bulletins),
    }
    print(json.dumps(out, indent=2))
    if a.write and out.get("byGap"):
        write_doc(db, "bulletin_backtest", out)
        print("wrote perm_docs['bulletin_backtest']")
    return 0


if __name__ == "__main__":
    sys.exit(main())
