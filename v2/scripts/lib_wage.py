"""A wage to a year, from the one table both the site and these scripts read.

`scripts/data/pay_periods.json` holds each pay period DOL's files use: the
spellings it prints, how many make a year, and the amount past which a figure
can't be pay for that period (a yearly salary filed under the wrong unit:
measured Oct 3 2026 over 3.65 million LCA rows, see `looksYearly` in
src/lib/wageFormat.ts). It also holds the plausible yearly band for each kind
of file. `annual_wage_sql()` builds the SQL from it, and the site builds the
same text from the same file; scripts/fixtures/annual_wage_sql.txt holds both
to it, so a doc built here and the query a page runs read one population.
"""
from __future__ import annotations

import json
import pathlib

_DATA = json.loads((pathlib.Path(__file__).resolve().parent / "data" / "pay_periods.json").read_text())

PERIODS: list[dict] = _DATA["periods"]
# spelling -> how many make a year, e.g. "HOUR" -> 2080
ANNUALIZE: dict[str, float] = {s: float(p["perYear"]) for p in PERIODS for s in p["spellings"]}
HOURS_PER_YEAR: int = next(p["perYear"] for p in PERIODS if p["label"] == "per hour")
# (lowest, highest) plausible yearly figure: the PERM file, and the wage-request, LCA and seasonal files
PERM_BAND: tuple[int, int] = tuple(_DATA["yearlyBands"]["perm"])  # type: ignore[assignment]
FLAG_BAND: tuple[int, int] = tuple(_DATA["yearlyBands"]["flag"])  # type: ignore[assignment]


def _spellings(p: dict) -> str:
    return ", ".join(f"'{s}'" for s in p["spellings"])


def annual_wage_sql() -> str:
    """Yearly dollars from a row's `wage` and `wage_unit`; NULL for an unknown
    unit or an amount that can't be pay for its period."""
    nulls = [f"WHEN wage_unit IN ({_spellings(p)}) AND wage >= {p['looksYearlyFrom']} THEN NULL"
             for p in PERIODS if p["looksYearlyFrom"] is not None]
    scale = [f"WHEN wage_unit IN ({_spellings(p)}) THEN " + ("wage" if p["perYear"] == 1 else f"wage * {p['perYear']}")
             for p in PERIODS]
    return "CASE " + " ".join(nulls + scale) + " END"


ANNUAL_WAGE_SQL = annual_wage_sql()
