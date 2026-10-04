#!/usr/bin/env python3
"""H-1B LCAs by worksite city, for the city pages.

One row per city in `lca_cities`, keyed exactly as the PERM city pages are
(`city_key`: the city's letters upper-cased, punctuation dropped, with its
state), so a city page joins its PERM record to its H-1B record by key. A
city with 20 or more LCAs gets a row; one that clears that floor on H-1B
alone, with too few PERM cases for a PERM page, gets a page of its own.

Totals cover every LCA this site holds (DOL's files from FY2020). The top
employers and occupations cover certified LCAs in the newest three fiscal
years, and an employer links to its page through employer_page_map.

Usage:
    python3 scripts/build_lca_cities.py            # rebuild the table
    python3 scripts/build_lca_cities.py --dry-run  # read and report only
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_entity_detail import city_key, city_labels  # noqa: E402
from lib_slugs import slugify  # noqa: E402
from lib_turso import Turso, record_run, rows_of  # noqa: E402

TABLE = "lca_cities"
COLS = ["key", "slug", "label", "total", "certified", "fy_from", "fy_to", "detail"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        key TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        label TEXT NOT NULL,
        total INTEGER NOT NULL,
        certified INTEGER NOT NULL,
        fy_from INTEGER,
        fy_to INTEGER,
        detail TEXT NOT NULL)""",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_slug ON {TABLE} (slug)",
]
FLOOR = 20
TOP = 10
YEARS = 3
WRITE_CHUNK = 300
WRITE_PAUSE_S = 0.4


def log(msg: str) -> None:
    print(msg, flush=True)


