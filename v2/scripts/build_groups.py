#!/usr/bin/env python3
"""PERM by worksite city, by industry and by country of citizenship.

One row per group in `perm_groups`, everything a group's page needs in that
row (totals, median wage, decisions by year, and its top employers,
occupations, states, cities, countries and education as JSON), so a page is
one primary-key read. Built from BOTH case tables:

    perm_cases           FY2024 onward (current DOL files)
    perm_cases_history   FY2016 to FY2023 (ingest_perm_history.py)

so a city or an industry spans FY2016 to today. Citizenship and education
exist only on DOL's old form, so a country's page covers FY2016 to
FY2024, plus its FY2008 onward yearly counts from `perm_country_years`
(read by the page, not copied here).

Groups under FLOOR decided cases get no row: a page of three cases is noise
and a crawler's dead weight. Rebuilt whole after each load (a few thousand
rows); the quarterly workflow runs it after the entity rebuild.

Usage:
    python3 scripts/build_groups.py            # rebuild perm_groups
    python3 scripts/build_groups.py --dry-run  # read and report only
"""
from __future__ import annotations

import argparse
import json
import pathlib
import statistics
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_entity_detail import city_key, city_labels  # noqa: E402
from lib_naics import naics_title, normalize_naics  # noqa: E402
from lib_turso import (  # noqa: E402
    Turso, insert_stmts, record_run, rows_of, run_stmts, stmt, write_doc,
)
from lib_slugs import slugify  # noqa: E402

FLOOR = 20                # decided cases a group needs for a row (and a page)
TOP = 10                  # entries in each of a group's top lists
PAGE = 25000              # case rows read per request
ROWS_PER_STMT = 200       # perm_groups rows per INSERT
STMTS_PER_REQUEST = 4

READ_COLS = ["status", "fiscal_year", "employer_slug", "employer_name", "state", "soc_code",
             "soc_title", "wage", "naics", "worksite_city", "citizenship", "education", "visa_class",
             "birth_country", "job_education"]

# The case search's pick lists (perm_docs['case_field_options']), counted in
# the same pass: stored column -> the doc's key. Values are kept exactly as
# stored, because the search matches them by equality.
FIELD_OPTIONS = {"citizenship": "citizenship", "birth_country": "birthCountry",
                 "visa_class": "visaClass", "education": "education",
                 "job_education": "jobEducation"}
