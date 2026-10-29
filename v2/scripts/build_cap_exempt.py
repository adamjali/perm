#!/usr/bin/env python3
"""The employers DOL's own files mark as cap-exempt kinds: `/h1b-cap-exempt-employers`.

WHO IS ON IT. Each wage request (ETA-9141, Section E) asks whether the American
Competitiveness and Workforce Improvement Act covers the employer, and as which of
its three kinds: an institution of higher education, a nonprofit affiliated with
one, or a nonprofit or government research organization (20 CFR 656.40(e)). Those
are, nearly word for word, the employers the H-1B cap leaves out
(8 CFR 214.2(h)(8)(iii)(F)). An employer is listed when most of its answered wage
requests say ACWIA covers it (`qualifies`), with the kind it named most. That's the
employer's own answer to DOL, not a USCIS finding: the page says "likely".

WHAT IT CARRIES (perm_docs['cap_exempt']):

* how many employers, and of each kind;
* their certified H-1B LCAs in the newest finished fiscal year, against every other
  employer's, month by month (the month DOL certified each): the lottery's season
  shows in everyone else's months and not in theirs;
* by state, the employers and their LCAs;
* the busiest 100 by those LCAs, each with its kind, state, wage requests, LCAs,
  positions and USCIS's H-1B approvals that year.

`cap_exempt_employers` holds every listed employer (slug, kind, the requests saying
yes and those answered), so an employer's page and the sponsor finder read the same
answer as this page, by one point read.

Every employer reaches its page through `employer_page_map`; one with no page keeps
its own slug and isn't linked. Big reads go a slice of slugs at a time
(`SLUG_WINDOWS`), so no read through the tunnel outlasts its 100 s.

Usage:
    python3 scripts/build_cap_exempt.py            # rebuild the doc
    python3 scripts/build_cap_exempt.py --dry-run  # read and report only
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
from lib_db import SLUG_WINDOWS, Database, read_doc, record_run, rows_of, slug_window, write_doc  # noqa: E402

DOC_KEY = "cap_exempt"
TABLE = "cap_exempt_employers"
COLS = ["slug", "kind", "requests", "answered"]
DDL = [f"""CREATE TABLE IF NOT EXISTS {TABLE} (
    slug TEXT PRIMARY KEY,
    kind TEXT,
    requests INTEGER NOT NULL,
    answered INTEGER NOT NULL)"""]
WRITE_CHUNK = 300
WRITE_PAUSE_S = 0.3
KINDS = ("higher-ed", "affiliated", "research")
TOP = 100
STATES_SHOWN = 15
NATION = "US"


def log(msg: str) -> None:
    print(msg, flush=True)


def num(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def qualifies(yes: int, answered: int) -> bool:
    """Listed when most of an employer's answered wage requests say ACWIA covers it."""
    return yes > 0 and yes * 2 > answered


def kind_of(kinds: Counter) -> str | None:
    """The kind an employer named most; a tie goes to the form's order (college first)."""
    best = None
    for k in KINDS:
        if kinds[k] > 0 and (best is None or kinds[k] > kinds[best]):
            best = k
    return best


