#!/usr/bin/env python3
"""Probes for build_lca_facets.py.

The thing worth testing is not that the builder runs. It is that its ported
percentile SQL cannot silently drift from the TypeScript the page falls back
to, and that the guard which catches that drift actually fires.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_lca_facets as blf  # noqa: E402

FAILURES: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' - ' + detail) if detail else ''}")
    if not cond:
        FAILURES.append(name)


class FakeDb:
    """Answers only the ranked-neighbour probe, with a controllable pair."""

    def __init__(self, lo: float, hi: float):
        self.lo, self.hi = lo, hi
        self.offsets: list[int] = []

    def execute(self, sql, args):
        self.offsets.append(args[0])
        return {
            "response": {
                "result": {
                    "rows": [
                        [{"type": "float", "value": self.lo}],
                        [{"type": "float", "value": self.hi}],
                    ]
                }
            }
        }


def stats(n: int, p50: float) -> dict:
    return {"n": n, "avg": 1.0, "p5": 1.0, "p25": 1.0, "p50": p50, "p75": 1.0, "p95": 1.0}


print("build_lca_facets probes\n")

# 1. THE GUARD FIRES. An interpolating median sits between its neighbours; a
#    nearest-rank one snaps to the lower neighbour, which is still "between"
#    them - so the real defect this catches is a median OUTSIDE the pair, which
#    is what a wrong CTE, a wrong population or a wrong band produces.
db = FakeDb(100_000.0, 110_000.0)
try:
    blf.verify_median(db, stats(1_000_001, 104_000.0))
    check("in-band median accepted", True)
except SystemExit as e:
    check("in-band median accepted", False, str(e)[:70])

db = FakeDb(100_000.0, 110_000.0)
try:
    blf.verify_median(db, stats(1_000_001, 87_500.0))
    check("out-of-band median REFUSED", False, "it was accepted")
except SystemExit as e:
    check("out-of-band median REFUSED", "not between the ranked neighbours" in str(e))

# 2. The probe asks at the rank the interpolation actually uses, int((n-1)/2).
db = FakeDb(1.0, 2.0)
try:
    blf.verify_median(db, stats(1_000_001, 1.5))
except SystemExit:
    pass
check("probes the interpolation's own rank", db.offsets == [500_000],
      f"offsets={db.offsets}")

# 3. An empty or degenerate view is refused rather than written.
for n, p50, label in ((0, None, "n=0"), (2, 5.0, "n=2"), (500, None, "p50 null")):
    db = FakeDb(1.0, 2.0)
    try:
        blf.verify_median(db, stats(n, p50))
        check(f"degenerate view refused ({label})", False, "accepted")
    except SystemExit:
        check(f"degenerate view refused ({label})", True)

# 4. THE PORTED SQL IS DERIVED FROM THE TYPESCRIPT, NOT RESTATED BESIDE IT.
#    A hand-written expectation here would go stale the moment publicData.ts
#    changed, leaving this green while the doc and the page's own fallback
#    disagreed by a few hundred dollars with nothing erroring. So the expected
#    string is built by EXECUTING the TypeScript's own template literal: read
#    the function body, take its return expression, and substitute the same
#    locals it declares. Change either side and this goes red.
ts = (pathlib.Path(__file__).resolve().parents[1]
      / "src" / "lib" / "turso" / "publicData.ts").read_text()


def ts_locals(body: str, seed: dict[str, str]) -> dict[str, str]:
    r"""`const k = \`...\`;` lines, in order, each resolved against the ones before."""
    out: dict[str, str] = dict(seed)
    for line in body.splitlines():
        line = line.strip()
        if not line.startswith("const ") or "= `" not in line:
            continue
        name, rhs = line[len("const "):].split(" = `", 1)
        out[name.strip()] = subst(rhs.rsplit("`", 1)[0], out)
    return out


def subst(tpl: str, env: dict[str, str]) -> str:
    """Resolve `${name}` against env; anything else must already be a literal."""
    out, i = [], 0
    while i < len(tpl):
        j = tpl.find("${", i)
        if j < 0:
            out.append(tpl[i:]); break
        out.append(tpl[i:j])
        k = tpl.index("}", j)
        key = tpl[j + 2:k].strip()
        if key not in env:
            raise AssertionError(f"unresolved ${{{key}}} - the TS gained a new local")
        out.append(env[key]); i = k + 1
    return "".join(out)


def ts_expr(fn_name: str, p_value: float, name: str) -> str:
    """Render one quantile the way the TypeScript function would."""
    start = ts.index(f"function {fn_name}(")
    body = ts[start:ts.index("\n}\n", start)]
    # `${p}` interpolates a JS number: 0.5 prints as "0.5", never "0.50".
    env = {"p": repr(p_value), "name": name}
    env = ts_locals(body, env)
    ret = body[body.index("return"):]
    # The two shapes the file uses: a bare template literal, or a
    # parenthesised concatenation of template literals.
    pieces = []
    i = 0
    while True:
        a = ret.find("`", i)
        if a < 0:
            break
        b = ret.index("`", a + 1)
        pieces.append(ret[a + 1:b])
        i = b + 1
    assert pieces, f"no template literal in {fn_name}'s return"
    return subst("".join(pieces), env)


def ts_quantiles(const_name: str) -> tuple:
    """The `[[0.05, "p5"], ...]` array the TS maps over.

    Driving the loop below off blf.QUANTILES alone made the list itself
    untested: changing 0.95 to 0.9 on EITHER side moved both the answer and
    the expectation together and stayed green. Found by probing, not review.
    """
    import re
    seg = ts[ts.index(f"export const {const_name} = ("):]
    seg = seg[:seg.index("] as const")]
    return tuple(
        (float(a), b) for a, b in re.findall(r"\[\s*([\d.]+)\s*,\s*\"(\w+)\"\s*\]", seg)
    )


for const_name in ("PERCENTILE_SELECT", "STATE_PERCENTILE_SELECT"):
    got = ts_quantiles(const_name)
    check(f"{const_name} quantiles match the builder's", got == blf.QUANTILES,
          f"ts={got} py={blf.QUANTILES}")

for fn_name, py_fn in (("percentileExpr", blf.percentile_select),
                       ("statePercentileExpr", blf.state_percentile_select)):
    expected = ",\n            ".join(
        ts_expr(fn_name, q, name) for q, name in blf.QUANTILES
    )
    got = py_fn()
    check(f"{fn_name} port equals the TypeScript's own output", got == expected,
          "" if got == expected else f"\n      py: {got[:110]}\n      ts: {expected[:110]}")

# 5. The floor is read from the TypeScript, never restated.
check("MIN_FOR_MEDIAN read from wageStats.ts", blf.min_for_median() == 30,
      f"got {blf.min_for_median()}")

# 6. The wage expression and band match the reader's.
lca = (pathlib.Path(__file__).resolve().parents[1]
       / "src" / "lib" / "turso" / "lcaWages.ts").read_text()
ts_wage = "".join(
    lca[lca.index("export const ANNUAL_WAGE_SQL ="):lca.index("/** Rows outside")]
    .split("=", 1)[1].replace('" +', "").replace('"', "").split()
)
check("ANNUAL_WAGE_SQL matches the reader",
      "".join(blf.ANNUAL_WAGE_SQL.split()).rstrip(";") == ts_wage.rstrip(";"),
      "python: " + " ".join(blf.ANNUAL_WAGE_SQL.split())[:60])
check("wage band matches the reader",
      "MIN_ANNUAL = 10_000" in lca and "MAX_ANNUAL = 1_500_000" in lca
      and "BETWEEN 10000 AND 1500000" in blf.DEFAULT_WHERE)

print(f"\n{len(FAILURES)} failure(s)" + (": " + ", ".join(FAILURES) if FAILURES else ""))
raise SystemExit(1 if FAILURES else 0)
