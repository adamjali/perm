#!/usr/bin/env python3
"""Load the rest of the PUBLIC data surface into Turso.

Companion to turso_migrate.py, which loads the 373,939 case rows. This one
loads everything else the public pages read: entities, wage cells, the
aggregate documents, and the visa bulletin history.

The point is not only cost. With the case table gone from Convex the site
would still have been dark, because /perm-employers, /perm-wages and the
state pages read permEntities and permDisclosureStats, which were disabled
along with everything else. Moving the whole public surface means a
data-volume problem can never take the public site down again. Convex keeps
what it should: accounts, user-tracked cases, chat, audit logs.

ONE CONSTRAINT DISAPPEARS HERE. Convex caps a document at 1 MB, which is why
perm-aggregate.json carries only the top 250 employers when the real list is
16,305 - the cap was an architectural limit wearing an editorial disguise.
SQLite has no such cap, so entities live in a real table, every one of them,
and the aggregate document keeps only the genuinely document-shaped series.
"""
from __future__ import annotations

import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from ingest_perm_disclosure import entity_key  # noqa: E402
from lib_turso import Turso, lit  # noqa: E402
from store_entities import with_unique_slugs  # noqa: E402

SCHEMA = [
    # ONLY these two are ours to rebuild wholesale: every row in them is
    # derived from the payload this run just parsed, so a drop is correct.
    #
    # `perm_docs` and `visa_bulletins` are NOT, and dropping them was a live
    # data-loss bug (found 2026-08-29, before it ever ran). We own three of
    # perm_docs' ten keys; the other seven belong to other writers, and two of
    # them - `live_census` and `decided_month_percentiles` - are written only
    # by the nightly case-status sweep. Dropping the table meant the public
    # case lookup fell back to its pre-census SQL (~1.8M row reads per lookup,
    # the path that got Turso reads BLOCKED in August) until the next 04:10 ET
    # sweep. And `visa_bulletins` is an ACCUMULATOR: it held 84 months
    # (2019-10..2026-09) built up over time and upgraded by source rank, while
    # this run's artifact carries only `--months 18` - so a drop-and-reload
    # destroyed 66 months of history and every primary-source upgrade in them.
    "DROP TABLE IF EXISTS perm_entities",
    "DROP TABLE IF EXISTS perm_wage_stats",
    """CREATE TABLE perm_entities (
         kind               TEXT NOT NULL,
         slug               TEXT NOT NULL,
         name               TEXT NOT NULL,
         merge_key          TEXT,
         rank               INTEGER NOT NULL,
         total              INTEGER NOT NULL,
         certified          INTEGER,
         denied             INTEGER,
         median_days        REAL,
         median_annual_wage REAL,
         state              TEXT,
         code               TEXT,
         PRIMARY KEY (kind, slug)
       )""",
    """CREATE TABLE perm_wage_stats (
         kind        TEXT NOT NULL,
         key         TEXT NOT NULL,
         soc_code    TEXT,
         soc_title   TEXT,
         state       TEXT,
         fiscal_year TEXT,
         count       INTEGER,
         p5 REAL, p10 REAL, p25 REAL, p50 REAL, p75 REAL, p90 REAL, p95 REAL,
         mean        REAL,
         histogram   TEXT,
         -- fiscal_year is part of the key, not a detail column. A cell
         -- exists per year AND as an 'all' rollup: ('occupation',
         -- '15-1252.00') has four rows. Keying on (kind, key) alone made
         -- INSERT OR REPLACE keep whichever landed last, silently turning
         -- 2,190 cells into 952 and serving one year's median as the
         -- all-time figure. Caught by verifying count(*) against what was
         -- streamed rather than trusting the loader's own counter.
         PRIMARY KEY (kind, key, fiscal_year)
       )""",
    # Singleton, genuinely document-shaped aggregates. A row per logical doc.
    # IF NOT EXISTS, never dropped: we write three of this table's keys
    # (disclosure_stats, cases_meta, wage_meta) by INSERT OR REPLACE and leave
    # every other writer's keys alone.
    """CREATE TABLE IF NOT EXISTS perm_docs (
         key         TEXT PRIMARY KEY,
         json        TEXT NOT NULL,
         computed_at INTEGER NOT NULL
       )""",
    # IF NOT EXISTS, never dropped: an accumulator owned by
    # ingest_visa_bulletin.py, whose SOURCE_RANK decides when a month may be
    # overwritten. This run only ever carries `--months 18`.
    """CREATE TABLE IF NOT EXISTS visa_bulletins (
         bulletin_month   TEXT PRIMARY KEY,
         source_url       TEXT,
         archived_at      TEXT,
         final_action     TEXT,
         dates_for_filing TEXT,
         computed_at      INTEGER NOT NULL
       )""",
]

