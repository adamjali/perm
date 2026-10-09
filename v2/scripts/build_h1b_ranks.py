#!/usr/bin/env python3
"""The busiest H-1B employers, by fiscal year and state, from DOL and USCIS.

`/h1b-employers` and its state pages read `h1b_employer_ranks`. Each fiscal
year and place ("US" for the whole country, else a two-letter state) holds the
100 employers with the most certified H-1B LCAs and the 100 with the most
USCIS H-1B approvals, one row per employer page, with both ranks where the
employer made both lists.

TWO SOURCES, TWO MEANINGS OF "STATE", AND THE PAGE SAYS SO:

* DOL's LCA disclosure files (FY2020 on here): an LCA certifies the wage and
  conditions for a job before the H-1B petition is filed. One LCA can cover
  several positions, and not every LCA becomes a petition. Its state is the
  WORKSITE's. Counted: certified H-1B LCAs (H-1B1 and E-3 left out), the
  positions they cover, transfers (positions marked change of employer), the
  share at wage level III or IV, and the median yearly wage (annualised from
  the unit DOL printed, with the salary explorer's own band and its rule for
  amounts that can't be pay for their unit).
* USCIS's H-1B Employer Data Hub (FY2009 on): workers USCIS approved and
  denied on its first decision, split six ways. Its state is the PETITIONER's,
  the address on the I-129. Counted: new employment approvals, all approvals
  and all denials.

A state view therefore ranks LCAs by where the job is and approvals by where
the employer files from, and each column is labelled that way. Rows reach an
employer page through `employer_page_map`, so a spelling counts on one page;
a row with no page keeps its own slug and isn't linked.

The current-record facts (pending PERM cases on hold, WARN notices in two
years, an active debarment) describe the employer today, not the year shown.
The H-1B dependent declaration is the one most of the employer's LCAs that
fiscal year made, and `willful` counts the LCAs declaring a willful violation
(the page shows that only when most of the year's LCAs say so: one filing in
6,418 is a typing error more often than a finding).

`perm_docs['h1b_ranks_summary']` carries each year's totals per place, so the
page can say how much of the year the top ten hold.

Usage:
    python3 scripts/build_h1b_ranks.py            # rebuild the table and the doc
    python3 scripts/build_h1b_ranks.py --dry-run  # read and report only
    python3 scripts/build_h1b_ranks.py --dry-run --show 2025 US 12
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_lca_facets import ANNUAL_WAGE_SQL  # noqa: E402
from lib_slugs import slugify  # noqa: E402
from lib_turso import Turso, read_doc, record_run, rows_of, write_doc  # noqa: E402

TABLE = "h1b_employer_ranks"
DOC_KEY = "h1b_ranks_summary"
COLS = [
    "fy", "state", "slug", "linked", "name", "rank_lca", "rank_uscis",
    "lcas", "positions", "transfers", "senior", "leveled", "wage_median",
    "uscis_new", "uscis_appr", "uscis_den",
    "dependent", "willful", "on_hold", "warn_2y", "debarred",
]
INTS = {
    "fy", "linked", "rank_lca", "rank_uscis", "lcas", "positions", "transfers", "senior", "leveled",
    "uscis_new", "uscis_appr", "uscis_den", "dependent", "willful", "on_hold", "warn_2y", "debarred",
}
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        fy INTEGER NOT NULL,
        state TEXT NOT NULL,
        slug TEXT NOT NULL,
        linked INTEGER NOT NULL,
        name TEXT NOT NULL,
        rank_lca INTEGER,
        rank_uscis INTEGER,
        lcas INTEGER NOT NULL,
        positions INTEGER NOT NULL,
        transfers INTEGER NOT NULL,
        senior INTEGER NOT NULL,
        leveled INTEGER NOT NULL,
        wage_median REAL,
        uscis_new INTEGER NOT NULL,
        uscis_appr INTEGER NOT NULL,
        uscis_den INTEGER NOT NULL,
        dependent INTEGER,
        willful INTEGER NOT NULL,
        on_hold INTEGER NOT NULL,
        warn_2y INTEGER NOT NULL,
        debarred INTEGER NOT NULL,
        PRIMARY KEY (fy, state, slug))""",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_lca ON {TABLE} (fy, state, rank_lca)",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_uscis ON {TABLE} (fy, state, rank_uscis)",
]
NATION = "US"
TOP = 100
TOP_SHARE = 10  # the "top ten hold X%" figure
MIN_WAGES = 5  # a median of fewer filings is withheld
WAGE_BAND = (10_000, 1_500_000)  # the salary explorer's band (build_lca_facets.DEFAULT_WHERE)
FIRST_FY = 2009  # the Data Hub's first year
KINDS = ("new", "cont", "same", "conc", "chg", "amend")
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


