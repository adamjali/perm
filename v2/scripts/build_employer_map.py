#!/usr/bin/env python3
"""Which employer page every spelling in every program belongs to.

DOL prints the name that went on each form, so one employer arrives under many
spellings across PERM, H-1B LCAs, wage requests and H-2A, H-2B and CW-1. Until
Oct 4 2026 an employer page found its non-PERM rows by a TEXT PREFIX of its
name, which both over- and under-counted (measured on the 40 busiest PERM
employers):

* over: Intel's page counted 8,219 LCAs filed by Intellectt, Inteli Platforms
  and Inteliroute (39% over), and Apple's counted Apple Tree Dental and an
  Applebee's franchise group;
* under, had the prefix been made exact: "Salesforce.com, Inc." (5,645 LCAs),
  "JPMORGAN CHASE &amp; CO." and "FMR LLC d/b/a Fidelity Investments".

This builds `employer_page_map`: for every employer slug in every program
table, the ONE page its rows belong to, by `program_key` equality
(entity_identity.py), in this order:

1. a published PERM employer (`perm_entities`): its own slug, an alias of it
   (`perm_entity_alias`), or a spelling whose key equals one of its names';
2. a live-only PERM employer (`perm_live_only_index`), the same way;
3. otherwise an employer with no PERM page, grouped by key: one page per group
   (`employer_other_index`), for every employer holding H-1B, wage-request or
   seasonal filings. A group keeps a slug already published (by an earlier
   build of this table, or as an Oct 3 seasonal-only page) when it holds one,
   so a page's URL doesn't move when its spellings' volumes shift. A spelling
   whose group merged into another keeps a map row, so its old URL can
   redirect to the page it now belongs to.

USCIS's H-1B approvals and the lottery FOIA rows map to pages too, but never
make a page on their own: a page needs a filing we hold.

Counts in `employer_other_index` are published rows plus live rows DOL hasn't
published yet, by program, decided by case-number prefix (a P-400 wage
request is H-2B, not a PERM wage request). Both tables are written as diffs,
with one normaliser for both sides (libSQL returns integers as strings), and
the slugs of changed index rows join `changed-employer-slugs.json` when the
nightly sweep wrote one.

It also builds `firm_page_map`, the same thing for law firms: the H-1B,
wage-request and seasonal files key a firm by its printed name
(`attorney_slug`), and a firm page reads every spelling the map assigns it.
Firms are matched by `program_key` and then by the attorney-only typo rules
(`typo_aliases`), over every program's spellings at once, so "Fragomen Del
Rey Bersen Loewy" in an LCA reaches Fragomen's page. Only firms with a PERM
page get one; a spelling that lands on no page maps to nothing.

Usage:
    python3 scripts/build_employer_map.py            # rebuild all three tables
    python3 scripts/build_employer_map.py --dry-run  # read and report only
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entity_identity import program_key, typo_aliases  # noqa: E402
from lib_turso import Turso, et_date, record_run, rows_of  # noqa: E402

MAP = "employer_page_map"
INDEX = "employer_other_index"
MAP_COLS = ["source_slug", "page_slug", "page_kind", "key"]
INDEX_COLS = ["slug", "name", "cases", "perm", "lca", "pwd", "h2a", "h2b", "cw1", "first_filed", "rank", "last_changed"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {MAP} (
        source_slug TEXT PRIMARY KEY,
        page_slug TEXT NOT NULL,
        page_kind TEXT NOT NULL,
        key TEXT NOT NULL)""",
    f"CREATE INDEX IF NOT EXISTS {MAP}_page ON {MAP} (page_slug)",
    # The browser extension's lookup (src/lib/api/employerLookup.ts) finds a
    # printed name's page by its program key; it reads this column only once
    # the index exists, since without it every lookup walks the whole map.
    f"CREATE INDEX IF NOT EXISTS {MAP}_key ON {MAP} (key)",
    f"""CREATE TABLE IF NOT EXISTS {INDEX} (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cases INTEGER NOT NULL,
        perm INTEGER NOT NULL,
        lca INTEGER NOT NULL,
        pwd INTEGER NOT NULL,
        h2a INTEGER NOT NULL,
        h2b INTEGER NOT NULL,
        cw1 INTEGER NOT NULL,
        first_filed TEXT,
        rank INTEGER NOT NULL,
        last_changed TEXT)""",
    f"CREATE INDEX IF NOT EXISTS {INDEX}_rank ON {INDEX} (rank)",
]
FIRM_MAP = "firm_page_map"
FIRM_MAP_COLS = ["source_slug", "page_slug", "key"]
DDL += [
    f"""CREATE TABLE IF NOT EXISTS {FIRM_MAP} (
        source_slug TEXT PRIMARY KEY,
        page_slug TEXT NOT NULL,
        key TEXT NOT NULL)""",
    f"CREATE INDEX IF NOT EXISTS {FIRM_MAP}_page ON {FIRM_MAP} (page_slug)",
]
# The program tables that name the representing firm.
FIRM_SOURCES = ("lca_cases", "pwd_cases", "seasonal_cases")
CHANGED_SLUGS_PATH = "changed-employer-slugs.json"
MAX_CHANGED_SLUGS = 800  # the revalidate route's MAX_PATHS
WRITE_CHUNK = 400
WRITE_PAUSE_S = 0.3

