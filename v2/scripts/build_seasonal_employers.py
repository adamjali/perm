#!/usr/bin/env python3
"""The employers that file H-2A, H-2B or CW-1 and nothing that already has a page.

Writes `seasonal_employer_index`: one row per employer slug found in DOL's
seasonal records (the live table `seasonal_case_status` and the published
`seasonal_cases`) whose slug resolves to no employer page yet: not a published
PERM employer (`perm_entities`), not an alias of one, not a live-only PERM
employer (`perm_live_only_index`). The employer page renders these from this
table (src/lib/turso/seasonalEmployers.ts), and the sitemap lists every row in
`seasonal-employer-N.xml` through rank windows, the same shape as the live-only
family.

Ranked densely by first filing then slug, so a night's arrivals mostly append
and the windows stay stable. `last_changed` (the sitemap's lastmod) is the
newest day any of the employer's cases changed as the page shows it: a
decision date, the day the live status last moved, or the filing date.

Written as a diff (only changed rows), with one normaliser for both sides
(libSQL returns integers as strings). The slugs of changed rows are added to
`changed-employer-slugs.json` when that file exists, so the nightly expiry
refreshes these pages with the rest.

Usage:
    python3 scripts/build_seasonal_employers.py            # rebuild the index
    python3 scripts/build_seasonal_employers.py --dry-run  # read and report only
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_flag_serials import prefix_of  # noqa: E402
from lib_turso import Turso, et_date, record_run, rows_of  # noqa: E402

TABLE = "seasonal_employer_index"
COLS = ["slug", "name", "cases", "h2a", "h2b", "cw1", "first_filed", "rank", "last_changed"]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cases INTEGER NOT NULL,
        h2a INTEGER NOT NULL,
        h2b INTEGER NOT NULL,
        cw1 INTEGER NOT NULL,
        first_filed TEXT,
        rank INTEGER NOT NULL,
        last_changed TEXT)""",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_rank ON {TABLE} (rank)",
]
CHANGED_SLUGS_PATH = "changed-employer-slugs.json"
MAX_CHANGED_SLUGS = 800  # the revalidate route's MAX_PATHS