def median(counts: Counter) -> float | None:
    """The median of a multiset, interpolated at (n - 1) / 2 like wage_views."""
    n = sum(counts.values())
    if n < MIN_WAGES:
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
    return round(lo_v + (hi_v - lo_v) * (pos - int(pos)), 2)


def blank() -> dict:
    return {"lcas": 0, "positions": 0, "transfers": 0, "senior": 0, "leveled": 0, "wages": Counter(),
            "uscis_new": 0, "uscis_appr": 0, "uscis_den": 0}


def read_pages(db: Turso) -> tuple[dict[str, str], dict[str, str]]:
    """source slug -> page slug, and page slug -> the name the page shows."""
    page_of: dict[str, str] = {}
    for src, page in rows_of(db.execute("SELECT source_slug, page_slug FROM employer_page_map")):
        page_of[str(src)] = str(page)
    names: dict[str, str] = {}
    for sql in ("SELECT slug, name FROM employer_other_index",
                "SELECT slug, name FROM perm_live_only_index",
                "SELECT slug, name FROM perm_entities WHERE kind = 'employer'"):
        try:
            for slug, name in rows_of(db.execute(sql)):
                if name:
                    names[str(slug)] = str(name)
        except Exception as e:  # noqa: BLE001
            if "no such table" not in str(e):
                raise
    return page_of, names


def read_lca(db: Turso, fy: int, page_of: dict[str, str]):
    """One fiscal year's certified H-1B LCAs, folded onto pages and places."""
    agg: dict[tuple[str, str], dict] = defaultdict(blank)
    spell: dict[str, Counter] = defaultdict(Counter)
    dep: dict[str, list] = defaultdict(lambda: [0, 0])  # LCAs declaring dependent, not dependent
    willful: Counter = Counter()
    where = "fiscal_year = ? AND case_status = 'CERTIFIED' AND visa_class = 'H-1B'"
    for slug, name, st, n, pos, chg, sen, lev, dyes, dno, wil in rows_of(db.execute(
            "SELECT employer_slug, MAX(employer_name), worksite_state, COUNT(*), SUM(COALESCE(workers, 1)), "
            "SUM(COALESCE(change_employer, 0)), SUM(CASE WHEN wage_level IN ('III', 'IV') THEN 1 ELSE 0 END), "
            "SUM(CASE WHEN wage_level IS NOT NULL THEN 1 ELSE 0 END), "
            "SUM(CASE WHEN h1b_dependent = 1 THEN 1 ELSE 0 END), "
            "SUM(CASE WHEN h1b_dependent = 0 THEN 1 ELSE 0 END), "
            "SUM(CASE WHEN willful_violator = 1 THEN 1 ELSE 0 END) "
            f"FROM lca_cases WHERE {where} AND employer_slug IS NOT NULL GROUP BY employer_slug, worksite_state",
            [fy])):
        page = page_of.get(str(slug), str(slug))
        spell[page][str(name or slug)] += num(n)
        for p in {NATION, place(st)} - {None}:
            a = agg[(page, p)]
            a["lcas"] += num(n)
            a["positions"] += num(pos)
            a["transfers"] += num(chg)
            a["senior"] += num(sen)
            a["leveled"] += num(lev)
        dep[page][0] += num(dyes)
        dep[page][1] += num(dno)
        willful[page] += num(wil)
    lo, hi = WAGE_BAND
    for slug, st, w, n in rows_of(db.execute(
            f"SELECT employer_slug, worksite_state, ROUND({ANNUAL_WAGE_SQL}), COUNT(*) FROM lca_cases "
            f"WHERE {where} AND employer_slug IS NOT NULL AND wage IS NOT NULL AND wage > 0 "
            f"AND ({ANNUAL_WAGE_SQL}) BETWEEN ? AND ? GROUP BY 1, 2, 3", [fy, lo, hi])):
        page = page_of.get(str(slug), str(slug))
        for p in {NATION, place(st)} - {None}:
            agg[(page, p)]["wages"][float(w)] += num(n)
    through = rows_of(db.execute(f"SELECT MAX(decision_date) FROM lca_cases WHERE {where}", [fy]))[0][0]
    dependent = {}
    for page, (yes, no) in dep.items():
        if yes or no:
            dependent[page] = 1 if yes > no else 0
    return agg, spell, dependent, willful, (str(through)[:10] if through else None)