# Which program a case-number prefix belongs to. Anything not listed (an older
# PERM form, a prefix DOL adds later) is counted under the table it came from.
PROGRAM_OF_PREFIX = {
    "P-100-": "pwd",
    "I-200-": "lca", "I-201-": "lca", "I-202-": "lca", "I-203-": "lca",
    "H-300-": "h2a", "JO-A-300-": "h2a",
    "H-400-": "h2b", "P-400-": "h2b",
    "C-500-": "cw1", "P-500-": "cw1",
}
FILING_PROGRAMS = ("perm", "lca", "pwd", "h2a", "h2b", "cw1")
PAGE_PROGRAMS = ("lca", "pwd", "h2a", "h2b", "cw1")  # what earns a page with no PERM record

# (table, name column, first-date expr, last-date expr, default program,
#  published tables a live row is checked against, so it isn't counted twice)
PREFIX_SQL = "substr(case_number, 1, length(case_number) - 12)"
CASE_SOURCES = [
    ("perm_cases", "employer_name", "received_date", "decision_date", "perm", ()),
    ("perm_cases_history", "employer_name", "received_date", "decision_date", "perm", ()),
    ("perm_live_recent", "employer_name", "filing_date", "filing_date", "perm", ()),
    ("pwd_cases", "employer_name", "received_date", "decision_date", "pwd", ()),
    ("lca_cases", "employer_name", "received_date", "decision_date", "lca", ()),
    ("seasonal_cases", "employer_name", "received_date", "decision_date", "h2a", ()),
    ("pwd_case_status", "employer_name", "filing_date", "fetched_at", "pwd", ("pwd_cases",)),
    ("lca_case_status", "employer_name", "filing_date", "fetched_at", "lca", ("lca_cases",)),
    ("seasonal_case_status", "employer_name", "filing_date", "fetched_at", "h2a", ("seasonal_cases", "pwd_cases")),
]
# Aggregate tables: they map to a page, they never make one.
NAME_SOURCES = [
    ("uscis_h1b_employers", "employer"),
    ("h1b_lottery_employers", "employer"),
]


def log(msg: str) -> None:
    print(msg, flush=True)


def day(v) -> str | None:
    s = "" if v is None else str(v)
    return s[:10] if len(s) >= 10 and s[4] == "-" else None


def missing_table(e: Exception) -> bool:
    return "no such table" in str(e)


def new_slug() -> dict:
    return {"names": Counter(), "programs": Counter(), "first": None, "last": None}


def fold(slugs: dict, slug, name, n, program, first, last) -> None:
    if not slug:
        return
    rec = slugs.setdefault(str(slug), new_slug())
    n = int(n or 0)
    if name:
        rec["names"][str(name)] += n or 1
    if program:
        rec["programs"][program] += n
    if first and (rec["first"] is None or first < rec["first"]):
        rec["first"] = first
    if last and (rec["last"] is None or last > rec["last"]):
        rec["last"] = last