def num(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def read(db: Turso) -> dict:
    totals: dict[str, list[int]] = {}
    votes: dict[str, Counter] = defaultdict(Counter)
    fy: dict[str, list[int]] = {}
    for city, state, n, cert, lo, hi in rows_of(db.execute(
            "SELECT worksite_city, worksite_state, COUNT(*), SUM(case_status = 'CERTIFIED'), MIN(fiscal_year), "
            "MAX(fiscal_year) FROM lca_cases WHERE worksite_city IS NOT NULL AND worksite_state IS NOT NULL "
            "GROUP BY worksite_city, worksite_state")):
        key = city_key(str(city), str(state))
        if not key:
            continue
        t = totals.setdefault(key, [0, 0])
        t[0] += num(n)
        t[1] += num(cert)
        votes[key][" ".join(str(city).split())] += num(n)
        span = fy.setdefault(key, [9999, 0])
        if lo:
            span[0] = min(span[0], num(lo))
        if hi:
            span[1] = max(span[1], num(hi))
    keep = {k for k, t in totals.items() if t[0] >= FLOOR}
    top_fy = max((s[1] for s in fy.values()), default=0)
    since = top_fy - YEARS + 1
    employers: dict[str, Counter] = defaultdict(Counter)
    names: dict[str, str] = {}
    for city, state, slug, name, n in rows_of(db.execute(
            "SELECT worksite_city, worksite_state, employer_slug, MAX(employer_name), COUNT(*) FROM lca_cases "
            "WHERE case_status = 'CERTIFIED' AND fiscal_year >= ? AND worksite_city IS NOT NULL "
            "AND worksite_state IS NOT NULL AND employer_slug IS NOT NULL "
            "GROUP BY worksite_city, worksite_state, employer_slug", [since])):
        key = city_key(str(city), str(state))
        if key in keep:
            employers[key][str(slug)] += num(n)
            names.setdefault(str(slug), str(name or slug))
    occupations: dict[str, Counter] = defaultdict(Counter)
    soc_titles: dict[str, str] = {}
    for city, state, soc, title, n in rows_of(db.execute(
            "SELECT worksite_city, worksite_state, substr(soc_code, 1, 7), MAX(soc_title), COUNT(*) FROM lca_cases "
            "WHERE case_status = 'CERTIFIED' AND fiscal_year >= ? AND worksite_city IS NOT NULL "
            "AND worksite_state IS NOT NULL AND soc_code IS NOT NULL "
            "GROUP BY worksite_city, worksite_state, substr(soc_code, 1, 7)", [since])):
        key = city_key(str(city), str(state))
        if key in keep:
            occupations[key][str(soc)] += num(n)
            soc_titles.setdefault(str(soc), str(title or soc))
    page_of: dict[str, str] = {}
    try:
        for src, page in rows_of(db.execute("SELECT source_slug, page_slug FROM employer_page_map")):
            page_of[str(src)] = str(page)
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise
    occ_pages = {str(c): str(s) for s, c in rows_of(db.execute(
        "SELECT slug, code FROM perm_entities WHERE kind = 'occupation' AND code IS NOT NULL"))}
    perm_city_slugs: dict[str, str] = {}
    try:
        for key, slug in rows_of(db.execute("SELECT key, slug FROM perm_groups WHERE kind = 'city'")):
            perm_city_slugs[str(key)] = str(slug)
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise
    return {"totals": totals, "votes": votes, "fy": fy, "keep": keep, "since": since, "employers": employers,
            "names": names, "occupations": occupations, "soc_titles": soc_titles, "page_of": page_of,
            "occ_pages": occ_pages, "perm_city_slugs": perm_city_slugs}


def plan(d: dict) -> list[list]:
    """The table's rows. Pure, for the test."""
    labels = city_labels({k: d["votes"][k] for k in d["keep"]})
    rows: list[list] = []
    taken: dict[str, str] = {}
    page_set = set(d["page_of"].values())
    for key in sorted(d["keep"], key=lambda k: (-d["totals"][k][0], k)):
        label = labels[key]
        # A city with a PERM page keeps that page's slug, so the two records share a URL.
        slug = d["perm_city_slugs"].get(key) or slugify(label)
        if slug in taken:
            continue  # two spellings slug alike; the busier kept it
        taken[slug] = key
        emp = Counter()
        for s, n in d["employers"].get(key, Counter()).items():
            emp[d["page_of"].get(s, s)] += n
        detail = {
            "since": d["since"],
            "employers": [{"slug": s if s in page_set else None, "name": d["names"].get(s, s), "n": n}
                          for s, n in emp.most_common(TOP)],
            "occupations": [{"code": c, "title": d["soc_titles"].get(c, c), "slug": d["occ_pages"].get(c), "n": n}
                            for c, n in d["occupations"].get(key, Counter()).most_common(TOP)],
            "hasPermPage": key in d["perm_city_slugs"],
        }
        lo, hi = d["fy"][key]
        rows.append([key, slug, label, d["totals"][key][0], d["totals"][key][1], lo if lo != 9999 else None,
                     hi or None, json.dumps(detail, separators=(",", ":"), ensure_ascii=False)])
    return rows


def norm(row: list) -> tuple:
    ints = {"total", "certified", "fy_from", "fy_to"}
    return tuple(None if v is None else int(float(v)) if c in ints else str(v) for c, v in zip(COLS, row))


def write_diff(db: Turso, want: list[list]) -> tuple[int, int]:
    stored = {}
    for r in rows_of(db.execute(f"SELECT {','.join(COLS)} FROM {TABLE}")):
        n = norm(list(r))
        stored[n[0]] = n
    changed = [w for w in want if stored.get(w[0]) != norm(w)]
    wanted = {w[0] for w in want}
    gone = [k for k in stored if k not in wanted]
    for i in range(0, len(gone), 500):
        chunk = gone[i:i + 500]
        db.execute(f"DELETE FROM {TABLE} WHERE key IN ({','.join('?' for _ in chunk)})", chunk)
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
    db = Turso()
    d = read(db)
    rows = plan(d)
    own = sum(1 for r in rows if not json.loads(r[7])["hasPermPage"])
    log(f"cities with {FLOOR}+ LCAs {len(rows):,}; {own:,} of them without a PERM city page; top {rows[0][2] if rows else '-'}")
    if args.dry_run:
        return 0
    for ddl in DDL:
        db.execute(ddl)
    changed, gone = write_diff(db, rows)
    got = int(rows_of(db.execute(f"SELECT count(*) FROM {TABLE}"))[0][0] or 0)
    ok = got == len(rows)
    log(f"  {'ok ' if ok else 'MISMATCH'} {TABLE} {got:,} of {len(rows):,} ({changed:,} written, {gone:,} removed)")
    record_run(db, "build_lca_cities.py", status="ok" if ok else "failed", rows_written=changed,
               note=f"{len(rows):,} cities, {own:,} H-1B only", started_at=started)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