FIELD_OPTIONS_MAX = 400

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS perm_groups (
         kind        TEXT NOT NULL,
         slug        TEXT NOT NULL,
         key         TEXT NOT NULL,
         label       TEXT NOT NULL,
         total       INTEGER NOT NULL,
         certified   INTEGER NOT NULL,
         denied      INTEGER NOT NULL,
         withdrawn   INTEGER NOT NULL,
         median_wage REAL,
         fy_from     INTEGER,
         fy_to       INTEGER,
         detail      TEXT NOT NULL,
         PRIMARY KEY (kind, slug)
       )""",
    "CREATE INDEX IF NOT EXISTS idx_pg_kind_total ON perm_groups(kind, total)",
]


def log(msg: str) -> None:
    print(msg, flush=True)




# The group pages (cities, industries, countries) describe decisions from
# FY2016 on, and say so: the history table reaches FY2008 since Oct 3 2026, and
# folding 2008 wages into "what they paid" would mislead.
GROUPS_FROM_DATE = "2015-10-01"


def read_table(db, table: str, since: str | None = None):
    """Every row of one case table, the READ_COLS only, in rowid pages.

    A column the table doesn't have yet (perm_cases gains the worker's fields
    at its next load) reads as NULL rather than failing the build.
    """
    have = {r[1] for r in rows_of(db.execute(f"PRAGMA table_info({table})"))}
    select = ",".join(c if c in have else f"NULL AS {c}" for c in READ_COLS)
    after = 0
    while True:
        floor = " AND decision_date >= ?" if since else ""
        res = db.execute(f"SELECT rowid, {select} FROM {table} "
                         f"WHERE rowid > ?{floor} ORDER BY rowid LIMIT {PAGE}",
                         [after, since] if since else [after])
        rs = rows_of(res)
        for r in rs:
            yield dict(zip(READ_COLS, r[1:]))
        if len(rs) < PAGE:
            return
        after = int(rs[-1][0])


def country_label(key: str) -> str:
    return " ".join(w.capitalize() if w.isalpha() else w for w in key.lower().split())


class Group:
    __slots__ = ("counts", "wages", "years", "employers", "occupations", "states",
                 "cities", "countries", "education", "visa", "industries", "emp_names")

    def __init__(self) -> None:
        self.counts = Counter()
        self.wages: list[float] = []
        self.years: dict[int, Counter] = defaultdict(Counter)
        self.employers = Counter()
        self.emp_names: dict[str, str] = {}
        self.occupations = Counter()
        self.states = Counter()
        self.cities = Counter()
        self.countries = Counter()
        self.education = Counter()
        self.visa = Counter()
        self.industries = Counter()

    def add(self, r: dict, ck: str | None, naics: str | None) -> None:
        st = r["status"]
        self.counts[st] += 1
        fy = r.get("fiscal_year")
        if fy:
            self.years[int(fy)][st] += 1
        w = r.get("wage")
        if st == "certified" and w not in (None, ""):
            try:
                self.wages.append(float(w))
            except (TypeError, ValueError):
                pass
        slug = r.get("employer_slug")
        if slug:
            self.employers[slug] += 1
            self.emp_names.setdefault(slug, r.get("employer_name") or slug)
        soc = (r.get("soc_code") or "")[:7]
        if soc:
            self.occupations[soc] += 1
        if r.get("state"):
            self.states[r["state"]] += 1
        if ck:
            self.cities[ck] += 1
        if r.get("citizenship"):
            self.countries[r["citizenship"]] += 1
        if r.get("education"):
            self.education[r["education"]] += 1
        if r.get("visa_class"):
            self.visa[r["visa_class"]] += 1
        if naics:
            self.industries[naics] += 1


def aggregate(rows, fields: dict[str, Counter] | None = None
              ) -> tuple[dict[tuple[str, str], Group], dict[str, Counter], Counter]:
    groups: dict[tuple[str, str], Group] = defaultdict(Group)
    city_votes: dict[str, Counter] = defaultdict(Counter)
    soc_titles: Counter = Counter()
    for r in rows:
        if r.get("status") not in ("certified", "denied", "withdrawn"):
            continue
        if fields is not None:
            for col in FIELD_OPTIONS:
                v = r.get(col)
                if v not in (None, ""):
                    fields[col][v] += 1
        raw_city = " ".join((r.get("worksite_city") or "").split())
        ck = city_key(raw_city, r.get("state"))
        if ck:
            city_votes[ck][raw_city] += 1
        naics = normalize_naics(r.get("naics"))
        soc = (r.get("soc_code") or "")[:7]
        if soc and r.get("soc_title"):
            soc_titles[(soc, r["soc_title"])] += 1
        if ck:
            groups[("city", ck)].add(r, ck, naics)
        if naics and len(naics) == 6:
            groups[("industry", naics)].add(r, ck, naics)
        if r.get("citizenship"):
            groups[("country", r["citizenship"])].add(r, ck, naics)
    return groups, city_votes, soc_titles


def build_rows(groups, city_votes, soc_titles, occ_slugs: dict[str, str],
               employer_pages: set[str] | None = None) -> list[tuple]:
    """employer_pages: the slugs an employer page answers to. A history row's
    slug can be its name slugified (no page), and a sponsor is linked only
    when its slug is a page; None means every slug is one (tests)."""
    labels = city_labels(city_votes)
    soc_title: dict[str, str] = {}
    for (soc, title), _ in soc_titles.most_common():
        soc_title.setdefault(soc, title)
    out: list[tuple] = []
    for (kind, key), g in groups.items():
        c, d, w = g.counts["certified"], g.counts["denied"], g.counts["withdrawn"]
        total = c + d + w
        if total < FLOOR:
            continue
        if kind == "city":
            label = labels.get(key, key.replace("|", ", "))
        elif kind == "industry":
            hit = naics_title(key)
            label = hit[1] if hit and hit[0] == key else (f"{hit[1]} (group {hit[0]})" if hit else f"NAICS {key}")
        else:
            label = country_label(key)
        slug = key if kind == "industry" else slugify(label if kind == "city" else key)
        years = sorted(g.years)
        detail = {
            "years": [{"fy": fy, "certified": g.years[fy]["certified"], "denied": g.years[fy]["denied"],
                       "withdrawn": g.years[fy]["withdrawn"]} for fy in years],
            "employers": [{"slug": s if employer_pages is None or s in employer_pages else None,
                           "name": g.emp_names.get(s, s), "n": n}
                          for s, n in g.employers.most_common(TOP)],
            "occupations": [{"code": s, "title": soc_title.get(s, s), "slug": occ_slugs.get(s), "n": n}
                            for s, n in g.occupations.most_common(TOP)],
            "states": [{"key": s, "n": n} for s, n in g.states.most_common(TOP)],
            "cities": [{"key": s, "label": labels.get(s, s), "slug": slugify(labels.get(s, s)), "n": n}
                       for s, n in g.cities.most_common(TOP)] if kind != "city" else [],
            "countries": [{"key": s, "label": country_label(s), "slug": slugify(s), "n": n}
                          for s, n in g.countries.most_common(TOP)] if kind != "country" else [],
            "industries": [{"code": s, "title": (naics_title(s) or (s, f"NAICS {s}"))[1], "n": n}
                           for s, n in g.industries.most_common(TOP)] if kind != "industry" else [],
            "education": [{"key": s, "n": n} for s, n in g.education.most_common(TOP)],
            "visa": [{"key": s, "n": n} for s, n in g.visa.most_common(TOP)],
        }
        med = statistics.median(g.wages) if g.wages else None
        out.append((kind, slug, key, label, total, c, d, w, med,
                    years[0] if years else None, years[-1] if years else None,
                    json.dumps(detail, separators=(",", ":"))))
    # Two city spellings can slug alike (rare); keep the busier.
    seen: dict[tuple[str, str], tuple] = {}
    for row in out:
        k = (row[0], row[1])
        if k not in seen or row[4] > seen[k][4]:
            seen[k] = row
    return list(seen.values())


def field_options_doc(fields: dict[str, Counter]) -> dict:
    """Each field's values, busiest first, as the case search reads them."""
    return {key: [{"value": v, "n": n} for v, n in fields.get(col, Counter()).most_common(FIELD_OPTIONS_MAX)]
            for col, key in FIELD_OPTIONS.items()}