def read_sources(db: Turso) -> dict[str, dict]:
    """Every employer slug in every program table, with names and counts."""
    slugs: dict[str, dict] = {}
    for table, name_col, first_col, last_col, default, published in CASE_SOURCES:
        live = bool(published)
        not_published = "".join(
            f" AND NOT EXISTS (SELECT 1 FROM {p} WHERE {p}.case_number = s.case_number)" for p in published)
        sql = (f"SELECT s.employer_slug, s.{name_col}, {PREFIX_SQL.replace('case_number', 's.case_number')}, "
               f"COUNT(*), MIN(s.{first_col}), MAX(s.{last_col}) FROM {table} s "
               f"WHERE s.employer_slug IS NOT NULL{not_published} "
               f"GROUP BY s.employer_slug, s.{name_col}, 3")
        try:
            rows = rows_of(db.execute(sql))
        except Exception as e:  # noqa: BLE001 (the client raises RuntimeError, SQLite OperationalError)
            if missing_table(e):
                log(f"  {table}: not present, skipped")
                continue
            raise
        for slug, name, prefix, n, first, last in rows:
            program = "perm" if default == "perm" else PROGRAM_OF_PREFIX.get(str(prefix or ""), default)
            fold(slugs, slug, name, n, program, day(first),
                 (et_date(last) or day(last)) if live else day(last))
        log(f"  {table}: {len(rows):,} slug and name pairs")
    for table, name_col in NAME_SOURCES:
        try:
            rows = rows_of(db.execute(
                f"SELECT employer_slug, {name_col}, COUNT(*) FROM {table} "
                f"WHERE employer_slug IS NOT NULL GROUP BY employer_slug, {name_col}"))
        except Exception as e:  # noqa: BLE001 (the client raises RuntimeError, SQLite OperationalError)
            if missing_table(e):
                continue
            raise
        for slug, name, _n in rows:
            fold(slugs, slug, name, 0, None, None, None)
        log(f"  {table}: {len(rows):,} slug and name pairs")
    return slugs


def read_pages(db: Turso) -> dict:
    """The pages that exist already: published, aliased and live-only PERM employers."""
    perm = {str(s): (str(n or ""), str(k or ""), int(t or 0)) for s, n, k, t in rows_of(db.execute(
        "SELECT slug, name, merge_key, total FROM perm_entities WHERE kind = 'employer'"))}
    alias = {str(s): str(t) for s, t in rows_of(db.execute(
        "SELECT slug, target_slug FROM perm_entity_alias WHERE kind = 'employer'"))}
    try:
        live = {str(s): (str(n or ""), int(c or 0)) for s, n, c in rows_of(db.execute(
            "SELECT slug, name, cases FROM perm_live_only_index"))}
    except Exception as e:  # noqa: BLE001
        if not missing_table(e):
            raise
        live = {}
    # Slugs already published as pages with no PERM record: this table's own
    # last build, and the Oct 3 seasonal-only family it replaced. The ranks
    # this table already gave are kept (see `plan`).
    published: dict[str, int] = {}
    ranks: dict[str, int] = {}
    for table in (INDEX, "seasonal_employer_index"):
        try:
            cols = "slug, cases, rank" if table == INDEX else "slug, cases, NULL"
            for s, c, rank in rows_of(db.execute(f"SELECT {cols} FROM {table}")):
                published[str(s)] = max(published.get(str(s), 0), int(c or 0))
                if rank is not None:
                    ranks[str(s)] = int(rank)
        except Exception as e:  # noqa: BLE001
            if not missing_table(e):
                raise
    return {"perm": perm, "alias": alias, "live": live, "published": published, "ranks": ranks}


def modal_name(names: Counter) -> str | None:
    if not names:
        return None
    return max(names, key=lambda n: (names[n], n))


