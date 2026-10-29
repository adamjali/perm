#!/usr/bin/env python3
"""The busiest law firms in DOL's files, by fiscal year and state: PERM and H-1B LCAs.

`/law-firm-rankings` and its state pages read `firm_ranks`. For each program,
fiscal year and place ("US" for the country, else a two-letter state) it holds
the 100 firms with the most filings, one row per firm page, with what each
ranking needs. Statistics only: a firm's volume, outcomes and pace, never a
grade, and firms only. Both of DOL's files name the law firm (PERM's
`ATTY_AG_LAW_FIRM_NAME`, the LCA's `LAWFIRM_NAME_BUSINESS_NAME`), never the
individual attorney, and no person is named here.

WHAT EACH PROGRAM COUNTS:

* PERM (`perm_cases` from FY2024, `perm_cases_history` FY2016 to FY2023, each
  fiscal year read from the one table that holds it): cases DOL decided that
  fiscal year, by outcome; the employers the firm filed for; and the median
  days from filing to a certification. The state is the worksite's, and the
  employer's where DOL's older files print no worksite.
* H-1B LCAs (`lca_cases`, FY2020 on): certified H-1B LCAs (H-1B1 and E-3 left
  out), the positions they cover, and the employers. The state is the
  worksite's. About a quarter of certified LCAs name no law firm (an employer
  filing for itself); they're counted in the doc's totals and ranked nowhere.

Rows reach a firm page through `firm_page_map`, so a firm's spellings count on
one page; a firm with no page keeps its own slug and isn't linked.
`perm_docs['firm_ranks_summary']` carries each year's totals per place.

Usage:
    python3 scripts/build_firm_ranks.py            # rebuild the table and the doc
    python3 scripts/build_firm_ranks.py --dry-run  # read and report only
    python3 scripts/build_firm_ranks.py --dry-run --show perm 2025 US 10
"""
from __future__ import annotations

import argparse
import pathlib
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_db import Database, record_run, rows_of, write_doc  # noqa: E402