def read_uscis(db: Turso, fy: int, page_of: dict[str, str], agg: dict, spell: dict) -> None:
    appr = " + ".join(f"{k}_appr" for k in KINDS)
    den = " + ".join(f"{k}_den" for k in KINDS)
    for slug, name, st, new, a, d in rows_of(db.execute(
            f"SELECT employer_slug, MAX(employer), state, SUM(new_appr), SUM({appr}), SUM({den}) "
            "FROM uscis_h1b_employers WHERE fy = ? GROUP BY employer_slug, employer, state", [fy])):
        own = str(slug) if slug else slugify(str(name or ""))
        if not own:
            continue
        page = page_of.get(own, own)
        spell[page][str(name or own)] += num(a)
        for p in {NATION, place(st)} - {None}:
            g = agg[(page, p)]
            g["uscis_new"] += num(new)
            g["uscis_appr"] += num(a)
            g["uscis_den"] += num(d)


def read_current(db: Turso, page_of: dict[str, str], today: dt.date) -> dict[str, dict[str, int]]:
    """Facts about each employer today: cases on hold, WARN notices, debarment."""
    out: dict[str, dict[str, int]] = defaultdict(lambda: {"on_hold": 0, "warn_2y": 0, "debarred": 0})
    try:
        for slug, stages in rows_of(db.execute(
                "SELECT slug, stages FROM perm_entity_pending WHERE kind = 'employer' AND pending > 0")):
            try:
                held = int(json.loads(str(stages)).get("APPLICATION ON HOLD", 0))
            except (ValueError, AttributeError):
                held = 0
            if held:
                out[page_of.get(str(slug), str(slug))]["on_hold"] += held
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise
    since = (today - dt.timedelta(days=730)).isoformat()
    try:
        for slug, n in rows_of(db.execute(
                "SELECT employer_slug, COUNT(*) FROM warn_notices WHERE notice_date >= ? "
                "AND employer_slug IS NOT NULL GROUP BY employer_slug", [since])):
            out[page_of.get(str(slug), str(slug))]["warn_2y"] += num(n)
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise
    day = today.isoformat()
    try:
        for slug, start in rows_of(db.execute(
                "SELECT entity_slug, start_date FROM debarments WHERE end_date >= ?", [day])):
            if slug and str(start or "") <= day:
                out[page_of.get(str(slug), str(slug))]["debarred"] = 1
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise
    return out