# Which visa a form prefix belongs to (src/lib/seasonalForms.ts holds the labels).
VISA_OF = {
    "H-300-": "h2a", "JO-A-300-": "h2a",
    "H-400-": "h2b", "P-400-": "h2b",
    "C-500-": "cw1", "P-500-": "cw1",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def day(v) -> str | None:
    s = "" if v is None else str(v)
    return s[:10] if len(s) >= 10 and s[4] == "-" else None


def taken_slugs(db: Turso) -> set[str]:
    """Every slug that already resolves to an employer page."""
    out: set[str] = set()
    for sql in ("SELECT slug FROM perm_entities WHERE kind = 'employer'",
                "SELECT slug FROM perm_entity_alias WHERE kind = 'employer'",
                "SELECT slug FROM perm_live_only_index"):
        try:
            out |= {str(r[0]) for r in rows_of(db.execute(sql))}
        except RuntimeError as e:
            # A table that doesn't exist yet takes nothing; any other failure
            # must stop the build, or every PERM employer would get a second page.
            if "no such table" not in str(e):
                raise
    return out


def build_rows(cases: dict[str, dict], taken: set[str]) -> list[list]:
    """One row per seasonal-only employer from {case_number: case} records."""
    by_slug: dict[str, dict] = {}
    for cn, c in cases.items():
        slug = c.get("slug")
        if not slug or slug in taken:
            continue
        rec = by_slug.setdefault(slug, {"names": {}, "cases": 0, "h2a": 0, "h2b": 0, "cw1": 0,
                                        "first": None, "last": None})
        rec["cases"] += 1
        visa = VISA_OF.get(prefix_of(cn) or "")
        if visa:
            rec[visa] += 1
        for name in c.get("names", ()):
            rec["names"][name] = rec["names"].get(name, 0) + 1
        filed = c.get("filed")
        if filed and (rec["first"] is None or filed < rec["first"]):
            rec["first"] = filed
        touched = c.get("changed")
        if touched and (rec["last"] is None or touched > rec["last"]):
            rec["last"] = touched
    ordered = sorted(by_slug.items(), key=lambda kv: (kv[1]["first"] or "9999", kv[0]))
    out = []
    for rank, (slug, rec) in enumerate(ordered, start=1):
        name = max(rec["names"], key=lambda n: (rec["names"][n], n)) if rec["names"] else slug
        out.append([slug, name, rec["cases"], rec["h2a"], rec["h2b"], rec["cw1"], rec["first"], rank, rec["last"]])
    return out


def read_cases(db: Turso) -> dict[str, dict]:
    """Both seasonal tables folded to one record per case number."""
    cases: dict[str, dict] = {}

    def fold(cn, slug, name, filed, changed) -> None:
        c = cases.setdefault(cn, {"slug": None, "names": [], "filed": None, "changed": None})
        if slug and not c["slug"]:
            c["slug"] = slug
        if name:
            c["names"].append(name)
        if filed and (c["filed"] is None or filed < c["filed"]):
            c["filed"] = filed
        if changed and (c["changed"] is None or changed > c["changed"]):
            c["changed"] = changed

    for r in rows_of(db.execute(
            "SELECT case_number, employer_slug, employer_name, filing_date, fetched_at FROM seasonal_case_status")):
        cn, slug, name, filed, fetched = r
        fold(str(cn), slug, name, day(filed), et_date(fetched) or day(filed))
    try:
        for r in rows_of(db.execute(
                "SELECT case_number, employer_slug, employer_name, received_date, decision_date FROM seasonal_cases")):
            cn, slug, name, received, decided = r
            fold(str(cn), slug, name, day(received), day(decided) or day(received))
    except RuntimeError as e:
        if "no such table" not in str(e):
            raise
    return cases


def norm(row) -> tuple:
    """One index row as comparable values, from either side (strings from libSQL)."""
    slug, name, cases_, h2a, h2b, cw1, first, rank, last = row
    return (str(slug), str(name), int(cases_ or 0), int(h2a or 0), int(h2b or 0), int(cw1 or 0),
            None if first is None else str(first), int(rank or 0), None if last is None else str(last))


def write_index(db: Turso, want: list[list]) -> tuple[int, int, list[str]]:
    for ddl in DDL:
        db.execute(ddl)
    stored = {norm(r)[0]: norm(r) for r in rows_of(db.execute(f"SELECT {','.join(COLS)} FROM {TABLE}"))}
    changed = [w for w in want if stored.get(w[0]) != norm(w)]
    wanted = {w[0] for w in want}
    gone = [k for k in stored if k not in wanted]
    for i in range(0, len(gone), 500):
        chunk = gone[i:i + 500]
        db.execute(f"DELETE FROM {TABLE} WHERE slug IN ({','.join('?' for _ in chunk)})", chunk)
    marks = "(" + ",".join("?" * len(COLS)) + ")"
    for i in range(0, len(changed), 200):
        chunk = changed[i:i + 200]
        db.execute(f"INSERT OR REPLACE INTO {TABLE} ({','.join(COLS)}) VALUES " + ",".join([marks] * len(chunk)),
                   [v for row in chunk for v in row])
        time.sleep(0.2)
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
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    started = time.time()
    db = Turso()
    taken = taken_slugs(db)
    cases = read_cases(db)
    want = build_rows(cases, taken)
    log(f"seasonal cases {len(cases):,}; employers with a page already {len(taken):,}; "
        f"seasonal-only employers {len(want):,}")
    if args.dry_run:
        for row in want[:5]:
            log(f"  {row}")
        return 0
    changed, gone, slugs = write_index(db, want)
    got = int(rows_of(db.execute(f"SELECT count(*) FROM {TABLE}"))[0][0] or 0)
    top = int(rows_of(db.execute(f"SELECT max(rank) FROM {TABLE}"))[0][0] or 0)
    ok = got == len(want) and top == len(want)
    expired = add_changed_slugs(slugs)
    log(f"  {'ok ' if ok else 'MISMATCH'} {TABLE} {got:,} of {len(want):,} "
        f"({changed:,} written, {gone:,} removed; max rank {top:,}); {expired:,} pages queued to expire")
    record_run(db, "build_seasonal_employers.py", status="ok" if ok else "failed",
               rows_written=changed, note=f"{len(want):,} seasonal-only employers", started_at=started)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