def write_field_options(db, doc: dict) -> None:
    db.execute("CREATE TABLE IF NOT EXISTS perm_docs (key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER)")
    write_doc(db, "case_field_options", doc)


def occupation_slugs(db) -> dict[str, str]:
    out: dict[str, str] = {}
    for r in rows_of(db.execute("SELECT code, slug FROM perm_entities WHERE kind = 'occupation' AND code IS NOT NULL")):
        code, slug = str(r[0]), str(r[1])
        out.setdefault(code[:7], slug)
    return out


def write_groups(db, rows: list[tuple]) -> None:
    cols = ["kind", "slug", "key", "label", "total", "certified", "denied", "withdrawn",
            "median_wage", "fy_from", "fy_to", "detail"]
    # The delete rides in the same request as the first inserts, so a reader
    # between them sees at worst a partial table, never an empty one for long.
    run_stmts(db, [stmt("DELETE FROM perm_groups"),
                   *insert_stmts("perm_groups", cols, rows, ROWS_PER_STMT)], STMTS_PER_REQUEST)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    db = Turso()
    t = time.time()

    def both():
        yield from read_table(db, "perm_cases")
        try:
            yield from read_table(db, "perm_cases_history", since=GROUPS_FROM_DATE)
        except Exception as exc:  # noqa: BLE001 - a missing history still builds today's groups
            log(f"  perm_cases_history unreadable ({exc}); groups cover perm_cases only")

    fields: dict[str, Counter] = defaultdict(Counter)
    groups, votes, titles = aggregate(both(), fields)
    from ingest_perm_history import employer_page_slugs
    rows = build_rows(groups, votes, titles, occupation_slugs(db), employer_page_slugs(db))
    by_kind = Counter(r[0] for r in rows)
    options = field_options_doc(fields)
    log(f"  {len(rows):,} groups over the floor of {FLOOR} ({dict(by_kind)}) in {time.time() - t:,.0f}s")
    log("  field options: " + ", ".join(f"{k} {len(v)}" for k, v in options.items()))
    if args.dry_run:
        for kind in ("city", "industry", "country"):
            top = sorted((r for r in rows if r[0] == kind), key=lambda r: -r[4])[:5]
            log(f"  {kind}: " + "; ".join(f"{r[3]} {r[4]:,}" for r in top))
        return 0
    db.script(SCHEMA)
    write_groups(db, rows)
    # An empty field list (the worker columns not loaded yet) is not written
    # over a good doc; the search falls back to perm_country_years meanwhile.
    if options["citizenship"]:
        write_field_options(db, options)
    got = int(db.scalar("SELECT COUNT(*) FROM perm_groups") or 0)
    ok = got == len(rows)
    log(f"  VERIFY perm_groups {got:,} of {len(rows):,}")
    record_run(db, "build_groups.py", status="ok" if ok else "failed", rows_written=len(rows),
               note=f"{dict(by_kind)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
