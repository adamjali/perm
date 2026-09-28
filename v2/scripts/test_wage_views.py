#!/usr/bin/env python3
"""build_wage_views.py must produce, for every view, exactly what the live SQL
would: same n, same percentiles, same bins, same by-state table.

The live SQL here is not a copy: it is assembled from percentile_select() and
state_percentile_select() in build_lca_facets.py, which test_lca_facets.py
already holds byte-for-byte to publicData.ts. The key format is read out of
src/lib/turso/wageViews.ts.

    python3 scripts/test_wage_views.py
"""
from __future__ import annotations

import pathlib
import random
import sqlite3
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_wage_views as bwv  # noqa: E402
from build_lca_facets import ANNUAL_WAGE_SQL, percentile_select, state_percentile_select  # noqa: E402

FAILS: list[str] = []


def check(ok: bool, msg: str) -> None:
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        FAILS.append(msg)


class FakeTurso:
    """The subset of lib_turso.Turso that read_rows uses, over a real SQLite."""

    def __init__(self, con: sqlite3.Connection):
        self.con = con

    def execute(self, sql, args=None):
        cur = self.con.execute(sql, list(args or []))
        out = []
        for r in cur.fetchall():
            out.append([{"type": "null"} if v is None else {"type": "text", "value": str(v)} for v in r])
        return {"response": {"result": {"rows": out}}}


def make_db(seed: int = 7) -> sqlite3.Connection:
    rnd = random.Random(seed)
    con = sqlite3.connect(":memory:")
    con.execute("""CREATE TABLE perm_cases (case_number TEXT PRIMARY KEY, status TEXT NOT NULL,
        fiscal_year TEXT, state TEXT, soc_code TEXT, wage REAL)""")
    con.execute("""CREATE TABLE lca_cases (case_number TEXT PRIMARY KEY, case_status TEXT,
        fiscal_year INTEGER, worksite_state TEXT, soc_code TEXT, wage REAL, wage_unit TEXT)""")
    socs = ["15-1252.00", "15-1211.00", "13-2011.00", "29-1141.00", None]
    states = ["CA", "TX", "NY", "WA", ""]
    for i in range(4000):
        con.execute("INSERT INTO perm_cases VALUES (?,?,?,?,?,?)", (
            f"G-{i}", rnd.choice(["certified"] * 8 + ["denied", "withdrawn"]),
            rnd.choice(["2024", "2025", "2026", None]), rnd.choice(states), rnd.choice(socs),
            rnd.choice([None, 0.0] + [round(rnd.uniform(40_000, 260_000), 2)] * 20)))
    units = ["YEAR"] * 12 + ["HOUR", "MONTH", "WEEK", "BI-WEEKLY", "DAY"]
    for i in range(6000):
        unit = rnd.choice(units)
        base = rnd.uniform(40_000, 260_000)
        wage = {"YEAR": base, "HOUR": base / 2080, "MONTH": base / 12, "WEEK": base / 52,
                "BI-WEEKLY": base / 26, "DAY": base / 260}[unit]
        con.execute("INSERT INTO lca_cases VALUES (?,?,?,?,?,?,?)", (
            f"I-{i}", rnd.choice(["CERTIFIED"] * 8 + ["DENIED", "WITHDRAWN", "CERTIFIED - WITHDRAWN"]),
            rnd.choice([2023, 2024, 2025]), rnd.choice(states), rnd.choice(socs),
            rnd.choice([None, 0.0, 5.0] + [round(wage, 2)] * 25), unit))
    return con


def live_where(program: str, status: str, soc: str, state: str, fy: str):
    if program == "perm":
        where, args = ["wage IS NOT NULL", "wage > 0"], []
        if status != "all":
            where.append("status = ?"); args.append(status)
        if soc:
            where.append("substr(soc_code, 1, 7) = ?"); args.append(soc)
        if state:
            where.append("state = ?"); args.append(state)
        if fy:
            where.append("fiscal_year = ?"); args.append(fy)
        return "perm_cases", "wage", "state", " AND ".join(where), args
    where = [f"wage IS NOT NULL AND wage > 0 AND ({ANNUAL_WAGE_SQL}) BETWEEN 10000 AND 1500000"]
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
    return "lca_cases", f"({ANNUAL_WAGE_SQL})", "worksite_state", " AND ".join(where), args