TABLE = "firm_ranks"
DOC_KEY = "firm_ranks_summary"
COLS = [
    "program", "fy", "state", "slug", "linked", "name", "rank", "prev_rank",
    "filings", "certified", "denied", "withdrawn", "positions", "employers", "median_days",
]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        program TEXT NOT NULL,
        fy INTEGER NOT NULL,
        state TEXT NOT NULL,
        slug TEXT NOT NULL,
        linked INTEGER NOT NULL,
        name TEXT NOT NULL,
        rank INTEGER NOT NULL,
        prev_rank INTEGER,
        filings INTEGER NOT NULL,
        certified INTEGER NOT NULL,
        denied INTEGER NOT NULL,
        withdrawn INTEGER NOT NULL,
        positions INTEGER NOT NULL,
        employers INTEGER NOT NULL,
        median_days REAL,
        PRIMARY KEY (program, fy, state, slug))""",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_rank ON {TABLE} (program, fy, state, rank)",
]
NATION = "US"
TOP = 100
TOP_SHARE = 10
MIN_DAYS = 10  # a median of fewer certifications is withheld
PERM_HISTORY_LAST_FY = 2023  # perm_cases_history holds FY2016 to FY2023
WRITE_CHUNK = 300
WRITE_PAUSE_S = 0.4


def log(msg: str) -> None:
    print(msg, flush=True)


def num(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def place(state) -> str | None:
    """A two-letter code, or None for a blank or a placeholder ("XX")."""
    s = str(state or "").strip().upper()
    return s if len(s) == 2 and s.isalpha() and s != "XX" else None


def median(counts: Counter, floor: int = MIN_DAYS) -> float | None:
    """The median of a multiset, interpolated at (n - 1) / 2, or None under `floor`."""
    n = sum(counts.values())
    if n < floor:
        return None
    pos = (n - 1) / 2
    lo_i, hi_i = int(pos), int(pos) + (pos % 1 > 0)
    seen = 0
    lo_v = hi_v = None
    for v in sorted(counts):
        seen += counts[v]
        if lo_v is None and seen > lo_i:
            lo_v = v
        if seen > hi_i:
            hi_v = v
            break
    if lo_v is None or hi_v is None:
        return None
    return round(lo_v + (hi_v - lo_v) * (pos - int(pos)), 1)


def blank() -> dict:
    return {"filings": 0, "certified": 0, "denied": 0, "withdrawn": 0, "positions": 0,
            "employers": set(), "days": Counter(), "spell": Counter()}


def read_pages(db: Database) -> tuple[dict[str, str], dict[str, str]]:
    """firm spelling slug -> page slug, and page slug -> the name the page shows."""
    page_of = {str(s): str(p) for s, p in rows_of(db.execute("SELECT source_slug, page_slug FROM firm_page_map"))}
    names = {str(s): str(n) for s, n in rows_of(db.execute(
        "SELECT slug, name FROM perm_entities WHERE kind = 'attorney'")) if n}
    return page_of, names


def fold(agg: dict, page: str, st, add) -> None:
    for p in {NATION, place(st)} - {None}:
        add(agg[(page, p)])


def read_perm(db: Database, fy: int, page_of: dict[str, str]) -> tuple[dict, dict]:
    """One fiscal year of decided PERM cases, folded onto firm pages and places."""
    table = "perm_cases_history" if fy <= PERM_HISTORY_LAST_FY else "perm_cases"
    agg: dict[tuple[str, str], dict] = defaultdict(blank)
    unnamed: Counter = Counter()
    for slug, name, st, status, emp, n in rows_of(db.execute(
            "SELECT attorney_slug, MAX(attorney_name), state, status, employer_slug, COUNT(*) "
            f"FROM {table} WHERE fiscal_year = ? GROUP BY attorney_slug, state, status, employer_slug", [fy])):
        if not slug:
            for p in {NATION, place(st)} - {None}:
                unnamed[p] += num(n)
            continue
        page = page_of.get(str(slug), str(slug))
        kind = str(status or "").lower()

        def add(a, kind=kind, n=num(n), emp=emp, name=name):
            a["filings"] += n
            if kind in ("certified", "denied", "withdrawn"):
                a[kind] += n
            if emp:
                a["employers"].add(str(emp))
            a["spell"][str(name or "")] += n
        fold(agg, page, st, add)
    for slug, st, days, n in rows_of(db.execute(
            "SELECT attorney_slug, state, days, COUNT(*) FROM " + table +
            " WHERE fiscal_year = ? AND status = 'certified' AND attorney_slug IS NOT NULL AND days IS NOT NULL "
            "GROUP BY attorney_slug, state, days", [fy])):
        page = page_of.get(str(slug), str(slug))
        fold(agg, page, st, lambda a, d=num(days), n=num(n): a["days"].update({d: n}))
    return agg, unnamed


def read_lca(db: Database, fy: int, page_of: dict[str, str]) -> tuple[dict, dict]:
    """One fiscal year of certified H-1B LCAs, folded onto firm pages and places."""
    agg: dict[tuple[str, str], dict] = defaultdict(blank)
    unnamed: Counter = Counter()
    for slug, name, st, emp, n, pos in rows_of(db.execute(
            "SELECT attorney_slug, MAX(attorney_name), worksite_state, employer_slug, COUNT(*), "
            "SUM(COALESCE(workers, 1)) FROM lca_cases WHERE fiscal_year = ? AND case_status = 'CERTIFIED' "
            "AND visa_class = 'H-1B' GROUP BY attorney_slug, worksite_state, employer_slug", [fy])):
        if not slug:
            for p in {NATION, place(st)} - {None}:
                unnamed[p] += num(n)
            continue
        page = page_of.get(str(slug), str(slug))

        def add(a, n=num(n), pos=num(pos), emp=emp, name=name):
            a["filings"] += n
            a["certified"] += n
            a["positions"] += pos
            if emp:
                a["employers"].add(str(emp))
            a["spell"][str(name or "")] += n
        fold(agg, page, st, add)
    return agg, unnamed


def ranks(agg: dict) -> dict[str, list[tuple[str, int]]]:
    """Per place, (page, rank) for the TOP pages by filings, ties broken by slug."""
    by_place: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for (page, p), a in agg.items():
        if a["filings"] > 0:
            by_place[p].append((page, a["filings"]))
    out = {}
    for p, items in by_place.items():
        items.sort(key=lambda t: (-t[1], t[0]))
        out[p] = [(page, i + 1) for i, (page, _) in enumerate(items[:TOP])]
    return out


def all_ranks(agg: dict) -> dict[tuple[str, str], int]:
    """(page, place) -> rank among every firm with filings, for last year's place beside this year's."""
    by_place: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for (page, p), a in agg.items():
        if a["filings"] > 0:
            by_place[p].append((page, a["filings"]))
    out = {}
    for p, items in by_place.items():
        items.sort(key=lambda t: (-t[1], t[0]))
        for i, (page, _) in enumerate(items):
            out[(page, p)] = i + 1
    return out


def plan_year(program: str, fy: int, agg: dict, prev: dict[tuple[str, str], int], names: dict[str, str],
              pages: set[str], unnamed: Counter) -> tuple[list[list], dict]:
    """One program-year's rows and its totals. Pure, for the test."""
    top = ranks(agg)
    rows: list[list] = []
    totals: dict[str, dict] = {}
    at: dict[str, list[dict]] = defaultdict(list)
    for (_, p), a in agg.items():
        at[p].append(a)
    for p, ranked in top.items():
        filings = sorted((a["filings"] for a in at[p]), reverse=True)
        totals[p] = {
            "filings": sum(filings), "firms": sum(1 for v in filings if v), "top10": sum(filings[:TOP_SHARE]),
            "unnamed": unnamed.get(p, 0),
        }
        for page, rank in ranked:
            a = agg[(page, p)]
            name = names.get(page) or (a["spell"].most_common(1)[0][0] if a["spell"] else page) or page
            rows.append([
                program, fy, p, page, 1 if page in pages else 0, name, rank, prev.get((page, p)),
                a["filings"], a["certified"], a["denied"], a["withdrawn"], a["positions"], len(a["employers"]),
                median(a["days"]) if program == "perm" else None,
            ])
    return rows, totals