def ranked(agg: dict, field: str) -> dict[str, list[tuple[str, int]]]:
    """Per place, (page, rank) for the TOP pages by `field`, ties broken by slug."""
    by_place: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for (page, p), a in agg.items():
        if a[field] > 0:
            by_place[p].append((page, a[field]))
    out = {}
    for p, items in by_place.items():
        items.sort(key=lambda t: (-t[1], t[0]))
        out[p] = [(page, i + 1) for i, (page, _) in enumerate(items[:TOP])]
    return out


def plan_year(fy: int, agg: dict, spell: dict, names: dict, pages: set, dependent: dict, willful: Counter,
              current: dict) -> tuple[list[list], dict]:
    """One fiscal year's rows and its totals. Pure, for the test."""
    by_lca = ranked(agg, "lcas")
    by_uscis = ranked(agg, "uscis_appr")
    at: dict[str, list[dict]] = defaultdict(list)
    for (_, q), a in agg.items():
        at[q].append(a)
    totals: dict[str, dict] = {}
    for p in set(by_lca) | set(by_uscis):
        lcas = sorted((a["lcas"] for a in at[p]), reverse=True)
        appr = sorted((a["uscis_appr"] for a in at[p]), reverse=True)
        totals[p] = {
            "lcas": sum(lcas), "lcaEmployers": sum(1 for v in lcas if v), "lcaTop10": sum(lcas[:TOP_SHARE]),
            "positions": sum(a["positions"] for a in at[p]),
            "uscisAppr": sum(appr), "uscisEmployers": sum(1 for v in appr if v), "uscisTop10": sum(appr[:TOP_SHARE]),
            "uscisNew": sum(a["uscis_new"] for a in at[p]),
        }
    rows = []
    for p in sorted(totals):
        ranks: dict[str, list] = defaultdict(lambda: [None, None])
        for page, r in by_lca.get(p, []):
            ranks[page][0] = r
        for page, r in by_uscis.get(p, []):
            ranks[page][1] = r
        for page in sorted(ranks):
            a = agg[(page, p)]
            linked = page in pages
            name = names.get(page) if linked else None
            if not name:
                name = spell[page].most_common(1)[0][0] if spell.get(page) else page
            cur = current.get(page, {"on_hold": 0, "warn_2y": 0, "debarred": 0})
            rows.append([
                fy, p, page, 1 if linked else 0, name, ranks[page][0], ranks[page][1],
                a["lcas"], a["positions"], a["transfers"], a["senior"], a["leveled"], median(a["wages"]),
                a["uscis_new"], a["uscis_appr"], a["uscis_den"],
                dependent.get(page), willful.get(page, 0), cur["on_hold"], cur["warn_2y"], cur["debarred"],
            ])
    return rows, totals


def norm(row: list) -> tuple:
    out = []
    for c, v in zip(COLS, row):
        if v is None:
            out.append(None)
        elif c in INTS:
            out.append(int(float(v)))
        elif c == "wage_median":
            out.append(round(float(v), 2))
        else:
            out.append(str(v))
    return tuple(out)


def write_diff(db: Turso, want: list[list]) -> tuple[int, int]:
    stored = {}
    for r in rows_of(db.execute(f"SELECT {','.join(COLS)} FROM {TABLE}")):
        n = norm(list(r))
        stored[n[:3]] = n
    changed = [w for w in want if stored.get(norm(w)[:3]) != norm(w)]
    wanted = {norm(w)[:3] for w in want}
    gone = [k for k in stored if k not in wanted]
    for i in range(0, len(gone), 300):
        chunk = gone[i:i + 300]
        db.execute(f"DELETE FROM {TABLE} WHERE " + " OR ".join("(fy = ? AND state = ? AND slug = ?)" for _ in chunk),
                   [v for k in chunk for v in k])
        time.sleep(WRITE_PAUSE_S)
    marks = "(" + ",".join("?" * len(COLS)) + ")"
    for i in range(0, len(changed), WRITE_CHUNK):
        chunk = changed[i:i + WRITE_CHUNK]
        db.execute(f"INSERT OR REPLACE INTO {TABLE} ({','.join(COLS)}) VALUES " + ",".join([marks] * len(chunk)),
                   [v for row in chunk for v in row])
        time.sleep(WRITE_PAUSE_S)
    return len(changed), len(gone)