def main() -> int:
    con = make_db()
    db = FakeTurso(con)
    bwv.MIN_ROWS = 150  # small enough that many combinations become views
    for program in ("perm", "lca"):
        rows = bwv.read_rows(db, program)
        views = bwv.build(program, rows, 30)
        check(len(views) > 20, f"{program}: {len(views)} views built at MIN_ROWS=150")
        bad = 0
        for k, v in views.items():
            _, status, soc, state, fy = k.split("|")
            table, wexpr, scol, where, args = live_where(program, status, soc, state, fy)
            con.row_factory = sqlite3.Row
            live = con.execute(
                f"WITH f AS (SELECT {wexpr} AS wage FROM {table} WHERE {where}), "
                "c AS (SELECT COUNT(*) AS n FROM f), "
                "o AS (SELECT wage, ROW_NUMBER() OVER (ORDER BY wage) AS rn FROM f) "
                f"SELECT (SELECT n FROM c) AS n, (SELECT AVG(wage) FROM f) AS avg, {percentile_select()}",
                args).fetchone()
            s = v["stats"]
            same = live["n"] == s["n"] and abs(live["avg"] - s["avg"]) < 1e-6 * max(1, abs(s["avg"]))
            same = same and all(live[q] == s[q] for q in ("p5", "p25", "p50", "p75", "p95"))
            bins = [list(r) for r in con.execute(
                f"SELECT CAST({wexpr} / ? AS INTEGER) * ? AS bin, COUNT(*) FROM {table} "
                f"WHERE {where} GROUP BY bin ORDER BY bin", [v["binWidth"], v["binWidth"], *args]).fetchall()]
            same = same and [[int(b), c] for b, c in bins] == v["histogram"]
            if not state:
                t2, w2, sc, where2, args2 = live_where(program, status, soc, "", fy)
                by = con.execute(
                    f"WITH o AS (SELECT {sc} AS state, {w2} AS wage, "
                    f"ROW_NUMBER() OVER (PARTITION BY {sc} ORDER BY {w2}) AS rn, "
                    f"COUNT(*) OVER (PARTITION BY {sc}) AS n FROM {t2} "
                    f"WHERE {where2} AND {sc} IS NOT NULL AND {sc} <> '') "
                    f"SELECT state, MAX(n) AS n, {state_percentile_select()} FROM o "
                    "GROUP BY state HAVING MAX(n) >= ? ORDER BY MAX(n) DESC, state", [*args2, 30]).fetchall()
                got = [(x["state"], x["n"], x["p50"], x["p5"], x["p95"]) for x in v["byState"]]
                want = [(r["state"], r["n"], r["p50"], r["p5"], r["p95"]) for r in by]
                same = same and got == want
            con.row_factory = None
            if not same:
                bad += 1
                if bad <= 3:
                    print(f"  mismatch {k}: live n={live['n']} p50={live['p50']} vs view n={s['n']} p50={s['p50']}")
        check(bad == 0, f"{program}: every view equals the live SQL ({len(views)} compared)")

    # Heavy only: nothing under MIN_ROWS is precomputed.
    rows = bwv.read_rows(db, "perm")
    views = bwv.build("perm", rows, 30)
    check(all(v["stats"]["n"] >= bwv.MIN_ROWS for v in views.values()), "no view under MIN_ROWS")

    # The key format is the TypeScript reader's.
    ts = (HERE.parent / "src" / "lib" / "turso" / "wageViews.ts").read_text()
    check("return `${program}|${status}|${soc}|${state}|${fy}`;" in ts,
          "wageViewKey() builds program|status|soc|state|fy like key()")
    check(bwv.key("lca", "all", "", "TX", "2025") == "lca|all||TX|2025", "key() layout")

    # ROUND is half away from zero, not Python's half-to-even.
    check(bwv.sql_round(2.5) == 3.0 and bwv.sql_round(58638.5) == 58639.0, "sql_round rounds halves up")
    print(f"\n{len(FAILS)} failure(s)")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