def plan(slugs: dict[str, dict], pages: dict) -> tuple[list[list], list[list], dict]:
    """(map rows, index rows, stats). Pure, for the test."""
    perm, alias, live, published_pages = pages["perm"], pages["alias"], pages["live"], pages["published"]

    # Every key a published page answers to: its name, its merge key, and every
    # spelling the PERM tables hold under its slug. The busier page wins a key
    # two pages share.
    perm_keys: dict[str, tuple[int, str]] = {}

    def claim(keys: dict, key: str, weight: int, slug: str) -> None:
        if key and (key not in keys or (weight, slug) > keys[key]):
            keys[key] = (weight, slug)

    for slug, (name, merge_key, total) in perm.items():
        for key in {program_key(name), program_key(merge_key)}:
            claim(perm_keys, key, total, slug)
        for name_ in slugs.get(slug, new_slug())["names"]:
            claim(perm_keys, program_key(name_), total, slug)
    live_keys: dict[str, tuple[int, str]] = {}
    for slug, (name, cases) in live.items():
        claim(live_keys, program_key(name), cases, slug)
        for name_ in slugs.get(slug, new_slug())["names"]:
            claim(live_keys, program_key(name_), cases, slug)

    rows: list[list] = []
    groups: dict[str, list[str]] = defaultdict(list)
    stats = Counter()
    for slug, rec in slugs.items():
        key = program_key(modal_name(rec["names"]) or slug.replace("-", " "))
        if slug in perm:
            rows.append([slug, slug, "perm", key]); stats["perm_own"] += 1
        elif slug in alias and alias[slug] in perm:
            rows.append([slug, alias[slug], "perm", key]); stats["perm_alias"] += 1
        elif slug in live:
            rows.append([slug, slug, "live", key]); stats["live_own"] += 1
        elif key and key in perm_keys:
            rows.append([slug, perm_keys[key][1], "perm", key]); stats["perm_key"] += 1
        elif key and key in live_keys:
            rows.append([slug, live_keys[key][1], "live", key]); stats["live_key"] += 1
        else:
            groups[key or f"slug:{slug}"].append(slug)

    index: list[dict] = []
    for key, members in groups.items():
        programs = Counter()
        names = Counter()
        first = last = None
        for s in members:
            rec = slugs[s]
            programs.update(rec["programs"])
            names.update(rec["names"])
            if rec["first"] and (first is None or rec["first"] < first):
                first = rec["first"]
            if rec["last"] and (last is None or rec["last"] > last):
                last = rec["last"]
        if not any(programs[p] for p in PAGE_PROGRAMS):
            stats["no_filings"] += len(members)
            continue  # USCIS or lottery rows alone, or PERM rows with no page: no page to point at
        published = [s for s in members if s in published_pages]
        if published:
            page = max(published, key=lambda s: (published_pages[s], -len(s), s))
        else:
            page = max(members, key=lambda s: (sum(slugs[s]["programs"].values()), -len(s), s))
        for s in members:
            rows.append([s, page, "other", key if not key.startswith("slug:") else ""])
        stats["other_slugs"] += len(members)
        index.append({"slug": page, "name": modal_name(names) or page, "programs": programs,
                      "first": first, "last": last})

    # RANKS STAY PUT. The sitemap reads this table in rank windows, so a rank
    # is an address. Ranked densely by first filing, one new employer with an
    # old first filing shifted everyone after it: the second build on Oct 4
    # 2026 rewrote 177,542 of 182,196 rows for 24 newcomers. An employer keeps
    # the rank it was given; newcomers go after the last one, oldest first
    # filing first. A removed employer leaves a gap, which a window tolerates.
    prior = pages.get("ranks", {})
    kept = [r for r in index if r["slug"] in prior]
    fresh = sorted((r for r in index if r["slug"] not in prior), key=lambda r: (r["first"] or "9999", r["slug"]))
    next_rank = max((prior[r["slug"]] for r in kept), default=0) + 1
    for r in kept:
        r["rank"] = prior[r["slug"]]
    for offset, r in enumerate(fresh):
        r["rank"] = next_rank + offset
    index = sorted(kept + fresh, key=lambda r: r["rank"])
    index_rows = []
    for r in index:
        p = r["programs"]
        rank = r["rank"]
        cases = sum(p[k] for k in PAGE_PROGRAMS)
        index_rows.append([r["slug"], r["name"], cases, p["perm"], p["lca"], p["pwd"], p["h2a"], p["h2b"], p["cw1"],
                           r["first"], rank, r["last"]])
    stats["other_pages"] = len(index_rows)
    rows.sort(key=lambda r: r[0])
    return rows, index_rows, dict(stats)


