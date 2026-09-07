#!/usr/bin/env python3
"""Store every PERM entity into Convex, chunked.

The aggregate document cannot hold these: 12,000 employer rows measured
1.14 MB against Convex's 1 MB limit, which is why the old top-100 cap
existed. This walks the ingest payload, assigns collision-free slugs in the
same volume order the site uses, and writes each kind in chunks.

    python3 scripts/store_entities.py --payload /tmp/perm-payload.json
    python3 scripts/store_entities.py --payload /tmp/perm-payload.json --prod

Slugs MUST match src/lib/entitySlug.ts. A slug computed differently here
than in the app is a detail page that 404s from its own index, so the rules
are duplicated deliberately and asserted by a test fixture rather than
imported across the language boundary.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

CHUNK = 400


def slugify(raw: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", raw.lower())
    s = re.sub(r"-+", "-", s).strip("-")[:60]
    return s.rstrip("-")


def with_unique_slugs(items: list[dict], name_of) -> list[tuple[str, dict]]:
    """Mirrors withUniqueSlugs in src/lib/entitySlug.ts, including the order."""
    seen: dict[str, int] = {}
    out = []
    for item in items:
        base = slugify(name_of(item)) or "entity"
        n = seen.get(base, 0)
        seen[base] = n + 1
        out.append((base if n == 0 else f"{base}-{n + 1}", item))
    return out


def plan_sticky_slugs(items: list, name_of, prior: dict[str, str],
                      key_of=None) -> tuple[list[tuple[str, object]], list[str]]:
    """Assign slugs so that an entity keeps the slug it already has.

    `prior` maps an entity's identity key to the slug it holds in the live
    table; `key_of` derives that key from an item and defaults to its name.
    OCCUPATIONS NEED THE SOC CODE IN THE KEY: 54 titles in the live table
    belong to two codes each ("Managers, All Other" under two SOC codes), so
    keying on the title alone made the pair swap slugs on every rebuild, the
    exact defect this exists to stop. An item whose key is in `prior` keeps
    that slug; a newcomer
    takes the first free candidate (`base`, `base-2`, ...) that no prior or
    newly assigned slug holds. Every prior slug is RESERVED even when its
    owner is gone, so a newcomer can never inherit the URL of a different
    entity - that would point every link Google holds at the wrong company.

    Why this exists: with_unique_slugs assigns suffixes in volume order, and
    volume order changes every quarter. `acme` and `acme-2` swapped owners
    when the second firm out-filed the first, and every inbound link swapped
    with them. Returns (assigned in input order, prior slugs nobody kept).
    """
    key_of = key_of or name_of
    reserved = set(prior.values())
    used: set[str] = set()
    counters: dict[str, int] = {}
    out: list[tuple[str, object]] = []
    for item in items:
        name = name_of(item)
        keep = prior.get(key_of(item))
        if keep and keep not in used:
            slug = keep
        else:
            base = slugify(name) or "entity"
            n = counters.get(base, 0)
            cand = base if n == 0 else f"{base}-{n + 1}"
            while cand in reserved or cand in used:
                n += 1
                cand = f"{base}-{n + 1}"
            counters[base] = n + 1
            slug = cand
        used.add(slug)
        out.append((slug, item))
    vanished = sorted(reserved - used)
    return out, vanished


def plan_aliases(vanished: list[str], prior_key: dict[str, str],
                 key_slug: dict[str, str]) -> tuple[list[tuple[str, str]], list[str]]:
    """Where a vanished slug should redirect: to the busiest entity that now
    holds the same merge key (the spelling was absorbed), or nowhere.

    `prior_key` maps a prior slug to its merge key; `key_slug` maps a merge
    key to the busiest slug assigned this run. Returns (alias pairs
    (old, target), slugs with no target). A slug with no target is an entity
    that disappeared from the source entirely; the writer refuses on those
    unless told the loss is understood, because a page Google holds must not
    404 silently.
    """
    aliases: list[tuple[str, str]] = []
    unresolved: list[str] = []
    for old in vanished:
        target = key_slug.get(prior_key.get(old, ""))
        if target and target != old:
            aliases.append((old, target))
        else:
            unresolved.append(old)
    return aliases, unresolved


def run(fn: str, payload: dict, prod: bool) -> dict:
    """Call a Convex function and return its parsed result."""
    cmd = ["npx", "--yes", "convex", "run", fn, json.dumps(payload)]
    if prod:
        cmd.append("--prod")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"FATAL: {fn} failed\n{res.stderr[-2000:]}")
    # The CLI prints the return value as JSON, sometimes after a notice line.
    out = res.stdout.strip()
    start = out.find("{")
    if start == -1:
        return {}
    try:
        return json.loads(out[start:])
    except json.JSONDecodeError:
        return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True)
    ap.add_argument("--prod", action="store_true")
    args = ap.parse_args()

    p = json.load(open(args.payload))

    kinds = [
        ("employer", p.get("topEmployers") or [], lambda r: r["name"]),
        ("attorney", p.get("topAttorneys") or [], lambda r: r["name"]),
        ("occupation", p.get("topOccupations") or [], lambda r: r["title"]),
    ]

    total_written = 0
    for kind, rows, name_of in kinds:
        if not rows:
            print(f"{kind:11s} no rows in payload; skipping")
            continue
        # One order, used for ranks and slugs alike, matching the app.
        ordered = sorted(rows, key=lambda r: -r["total"])
        slugged = with_unique_slugs(ordered, name_of)

        prepared = []
        for i, (slug, r) in enumerate(slugged):
            row = {
                "slug": slug,
                "name": name_of(r),
                "rank": i + 1,
                "total": r["total"],
                "certified": r["certified"],
                "denied": r["denied"],
                "medianDays": r.get("medianDays"),
            }
            if "medianAnnualWage" in r:
                row["medianAnnualWage"] = r["medianAnnualWage"]
            if r.get("state"):
                row["state"] = r["state"]
            if r.get("code"):
                row["code"] = r["code"]
            prepared.append(row)

        assert len({r["slug"] for r in prepared}) == len(prepared), f"{kind}: slug collision survived"

        # Clear first, in its own repeated call. Convex counts reads per
        # function execution, so the delete cannot live inside the insert.
        cleared = 0
        while True:
            res = run("permEntities:clearKind", {"kind": kind}, args.prod)
            deleted = res.get("deleted", 0)
            cleared += deleted
            if res.get("done") or deleted == 0:
                break
        print(f"  {kind:11s} cleared {cleared:,} existing rows")

        for start in range(0, len(prepared), CHUNK):
            chunk = prepared[start : start + CHUNK]
            run("permEntities:insertChunk", {"kind": kind, "rows": chunk}, args.prod)
            print(f"  {kind:11s} {start + len(chunk):>6,} / {len(prepared):,}")
        total_written += len(prepared)
        print(f"{kind:11s} {len(prepared):,} rows stored")

    print(f"\ntotal {total_written:,} entity rows")
    if total_written == 0:
        sys.exit("FATAL: nothing was written; the payload had no entity arrays")
    return 0


if __name__ == "__main__":
    sys.exit(main())