def years(db: Database, program: str) -> list[int]:
    if program == "perm":
        got = [num(r[0]) for r in rows_of(db.execute("SELECT DISTINCT fiscal_year FROM perm_cases_history"))
               if num(r[0]) <= PERM_HISTORY_LAST_FY]
        got += [num(r[0]) for r in rows_of(db.execute("SELECT DISTINCT fiscal_year FROM perm_cases"))
                if num(r[0]) > PERM_HISTORY_LAST_FY]
    else:
        got = [num(r[0]) for r in rows_of(db.execute(
            "SELECT DISTINCT fiscal_year FROM lca_cases WHERE case_status = 'CERTIFIED'"))]
    return sorted(y for y in set(got) if y > 2000)


INTS = {"fy", "linked", "rank", "prev_rank", "filings", "certified", "denied", "withdrawn", "positions", "employers"}
KEY = 4  # program, fy, state, slug


def norm(row) -> tuple:
    """One shape for a planned row and a stored one: the database hands integers back as strings."""
    out = []
    for c, v in zip(COLS, row):
        if v is None:
            out.append(None)
        elif c in INTS:
            out.append(int(float(v)))
        elif c == "median_days":
            out.append(round(float(v), 1))
        else:
            out.append(str(v))
    return tuple(out)


def write_diff(db: Database, want: list[list]) -> tuple[int, int]:
    """Write only the rows that changed and delete the ones gone, so the table is never empty."""
    for stmt in DDL:
        db.execute(stmt)
    stored = {}
    for r in rows_of(db.execute(f"SELECT {','.join(COLS)} FROM {TABLE}")):
        n = norm(list(r))
        stored[n[:KEY]] = n
    changed = [w for w in want if stored.get(norm(w)[:KEY]) != norm(w)]
    wanted = {norm(w)[:KEY] for w in want}
    gone = [k for k in stored if k not in wanted]
    for i in range(0, len(gone), WRITE_CHUNK):
        chunk = gone[i:i + WRITE_CHUNK]
        db.execute(f"DELETE FROM {TABLE} WHERE "
                   + " OR ".join("(program = ? AND fy = ? AND state = ? AND slug = ?)" for _ in chunk),
                   [v for k in chunk for v in k])
        time.sleep(WRITE_PAUSE_S)
    marks = "(" + ",".join("?" * len(COLS)) + ")"
    for i in range(0, len(changed), WRITE_CHUNK):
        chunk = changed[i:i + WRITE_CHUNK]
        db.execute(f"INSERT OR REPLACE INTO {TABLE} ({','.join(COLS)}) VALUES " + ",".join([marks] * len(chunk)),
                   [v for row in chunk for v in row])
        time.sleep(WRITE_PAUSE_S)
    return len(changed), len(gone)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--show", nargs=4, metavar=("PROGRAM", "FY", "PLACE", "N"))
    args = ap.parse_args(argv)
    started = time.time()
    db = Database()
    page_of, names = read_pages(db)
    pages = set(names)
    all_rows: list[list] = []
    summary: dict = {"programs": {}}
    for program, reader in (("perm", read_perm), ("lca", read_lca)):
        prev: dict[tuple[str, str], int] = {}
        per_year: dict[str, dict] = {}
        for fy in years(db, program):
            agg, unnamed = reader(db, fy, page_of)
            rows, totals = plan_year(program, fy, agg, prev, names, pages, unnamed)
            all_rows += rows
            per_year[str(fy)] = totals
            prev = all_ranks(agg)
            log(f"{program} FY{fy}: {len(rows):,} rows, {totals.get(NATION, {}).get('firms', 0):,} firms in the country")
        summary["programs"][program] = {"years": per_year}
    if args.show:
        prog, fy, p, n = args.show
        for r in sorted((r for r in all_rows if r[0] == prog and r[1] == int(fy) and r[2] == p), key=lambda r: r[6])[:int(n)]:
            log(f"  #{r[6]} {r[5]} ({r[3]}): {r[8]:,} filings, {r[9]:,} certified, {r[13]:,} employers, prev #{r[7]}")
    if args.dry_run:
        log(f"dry run: {len(all_rows):,} rows, nothing written")
        return 0
    changed, gone = write_diff(db, all_rows)
    write_doc(db, DOC_KEY, summary)
    note = f"{len(all_rows):,} rows held, {changed:,} written, {gone:,} removed"
    record_run(db, "build_firm_ranks.py", status="ok", rows_written=changed, note=note, started_at=started)
    log(f"done: {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
