#!/usr/bin/env python3
"""Load the rest of the public data surface into the database.

The companion to turso_migrate.py, which loads the case rows. This loads
everything else the public pages read from the quarterly payload: entities,
wage cells, the aggregate documents, and the visa bulletin history. Every
entity lives in a real table, all of them; the aggregate document keeps only
the genuinely document-shaped series.
"""
from __future__ import annotations

import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from entity_identity import entity_key  # noqa: E402
from lib_turso import Turso, insert_rows, query_rows  # noqa: E402
from lib_slugs import plan_aliases, plan_sticky_slugs, with_aliases  # noqa: E402

SCHEMA = [
    # Only these two are rebuilt wholesale: every row in them is derived from the
    # payload this run parsed. They are built alongside as *_next tables and
    # swapped in one transaction (swap()) only when VERIFY passes, so pages never
    # read a missing or half-filled table and a failed load leaves the old data.
    #
    # `perm_docs` and `visa_bulletins` are never dropped. Other writers own most of
    # perm_docs' keys (the nightly sweep's census among them), and visa_bulletins is
    # an accumulator built up over time and upgraded by source rank, while this
    # run's artifact carries only the recent months.
    "DROP TABLE IF EXISTS perm_entities_next",
    "DROP TABLE IF EXISTS perm_wage_stats_next",
    """CREATE TABLE perm_entities_next (
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
         -- Filled by build_entity_detail.refresh_recent_12m. Declared HERE
         -- because this script drops and recreates the table, and the
         -- readers select it: without it every entity page rendered between
         -- this load and the next refresh failed (found Sep 26 2026).
         recent_12m         INTEGER,
         PRIMARY KEY (kind, slug)
       )""",
    """CREATE TABLE perm_wage_stats_next (
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
    # overwritten. This run carries bulletins only from a hand-built artifact.
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
    # Expression index for fieldDistribution's cohort filter. The SQL text in
    # src/lib/turso/entities.ts must match this expression exactly, or SQLite
    # walks the whole kind on every entity page render.
    "CREATE INDEX idx_pe_kind_decided ON perm_entities(kind, (IFNULL(certified, 0) + IFNULL(denied, 0)))",
    "CREATE INDEX idx_pe_kind_total ON perm_entities(kind, total DESC)",
    "CREATE INDEX idx_pe_kind_name ON perm_entities(kind, name)",
    "CREATE INDEX idx_pe_merge ON perm_entities(kind, merge_key)",
    "CREATE INDEX idx_pws_kind_year ON perm_wage_stats(kind, fiscal_year)",
    "CREATE INDEX idx_pws_soc ON perm_wage_stats(soc_code)",
]


def log(m): print(m, flush=True)


def identity_key(kind: str, name: str, code) -> str:
    """What makes a stored entity row THIS row across rebuilds: the name, and
    for an occupation the SOC code as well (two codes share a title)."""
    return f"{code or ''}|{name}" if kind == "occupation" else name


def prior_maps(rows) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    """(kind -> identity -> slug, kind -> slug -> merge key) for the entities held now.

    An employer's or firm's key is recomputed from its stored NAME with today's
    `entity_key`, never read from the stored `merge_key`: when the rule changes
    (Oct 5 2026, "limited" and "incorporated" became form words) an absorbed page's
    stored key matches nothing this run, and the planner would refuse the whole
    load over it. An occupation keeps its stored key, which carries the SOC code.
    """
    prior_slug: dict[str, dict[str, str]] = {}
    prior_key: dict[str, dict[str, str]] = {}
    for kind, name, slug, key, code in rows:
        prior_slug.setdefault(kind, {})[identity_key(kind, name, code)] = slug
        current = entity_key(name) if kind in ("employer", "attorney") and name else key
        prior_key.setdefault(kind, {})[slug] = current or ""
    return prior_slug, prior_key


def count_kept(kind: str, assigned, name_of, prior: dict[str, str]) -> int:
    """How many entities kept the slug they held, keyed as the planner keys them."""
    return sum(1 for slug, item in assigned
               if prior.get(identity_key(kind, name_of(item), item.get("code"))) == slug)


def main() -> int:
    positional = [a for a in sys.argv[1:] if not a.startswith("--")]
    art = pathlib.Path(positional[0] if positional else "/tmp/ingest-artifact/federal-payloads")
    # --allow-vanished: proceed when an entity has left the source entirely
    # and its slug can redirect nowhere. Off by default, because a page
    # Google holds turning into a 404 with nobody noticing is the failure.
    allow_vanished = "--allow-vanished" in sys.argv
    payload = json.load(open(art / "perm-payload.json"))
    wages = json.load(open(art / "perm-wages.json"))
    meta = json.load(open(art / "perm-cases.ndjson.gz.meta.json"))

    # The visa bulletin is the one optional input. No workflow step produces it
    # since Oct 5 2026 (the daily direct read from State owns the series); a
    # hand-built artifact may still carry one. Missing simply adds no months,
    # which is safe because the table is an accumulator.
    bulletin_path = art / "visa-bulletin.json"
    if bulletin_path.exists():
        bulletins = json.load(open(bulletin_path))
    else:
        bulletins = {"bulletins": []}
        log("  NOTE: no visa-bulletin.json in the artifact; leaving the stored "
            "months untouched and loading everything else.")
    stamp = int(time.time() * 1000)

    db = Turso()
    log(f"  target: {db.url}")

    # Baseline the two accumulator tables before the schema runs: read afterwards,
    # a DROP re-added to SCHEMA would make "held before" 0 and VERIFY would pass
    # over the loss.
    def count_or_zero(table: str) -> int:
        try:
            return int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
        except Exception:
            return 0        # first run: the table does not exist yet

    bulletins_before = count_or_zero("visa_bulletins")

    # Sticky slugs: read what every entity is called now, before the rebuild. An
    # entity keeps the slug it holds (volume order changes every quarter, and
    # reassigning `-2`/`-3` would swap URLs between firms); only newcomers are
    # assigned, and every slug no entity kept gets an alias row, or the run
    # refuses.
    prior_slug: dict[str, dict[str, str]] = {}     # kind -> name -> slug
    prior_key: dict[str, dict[str, str]] = {}      # kind -> slug -> merge key
    try:
        prior_slug, prior_key = prior_maps(query_rows(
            db, "SELECT kind, name, slug, merge_key, code FROM perm_entities"))
    except Exception:  # noqa: BLE001 - first run: no table yet
        pass
    log(f"  prior entities: {sum(len(v) for v in prior_slug.values()):,} slugs held")

    planned: dict[str, list] = {}
    alias_rows: list[tuple[str, str, str]] = []
    unresolved_all: list[tuple[str, str]] = []
    for kind, src, name_of in (
        ("employer", "topEmployers", lambda r: r["name"]),
        ("attorney", "topAttorneys", lambda r: r["name"]),
        ("occupation", "topOccupations", lambda r: r["title"]),
    ):
        rows = payload.get(src) or []
        # Volume order still decides RANK and which newcomer gets the clean
        # slug; it no longer moves a slug an entity already holds.
        ordered = sorted(rows, key=lambda r: -r["total"])
        assigned, vanished = plan_sticky_slugs(
            ordered, name_of, prior_slug.get(kind, {}),
            key_of=lambda r, k=kind, n=name_of: identity_key(k, n(r), r.get("code")))
        key_slug: dict[str, str] = {}
        for slug, item in assigned:            # busiest first, so first wins
            key_slug.setdefault(entity_key(name_of(item)), slug)
        # A spelling the build folded into another (typo and spacing aliases) points
        # at the page its rows now live on.
        key_slug = with_aliases(key_slug, (payload.get("keyAliases") or {}).get(kind) or {})
        aliases, unresolved = plan_aliases(vanished, prior_key.get(kind, {}), key_slug)
        alias_rows.extend((kind, old, target) for old, target in aliases)
        unresolved_all.extend((kind, old) for old in unresolved)
        planned[kind] = [(slug, name_of(item), item) for slug, item in assigned]
        # Counted by the same key the planner used (an occupation's key carries
        # its SOC code), so the log's kept and new counts are true.
        kept = count_kept(kind, assigned, name_of, prior_slug.get(kind, {}))
        log(f"    {kind:11s} {len(assigned):>6,} slugs: {kept:,} kept, "
            f"{len(assigned) - kept:,} new, {len(aliases):,} aliased, {len(unresolved):,} unresolved")
    if unresolved_all:
        sample = ", ".join(f"{k}:{s}" for k, s in unresolved_all[:8])
        if not allow_vanished:
            log(f"  FATAL: {len(unresolved_all)} slug(s) held live pages and now redirect "
                f"nowhere ({sample}). Nothing written. Read the parser's log: an entity "
                "that left the source entirely is either DOL dropping it or a mapping "
                "change. Re-run with --allow-vanished once that is understood.")
            return 1
        log(f"  --allow-vanished: {len(unresolved_all)} slug(s) will 404 ({sample})")
    docs_before = count_or_zero("perm_docs")

    log("  creating schema")
    db.script(SCHEMA)

    # ---- entities: ALL of them, not a top-100, with the slugs planned above
    total_entities = 0
    for kind, rows_planned in planned.items():
        out = []
        for rank, (slug, name, item) in enumerate(rows_planned, start=1):
            out.append((
                kind, slug, name, entity_key(name), rank,
                item["total"], item.get("certified"), item.get("denied"),
                item.get("medianDays"), item.get("medianAnnualWage"),
                item.get("state"), item.get("code"),
            ))
        n = insert_rows(db, "perm_entities_next",
                        ["kind", "slug", "name", "merge_key", "rank", "total",
                         "certified", "denied", "median_days",
                         "median_annual_wage", "state", "code"], out)
        total_entities += n
        log(f"    {kind:11s} {n:>6,}")

    # ---- aliases for the slugs nobody kept -----------------------------
    # A row per vanished slug pointing at the entity that absorbed it, and
    # any older alias that pointed AT a vanished slug is re-pointed so no
    # chain forms. reconcile_entity_aliases.py runs after this and drops
    # anything that ended up inconsistent.
    db.execute("""CREATE TABLE IF NOT EXISTS perm_entity_alias (
        kind TEXT NOT NULL, slug TEXT NOT NULL, target_slug TEXT NOT NULL,
        PRIMARY KEY (kind, slug))""")
    if alias_rows:
        insert_rows(db, "perm_entity_alias", ["kind", "slug", "target_slug"], alias_rows)
        for kind, old, target in alias_rows:
            db.execute("UPDATE perm_entity_alias SET target_slug = ? "
                       "WHERE kind = ? AND target_slug = ? AND slug <> ?",
                       [target, kind, old, target])
        log(f"    aliases     {len(alias_rows):>6,} written for slugs no entity kept")

    # ---- wage cells ----------------------------------------------------
    wrows = [(
        r["kind"], r["key"], r.get("socCode"), r.get("socTitle"), r.get("state"),
        r.get("fiscalYear"), r.get("count"), r.get("p5"), r.get("p10"),
        r.get("p25"), r.get("p50"), r.get("p75"), r.get("p90"), r.get("p95"),
        r.get("mean"), json.dumps(r.get("histogram")),
    ) for r in wages.get("rows", [])]
    nw = insert_rows(db, "perm_wage_stats_next",
                     ["kind", "key", "soc_code", "soc_title", "state",
                      "fiscal_year", "count", "p5", "p10", "p25", "p50", "p75",
                      "p90", "p95", "mean", "histogram"], wrows)
    log(f"    wage cells  {nw:>6,}")

    # ---- documents -----------------------------------------------------
    # The entity arrays are dropped from the stats document: they live in
    # perm_entities in full, and a truncated copy here would become a second,
    # wrong source of truth.
    stats = {k: v for k, v in payload.items()
             if k not in ("topEmployers", "topAttorneys", "topOccupations", "keyAliases")}
    docs = [
        ("disclosure_stats", json.dumps(stats), stamp),
        ("cases_meta", json.dumps(meta), stamp),
        ("wage_meta", json.dumps({k: v for k, v in wages.items() if k != "rows"}), stamp),
    ]
    # The build's aliases (a spelling's key -> the key it merged under), for every
    # later step that joins a printed name to a page: the entity detail, the
    # employer map, the history and WARN loaders.
    if payload.get("keyAliases"):
        docs.append(("key_aliases", json.dumps(payload["keyAliases"]), stamp))
    nd = insert_rows(db, "perm_docs", ["key", "json", "computed_at"], docs, per_stmt=1)
    log(f"    documents   {nd:>6,}")

    # ---- visa bulletins ------------------------------------------------
    # Add only what is missing. ingest_visa_bulletin.py decides by SOURCE_RANK
    # when a month may be replaced, and this artifact is a plain archive pull, so
    # replacing a held month could downgrade it. A fresh database still gets the
    # full artifact.
    have_months = {r[0] for r in query_rows(db, "SELECT bulletin_month FROM visa_bulletins")}

    brows = [(
        b["bulletinMonth"], b.get("sourceUrl"), b.get("archivedAt"),
        json.dumps(b.get("finalAction")), json.dumps(b.get("datesForFiling")), stamp,
    ) for b in bulletins.get("bulletins", [])
        if b["bulletinMonth"] not in have_months]
    nb = insert_rows(db, "visa_bulletins",
                     ["bulletin_month", "source_url", "archived_at",
                      "final_action", "dates_for_filing", "computed_at"], brows)
    log(f"    bulletins   {nb:>6,} new"
        f"  ({len(have_months):,} already held, left untouched)")

    # Verify from the tables, never from the counters that wrote them, with one
    # invariant for the rebuilt tables and another for the accumulators: on a
    # table we only add to, "count(*) == rows written" would pass only when every
    # earlier row was gone.
    log("  VERIFY")
    ok = True

    # Rebuilt wholesale: the table is exactly what this run wrote.
    for table, expect in (("perm_entities_next", total_entities),
                          ("perm_wage_stats_next", nw)):
        got = int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
        flag = "ok " if got == expect else "MISMATCH"
        if got != expect:
            ok = False
        log(f"    {flag} {table:16s} {got:>6,} (expected {expect:,})")

    # Preserved and added to: every row held before must still be there, plus
    # whatever was just added. bulletins_before was read before the schema
    # statements, so a re-added DROP shows up here as a mismatch.
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

    if not ok:
        log("  NOT SWAPPED: perm_entities and perm_wage_stats keep serving the "
            "previous load. The *_next tables are left for inspection.")
        return 1
    swap(db)
    for table, expect in (("perm_entities", total_entities), ("perm_wage_stats", nw)):
        got = int(db.scalar(f"SELECT count(*) FROM {table}") or 0)
        if got != expect:
            log(f"  FATAL after swap: {table} holds {got:,}, expected {expect:,}")
            return 1
    log(f"  swapped in: perm_entities {total_entities:,}, perm_wage_stats {nw:,}")
    return 0


def swap(db) -> None:
    """Replace the live tables with the *_next ones, and index them, atomically.

    One pipeline, one transaction: readers keep the old committed tables until
    COMMIT, so no page ever sees a missing or half-indexed table. Dropping the
    old table drops its indexes, which is what frees the names for INDEXES.
    """
    db.script(["BEGIN",
               "DROP TABLE IF EXISTS perm_entities",
               "ALTER TABLE perm_entities_next RENAME TO perm_entities",
               "DROP TABLE IF EXISTS perm_wage_stats",
               "ALTER TABLE perm_wage_stats_next RENAME TO perm_wage_stats",
               *INDEXES,
               "COMMIT"])


if __name__ == "__main__":
    sys.exit(main())
