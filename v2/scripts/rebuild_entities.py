#!/usr/bin/env python3
"""Rebuild perm_entities from the case corpus, at storage floor 1.

WHY. The entities table was loaded from an artifact built when ENTITY_FLOOR
was 3, so 65,026 of 82,677 employers (79%) were simply absent. A practicing
attorney searched a firm she knows - Akal Group of Missouri, 2 cases, present
in our own perm_cases - and found nothing, on a site whose competitor lists
it. Storage floor is 1; PAGE floor (hasOwnPage / the sitemap) stays 3, so
the sitemap does not grow and thin pages are not advertised - but every
entity is searchable and its page renders on demand.

RULES CARRIED FROM THE INGEST, not reinvented:
- entity_key merges DOL's spelling variants before ranking (Fragomen prints
  six ways); merge_entities pools day/wage lists so medians are medians of
  the pooled population, never medians of medians.
- Sort by volume BEFORE slugging, so the busier entity keeps the clean slug.
- The first len(existing) slugs must be IDENTICAL to the live table, asserted
  against Turso before a single row is written: a slug that moves is a page
  that 404s from its own index.

Attorney firm STATE is not in the case rows (rows carry the worksite state),
so it is preserved by join from the existing table and blank for new firms.
"""
from __future__ import annotations

import gzip
import json
import pathlib
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from ingest_perm_disclosure import entity_key, merge_entities  # noqa: E402
from lib_turso import Turso, lit  # noqa: E402
from store_entities import with_unique_slugs  # noqa: E402

ART = pathlib.Path("/tmp/ingest-artifact/federal-payloads/perm-cases.ndjson.gz")
PAGE_FLOOR = 3  # mirrors MIN_TOTAL_FOR_PAGE; storage floor is 1


def log(m): print(m, flush=True)


def build_buckets():
    emp: dict[str, dict] = {}
    att: dict[str, dict] = {}
    occ: dict[str, dict] = {}
    n = 0
    with gzip.open(ART, "rt", encoding="utf-8") as src:
        for line in src:
            r = json.loads(line)
            n += 1
            st = r["status"]
            cert = 1 if st == "certified" else 0
            den = 1 if st == "denied" else 0
            wd = 1 if st == "withdrawn" else 0
            days = r.get("days")
            wage = r.get("wage")
            for key, bucket, name in (
                (r.get("employerName"), emp, r.get("employerName")),
                (r.get("attorneyName"), att, r.get("attorneyName")),
            ):
                if not key:
                    continue
                d = bucket.get(key)
                if d is None:
                    d = bucket[key] = {"certified": 0, "denied": 0, "withdrawn": 0,
                                       "days": [], "wages": [], "name": name, "state": ""}
                d["certified"] += cert; d["denied"] += den; d["withdrawn"] += wd
                if days is not None: d["days"].append(days)
                if wage is not None: d["wages"].append(wage)
            code = r.get("socCode")
            if code:
                d = occ.get(code)
                if d is None:
                    d = occ[code] = {"certified": 0, "denied": 0, "withdrawn": 0,
                                     "days": [], "wages": [], "code": code,
                                     "title": r.get("socTitle") or code}
                d["certified"] += cert; d["denied"] += den; d["withdrawn"] += wd
                if days is not None: d["days"].append(days)
                if wage is not None: d["wages"].append(wage)
    log(f"  {n:,} case rows -> {len(emp):,} employer spellings, "
        f"{len(att):,} firm spellings, {len(occ):,} SOC codes")
    return emp, att, occ


def rows_for(kind, merged, name_of, extra, live):
    """live: merge_key -> {name, slug, rank} from the current table.

    The first rebuild recomputed everything and the prefix gate refused it:
    merge_entities breaks TIES between spellings by insertion order, and the
    original ingest streamed XLSX while this streams NDJSON, so ~5 of the
    first 5,000 employers came out under a different canonical spelling and
    slug. Names and slugs are IDENTITY, not derived values: for any
    merge_key the live table already knows, its name and slug are preserved
    verbatim, and live rank breaks total-ties so the published "#N by
    volume" ordering cannot shuffle. Only genuinely new entities are slugged,
    against a reserved set so they cannot collide with a live URL.
    """
    def total_of(d):
        return d["certified"] + d["denied"] + d.get("withdrawn", 0)

    def key_of(d):
        # Occupations are BUCKETED by SOC code (codes are canonical), but the
        # live table's merge_key for them is entity_key(title) - that is what
        # turso_migrate_public.py wrote for every kind. Identity lookup has to
        # speak the live table's key or every occupation reads as "new" and
        # collides into a -2 slug, which is exactly what the gate caught.
        return entity_key(name_of(d))

    # TWO PHASES, because a single sort cannot know which live rank each row
    # will consume. Phase 1 assigns identity (queue consumption in volume
    # order); phase 2 orders by the ASSIGNED live rank, so total-ties between
    # different keys land exactly where the live table has them - the last
    # divergence was nothing but adjacent swaps inside tie groups.
    provisional = sorted(merged, key=lambda d: (-total_of(d), name_of(d)))
    reserved = {e["slug"] for v in live.values() for e in v}
    seen: dict[str, int] = {}
    assigned = []
    from store_entities import slugify
    for d in provisional:
        k = key_of(d)
        if live.get(k):
            hit = live[k].pop(0)
            name, slug, lrank = hit["name"], hit["slug"], hit["rank"]
        else:
            name = name_of(d)
            base = slugify(name) or "entity"
            n = seen.get(base, 0)
            cand = base if n == 0 else f"{base}-{n + 1}"
            while cand in reserved:
                n += 1
                cand = f"{base}-{n + 1}"
            seen[base] = n + 1
            reserved.add(cand)
            slug, lrank = cand, 10**9
        assigned.append((d, name, slug, lrank))

    ordered = sorted(assigned, key=lambda t: (-total_of(t[0]), t[3], t[1]))
    out = []
    for rank, (d, name, slug, _lr) in enumerate(ordered, start=1):
        k = key_of(d)
        out.append({
            "kind": kind, "slug": slug, "name": name,
            "merge_key": k,
            "rank": rank, "total": total_of(d),
            "certified": d["certified"], "denied": d["denied"],
            "median_days": statistics.median(d["days"]) if d["days"] else None,
            "median_annual_wage": statistics.median(d["wages"]) if d["wages"] else None,
            **extra(d),
        })
    return out


