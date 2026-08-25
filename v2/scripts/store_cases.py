#!/usr/bin/env python3
"""Store the case-level PERM rows in Convex, and the coverage doc with them.

Reads what `ingest_perm_disclosure.py --cases-out` wrote, joins each row to its
employer and law-firm slug, and loads the lot.

    python3 scripts/ingest_perm_disclosure.py --out /tmp/perm.json \\
        --cases-out /tmp/perm-cases.ndjson.gz
    python3 scripts/store_entities.py --payload /tmp/perm.json     # FIRST
    python3 scripts/store_cases.py --cases /tmp/perm-cases.ndjson.gz

## Order matters: entities before cases

The slugs are READ BACK from `permEntities` rather than recomputed here. They
could be recomputed - `store_entities.py` has the rules and they are
deterministic - but recomputing them means two programs independently deriving
the URL a case links to, and the failure mode of that is a detail page that
404s from its own index. Reading the table makes every slug a case links to a
slug that provably exists. It also means this script REFUSES to run before
`store_entities.py` has, which is the correct dependency and would otherwise
be an unwritten one.

## Two transports, and why the default is not the obvious one

`convex import --replace` hands the whole file to the deployment in one
server-side streaming job. The obvious alternative, looping a chunked
mutation the way `store_entities.py` does, cannot work at this size: Linux
caps a single argv string at 128 KB (MAX_ARG_STRLEN), which at ~430 bytes a
row is about 250 rows per call, which is roughly 1,040 invocations of
`npx convex run` for the insert alone. Measured at the usual 1.5-2 s of CLI
startup each, that is half an hour of process spawning inside a job whose
timeout is 45 minutes.

`--via-mutations` keeps that path anyway, byte-sized so it is correct rather
than merely slow. It is the fallback for a deployment where import is not
available, and it is the path the Convex tests exercise.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import subprocess
import sys
import tempfile
import time

# Sibling scripts. Python puts this file's directory on sys.path, so these
# resolve when the script is run as `python3 scripts/store_cases.py`.
from ingest_perm_disclosure import entity_key

# The exact field set `convex/permCases.ts` will accept, kept here in full.
#
# Deliberately duplicated rather than derived: `INGEST_ROW_FIELDS` in that file
# is the same list, pinned by its own test, and the pair is the only thing
# standing between a renamed field and a quarterly ingest that dies at its last
# step after twenty minutes of work. Convex's import validates against the
# schema too, so a mismatch cannot store bad data - this just fails first, and
# names the field.
# Same contract, for the wage cells. `WAGE_CELL_FIELDS` in
# convex/permWageStats.ts is the other half.
EXPECTED_WAGE_KEYS = {
    "count", "fiscalYear", "histogram", "kind", "key", "mean",
    "p10", "p25", "p5", "p50", "p75", "p90", "p95", "socCode", "socTitle", "state",
}

EXPECTED_ROW_KEYS = {
    "attorneyName", "attorneySlug", "caseNumber", "computedAt", "days",
    "decisionDate", "employerName", "employerSlug", "fiscalYear", "jobTitle",
    "receivedDate", "socCode", "socTitle", "state", "status", "wage",
}

# A single argv string is capped at 128 KB on Linux (MAX_ARG_STRLEN, 32 pages)
# regardless of the much larger ARG_MAX. Chunks are sized in BYTES rather than
# rows because row width varies by 3x between a one-word employer and a full
# law-firm name, and a row count that fits the average overflows on the tail.
MAX_ARG_BYTES = 96_000
# How many entity rows to pull per read. `permEntities.listByKind` caps at 2000.
ENTITY_PAGE = 2000


def log(msg: str) -> None:
    print(msg, flush=True)


def convex_cmd() -> list[str]:
    """Prefer the installed CLI. `npx` adds about a second per invocation."""
    local = os.path.join("node_modules", ".bin", "convex")
    return [local] if os.path.exists(local) else ["npx", "--yes", "convex"]


def run(fn: str, payload: dict, prod: bool):
    """Call a Convex function and return its parsed result.

    Parses the FIRST JSON value in the output, object or array alike. The
    version in `store_entities.py` looks for `{`, which finds the first object
    INSIDE an array response and then fails to parse it - a bug that only
    shows up the first time a caller reads a list.
    """
    cmd = [*convex_cmd(), "run", fn, json.dumps(payload, separators=(",", ":"))]
    if prod:
        cmd.append("--prod")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"FATAL: {fn} failed\n{res.stderr[-2000:]}")
    out = res.stdout
    starts = [i for i in (out.find("{"), out.find("[")) if i != -1]
    if not starts:
        return None
    try:
        return json.loads(out[min(starts):])
    except json.JSONDecodeError:
        return None


def load_slug_map(kind: str, prod: bool) -> dict[str, str]:
    """`entity_key(name) -> slug` for one entity kind, read from Convex.

    Keyed by `entity_key` rather than by the raw name because DOL prints one
    firm under several spellings and the ingest already merged them: the table
    holds the busiest spelling, and a case row may carry any of them.
    """
    out: dict[str, str] = {}
    collisions = 0
    after: float | None = None
    while True:
        args = {"kind": kind, "limit": ENTITY_PAGE}
        if after is not None:
            args["afterRank"] = after
        rows = run("permEntities:listByKind", args, prod)
        if not rows:
            break
        for row in rows:
            key = entity_key(row["name"])
            # Rows arrive in rank order, so the first spelling to claim a key
            # is the busiest one. A collision here would mean the ingest's
            # merge and this key disagree; count it rather than hiding it.
            if key in out:
                collisions += 1
                continue
            out[key] = row["slug"]
        after = rows[-1]["rank"]
        if len(rows) < ENTITY_PAGE:
            break
    log(f"  {kind:9s} {len(out):,} slugs" + (f"  ({collisions} key collisions)" if collisions else ""))
    return out


def resolve(cases_path: str, employers: dict[str, str], firms: dict[str, str], out_path: str) -> dict:
    """Stream the ingest's rows into loadable ones, adding the slugs.

    Streamed for the same reason the ingest streams: 259,000 rows held as
    Python dicts is a quarter of a gigabyte before any of it is serialised.
    """
    stamp = int(time.time() * 1000)
    counts = {"rows": 0, "withEmployerSlug": 0, "withAttorneySlug": 0, "withWage": 0, "withJobTitle": 0}
    with gzip.open(cases_path, "rt", encoding="utf-8") as src, open(out_path, "w") as dst:
        for line in src:
            row = json.loads(line)
            employer_name = row["employerName"]
            attorney_name = row["attorneyName"]
            # "" means no entity page, which is the honest state for an
            # employer below the entity floor of 3 cases. The UI renders those
            # as plain text rather than a link that would 404.
            row["employerSlug"] = employers.get(entity_key(employer_name), "") if employer_name else ""
            row["attorneySlug"] = firms.get(entity_key(attorney_name), "") if attorney_name else ""
            row["computedAt"] = stamp
            if counts["rows"] == 0:
                extra = sorted(set(row) - EXPECTED_ROW_KEYS)
                missing = sorted(EXPECTED_ROW_KEYS - set(row))
                if extra or missing:
                    sys.exit(
                        "FATAL: the case rows do not match what Convex accepts.\n"
                        f"  unexpected: {extra}\n  missing:    {missing}\n"
                        "Update EXPECTED_ROW_KEYS here and INGEST_ROW_FIELDS in "
                        "convex/permCases.ts together."
                    )
            counts["rows"] += 1
            if row["employerSlug"]:
                counts["withEmployerSlug"] += 1
            if row["attorneySlug"]:
                counts["withAttorneySlug"] += 1
            if row["wage"] is not None:
                counts["withWage"] += 1
            if row["jobTitle"]:
                counts["withJobTitle"] += 1
            dst.write(json.dumps(row, separators=(",", ":")) + "\n")
    return counts


def store_via_import(path: str, prod: bool) -> None:
    cmd = [
        *convex_cmd(), "import",
        "--table", "permCases",
        "--format", "jsonLines",
        "--replace", "--yes",
        path,
    ]
    if prod:
        cmd.append("--prod")
    log(f"  {' '.join(cmd[-7:])}")
    res = subprocess.run(cmd, text=True)
    if res.returncode != 0:
        sys.exit("FATAL: convex import failed. Re-run with --via-mutations to use the slow path.")


def store_via_mutations(path: str, prod: bool) -> None:
    """The chunked clear-then-insert path, byte-sized to fit one argv."""
    cleared = 0
    while True:
        res = run("permCases:clearBatch", {}, prod)
        deleted = (res or {}).get("deleted", 0)
        cleared += deleted
        if (res or {}).get("done") or deleted == 0:
            break
        if cleared % 30_000 == 0:
            log(f"  cleared {cleared:,}")
    log(f"  cleared {cleared:,} existing rows")

    chunk: list[dict] = []
    size = 0
    written = 0
    calls = 0

    def flush() -> None:
        nonlocal chunk, size, written, calls
        if not chunk:
            return
        run("permCases:insertChunk", {"rows": chunk}, prod)
        written += len(chunk)
        calls += 1
        if calls % 20 == 0:
            log(f"  inserted {written:,}")
        chunk, size = [], 0

    with open(path) as fh:
        for line in fh:
            row = json.loads(line)
            width = len(line)
            if chunk and size + width > MAX_ARG_BYTES:
                flush()
            chunk.append(row)
            size += width
    flush()
    log(f"  inserted {written:,} rows in {calls:,} calls")


def store_wage_stats(path: str, prod: bool) -> None:
    """Chunk the salary-explorer cells in, then write their meta document.

    Mutations rather than `convex import` here, unlike the case rows: the cell
    count is in the thousands, not the hundreds of thousands, so the whole set
    is roughly 20 calls and the extra transport is not worth its own code path.
    """
    payload = json.load(open(path))
    rows = payload.get("rows") or []
    if not rows:
        sys.exit(f"FATAL: {path} carries no wage cells. Refusing to clear the table.")

    extra = sorted(set(rows[0]) - EXPECTED_WAGE_KEYS)
    missing = sorted(EXPECTED_WAGE_KEYS - set(rows[0]))
    if extra or missing:
        sys.exit(
            "FATAL: the wage cells do not match what Convex accepts.\n"
            f"  unexpected: {extra}\n  missing:    {missing}\n"
            "Update EXPECTED_WAGE_KEYS here and WAGE_CELL_FIELDS in "
            "convex/permWageStats.ts together."
        )

    by_kind = {}
    for r in rows:
        by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
    log(f"  cells {len(rows):,}  {by_kind}")

    cleared = 0
    while True:
        res = run("permWageStats:clearBatch", {}, prod)
        deleted = (res or {}).get("deleted", 0)
        cleared += deleted
        if (res or {}).get("done") or deleted == 0:
            break
    log(f"  cleared {cleared:,} existing cells")

    chunk: list[dict] = []
    size = 0
    written = 0
    for r in rows:
        width = len(json.dumps(r, separators=(",", ":")))
        if chunk and size + width > MAX_ARG_BYTES:
            run("permWageStats:insertChunk", {"rows": chunk}, prod)
            written += len(chunk)
            chunk, size = [], 0
        chunk.append(r)
        size += width
    if chunk:
        run("permWageStats:insertChunk", {"rows": chunk}, prod)
        written += len(chunk)
    log(f"  inserted {written:,} cells")

    # LAST, same rule as the case coverage doc.
    res = run(
        "permWageStats:storeMeta",
        {
            "sourceFiles": payload.get("sourceFiles") or [],
            "binEdges": payload["binEdges"],
            "floors": payload["floors"],
            "policy": payload["policy"],
            "cells": len(rows),
            "fiscalYears": payload.get("fiscalYears") or [],
            "contentHash": payload["contentHash"],
        },
        prod,
    )
    log(f"  meta {res}")
    if not (res or {}).get("stored"):
        sys.exit("FATAL: the wage meta document was not stored.")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cases", required=True, help="The .ndjson.gz written by --cases-out")
    ap.add_argument("--meta", help="Defaults to <cases>.meta.json")
    ap.add_argument(
        "--wages",
        help="Also store the salary-explorer cells written by --wages-out.",
    )
    ap.add_argument("--prod", action="store_true")
    ap.add_argument(
        "--via-mutations",
        action="store_true",
        help="Use the chunked clear/insert mutations instead of `convex import`.",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Resolve the slugs and report, without writing anything to Convex.",
    )
    args = ap.parse_args()

    meta_path = args.meta or args.cases + ".meta.json"
    if not os.path.exists(meta_path):
        # The ingest writes the meta file LAST. Its absence means the ingest
        # died partway, and the .ndjson.gz next to it is a truncated file that
        # would replace a good table with a partial one.
        sys.exit(f"FATAL: {meta_path} is missing, so {args.cases} is a partial write.")
    meta = json.load(open(meta_path))
    if meta.get("totalCases", 0) <= 0:
        sys.exit("FATAL: the meta file reports no cases. Refusing to clear the table.")

    log(f"cases   {args.cases}")
    log(f"meta    {meta['totalCases']:,} rows, decisions {meta['firstDecisionDate']} to {meta['lastDecisionDate']}")

    log("Reading entity slugs from Convex (store_entities.py must have run first)")
    employers = load_slug_map("employer", args.prod)
    firms = load_slug_map("attorney", args.prod)
    if not employers:
        sys.exit(
            "FATAL: permEntities holds no employers. Run store_entities.py first, "
            "or every case row would link nowhere."
        )

    with tempfile.TemporaryDirectory() as tmp:
        resolved = os.path.join(tmp, "permCases.jsonl")
        log("Resolving slugs")
        counts = resolve(args.cases, employers, firms, resolved)
        size = os.path.getsize(resolved) / 1e6

        # Counts before the verdict. A run that resolved nothing has to be
        # loud, not a clean zero.
        log("")
        log(f"rows                 {counts['rows']:,}")
        log(f"  employer slug      {counts['withEmployerSlug']:,}")
        log(f"  law firm slug      {counts['withAttorneySlug']:,}")
        log(f"  annualised wage    {counts['withWage']:,}")
        log(f"  job title          {counts['withJobTitle']:,}")
        log(f"resolved file        {size:.1f} MB")
        log("")

        if counts["rows"] != meta["totalCases"]:
            sys.exit(
                f"FATAL: read {counts['rows']:,} rows but the meta says "
                f"{meta['totalCases']:,}. The artifact pair does not match."
            )
        if counts["rows"] == 0:
            sys.exit("FATAL: nothing to store.")
        if counts["withEmployerSlug"] == 0:
            sys.exit(
                "FATAL: not one row matched an employer slug. The entity table and "
                "this artifact came from different ingests."
            )

        if args.dry_run:
            log("--dry-run: nothing written to Convex")
            return 0

        log("Storing rows")
        if args.via_mutations:
            store_via_mutations(resolved, args.prod)
        else:
            store_via_import(resolved, args.prod)

    # LAST, so a run that dies partway leaves the previous coverage statement
    # standing rather than advertising a row count the table does not have.
    log("Storing the coverage document")
    res = run(
        "permCases:storeMeta",
        {
            "sourceFiles": meta.get("sourceFiles") or [],
            "totalCases": meta["totalCases"],
            "firstDecisionDate": meta["firstDecisionDate"],
            "lastDecisionDate": meta["lastDecisionDate"],
            "firstReceivedDate": meta["firstReceivedDate"],
            "lastReceivedDate": meta["lastReceivedDate"],
            "byStatus": meta["byStatus"],
            "byFiscalYear": meta["byFiscalYear"],
            "byState": meta["byState"],
            "contentHash": meta["contentHash"],
        },
        args.prod,
    )
    log(f"  {res}")
    if not (res or {}).get("stored"):
        sys.exit("FATAL: the coverage document was not stored.")

    if args.wages:
        log("Storing the salary-explorer cells")
        store_wage_stats(args.wages, args.prod)
    return 0


if __name__ == "__main__":
    sys.exit(main())