INDEXES = [
    "CREATE INDEX idx_pe_kind_rank ON perm_entities(kind, rank)",
    "CREATE INDEX idx_pe_kind_total ON perm_entities(kind, total DESC)",
    "CREATE INDEX idx_pe_kind_name ON perm_entities(kind, name)",
    "CREATE INDEX idx_pe_merge ON perm_entities(kind, merge_key)",
    "CREATE INDEX idx_pws_kind_year ON perm_wage_stats(kind, fiscal_year)",
    "CREATE INDEX idx_pws_soc ON perm_wage_stats(soc_code)",
]


def log(m): print(m, flush=True)


def chunked(rows, n):
    buf = []
    for r in rows:
        buf.append(r)
        if len(buf) >= n:
            yield buf; buf = []
    if buf:
        yield buf


def insert_many(db, table, columns, rows, per_stmt=400, per_req=4):
    ph = "(" + ",".join("?" * len(columns)) + ")"
    head = f"INSERT OR REPLACE INTO {table} ({','.join(columns)}) VALUES "
    pending, n = [], 0
    for batch in chunked(rows, per_stmt):
        pending.append({"type": "execute", "stmt": {
            "sql": head + ",".join([ph] * len(batch)),
            "args": [lit(v) for row in batch for v in row]}})
        n += len(batch)
        if len(pending) >= per_req:
            db.pipeline(pending + [{"type": "close"}]); pending = []
    if pending:
        db.pipeline(pending + [{"type": "close"}])
    return n


