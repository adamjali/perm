#!/usr/bin/env python3
"""Rebuild `perm_entities` under merged identity, and keep every old URL alive.

    python3 scripts/rebuild_entity_identity.py --dry-run
    python3 scripts/rebuild_entity_identity.py --cache /tmp/cases.jsonl
    python3 scripts/rebuild_entity_identity.py

WHY. `entity_key` shredded punctuation before consulting its noise list, so
`P.C.` reached it as `p` + `c` and never matched "pc". 604 pairs of firms
were therefore two firms, with two pages, two ranks and two halves of one
practice's record. `scripts/entity_identity.py` now owns identity and this
script is what applies it to the stored table.

## The gate that replaced the prefix check

`rebuild_entities.py` refused to write unless the live slug order was an
exact prefix of the new one. That gate cannot survive a deliberate merge -
absorbing 606 rows moves every rank after the first one - and loosening it
would give up the thing it was protecting, which is that a URL people and
Google already hold must not 404.

So the guarantee moves from "no slug ever moves" to "no slug ever dies".
Every slug in the live table must come out of this run either as a canonical
slug or as a row in `perm_entity_alias` pointing at the entity that absorbed
it. The run refuses to write if even one is unaccounted for. That is a
STRONGER promise than the prefix check: the prefix check said nothing at all
about rows past the live length.

## Which live slug survives a merge

The busiest one. It is the spelling most people typed, the one most likely
to be linked, and - because the old ranking was by volume - the one that
already held the clean slug. The others redirect to it permanently.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entity_identity import entity_key, typo_aliases  # noqa: E402
from lib_turso import Turso, lit  # noqa: E402
from store_entities import slugify  # noqa: E402

PAGE = 25000
CHUNK = 400


def log(m: str) -> None:
    print(m, flush=True)


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

CASE_COLS = ["employer_name", "attorney_name", "soc_code", "soc_title",
             "status", "days", "wage", "state"]


def read_cases(db: Turso, cache: str | None):
    """Every decided case. The corpus is `perm_cases`, not an ingest artifact.

    Deriving from the stored table rather than from `/tmp/ingest-artifact`
    means this can be re-run at any time by anyone, which matters for a
    script whose whole job is to be re-runnable after an identity change.
    """
    if cache:
        with open(cache) as f:
            for line in f:
                yield json.loads(line)
        return
    off = 0
    while True:
        res = db.execute(
            f"SELECT {','.join(CASE_COLS)} FROM perm_cases ORDER BY rowid LIMIT ? OFFSET ?",
            [PAGE, off])
        rows = res["response"]["result"]["rows"]
        for r in rows:
            yield {c: (None if cell["type"] == "null" else cell["value"])
                   for c, cell in zip(CASE_COLS, r)}
        if len(rows) < PAGE:
            return
        off += PAGE


def num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Aggregate
# ---------------------------------------------------------------------------

def build(cases) -> dict[str, dict[str, dict]]:
    """Case rows -> per-kind buckets keyed by identity.

    Employers and firms bucket on `entity_key`; occupations bucket on the SOC
    CODE, which is already canonical, and take the modal title as their label
    because `soc_title` is free text an employer typed.
    """
    kinds = {"employer": {}, "attorney": {}, "occupation": {}}
    n = 0
    for r in cases:
        n += 1
        st = (r.get("status") or "").lower()
        cert = 1 if st == "certified" else 0
        den = 1 if st == "denied" else 0
        wd = 1 if st == "withdrawn" else 0
        days = num(r.get("days"))
        wage = num(r.get("wage"))
        state = r.get("state") or None

        for field, kind in (("employer_name", "employer"), ("attorney_name", "attorney")):
            name = r.get(field)
            if not name:
                continue
            key = entity_key(name)
            d = kinds[kind].get(key)
            if d is None:
                d = kinds[kind][key] = {"certified": 0, "denied": 0, "withdrawn": 0,
                                        "days": [], "wages": [], "names": {},
                                        "states": {}, "code": None}
            d["certified"] += cert
            d["denied"] += den
            d["withdrawn"] += wd
            if days is not None:
                d["days"].append(days)
            if wage is not None:
                d["wages"].append(wage)
            d["names"][name] = d["names"].get(name, 0) + 1
            if state:
                d["states"][state] = d["states"].get(state, 0) + 1

        code = r.get("soc_code")
        if code:
            d = kinds["occupation"].get(code)
            if d is None:
                d = kinds["occupation"][code] = {"certified": 0, "denied": 0, "withdrawn": 0,
                                                 "days": [], "wages": [], "names": {},
                                                 "states": {}, "code": code}
            d["certified"] += cert
            d["denied"] += den
            d["withdrawn"] += wd
            if days is not None:
                d["days"].append(days)
            if wage is not None:
                d["wages"].append(wage)
            title = r.get("soc_title") or code
            d["names"][title] = d["names"].get(title, 0) + 1
    log(f"  {n:,} cases -> " + ", ".join(f"{len(v):,} {k}" for k, v in kinds.items()))
    return kinds


def fold_typos(bucket: dict[str, dict], kind: str) -> tuple[dict[str, dict], dict[str, str]]:
    """Second identity pass. Returns the folded bucket and the key->key map."""
    totals = {k: d["certified"] + d["denied"] + d["withdrawn"] for k, d in bucket.items()}
    alias = typo_aliases(totals, kind)
    if not alias:
        return bucket, {}
    out: dict[str, dict] = {}
    for key, d in bucket.items():
        root = alias.get(key, key)
        cur = out.get(root)
        if cur is None:
            out[root] = dict(d, days=list(d["days"]), wages=list(d["wages"]),
                             names=dict(d["names"]), states=dict(d["states"]))
            continue
        cur["certified"] += d["certified"]
        cur["denied"] += d["denied"]
        cur["withdrawn"] += d["withdrawn"]
        cur["days"].extend(d["days"])
        cur["wages"].extend(d["wages"])
        for name, c in d["names"].items():
            cur["names"][name] = cur["names"].get(name, 0) + c
        for s, c in d["states"].items():
            cur["states"][s] = cur["states"].get(s, 0) + c
    return out, alias


def display_name(counts: dict[str, int]) -> str:
    """The spelling people typed most often, ties broken alphabetically."""
    return max(counts.items(), key=lambda kv: (kv[1], kv[0]))[0]


# ---------------------------------------------------------------------------
# Slugs and aliases
# ---------------------------------------------------------------------------

def live_rows(db: Turso, kind: str) -> list[dict]:
    out, off = [], 0
    while True:
        res = db.execute(
            "SELECT slug, name, total, code, state FROM perm_entities WHERE kind = ? "
            "ORDER BY rank LIMIT ? OFFSET ?", [kind, PAGE, off])
        rows = res["response"]["result"]["rows"]
        out += [{"slug": r[0]["value"], "name": r[1]["value"], "total": int(r[2]["value"]),
                 "code": None if r[3]["type"] == "null" else r[3]["value"],
                 "state": None if r[4]["type"] == "null" else r[4]["value"]}
                for r in rows]
        if len(rows) < PAGE:
            return out
        off += PAGE


def assign(kind: str, merged: dict[str, dict], live: list[dict], key_alias: dict[str, str]):
    """Ranks, slugs and the alias rows, in one pass.

    A merged entity inherits the SLUG of the busiest live row that folds into
    it. Every other live slug that folds into it becomes an alias. A slug
    that inherits nothing is brand new and gets slugged from scratch against
    a reserved set, so it cannot land on a URL that is already spoken for.
    """
    # A bucket key is an `entity_key` for employers and firms and a SOC CODE
    # for occupations, so a live row has to be resolved the same way its kind
    # was bucketed. Matching every kind on the name looked right and silently
    # matched no occupation at all, which the gate caught as 1,410 dead URLs.
    def resolve(row: dict) -> str:
        if kind == "occupation":
            return row.get("code") or entity_key(row["name"])
        k = entity_key(row["name"])
        return key_alias.get(k, k)

    claims: dict[str, list[dict]] = {}
    for row in live:
        claims.setdefault(resolve(row), []).append(row)

    reserved = {r["slug"] for r in live}
    seen: dict[str, int] = {}
    prepared, aliases = [], []

    for key, d in merged.items():
        total = d["certified"] + d["denied"] + d["withdrawn"]
        name = display_name(d["names"]) if d["names"] else key
        held = sorted(claims.get(key, []), key=lambda r: (-r["total"], r["slug"]))
        if held:
            slug = held[0]["slug"]
            for other in held[1:]:
                aliases.append((kind, other["slug"], slug))
        else:
            base = slugify(name) or "entity"
            n = seen.get(base, 0)
            cand = base if n == 0 else f"{base}-{n + 1}"
            while cand in reserved:
                n += 1
                cand = f"{base}-{n + 1}"
            seen[base] = n + 1
            reserved.add(cand)
            slug = cand
        # STATE IS CARRIED, NOT DERIVED.
        #
        # A firm's state is its office, and it comes from a source the case
        # rows do not contain, so it is preserved from whichever live row
        # folds into this entity. The first rebuild derived it instead and
        # silently emptied the column for all 3,555 firms that had one,
        # which is the state filter on /perm-attorneys and the same-state
        # peer set on every firm page.
        #
        # An EMPLOYER has no state and must not acquire one. The case rows
        # carry a WORKSITE state, and taking the modal worksite would put a
        # single two-letter code in a column labelled "State" on an index
        # this task does not own, where filtering to CA would then drop any
        # employer that files 40% of its cases there. The per-state
        # breakdown lives on the entity's own page, where it is labelled.
        state = next((h["state"] for h in held if h.get("state")), None) \
            if kind == "attorney" else None
        prepared.append({
            "kind": kind, "slug": slug, "name": name, "merge_key": key,
            "total": total, "certified": d["certified"], "denied": d["denied"],
            "median_days": statistics.median(d["days"]) if d["days"] else None,
            "median_annual_wage": statistics.median(d["wages"]) if d["wages"] else None,
            "state": state,
            "code": d.get("code"),
        })

    prepared.sort(key=lambda r: (-r["total"], r["name"]))
    for i, r in enumerate(prepared, start=1):
        r["rank"] = i
    return prepared, aliases


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

DDL = [
    """CREATE TABLE IF NOT EXISTS perm_entity_alias (
         kind        TEXT NOT NULL,
         slug        TEXT NOT NULL,
         target_slug TEXT NOT NULL,
         PRIMARY KEY (kind, slug)
       )""",
    "CREATE INDEX IF NOT EXISTS perm_entity_alias_target "
    "ON perm_entity_alias (kind, target_slug)",
]

ENTITY_COLS = ["kind", "slug", "name", "merge_key", "rank", "total", "certified",
               "denied", "median_days", "median_annual_wage", "state", "code"]


def write_rows(db: Turso, table: str, cols: list[str], rows: list) -> None:
    """Chunked replace.

    INSERT OR REPLACE, not INSERT, and that is not a style choice.
    `lib_turso.pipeline` retries on a network error, and a request whose
    response is lost has still been applied on the server - so a plain INSERT
    turns one dropped packet into `UNIQUE constraint failed` at row 33,600 of
    79,000, halfway through a replace, with the table left in neither state.
    That happened. An idempotent write makes the retry harmless.
    """
    ph = "(" + ",".join("?" * len(cols)) + ")"
    head = f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES "
    pending = []
    for i in range(0, len(rows), CHUNK):
        batch = rows[i:i + CHUNK]
        args = [lit(r[c] if isinstance(r, dict) else r[j]) for r in batch
                for j, c in enumerate(cols)]
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
    ap.add_argument("--baseline",
                    help="JSON snapshot of the live perm_entities rows to honour instead "
                         "of reading the table. Use this to RE-RUN after a partial write.")
    ap.add_argument("--snapshot", default="/tmp/perm-entities-baseline.json",
                    help="where the pre-write snapshot is saved")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db = Turso()

    # ---- Snapshot the live table BEFORE anything is computed from it.
    #
    # The no-slug-dies guarantee is derived from the live table, and the run
    # then overwrites that same table. A write that fails halfway therefore
    # destroys its own baseline, and the RETRY reads the wreckage as truth
    # and cheerfully reports "0 aliases" because there is nothing left to
    # redirect. That happened: 33,600 of 79,386 rows landed, the second run
    # saw 33,600 live slugs, and every retired URL would have 404'd silently.
    # Re-run with --baseline pointing at the snapshot.
    if args.baseline:
        snap = json.loads(pathlib.Path(args.baseline).read_text())
        log(f"BASELINE from {args.baseline}: " +
            ", ".join(f"{len(v):,} {k}" for k, v in snap.items()))
    else:
        snap = {k: live_rows(db, k) for k in ("employer", "attorney", "occupation")}
        if not args.dry_run:
            pathlib.Path(args.snapshot).write_text(json.dumps(snap))
            log(f"BASELINE saved to {args.snapshot}: " +
                ", ".join(f"{len(v):,} {k}" for k, v in snap.items()))

    log("READ")
    kinds = build(read_cases(db, args.cache))

    all_entities, all_aliases = [], []
    log("MERGE")
    for kind in ("employer", "attorney", "occupation"):
        before = len(kinds[kind])
        folded, key_alias = fold_typos(kinds[kind], kind)
        live = snap[kind]
        prepared, aliases = assign(kind, folded, live, key_alias)

        # ---- THE GATE. Every live slug survives or redirects. Nothing dies.
        survivors = {r["slug"] for r in prepared}
        redirected = {a[1] for a in aliases}
        orphans = [r["slug"] for r in live if r["slug"] not in survivors and r["slug"] not in redirected]
        log(f"  {kind:11s} {before:,} keys -> {len(folded):,} entities "
            f"({before - len(folded):,} folded by the typo pass), "
            f"{len(live):,} live slugs -> {len(survivors):,} canonical + {len(aliases):,} aliases")
        if orphans:
            log(f"  FATAL: {len(orphans):,} live slugs would 404. First: {orphans[:5]}")
            log("  Refusing to write.")
            return 1
        targets = {a[2] for a in aliases}
        affected = sum(r["total"] for r in prepared if r["slug"] in targets)
        log(f"              {len(targets):,} entities absorbed a spelling; their combined "
            f"{affected:,} cases are what was split across several pages")
        all_entities += prepared
        all_aliases += aliases

    if args.dry_run:
        log("\nDRY RUN - nothing written")
        return 0

    log("WRITE")
    db.script(DDL)
    db.execute("DELETE FROM perm_entities")
    db.execute("DELETE FROM perm_entity_alias")
    write_rows(db, "perm_entities", ENTITY_COLS, all_entities)
    write_rows(db, "perm_entity_alias", ["kind", "slug", "target_slug"], all_aliases)

    # ---- Re-stamp the case rows.
    #
    # `perm_cases.employer_slug` / `attorney_slug` were written by
    # `store_cases.py` against the PRE-merge slug map, so after a merge the
    # 245 Fragomen cases filed under a mistyped spelling still point at the
    # slug that just became an alias. Nothing 404s - the browser filters by
    # slug rather than linking - so the failure is silent: the canonical
    # firm's case list would simply be short by every case it just absorbed.
    # One UPDATE per alias, which is 787 statements rather than 373,939 rows.
    log("RE-STAMP CASES")
    restamp_ok: list[bool] = []
    for col, kind in (("employer_slug", "employer"), ("attorney_slug", "attorney")):
        moves = [(a[1], a[2]) for a in all_aliases if a[0] == kind]
        pending = []
        for old, new in moves:
            pending.append({"type": "execute", "stmt": {
                "sql": f"UPDATE perm_cases SET {col} = ? WHERE {col} = ?",
                "args": [lit(new), lit(old)]}})
            if len(pending) >= 50:
                db.pipeline(pending + [{"type": "close"}])
                pending = []
        if pending:
            db.pipeline(pending + [{"type": "close"}])
        left = int(db.scalar(
            f"SELECT count(*) FROM perm_cases c JOIN perm_entity_alias a "
            f"ON a.kind = ? AND a.slug = c.{col}", [kind]) or 0)
        stamped_ok = left == 0
        restamp_ok.append(stamped_ok)
        log(f"  {'ok ' if stamped_ok else 'FATAL'} {col:14s} {len(moves):>4,} redirects applied, "
            f"{left} case rows still on a retired slug")

    log("VERIFY")
    ok = True
    for kind in ("employer", "attorney", "occupation"):
        want = sum(1 for r in all_entities if r["kind"] == kind)
        got = int(db.scalar("SELECT count(*) FROM perm_entities WHERE kind=?", [kind]) or 0)
        ok &= got == want
        log(f"  {'ok ' if got == want else 'MISMATCH'} {kind:11s} {got:>7,} of {want:,}")
    got = int(db.scalar("SELECT count(*) FROM perm_entity_alias") or 0)
    ok &= got == len(all_aliases)
    log(f"  {'ok ' if got == len(all_aliases) else 'MISMATCH'} aliases     {got:>7,} of {len(all_aliases):,}")

    # An alias that points at a slug that is not there is a redirect loop
    # into a 404, which is worse than the duplicate it replaced.
    dangling = int(db.scalar(
        "SELECT count(*) FROM perm_entity_alias a LEFT JOIN perm_entities e "
        "ON e.kind = a.kind AND e.slug = a.target_slug WHERE e.slug IS NULL") or 0)
    ok &= dangling == 0
    log(f"  {'ok ' if dangling == 0 else 'FATAL'} dangling aliases {dangling}")
    return 0 if (ok and all(restamp_ok)) else 1


if __name__ == "__main__":
    sys.exit(main())
