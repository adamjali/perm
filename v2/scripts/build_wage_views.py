#!/usr/bin/env python3
"""Precompute every wage selection big enough to be slow, for both explorers.

WHY THIS EXISTS. The PERM salary explorer and the H-1B (LCA) wage explorer
compute five percentiles, a histogram and a per-state table over whatever the
reader filtered to, live, with window functions. On a big selection that is
slow and it is billed per row:

- Turso's Top Queries, Sep 27 2026 (the four hours after the entity-count
  fix): the PERM percentiles read 25.9M rows in 5 runs, the PERM per-state
  table 13.3M, the histogram 3.4M. About 8.5M rows per rebuild of one page.
- Sentry JAVASCRIPT-NEXTJS-3K: `/api/lca-wages` passed the read layer's 20 s
  deadline 839 times between Aug 31 and Sep 27. `lca_cases` holds 2.38M rows,
  and a big occupation (15-1252) alone is most of them.

`build_lca_facets.py` already precomputed ONE selection (the LCA default
view). This does all of them that matter: every combination of status x
occupation group x state x fiscal year holding at least MIN_ROWS filings, for
both tables, written to `wage_views` keyed exactly as
`src/lib/turso/wageViews.ts` builds its keys. A selection under MIN_ROWS is
served live, where an index narrows it and it is fast.

HOW. One keyset read of each table's five filter columns (roughly the rows of
one live query of the biggest selection), then everything is computed here in
the arithmetic the SQL uses, which `test_wage_views.py` pins against the SQL
itself on a real SQLite:

- a percentile interpolates between ranks floor(k) and floor(k)+1 with
  k = (n - 1) * p, then rounds half away from zero (SQLite's ROUND);
- a histogram bin is CAST(wage / width AS INTEGER) * width, width from
  bin_width() (the port in build_lca_facets.py of wageStats.ts);
- the per-state table keeps states with at least MIN_FOR_MEDIAN filings,
  busiest first.

The data behind both explorers changes when a disclosure file is loaded, so
this runs after those loads, not nightly.

    python3 scripts/build_wage_views.py              # both programs
    python3 scripts/build_wage_views.py --program lca
    python3 scripts/build_wage_views.py --dry-run    # compute, count, write nothing
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_lca_facets import ANNUAL_WAGE_SQL, bin_width, min_for_median  # noqa: E402
from lib_turso import Turso, record_run  # noqa: E402

# A selection at or above this many filings is precomputed. Below it the live
# query touches at most an index slice and returns in well under a second.
MIN_ROWS = 5_000

PAGE = 25_000
QUANTILES = ((0.05, "p5"), (0.25, "p25"), (0.5, "p50"), (0.75, "p75"), (0.95, "p95"))
STATUSES = ("certified", "denied", "withdrawn", "all")

# Dimension order in a key: status|soc|state|fy. MUST MATCH wageViewKey() in
# src/lib/turso/wageViews.ts; test_wage_views.py reads that function.
SOC, STATE, FY = 1, 2, 4

# LCA rows outside this annual band are data defects, the same band as
# lcaWages.ts (MIN_ANNUAL / MAX_ANNUAL) and build_lca_facets.py.
LCA_MIN, LCA_MAX = 10_000, 1_500_000

LCA_STATUS = {
    "CERTIFIED": "certified",
    "DENIED": "denied",
    "WITHDRAWN": "withdrawn",
    "CERTIFIED - WITHDRAWN": "withdrawn",
}

READS = {
    # PERM: wageWhere() in publicData.ts filters `wage > 0` and a lowercase
    # status; state and fiscal_year are compared as stored.
    "perm": (
        "SELECT rowid, wage, status, substr(soc_code, 1, 7), state, fiscal_year "
        "FROM perm_cases WHERE rowid > ? AND wage IS NOT NULL AND wage > 0 "
        "ORDER BY rowid LIMIT ?"
    ),
    # LCA: where() in lcaWages.ts annualises first and keeps 10k to 1.5M.
    "lca": (
        f"SELECT rowid, ({ANNUAL_WAGE_SQL}), case_status, substr(soc_code, 1, 7), "
        "worksite_state, fiscal_year FROM lca_cases "
        "WHERE rowid > ? AND wage IS NOT NULL AND wage > 0 ORDER BY rowid LIMIT ?"
    ),
}


def sql_round(x: float) -> float:
    """SQLite's ROUND(x): half away from zero (Python's round() is half-even)."""
    return float(math.floor(x + 0.5)) if x >= 0 else -float(math.floor(-x + 0.5))


def percentiles(vals: list[float]) -> dict:
    """n, avg and the five interpolated percentiles of an ASCENDING list."""
    n = len(vals)
    out: dict = {"n": n, "avg": (math.fsum(vals) / n) if n else None}
    for p, name in QUANTILES:
        if not n:
            out[name] = None
            continue
        k = (n - 1) * p
        i = int(k)
        lo, hi = vals[i], vals[min(i + 1, n - 1)]
        out[name] = sql_round(lo + (hi - lo) * (k - i))
    return out


def histogram(vals: list[float], width: int) -> list[list[int]]:
    """Every occupied bin, lowest first, as [from, count]."""
    bins: dict[int, int] = {}
    for w in vals:
        b = math.trunc(w / width) * width
        bins[b] = bins.get(b, 0) + 1
    return [[b, bins[b]] for b in sorted(bins)]


def key(program: str, status: str, soc: str, state: str, fy: str) -> str:
    return f"{program}|{status}|{soc}|{state}|{fy}"


def read_rows(db: Turso, program: str) -> list[tuple]:
    """(wage, statuses, soc, state, fy) for every row the explorer can see."""
    sql = READS[program]
    out: list[tuple] = []
    last = 0
    while True:
        res = db.execute(sql, [last, PAGE])
        rows = res["response"]["result"]["rows"]
        if not rows:
            break
        for r in rows:
            v = [None if c["type"] == "null" else c["value"] for c in r]
            last = int(v[0])
            wage = None if v[1] is None else float(v[1])
            if wage is None or wage <= 0:
                continue
            raw_status = v[2] or ""
            if program == "lca":
                if not (LCA_MIN <= wage <= LCA_MAX):
                    continue
                s = LCA_STATUS.get(raw_status)
            else:
                s = raw_status if raw_status in ("certified", "denied", "withdrawn") else None
            statuses = ("all",) if s is None else (s, "all")
            soc = v[3] or ""
            state = (v[4] or "").upper() if program == "lca" else (v[4] or "")
            fy = "" if v[5] is None else str(v[5])
            out.append((wage, statuses, soc, state, fy))
        if len(rows) < PAGE:
            break
    out.sort(key=lambda t: t[0])
    return out


def build(program: str, rows: list[tuple], min_cases: int) -> dict[str, dict]:
    """Every precomputed view for one program, keyed as wageViews.ts keys them."""
    views: dict[str, dict] = {}
    for status in STATUSES:
        mine = [r for r in rows if status in r[1]]
        # Pass 1: counts for all eight subsets of (soc, state, fy).
        counts: dict[str, int] = {}
        for _, _, soc, state, fy in mine:
            for mask in range(8):
                if (mask & SOC and not soc) or (mask & STATE and not state) or (mask & FY and not fy):
                    continue
                k = key(program, status, soc if mask & SOC else "",
                        state if mask & STATE else "", fy if mask & FY else "")
                counts[k] = counts.get(k, 0) + 1
        heavy = {k for k, c in counts.items() if c >= MIN_ROWS}
        if not heavy:
            continue
        # Pass 2: ascending wage lists for the heavy keys, plus each heavy
        # state-less key's per-state children (for its by-state table).
        lists: dict[str, list[float]] = {k: [] for k in heavy}
        children: dict[str, dict[str, list[float]]] = {}
        for wage, _, soc, state, fy in mine:
            for mask in range(8):
                if (mask & SOC and not soc) or (mask & FY and not fy):
                    continue
                s_soc = soc if mask & SOC else ""
                s_fy = fy if mask & FY else ""
                if mask & STATE:
                    if not state:
                        continue
                    k = key(program, status, s_soc, state, s_fy)
                    if k in lists:
                        lists[k].append(wage)
                    parent = key(program, status, s_soc, "", s_fy)
                    if parent in lists:
                        children.setdefault(parent, {}).setdefault(state, []).append(wage)
                else:
                    k = key(program, status, s_soc, "", s_fy)
                    if k in lists:
                        lists[k].append(wage)
        for k, vals in lists.items():
            stats = percentiles(vals)
            width = bin_width(stats["p5"], stats["p95"])
            view = {
                "stats": stats,
                "binWidth": width,
                "histogram": histogram(vals, width),
                "minCases": min_cases,
                "byState": None,
            }
            if k.split("|")[3] == "":
                by = []
                for st, sv in (children.get(k) or {}).items():
                    if len(sv) >= min_cases:
                        by.append({"state": st, **percentiles(sv)})
                by.sort(key=lambda x: (-x["n"], x["state"]))
                view["byState"] = by
            views[k] = view
    return views


def write(db: Turso, program: str, views: dict[str, dict]) -> int:
    db.execute(
        """CREATE TABLE IF NOT EXISTS wage_views (
             key TEXT PRIMARY KEY, program TEXT NOT NULL, n INTEGER NOT NULL,
             json TEXT NOT NULL, built_at INTEGER NOT NULL)""", [])
    built = int(time.time() * 1000)
    items = list(views.items())
    for i in range(0, len(items), 40):
        reqs = []
        for k, v in items[i:i + 40]:
            reqs.append({"type": "execute", "stmt": {
                "sql": "INSERT OR REPLACE INTO wage_views (key, program, n, json, built_at) VALUES (?, ?, ?, ?, ?)",
                "args": [{"type": "text", "value": k}, {"type": "text", "value": program},
                         {"type": "integer", "value": str(v["stats"]["n"])},
                         {"type": "text", "value": json.dumps(v, separators=(",", ":"))},
                         {"type": "integer", "value": str(built)}]}})
        db.pipeline(reqs + [{"type": "close"}])
    # Keys that no longer clear the floor go, so a stale view can't outlive
    # the data it described. Only AFTER every new row is in.
    db.execute("DELETE FROM wage_views WHERE program = ? AND built_at < ?", [program, built])
    got = int(db.scalar("SELECT COUNT(*) FROM wage_views WHERE program = ?", [program]) or 0)
    if got != len(views):
        raise SystemExit(f"FATAL: wrote {len(views)} {program} views, read back {got}")
    return got


def verify(db: Turso, program: str, views: dict[str, dict]) -> None:
    """Recompute the smallest precomputed selection live and demand agreement.

    The smallest one because it is the cheapest honest control: a few thousand
    rows read, through the site's own percentile SQL (not a Python copy).
    """
    from build_lca_facets import percentile_select
    k = min(views, key=lambda x: views[x]["stats"]["n"])
    _, status, soc, state, fy = k.split("|")
    if program == "perm":
        where = ["wage IS NOT NULL", "wage > 0"]
        args: list = []
        if status != "all":
            where.append("status = ?"); args.append(status)
        if soc:
            where.append("substr(soc_code, 1, 7) = ?"); args.append(soc)
        if state:
            where.append("state = ?"); args.append(state)
        if fy:
            where.append("fiscal_year = ?"); args.append(fy)
        f = f"SELECT wage FROM perm_cases WHERE {' AND '.join(where)}"
    else:
        where = [f"wage IS NOT NULL AND wage > 0 AND ({ANNUAL_WAGE_SQL}) BETWEEN {LCA_MIN} AND {LCA_MAX}"]
        args = []
        if status == "certified":
            where.append("case_status = 'CERTIFIED'")
        elif status == "denied":
            where.append("case_status = 'DENIED'")
        elif status == "withdrawn":
            where.append("case_status IN ('WITHDRAWN', 'CERTIFIED - WITHDRAWN')")
        if soc:
            where.append("substr(soc_code, 1, 7) = ?"); args.append(soc)
        if state:
            where.append("worksite_state = ?"); args.append(state)
        if fy:
            where.append("fiscal_year = ?"); args.append(int(fy))
        f = f"SELECT ({ANNUAL_WAGE_SQL}) AS wage FROM lca_cases WHERE {' AND '.join(where)}"
    sql = (f"WITH f AS ({f}), c AS (SELECT COUNT(*) AS n FROM f), "
           "o AS (SELECT wage, ROW_NUMBER() OVER (ORDER BY wage) AS rn FROM f) "
           f"SELECT (SELECT n FROM c) AS n, {percentile_select()}")
    res = db.execute(sql, args)["response"]["result"]
    row = [None if c["type"] == "null" else c["value"] for c in res["rows"][0]]
    live = dict(zip([c["name"] for c in res["cols"]], row))
    mine = views[k]["stats"]
    if int(live["n"]) != mine["n"]:
        raise SystemExit(f"FATAL: {k} n live {live['n']} != precomputed {mine['n']}")
    for _, name in QUANTILES:
        if abs(float(live[name]) - mine[name]) > 1:
            raise SystemExit(f"FATAL: {k} {name} live {live[name]} != precomputed {mine[name]}")
    print(f"[wage-views] {program}: verified {k} (n={mine['n']:,}) against the live SQL", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--program", choices=("perm", "lca", "both"), default="both")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    started = time.time()
    db = Turso()
    floor = min_for_median()
    programs = ("perm", "lca") if a.program == "both" else (a.program,)
    notes = []
    for program in programs:
        t0 = time.time()
        rows = read_rows(db, program)
        # A read that came back thin is a broken read, not a small corpus.
        if len(rows) < 100_000:
            print(f"[wage-views] {program}: only {len(rows):,} rows read; not writing", flush=True)
            return 1
        views = build(program, rows, floor)
        print(f"[wage-views] {program}: {len(rows):,} rows, {len(views):,} views "
              f"at >= {MIN_ROWS:,} in {time.time() - t0:.0f}s", flush=True)
        if not views:
            print(f"[wage-views] {program}: no views; not writing", flush=True)
            return 1
        verify(db, program, views)
        if a.dry_run:
            continue
        got = write(db, program, views)
        notes.append(f"{program} {got} views")
    if not a.dry_run:
        record_run(db, "build_wage_views.py", status="ok", note="; ".join(notes),
                   started_at=started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