def main() -> int:
    art = pathlib.Path(sys.argv[1] if len(sys.argv) > 1
                       else "/tmp/ingest-artifact/federal-payloads")
    payload = json.load(open(art / "perm-payload.json"))
    wages = json.load(open(art / "perm-wages.json"))
    bulletins = json.load(open(art / "visa-bulletin.json"))
    meta = json.load(open(art / "perm-cases.ndjson.gz.meta.json"))
    stamp = int(time.time() * 1000)

    db = Turso()
    log(f"  target: {db.url}")

    # Baseline the two ACCUMULATOR tables BEFORE the schema runs. Reading them
    # afterwards would make the check self-fulfilling: if a DROP for either one
    # were ever re-added to SCHEMA, "held before" would read 0 and VERIFY would
    # sail straight over the loss. Taken here, a drop shows up as a mismatch.
    def count_or_zero(table: str) -> int:
        try:
            return int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
        except Exception:
            return 0        # first run: the table does not exist yet

    bulletins_before = count_or_zero("visa_bulletins")
    docs_before = count_or_zero("perm_docs")

    log("  creating schema")
    db.script(SCHEMA)

    # ---- entities: ALL of them, not a top-100 --------------------------
    total_entities = 0
    for kind, src, name_of in (
        ("employer", "topEmployers", lambda r: r["name"]),
        ("attorney", "topAttorneys", lambda r: r["name"]),
        ("occupation", "topOccupations", lambda r: r["title"]),
    ):
        rows = payload.get(src) or []
        # Sort by volume BEFORE slugging, exactly as store_entities.py does:
        # the busier entity must keep the clean slug or pages reassign
        # themselves between ingests.
        ordered = sorted(rows, key=lambda r: -r["total"])
        out = []
        for rank, (slug, item) in enumerate(with_unique_slugs(ordered, name_of), start=1):
            out.append((
                kind, slug, name_of(item), entity_key(name_of(item)), rank,
                item["total"], item.get("certified"), item.get("denied"),
                item.get("medianDays"), item.get("medianAnnualWage"),
                item.get("state"), item.get("code"),
            ))
        n = insert_many(db, "perm_entities",
                        ["kind", "slug", "name", "merge_key", "rank", "total",
                         "certified", "denied", "median_days",
                         "median_annual_wage", "state", "code"], out)
        total_entities += n
        log(f"    {kind:11s} {n:>6,}")

    # ---- wage cells ----------------------------------------------------
    wrows = [(
        r["kind"], r["key"], r.get("socCode"), r.get("socTitle"), r.get("state"),
        r.get("fiscalYear"), r.get("count"), r.get("p5"), r.get("p10"),
        r.get("p25"), r.get("p50"), r.get("p75"), r.get("p90"), r.get("p95"),
        r.get("mean"), json.dumps(r.get("histogram")),
    ) for r in wages.get("rows", [])]
    nw = insert_many(db, "perm_wage_stats",
                     ["kind", "key", "soc_code", "soc_title", "state",
                      "fiscal_year", "count", "p5", "p10", "p25", "p50", "p75",
                      "p90", "p95", "mean", "histogram"], wrows)
    log(f"    wage cells  {nw:>6,}")

    # ---- documents -----------------------------------------------------
    # The entity arrays are deliberately dropped from the stats document:
    # they now live in perm_entities in full, and keeping a truncated copy
    # here is how the top-250 version silently became the source of truth.
    stats = {k: v for k, v in payload.items()
             if k not in ("topEmployers", "topAttorneys", "topOccupations")}
    docs = [
        ("disclosure_stats", json.dumps(stats), stamp),
        ("cases_meta", json.dumps(meta), stamp),
        ("wage_meta", json.dumps({k: v for k, v in wages.items() if k != "rows"}), stamp),
    ]
    nd = insert_many(db, "perm_docs", ["key", "json", "computed_at"], docs, per_stmt=1)
    log(f"    documents   {nd:>6,}")

    # ---- visa bulletins ------------------------------------------------
    # ADD ONLY WHAT IS MISSING. This table is an accumulator: it holds every
    # month back to 2019-10, and ingest_visa_bulletin.py decides by SOURCE_RANK
    # when a month may be replaced (a saved primary-source page outranks an
    # archive capture, which outranks the mirror). This run's artifact is a
    # plain `--months 18` archive pull, so an unconditional INSERT OR REPLACE
    # would silently DOWNGRADE any month already upgraded to a better source.
    # Skipping months we already hold leaves that decision where it belongs,
    # and a fresh database still gets the full artifact.
    have_months = set()
    res = db.execute("SELECT bulletin_month FROM visa_bulletins")
    for r in res["response"]["result"]["rows"]:
        have_months.add(r[0]["value"])

    brows = [(
        b["bulletinMonth"], b.get("sourceUrl"), b.get("archivedAt"),
        json.dumps(b.get("finalAction")), json.dumps(b.get("datesForFiling")), stamp,
    ) for b in bulletins.get("bulletins", [])
        if b["bulletinMonth"] not in have_months]
    nb = insert_many(db, "visa_bulletins",
                     ["bulletin_month", "source_url", "archived_at",
                      "final_action", "dates_for_filing", "computed_at"], brows)
    log(f"    bulletins   {nb:>6,} new"
        f"  ({len(have_months):,} already held, left untouched)")

    log("  building indexes")
    for s in INDEXES:
        db.execute(s)

    # Verify from the TABLES, never from the counters that wrote them.
    #
    # Two different invariants, because two of these tables are rebuilt and two
    # are added to. Asserting "count(*) == rows I wrote" on a table we only
    # append to would be wrong in the dangerous direction: it passes only when
    # every pre-existing row is gone.
    log("  VERIFY")
    ok = True

    # Rebuilt wholesale: the table is exactly what this run wrote.
    for table, expect in (("perm_entities", total_entities),
                          ("perm_wage_stats", nw)):
        got = int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
        flag = "ok " if got == expect else "MISMATCH"
        if got != expect:
            ok = False
        log(f"    {flag} {table:16s} {got:>6,} (expected {expect:,})")

    # Preserved + added to: every row we held before must STILL be there, plus
    # whatever we just added. This is the check that would have caught the
    # drop-and-reload bug, so it is written to fail if history goes missing.
    # bulletins_before is read BEFORE the schema statements, so a re-added DROP
    # shows up here as a mismatch instead of silently redefining the baseline.
    vb_expect = bulletins_before + nb
    vb_got = int(db.scalar("SELECT count(*) FROM visa_bulletins") or 0)
    if vb_got != vb_expect:
        ok = False
    log(f"    {'ok ' if vb_got == vb_expect else 'MISMATCH'} "
        f"{'visa_bulletins':16s} {vb_got:>6,} (expected {vb_expect:,} = "
        f"{bulletins_before:,} held + {nb:,} new)")

    # perm_docs: our three keys must be present, and no other writer's key may
    # have been lost (we never delete, so the total cannot shrink).
    docs_got = int(db.scalar("SELECT count(*) FROM perm_docs") or 0)
    ours = int(db.scalar(
        "SELECT count(*) FROM perm_docs WHERE key IN "
        "('disclosure_stats','cases_meta','wage_meta')") or 0)
    docs_ok = ours == 3 and docs_got >= max(docs_before, 3)
    if not docs_ok:
        ok = False
    log(f"    {'ok ' if docs_ok else 'MISMATCH'} {'perm_docs':16s} "
        f"{docs_got:>6,} keys ({ours}/3 ours, {docs_before:,} held before)")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