def read_firm_sources(db: Turso) -> dict[str, Counter]:
    """Every firm spelling in the program files: slug -> {printed name: filings}."""
    spellings: dict[str, Counter] = defaultdict(Counter)
    for table in FIRM_SOURCES:
        try:
            rows = rows_of(db.execute(
                f"SELECT attorney_slug, attorney_name, COUNT(*) FROM {table} "
                f"WHERE attorney_slug IS NOT NULL GROUP BY attorney_slug, attorney_name"))
        except Exception as e:  # noqa: BLE001
            if missing_table(e) or "no such column" in str(e):
                log(f"  {table}: no firm column, skipped")
                continue
            raise
        for slug, name, n in rows:
            if slug and name:
                spellings[str(slug)][str(name)] += int(n or 0)
        log(f"  {table}: {len(rows):,} firm slug and name pairs")
    return spellings


def read_firm_pages(db: Turso) -> dict[str, tuple[str, str, int]]:
    """Every law-firm page: slug -> (name, merge key, total)."""
    return {str(s): (str(n or ""), str(k or ""), int(t or 0)) for s, n, k, t in rows_of(db.execute(
        "SELECT slug, name, merge_key, total FROM perm_entities WHERE kind = 'attorney'"))}


def plan_firms(spellings: dict[str, Counter], pages: dict[str, tuple[str, str, int]]) -> tuple[list[list], dict]:
    """(map rows, stats): each program spelling of a firm that has a page. Pure, for the test."""
    page_of_key: dict[str, tuple[int, str]] = {}
    totals: Counter = Counter()
    for slug, (name, merge_key, total) in pages.items():
        for key in {program_key(name), program_key(merge_key)}:
            if key and (key not in page_of_key or (total, slug) > page_of_key[key]):
                page_of_key[key] = (total, slug)
            if key:
                totals[key] += total
    key_of: dict[str, str] = {}
    for slug, names in spellings.items():
        key = program_key(modal_name(names) or "")
        if key:
            key_of[slug] = key
            totals[key] += sum(names.values())
    # The attorney-only typo rules, over every spelling in every file at once.
    root = typo_aliases(dict(totals), "attorney")
    rows: list[list] = []
    stats = Counter()
    for slug, key in sorted(key_of.items()):
        # A key that IS a page's key stays on that page: the typo rules only
        # place spellings that have no page of their own.
        own = page_of_key.get(key)
        page = own or page_of_key.get(root.get(key, key))
        if page is None:
            stats["no_page"] += 1
            continue
        rows.append([slug, page[1], key])
        stats["key" if own else "typo"] += 1
    return rows, dict(stats)


def norm(row: list, cols: list[str]) -> tuple:
    ints = {"cases", "perm", "lca", "pwd", "h2a", "h2b", "cw1", "rank"}
    return tuple(int(v or 0) if c in ints else (None if v is None else str(v)) for c, v in zip(cols, row))


def write_diff(db: Turso, table: str, cols: list[str], want: list[list]) -> tuple[int, int, list[str]]:
    stored = {}
    for r in rows_of(db.execute(f"SELECT {','.join(cols)} FROM {table}")):
        n = norm(list(r), cols)
        stored[n[0]] = n
    changed = [w for w in want if stored.get(w[0]) != norm(w, cols)]
    wanted = {w[0] for w in want}
    gone = [k for k in stored if k not in wanted]
    for i in range(0, len(gone), 500):
        chunk = gone[i:i + 500]
        db.execute(f"DELETE FROM {table} WHERE {cols[0]} IN ({','.join('?' for _ in chunk)})", chunk)
        time.sleep(WRITE_PAUSE_S)
    marks = "(" + ",".join("?" * len(cols)) + ")"
    for i in range(0, len(changed), WRITE_CHUNK):
        chunk = changed[i:i + WRITE_CHUNK]
        db.execute(f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES " + ",".join([marks] * len(chunk)),
                   [v for row in chunk for v in row])
        time.sleep(WRITE_PAUSE_S)
    return len(changed), len(gone), [w[0] for w in changed] + gone


