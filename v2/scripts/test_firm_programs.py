#!/usr/bin/env python3
"""The nightly firm lines say what the firm page's live query would (build_firm_programs.py).

* CERTIFIED_SQL is the TypeScript's, table for table (src/lib/db/firmPrograms.ts);
* on a fixture with two printed spellings of one firm, a second firm and an
  unmapped one, each firm's row equals the live query over its spellings:
  filings, certified, first and last decisions, and the busiest employers in
  order, an employer filed under both spellings counted once;
* a firm page with nothing outside PERM gets no row;
* an empty firm map refuses, never writing an empty table.

Run: python3 scripts/test_firm_programs.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sqlite3
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_firm_programs as bfp  # noqa: E402

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "FAIL ") + name + (f": {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)


ts = (HERE.parent / "src" / "lib" / "db" / "firmPrograms.ts").read_text()
block = ts[ts.index("const CERTIFIED_SQL"): ts.index("};", ts.index("const CERTIFIED_SQL"))]
ts_sql = {k: "".join(re.findall(r'"([^"]*)"', v)) for k, v in re.findall(r"(\w+_cases):\s*((?:\s*\"[^\"]*\"\s*,?)+)", block)}
check("CERTIFIED_SQL is the TypeScript's, table for table", ts_sql == bfp.CERTIFIED_SQL, f"{ts_sql} vs {bfp.CERTIFIED_SQL}")
top = re.search(r"export const FIRM_TOP_EMPLOYERS = (\d+);", ts)
check("the top-employer count is the TypeScript's", top is not None and int(top.group(1)) == bfp.TOP_EMPLOYERS)

con = sqlite3.connect(":memory:")
con.execute("CREATE TABLE firm_page_map (source_slug TEXT PRIMARY KEY, page_slug TEXT, key TEXT)")
con.executemany("INSERT INTO firm_page_map VALUES (?, ?, '')", [
    ("fragomen-llp", "fragomen"), ("fragomen-loewyllp", "fragomen"), ("small-firm", "small-firm"), ("quiet-firm", "quiet-firm"),
])
con.execute("CREATE TABLE lca_cases (case_number TEXT, attorney_slug TEXT, employer_slug TEXT, employer_name TEXT, case_status TEXT, decision_date TEXT)")
rows = []
i = 0
def add(att, emp, name, status, day, n=1):
    global i
    for _ in range(n):
        i += 1
        rows.append((f"I-200-{i}", att, emp, name, status, day))
add("fragomen-llp", "apple-inc", "Apple Inc.", "CERTIFIED", "2026-01-05", 5)
add("fragomen-loewyllp", "apple-inc", "APPLE INC", "CERTIFIED", "2025-11-02", 3)   # one employer, two spellings
add("fragomen-llp", "intel", "Intel", "WITHDRAWN", "2026-03-01", 4)
add("fragomen-loewyllp", None, "Unnamed", "DENIED", "2026-06-30", 2)
for k in range(9):                                                                    # ties and a ninth employer
    add("fragomen-llp", f"tie-{k}", f"Tie {k}", "CERTIFIED", "2026-02-01", 1)
add("small-firm", "acme", "Acme", "CERTIFIED", "2024-10-01", 2)
add("not-mapped", "acme", "Acme", "CERTIFIED", "2024-10-01", 50)
add("", "acme", "Acme", "CERTIFIED", "2024-10-01", 7)
con.executemany("INSERT INTO lca_cases VALUES (?, ?, ?, ?, ?, ?)", rows)
for t in ("pwd_cases", "seasonal_cases"):
    con.execute(f"CREATE TABLE {t} AS SELECT * FROM lca_cases WHERE 0")

bfp.query_rows = lambda db, sql, args=None: [tuple(r) for r in con.execute(sql, args or []).fetchall()]
built = {(r[0], r[1]): r for r in bfp.build(None)}


def live(firm: str):
    """The firm page's own query (src/lib/db/firmPrograms.ts `line`), on the fixture."""
    slugs = [s for (s,) in con.execute("SELECT source_slug FROM firm_page_map WHERE page_slug = ?", [firm])]
    ph = ",".join("?" * len(slugs))
    n, cert, lo, hi = con.execute(
        f"SELECT COUNT(*), {bfp.CERTIFIED_SQL['lca_cases']}, MIN(decision_date), MAX(decision_date) FROM lca_cases WHERE attorney_slug IN ({ph})", slugs).fetchone()
    tops = con.execute(
        f"SELECT employer_slug, MAX(employer_name), COUNT(*) AS n FROM lca_cases WHERE attorney_slug IN ({ph}) "
        f"GROUP BY employer_slug ORDER BY n DESC, employer_slug IS NULL, employer_slug LIMIT {bfp.TOP_EMPLOYERS}", slugs).fetchall()
    return n, cert, lo, hi, [(s, nm, c) for s, nm, c in tops]


for firm in ("fragomen", "small-firm"):
    n, cert, lo, hi, tops = live(firm)
    b = built.get((firm, "lca"))
    emp = json.loads(b[6]) if b else []
    check(f"{firm}: filings, certified and dates equal the live query",
          b is not None and (b[2], b[3], b[4], b[5]) == (n, cert, lo, hi), f"{b} vs {(n, cert, lo, hi)}")
    check(f"{firm}: the busiest employers equal the live query, in order",
          [(e["slug"], e["name"], e["n"]) for e in emp] == tops, f"{emp} vs {tops}")
apple = next(e for e in json.loads(built[("fragomen", "lca")][6]) if e["slug"] == "apple-inc")
check("an employer filed under both spellings is counted once, with all its filings", apple["n"] == 8, str(apple))
check("a firm with nothing outside PERM gets no row", ("quiet-firm", "lca") not in built)
check("an unmapped spelling and a blank firm are left out", all(r[0] in {"fragomen", "small-firm"} for r in built.values()))

con.execute("DELETE FROM firm_page_map")
try:
    bfp.build(None)
    check("an empty firm map refuses", False)
except RuntimeError as exc:
    check("an empty firm map refuses", "empty" in str(exc))

print(f"\n{len(failures)} failure(s)" if failures else "\nall passed")
sys.exit(1 if failures else 0)