def fy_months(fy: int) -> list[str]:
    """October of the year before to September: a fiscal year's twelve months."""
    out = []
    y, m = fy - 1, 10
    for _ in range(12):
        out.append(f"{y}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def read_pages(db: Database) -> tuple[dict[str, str], dict[str, str]]:
    """source slug -> page slug, and page slug -> the name the page shows (the H-1B ranks' own read)."""
    from build_h1b_ranks import read_pages as h1b_pages
    return h1b_pages(db)


def windowed(db: Database, sql: str, args: list, col: str = "employer_slug") -> list[list]:
    """`sql` with `{w}` for a slug window, run once per window, the rows added up."""
    out: list[list] = []
    for lo, hi in SLUG_WINDOWS:
        clause, wargs = slug_window(col, lo, hi)
        out += rows_of(db.execute(sql.format(w=clause), [*args, *wargs]))
    return out


def read_acwia(db: Database, page_of: dict[str, str]):
    """Each page's wage requests: answered, saying yes, by kind and by state, and the names it filed under."""
    agg: dict[str, dict] = defaultdict(lambda: {"answered": 0, "yes": 0, "kinds": Counter(), "states": Counter(),
                                                "spell": Counter()})
    for slug, name, yes, kind, st, n in windowed(db, (
            "SELECT employer_slug, MAX(employer_name), acwia, acwia_kind, worksite_state, COUNT(*) FROM pwd_cases "
            "WHERE acwia IS NOT NULL AND {w} GROUP BY employer_slug, acwia, acwia_kind, worksite_state"), []):
        page = page_of.get(str(slug), str(slug))
        a = agg[page]
        a["answered"] += num(n)
        a["spell"][str(name or slug)] += num(n)
        if num(yes) == 1:
            a["yes"] += num(n)
            if kind in KINDS:
                a["kinds"][kind] += num(n)
            if st:
                a["states"][str(st).upper()[:2]] += num(n)
    span = rows_of(db.execute("SELECT MIN(decision_date), MAX(decision_date) FROM pwd_cases WHERE acwia IS NOT NULL"))
    lo, hi = (span[0] if span else [None, None])
    return agg, (str(lo)[:10] if lo else None, str(hi)[:10] if hi else None)


def newest_finished_fy(db: Database) -> tuple[int | None, str | None]:
    """The newest LCA fiscal year whose decisions run to its last week, and its last decision day."""
    years = [num(r[0]) for r in rows_of(db.execute(
        "SELECT DISTINCT fiscal_year FROM lca_cases WHERE fiscal_year IS NOT NULL ORDER BY 1 DESC"))]
    for fy in years:
        got = rows_of(db.execute("SELECT MAX(decision_date) FROM lca_cases WHERE decision_date >= ? AND decision_date <= ?",
                                 [f"{fy - 1}-10-01", f"{fy}-09-30"]))
        through = str(got[0][0])[:10] if got and got[0][0] else None
        if through and through >= f"{fy}-09-24":
            return fy, through
    return None, None


def read_lca(db: Database, fy: int, page_of: dict[str, str]):
    """Each page's certified H-1B LCAs and positions that fiscal year, by the month DOL certified them."""
    by_page: dict[str, dict] = defaultdict(lambda: {"lcas": 0, "positions": 0, "months": Counter()})
    for slug, month, n, pos in windowed(db, (
            "SELECT employer_slug, substr(decision_date, 1, 7), COUNT(*), SUM(COALESCE(workers, 1)) FROM lca_cases "
            "WHERE fiscal_year = ? AND case_status = 'CERTIFIED' AND visa_class = 'H-1B' AND {w} "
            "GROUP BY employer_slug, substr(decision_date, 1, 7)"), [fy]):
        page = page_of.get(str(slug), str(slug))
        p = by_page[page]
        p["lcas"] += num(n)
        p["positions"] += num(pos)
        p["months"][str(month)] += num(n)
    # The LCAs that name no employer slug count toward everyone else's months.
    loose = Counter()
    for month, n in rows_of(db.execute(
            "SELECT substr(decision_date, 1, 7), COUNT(*) FROM lca_cases WHERE fiscal_year = ? AND case_status = 'CERTIFIED' "
            "AND visa_class = 'H-1B' AND employer_slug IS NULL GROUP BY 1", [fy])):
        loose[str(month)] += num(n)
    return by_page, loose


def read_uscis(db: Database, page_of: dict[str, str]) -> tuple[int | None, dict[str, tuple[int, int]]]:
    """USCIS's newest Data Hub year: each page's new-employment and all approvals."""
    got = rows_of(db.execute("SELECT MAX(fy) FROM uscis_h1b_employers"))
    fy = num(got[0][0]) if got and got[0][0] else None
    out: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    if fy is None:
        return None, {}
    kinds = ("new", "cont", "same", "conc", "chg", "amend")
    appr = " + ".join(f"{k}_appr" for k in kinds)
    for slug, new, a in rows_of(db.execute(
            f"SELECT employer_slug, SUM(new_appr), SUM({appr}) FROM uscis_h1b_employers WHERE fy = ? "
            "AND employer_slug IS NOT NULL GROUP BY employer_slug", [fy])):
        page = page_of.get(str(slug), str(slug))
        out[page][0] += num(new)
        out[page][1] += num(a)
    return fy, {k: (v[0], v[1]) for k, v in out.items()}


def plan(acwia: dict, lca: dict, loose: Counter, uscis: dict, names: dict[str, str], fy: int | None) -> dict:
    """The doc, from the reads. Pure: the tests drive it."""
    listed = {page: a for page, a in acwia.items() if qualifies(a["yes"], a["answered"])}
    kinds = {k: {"employers": 0, "lcas": 0} for k in KINDS}
    states: dict[str, dict] = defaultdict(lambda: {"employers": 0, "lcas": 0})
    rows = []
    for page, a in listed.items():
        kind = kind_of(a["kinds"])
        state = a["states"].most_common(1)[0][0] if a["states"] else None
        l = lca.get(page, {"lcas": 0, "positions": 0})
        new, appr = uscis.get(page, (0, 0))
        if kind:
            kinds[kind]["employers"] += 1
            kinds[kind]["lcas"] += l["lcas"]
        if state:
            states[state]["employers"] += 1
            states[state]["lcas"] += l["lcas"]
        rows.append({
            "slug": page, "linked": page in names,
            "name": names.get(page) or (a["spell"].most_common(1)[0][0] if a["spell"] else page),
            "kind": kind, "state": state, "requests": a["yes"], "lcas": l["lcas"], "positions": l["positions"],
            "uscisNew": new, "uscisAppr": appr,
        })
    rows.sort(key=lambda r: (-r["lcas"], -r["requests"], r["slug"]))
    months = []
    if fy is not None:
        for m in fy_months(fy):
            exempt = sum(lca[p]["months"][m] for p in listed if p in lca)
            everyone = sum(v["months"][m] for v in lca.values()) + loose[m]
            months.append({"month": m, "exempt": exempt, "others": everyone - exempt})
    exempt_lcas = sum(r["lcas"] for r in rows)
    all_lcas = sum(v["lcas"] for v in lca.values()) + sum(loose.values())
    return {
        "employers": len(rows),
        "withLcas": sum(1 for r in rows if r["lcas"] > 0),
        "kinds": kinds,
        "lcas": exempt_lcas,
        "allLcas": all_lcas,
        "months": months,
        "states": sorted(({"state": s, **v} for s, v in states.items()), key=lambda s: (-s["lcas"], -s["employers"], s["state"]))[:STATES_SHOWN],
        "statesTotal": len(states),
        "top": rows[:TOP],
    }


def listed_rows(acwia: dict) -> list[list]:
    """The table's rows: every listed employer, by slug."""
    return sorted([page, kind_of(a["kinds"]), a["yes"], a["answered"]]
                  for page, a in acwia.items() if qualifies(a["yes"], a["answered"]))


def norm(row) -> tuple:
    """One shape for a planned row and a stored one: the database hands integers back as strings."""
    slug, kind, req, ans = row
    return (str(slug), None if kind is None else str(kind), int(float(req)), int(float(ans)))


def write_diff(db: Database, want: list[list]) -> tuple[int, int]:
    """Write only the rows that changed and delete the ones gone, so the table is never empty."""
    for stmt in DDL:
        db.execute(stmt)
    # COLS and TABLE are this module's constants, never input.
    # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query
    stored = {norm(r)[0]: norm(r) for r in rows_of(db.execute(f"SELECT {','.join(COLS)} FROM {TABLE}"))}
    changed = [w for w in want if stored.get(w[0]) != norm(w)]
    wanted = {w[0] for w in want}
    gone = [k for k in stored if k not in wanted]
    for i in range(0, len(gone), WRITE_CHUNK):
        chunk = gone[i:i + WRITE_CHUNK]
        db.execute(f"DELETE FROM {TABLE} WHERE slug IN (" + ",".join("?" * len(chunk)) + ")", chunk)
        time.sleep(WRITE_PAUSE_S)
    marks = "(" + ",".join("?" * len(COLS)) + ")"
    for i in range(0, len(changed), WRITE_CHUNK):
        chunk = changed[i:i + WRITE_CHUNK]
        db.execute(f"INSERT OR REPLACE INTO {TABLE} ({','.join(COLS)}) VALUES " + ",".join([marks] * len(chunk)),
                   [v for row in chunk for v in row])
        time.sleep(WRITE_PAUSE_S)
    return len(changed), len(gone)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    db = Database()
    page_of, names = read_pages(db)
    acwia, (pw_from, pw_through) = read_acwia(db, page_of)
    log(f"wage requests: {sum(a['answered'] for a in acwia.values()):,} answered the ACWIA question, "
        f"{len(acwia):,} employers, decided {pw_from} to {pw_through}")
    fy, lca_through = newest_finished_fy(db)
    lca, loose = read_lca(db, fy, page_of) if fy else ({}, Counter())
    uscis_fy, uscis = read_uscis(db, page_of)
    doc = plan(acwia, lca, loose, uscis, names, fy)
    doc.update({"asOf": {"pwFrom": pw_from, "pwThrough": pw_through, "lcaFy": fy, "lcaThrough": lca_through,
                         "uscisFy": uscis_fy}, "builtOn": dt.date.today().isoformat()})
    if doc["employers"] == 0:
        log("FATAL: no employer's wage requests say ACWIA covers it; the column may not be loaded")
        record_run(db, "build_cap_exempt.py", status="failed", note="no ACWIA answers", started_at=started)
        return 1
    log(f"listed {doc['employers']:,} employers ({doc['withLcas']:,} with LCAs in FY{fy}): "
        + ", ".join(f"{k} {v['employers']:,}" for k, v in doc["kinds"].items())
        + f"; {doc['lcas']:,} of {doc['allLcas']:,} certified H-1B LCAs")
    for r in doc["top"][:8]:
        log("  " + json.dumps(r, ensure_ascii=False))
    if args.dry_run:
        return 0
    want = listed_rows(acwia)
    changed, gone = write_diff(db, want)
    write_doc(db, DOC_KEY, doc)
    back = read_doc(db, DOC_KEY)
    # TABLE is this module's constant, never input.
    # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query
    held = int(rows_of(db.execute(f"SELECT count(*) FROM {TABLE}"))[0][0] or 0)
    ok = bool(back and back.get("employers") == doc["employers"]) and held == len(want)
    log(f"  {'ok ' if ok else 'MISMATCH'} {TABLE} {held:,} of {len(want):,} ({changed:,} written, {gone:,} removed)")
    record_run(db, "build_cap_exempt.py", status="ok" if ok else "failed", rows_written=changed,
               note=f"{doc['employers']:,} employers, FY{fy} LCAs", started_at=started)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