def add_changed_slugs(slugs: list[str], path: str = CHANGED_SLUGS_PATH) -> int:
    """Append these pages to the nightly expiry list, if the sweep wrote one."""
    p = pathlib.Path(path)
    if not p.exists() or not slugs:
        return 0
    try:
        doc = json.loads(p.read_text() or "{}")
    except ValueError:
        doc = {}
    have = list(doc.get("slugs") or [])
    room = max(0, MAX_CHANGED_SLUGS - len(have))
    seen = set(have)
    add = [s for s in slugs if s not in seen][:room]
    doc["slugs"] = have + add
    p.write_text(json.dumps(doc))
    return len(add)


def main() -> int:
    global WRITE_PAUSE_S
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--show", nargs="*", default=[], metavar="PAGE_SLUG",
                    help="with --dry-run: every spelling that lands on these pages, with its counts")
    ap.add_argument("--biggest", type=int, default=0, metavar="N",
                    help="with --dry-run: the N pages that gather the most spellings")
    ap.add_argument("--pause", type=float, default=WRITE_PAUSE_S, metavar="SECONDS",
                    help="pause between write requests; the first full build writes about 515,000 rows")
    args = ap.parse_args()
    WRITE_PAUSE_S = max(0.0, args.pause)
    started = time.time()
    db = Turso()
    slugs = read_sources(db)
    pages = read_pages(db)
    rows, index_rows, stats = plan(slugs, pages)
    log(f"employer slugs {len(slugs):,}; map rows {len(rows):,}; {stats}")
    firm_rows, firm_stats = plan_firms(read_firm_sources(db), read_firm_pages(db))
    log(f"firm spellings mapped {len(firm_rows):,}; {firm_stats}")
    if args.dry_run:
        for row in index_rows[:5]:
            log(f"  {row}")
        by_page: dict[str, list[list]] = defaultdict(list)
        for r in rows:
            by_page[r[1]].append(r)
        for page in args.show:
            log(f"page {page}: {len(by_page.get(page, []))} spellings")
            for src, _page, kind, key in by_page.get(page, []):
                rec = slugs.get(src, new_slug())
                log(f"  {kind} {src!r} key={key!r} {dict(rec['programs'])} {modal_name(rec['names'])!r}")
        for page, members in sorted(by_page.items(), key=lambda kv: -len(kv[1]))[:args.biggest]:
            log(f"  {len(members):>4} spellings -> {members[0][2]} {page!r}: "
                + ", ".join(m[0] for m in members[:6]))
        return 0
    for ddl in DDL:
        db.execute(ddl)
    m_changed, m_gone, _ = write_diff(db, MAP, MAP_COLS, rows)
    f_changed, f_gone, _ = write_diff(db, FIRM_MAP, FIRM_MAP_COLS, firm_rows)
    i_changed, i_gone, page_slugs = write_diff(db, INDEX, INDEX_COLS, index_rows)
    got_map = int(rows_of(db.execute(f"SELECT count(*) FROM {MAP}"))[0][0] or 0)
    got_index = int(rows_of(db.execute(f"SELECT count(*) FROM {INDEX}"))[0][0] or 0)
    top = int(rows_of(db.execute(f"SELECT max(rank) FROM {INDEX}"))[0][0] or 0)
    got_firms = int(rows_of(db.execute(f"SELECT count(*) FROM {FIRM_MAP}"))[0][0] or 0)
    want_top = max((r[INDEX_COLS.index("rank")] for r in index_rows), default=0)
    ok = (got_map == len(rows) and got_index == len(index_rows) and top == want_top
          and got_firms == len(firm_rows))
    expired = add_changed_slugs(page_slugs)
    log(f"  {'ok ' if ok else 'MISMATCH'} {MAP} {got_map:,} of {len(rows):,} ({m_changed:,} written, {m_gone:,} removed); "
        f"{INDEX} {got_index:,} of {len(index_rows):,} ({i_changed:,} written, {i_gone:,} removed, max rank {top:,}); "
        f"{FIRM_MAP} {got_firms:,} of {len(firm_rows):,} ({f_changed:,} written, {f_gone:,} removed); "
        f"{expired:,} pages queued to expire")
    record_run(db, "build_employer_map.py", status="ok" if ok else "failed", rows_written=m_changed + i_changed + f_changed,
               note=f"{len(index_rows):,} employers with no PERM page; {len(rows):,} spellings mapped",
               started_at=started)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