def main() -> int:
    db = Turso()
    emp_b, att_b, occ_b = build_buckets()

    def live_map(kind):
        res = db.execute(
            "SELECT merge_key, name, slug, rank FROM perm_entities WHERE kind = ? ORDER BY rank",
            [kind])
        out: dict[str, list] = {}
        for r in res["response"]["result"]["rows"]:
            out.setdefault(r[0]["value"], []).append(
                {"name": r[1]["value"], "slug": r[2]["value"], "rank": int(r[3]["value"])})
        return out

    employers = rows_for("employer", merge_entities(emp_b, lambda d: d["name"]),
                         lambda d: d["name"], lambda d: {"state": None, "code": None},
                         live_map("employer"))
    attorneys = rows_for("attorney", merge_entities(att_b, lambda d: d["name"]),
                         lambda d: d["name"], lambda d: {"state": d.get("state") or None, "code": None},
                         live_map("attorney"))
    occupations = rows_for("occupation", list(occ_b.values()),
                           lambda d: d["title"], lambda d: {"state": None, "code": d["code"]},
                           live_map("occupation"))

    # ---- GATE: the live table's slugs must be a strict PREFIX of the rebuild.
    for kind, rows in (("employer", employers), ("attorney", attorneys), ("occupation", occupations)):
        res = db.execute(
            "SELECT slug FROM perm_entities WHERE kind = ? ORDER BY rank", [kind])
        live = [r[0]["value"] for r in res["response"]["result"]["rows"]]
        new = [r["slug"] for r in rows[:len(live)]]
        if live != new:
            diffs = [(i, a, b) for i, (a, b) in enumerate(zip(live, new)) if a != b][:5]
            log(f"  FATAL: {kind} slugs diverge from the live table; first diffs: {diffs}")
            log("  Refusing to write - a moved slug is a page that 404s from its own index.")
            return 1
        log(f"  {kind:11s} prefix check ok: first {len(live):,} slugs identical; "
            f"{len(rows) - len(live):,} new sub-floor rows append after")

    # ---- Preserve attorney firm state by slug join (not present in case rows).
    res = db.execute("SELECT slug, state FROM perm_entities WHERE kind='attorney' AND state IS NOT NULL")
    st = {r[0]["value"]: r[1]["value"] for r in res["response"]["result"]["rows"]}
    kept = 0
    for r in attorneys:
        if r["state"] is None and r["slug"] in st:
            r["state"] = st[r["slug"]]; kept += 1
    log(f"  attorney state preserved for {kept:,} firms")

    # ---- Replace, chunked.
    all_rows = employers + attorneys + occupations
    cols = ["kind", "slug", "name", "merge_key", "rank", "total", "certified",
            "denied", "median_days", "median_annual_wage", "state", "code"]
    db.execute("DELETE FROM perm_entities")
    ph = "(" + ",".join("?" * len(cols)) + ")"
    head = f"INSERT INTO perm_entities ({','.join(cols)}) VALUES "
    CH = 400
    pending = []
    for i in range(0, len(all_rows), CH):
        batch = all_rows[i:i + CH]
        args = [lit(r[c]) for r in batch for c in cols]
        pending.append({"type": "execute", "stmt": {"sql": head + ",".join([ph] * len(batch)), "args": args}})
        if len(pending) >= 4:
            db.pipeline(pending + [{"type": "close"}]); pending = []
    if pending:
        db.pipeline(pending + [{"type": "close"}])

    # ---- Verify from the table.
    log("  VERIFY")
    ok = True
    for kind, rows in (("employer", employers), ("attorney", attorneys), ("occupation", occupations)):
        got = int(db.scalar(f"SELECT count(*) FROM perm_entities WHERE kind='{kind}'") or 0)
        good = got == len(rows); ok &= good
        log(f"    {'ok ' if good else 'MISMATCH'} {kind:11s} {got:>7,} (expected {len(rows):,})")
    akal = db.execute("SELECT name, slug, total FROM perm_entities WHERE kind='employer' AND name LIKE '%Akal Group%'")
    for r in akal["response"]["result"]["rows"]:
        log(f"    akal check: {r[0]['value']}  /{r[1]['value']}  total={r[2]['value']}")
    if not akal["response"]["result"]["rows"]:
        log("    akal check: STILL MISSING"); ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
