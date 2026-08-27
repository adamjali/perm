#!/usr/bin/env python3
"""Everything an entity page needs beyond its own four numbers.

    python3 scripts/build_entity_detail.py --cache /tmp/cases.jsonl
    python3 scripts/build_entity_detail.py --dry-run

Two tables, from two different corpora, and the difference between them is
the point:

`perm_entity_pending` comes from `perm_case_status`, the LIVE per-case
mirror. It is the only source in the building that knows a case is still
waiting - DOL's disclosure files carry a decision date on every row, so a
pending case appears in none of them. This is what lets a sponsor page say
"1,768 of their cases are in analyst review right now" instead of only
reciting history.

`perm_entity_facets` comes from `perm_cases`, the decided corpus, and says
what an entity's filings are MADE OF: which occupations, which states, which
firm filed them, and for a firm, which employers it files for. Rolled up at
build time because the alternative is a GROUP BY over 373,939 rows on every
one of 21,000 page regenerations.

## Scope, and why it is not every entity

Facets are built only for entities that have a page (`MIN_TOTAL_FOR_PAGE`,
three filings). Below that the facet IS the entity - one case, one
occupation, one state - so the row would carry no information and there are
55,000 of them.

## Two joins that do not line up, and are not made to

The live mirror holds 88,861 distinct employer spellings against the decided
corpus's 71,512 entities, because the mirror includes cases filed after the
last disclosure file was cut. An employer that appears only in the mirror has
no entity row and therefore no page; its pending count is real and is simply
not reachable from anywhere yet. The unmatched share is REPORTED rather than
silently dropped - a join whose miss rate nobody prints is a join nobody can
trust.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entity_identity import entity_key  # noqa: E402
from lib_turso import Turso, lit  # noqa: E402

PAGE_FLOOR = 3          # mirrors MIN_TOTAL_FOR_PAGE in src/lib/entityPayload.ts
TOP_N = 6               # facet rows kept per entity per facet
CHUNK = 400


def log(m: str) -> None:
    print(m, flush=True)


DDL = [
    """CREATE TABLE IF NOT EXISTS perm_entity_pending (
         kind      TEXT NOT NULL,
         slug      TEXT NOT NULL,
         tracked   INTEGER NOT NULL,
         pending   INTEGER NOT NULL,
         stages    TEXT NOT NULL,
         oldest    TEXT,
         PRIMARY KEY (kind, slug)
       )""",
    "CREATE INDEX IF NOT EXISTS perm_entity_pending_rank "
    "ON perm_entity_pending (kind, pending DESC)",
    """CREATE TABLE IF NOT EXISTS perm_entity_facets (
         kind      TEXT NOT NULL,
         slug      TEXT NOT NULL,
         facet     TEXT NOT NULL,
         pos       INTEGER NOT NULL,
         key       TEXT,
         label     TEXT NOT NULL,
         n         INTEGER NOT NULL,
         certified INTEGER NOT NULL,
         denied    INTEGER NOT NULL,
         PRIMARY KEY (kind, slug, facet, pos)
       )""",
]


def rows_of(res) -> list[list]:
    return res["response"]["result"]["rows"]


def cell(c):
    return None if c["type"] == "null" else c["value"]


# ---------------------------------------------------------------------------
# Slug lookup
# ---------------------------------------------------------------------------

def slug_maps(db: Turso):
    """merge_key -> (slug, total) per kind, plus code -> slug for occupations."""
    out: dict[str, dict[str, tuple[str, int]]] = {}
    for kind in ("employer", "attorney", "occupation"):
        m: dict[str, tuple[str, int]] = {}
        off = 0
        while True:
            res = db.execute(
                "SELECT merge_key, slug, total, code FROM perm_entities WHERE kind = ? "
                "ORDER BY rank LIMIT 20000 OFFSET ?", [kind, off])
            rs = rows_of(res)
            for r in rs:
                key = cell(r[3]) if kind == "occupation" else cell(r[0])
                if key:
                    m[key] = (cell(r[1]), int(cell(r[2])))
            if len(rs) < 20000:
                break
            off += 20000
        out[kind] = m
        log(f"  {kind:11s} {len(m):,} slugs")
    return out


# ---------------------------------------------------------------------------
# Pending, from the live mirror
# ---------------------------------------------------------------------------

def build_pending(db: Turso, maps) -> list[dict]:
    """Per-employer live queue position, aggregated server-side.

    A GROUP BY over 412,865 rows returns 88,861, which is the difference
    between a query and a download. Stage counts come back in a second
    aggregate restricted to `is_final = 0`, so the two never disagree about
    what "pending" means: the mirror's own flag decides, not a status list
    kept here that would drift the first time DOL invents a stage.
    """
    totals = rows_of(db.execute(
        "SELECT employer_name, count(*), sum(1 - is_final), min(CASE WHEN is_final = 0 "
        "THEN filing_date END) FROM perm_case_status WHERE employer_name IS NOT NULL "
        "AND employer_name <> '' GROUP BY employer_name"))
    stages = rows_of(db.execute(
        "SELECT employer_name, current_status, count(*) FROM perm_case_status "
        "WHERE is_final = 0 AND employer_name IS NOT NULL AND employer_name <> '' "
        "GROUP BY employer_name, current_status"))
    log(f"  mirror: {len(totals):,} employer spellings, {len(stages):,} spelling/stage pairs")

    emp = maps["employer"]
    acc: dict[str, dict] = {}
    matched = unmatched = unmatched_pending = 0
    for r in totals:
        name = cell(r[0])
        key = entity_key(name)
        hit = emp.get(key)
        pend = int(cell(r[2]) or 0)
        if hit is None:
            unmatched += 1
            unmatched_pending += pend
            continue
        matched += 1
        slug = hit[0]
        d = acc.setdefault(slug, {"tracked": 0, "pending": 0, "stages": Counter(), "oldest": None})
        d["tracked"] += int(cell(r[1]) or 0)
        d["pending"] += pend
        oldest = cell(r[3])
        if oldest and (d["oldest"] is None or oldest < d["oldest"]):
            d["oldest"] = oldest

    for r in stages:
        hit = emp.get(entity_key(cell(r[0])))
        if hit is None:
            continue
        d = acc.get(hit[0])
        if d is not None:
            d["stages"][cell(r[1]) or "UNKNOWN"] += int(cell(r[2]) or 0)

    share = unmatched_pending / max(1, sum(int(cell(r[2]) or 0) for r in totals)) * 100
    log(f"  matched {matched:,} spellings to an entity, {unmatched:,} unmatched "
        f"({unmatched_pending:,} pending cases, {share:.1f}% of the live backlog) - "
        f"those are filings newer than the last disclosure file")

    out = [{"kind": "employer", "slug": slug, "tracked": d["tracked"], "pending": d["pending"],
            "stages": json.dumps(dict(d["stages"].most_common()), separators=(",", ":")),
            "oldest": d["oldest"]}
           for slug, d in acc.items() if d["tracked"] > 0]
    top = sorted(out, key=lambda r: -r["pending"])[:10]
    log("  top by pending:")
    for r in top:
        log(f"      {r['pending']:>6,} pending of {r['tracked']:>6,} tracked   /{r['slug']}")
    return out


# ---------------------------------------------------------------------------
# Facets, from the decided corpus
# ---------------------------------------------------------------------------

def read_cases(db: Turso, cache: str | None):
    cols = ["employer_name", "attorney_name", "soc_code", "soc_title", "status", "state"]
    if cache:
        with open(cache) as f:
            for line in f:
                yield json.loads(line)
        return
    off = 0
    while True:
        res = db.execute(
            f"SELECT {','.join(cols)} FROM perm_cases ORDER BY rowid LIMIT 25000 OFFSET ?", [off])
        rs = rows_of(res)
        for r in rs:
            yield {c: cell(x) for c, x in zip(cols, r)}
        if len(rs) < 25000:
            return
        off += 25000


def build_facets(db: Turso, maps, cache) -> list[list]:
    emp, att, occ = maps["employer"], maps["attorney"], maps["occupation"]
    # (kind, slug, facet) -> label-key -> [n, certified, denied, display label]
    acc: dict[tuple, dict[str, list]] = defaultdict(dict)

    def add(kind, slug, facet, key, label, cert, den):
        if not slug or not label:
            return
        bucket = acc[(kind, slug, facet)]
        row = bucket.get(key)
        if row is None:
            bucket[key] = [1, cert, den, label]
        else:
            row[0] += 1
            row[1] += cert
            row[2] += den

    n = 0
    for r in read_cases(db, cache):
        n += 1
        st = (r.get("status") or "").lower()
        cert = 1 if st == "certified" else 0
        den = 1 if st == "denied" else 0

        e = emp.get(entity_key(r["employer_name"])) if r.get("employer_name") else None
        a = att.get(entity_key(r["attorney_name"])) if r.get("attorney_name") else None
        code = r.get("soc_code")
        o = occ.get(code) if code else None
        state = r.get("state") or None
        occ_label = (o and o[0]) and (r.get("soc_title") or code)

        # The occupation facet's key is the occupation's SLUG, not its SOC
        # code: it is a link target, and /perm-wages/[slug] is keyed on the
        # entity slug. Storing the code here produced a facet list whose
        # every link 404'd while looking perfectly correct in the table.
        if e and e[1] >= PAGE_FLOOR:
            if o:
                add("employer", e[0], "occupation", o[0], occ_label or code, cert, den)
            if state:
                add("employer", e[0], "state", state, state, cert, den)
            if a:
                add("employer", e[0], "attorney", a[0], r["attorney_name"], cert, den)
        if a and a[1] >= PAGE_FLOOR:
            if e:
                add("attorney", a[0], "employer", e[0], r["employer_name"], cert, den)
            if o:
                add("attorney", a[0], "occupation", o[0], occ_label or code, cert, den)
            if state:
                add("attorney", a[0], "state", state, state, cert, den)
        if o and o[1] >= PAGE_FLOOR:
            if e:
                add("occupation", o[0], "employer", e[0], r["employer_name"], cert, den)
            if state:
                add("occupation", o[0], "state", state, state, cert, den)
            if a:
                add("occupation", o[0], "attorney", a[0], r["attorney_name"], cert, den)
    log(f"  {n:,} cases -> {len(acc):,} (entity, facet) groups")

    out: list[list] = []
    for (kind, slug, facet), bucket in acc.items():
        # Ties broken on the key so a rebuild cannot reshuffle a page's
        # "top occupations" list without the underlying counts changing.
        ranked = sorted(bucket.items(), key=lambda kv: (-kv[1][0], kv[0]))[:TOP_N]
        for pos, (key, (cnt, cert, den, label)) in enumerate(ranked):
            out.append([kind, slug, facet, pos, key, label, cnt, cert, den])
    log(f"  {len(out):,} facet rows")
    return out


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def write_rows(db: Turso, table: str, cols: list[str], rows: list) -> None:
    """INSERT OR REPLACE - `lib_turso.pipeline` retries, and a retry after a
    lost response replays a write that already landed."""
    ph = "(" + ",".join("?" * len(cols)) + ")"
    head = f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES "
    pending = []
    for i in range(0, len(rows), CHUNK):
        batch = rows[i:i + CHUNK]
        args = [lit(r[c] if isinstance(r, dict) else r[j])
                for r in batch for j, c in enumerate(cols)]
        pending.append({"type": "execute",
                        "stmt": {"sql": head + ",".join([ph] * len(batch)), "args": args}})
        if len(pending) >= 4:
            db.pipeline(pending + [{"type": "close"}])
            pending = []
    if pending:
        db.pipeline(pending + [{"type": "close"}])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", help="NDJSON of perm_cases rows, for local iteration")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db = Turso()
    log("SLUGS")
    maps = slug_maps(db)
    log("PENDING")
    pending = build_pending(db, maps)
    log("FACETS")
    facets = build_facets(db, maps, args.cache)

    if args.dry_run:
        log("\nDRY RUN - nothing written")
        return 0

    log("WRITE")
    db.script(DDL)
    db.execute("DELETE FROM perm_entity_pending")
    db.execute("DELETE FROM perm_entity_facets")
    write_rows(db, "perm_entity_pending",
               ["kind", "slug", "tracked", "pending", "stages", "oldest"], pending)
    write_rows(db, "perm_entity_facets",
               ["kind", "slug", "facet", "pos", "key", "label", "n", "certified", "denied"],
               facets)

    log("VERIFY")
    ok = True
    for table, want in (("perm_entity_pending", len(pending)), ("perm_entity_facets", len(facets))):
        got = int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
        ok &= got == want
        log(f"  {'ok ' if got == want else 'MISMATCH'} {table:22s} {got:>7,} of {want:,}")
    # A facet or pending row pointing at no entity is a page that cannot
    # render its own module, so it is a failure rather than a curiosity.
    for table in ("perm_entity_pending", "perm_entity_facets"):
        orphan = int(db.scalar(
            f"SELECT count(*) FROM {table} t LEFT JOIN perm_entities e "
            "ON e.kind = t.kind AND e.slug = t.slug WHERE e.slug IS NULL") or 0)
        ok &= orphan == 0
        log(f"  {'ok ' if orphan == 0 else 'FATAL'} {table:22s} {orphan} orphan rows")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