def main() -> int:
    global WRITE_PAUSE_S
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--show", nargs=3, metavar=("FY", "STATE", "N"))
    ap.add_argument("--pause", type=float, default=WRITE_PAUSE_S)
    args = ap.parse_args()
    WRITE_PAUSE_S = max(0.0, args.pause)
    started = time.time()
    db = Turso()
    today = dt.date.today()
    page_of, names = read_pages(db)
    pages = set(names)
    current = read_current(db, page_of, today)
    lca_years = [num(r[0]) for r in rows_of(db.execute(
        "SELECT DISTINCT fiscal_year FROM lca_cases WHERE fiscal_year IS NOT NULL ORDER BY 1"))]
    uscis_years = [num(r[0]) for r in rows_of(db.execute("SELECT DISTINCT fy FROM uscis_h1b_employers ORDER BY 1"))]
    hub_through = None
    for (as_of,) in rows_of(db.execute("SELECT as_of FROM data_freshness WHERE dataset = 'uscis-h1b-hub'")):
        hub_through = str(as_of)[:10] if as_of else None
    newest_hub = max(uscis_years, default=0)
    rows: list[list] = []
    years: dict[str, dict] = {}
    for fy in sorted(set(lca_years) | set(uscis_years)):
        if fy < FIRST_FY:
            continue
        spell: dict[str, Counter] = defaultdict(Counter)
        agg: dict = defaultdict(blank)
        dependent: dict = {}
        willful: Counter = Counter()
        lca_through = None
        if fy in lca_years:
            agg, spell, dependent, willful, lca_through = read_lca(db, fy, page_of)
        if fy in uscis_years:
            read_uscis(db, fy, page_of, agg, spell)
        year_rows, totals = plan_year(fy, agg, spell, names, pages, dependent, willful, current)
        rows += year_rows
        fy_end = f"{fy}-09-30"
        years[str(fy)] = {
            "lcaThrough": lca_through if fy in lca_years else None,
            "uscisThrough": (hub_through if fy == newest_hub and hub_through else fy_end) if fy in uscis_years else None,
            "places": totals,
        }
        n = totals.get(NATION, {})
        log(f"  FY{fy}: {n.get('lcas', 0):,} LCAs, {n.get('uscisAppr', 0):,} USCIS approvals, "
            f"{len(totals)} places, {len(year_rows):,} rows")
    doc = {"years": years, "top": TOP, "builtOn": today.isoformat()}
    log(f"rows {len(rows):,} over {len(years)} fiscal years")
    if args.show:
        fy, st, k = int(args.show[0]), args.show[1].upper(), int(args.show[2])
        pick = sorted((r for r in rows if r[0] == fy and r[1] == st and r[5]), key=lambda r: r[5])[:k]
        for r in pick:
            log("  " + json.dumps(dict(zip(COLS, r)), ensure_ascii=False))
        log("  totals " + json.dumps(years.get(str(fy), {}).get("places", {}).get(st)))
    if args.dry_run:
        return 0
    for ddl in DDL:
        db.execute(ddl)
    changed, gone = write_diff(db, rows)
    write_doc(db, DOC_KEY, doc)
    got = int(rows_of(db.execute(f"SELECT count(*) FROM {TABLE}"))[0][0] or 0)
    back = read_doc(db, DOC_KEY)
    ok = got == len(rows) and bool(back and back.get("years"))
    log(f"  {'ok ' if ok else 'MISMATCH'} {TABLE} {got:,} of {len(rows):,} ({changed:,} written, {gone:,} removed)")
    record_run(db, "build_h1b_ranks.py", status="ok" if ok else "failed", rows_written=changed,
               note=f"{len(rows):,} rows over {len(years)} fiscal years", started_at=started)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
