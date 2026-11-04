"""The holiday-aware walk (lib_pace_walk.py): the shared fixture's answers, and the rules behind them."""
from __future__ import annotations

import json
import pathlib
import sys
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_pace_walk import days_to_clear, season_factor, working_rates  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS  " if ok else "FAIL  ") + name + ("" if ok else f"  {detail}"))
    if not ok:
        failures.append(name)


fx = json.loads((pathlib.Path(__file__).resolve().parent / "fixtures" / "pace_walk.json").read_text())
for c in fx["walks"]:
    got = days_to_clear(date.fromisoformat(c["today"]), c["cases"], c["workday"], c["offday"])
    check(f"{c['cases']} cases from {c['today']} take {c['days']} days", got == c["days"], str(got))
for f in fx["factors"]:
    check(f"{f['date']} counts {f['factor']} of a working day", season_factor(date.fromisoformat(f["date"])) == f["factor"])

# Ten working days' worth in early March clears in two weeks; the same across Christmas takes longer.
march = days_to_clear(date(2027, 3, 1), 7600, 760, 5)
xmas = days_to_clear(date(2026, 12, 18), 7600, 760, 5)
check("ten working days' work in March clears in 12 days or so", march is not None and 11 <= march <= 14, str(march))
check("the same work across Christmas takes longer", xmas is not None and march is not None and xmas > march + 3, f"{xmas} vs {march}")
check("no rate, no answer", days_to_clear(date(2026, 11, 3), 100, 0, 5) is None)
check("a queue past the horizon has no answer", days_to_clear(date(2026, 11, 3), 10**9, 760, 5) is None)
# A season day in the measuring window counts at its own share, so the late-December slump doesn't lower the rate.
window = [(date(2026, 12, d), 700 * season_factor(date(2026, 12, d)) if date(2026, 12, d).weekday() < 5 else 4) for d in range(14, 31)]
rates = working_rates(window)
check("the working-day rate isn't pulled down by the season it was measured in", rates is not None and abs(rates[0] - 700) < 1, str(rates))

print(f"\n  {len(failures)} failure(s)")
sys.exit(1 if failures else 0)
