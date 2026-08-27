#!/usr/bin/env python3
"""Denial rate by offered wage, at a resolution the five-band view hides.

WHY THIS EXISTS. `ingest_perm_disclosure.py` emits `risk.byWage` over five
wide bands, and read at that resolution the data appears to say the middle of
the wage range is the most-denied part of it. It does not. The five-band view
produces that shape by averaging:

    $0k-$40k     4.96%  |
    $40k-$50k    7.26%  |  all three become "Under $60k", 5.22%
    $50k-$60k    4.41%  |
    $60k-$70k    6.93%  |  both become "$60k-$80k", 5.21%
    $70k-$80k    3.53%  |

The real maximum is $40k-$50k at 7.26%, it sits inside the bottom band, and
the coarse view cannot show it. Move the edges and the story moves with them.
A finding that depends on where an analyst drew a boundary is not a finding,
so the page shows the finer bands and says the shape is bin-sensitive.

BOTH RESOLUTIONS ARE WRITTEN, AND THE FINE ONES MUST SUM TO THE COARSE ONES.
That assertion is the whole safety of publishing two views of one dataset: if
they ever disagree, one read is wrong and the page would be showing a reader
two contradictory pictures with no way to tell which. Measured at build time,
not assumed.

The convention matches the page exactly: decided = certified + denied, and a
withdrawal sits on NEITHER side, because it is neither an approval nor a
refusal. Wages are the annualised offered wage the ingest already computed and
band-limited; rows without one are excluded and counted so the page can say
how many.

    python3 scripts/build_wage_bands.py            # write
    python3 scripts/build_wage_bands.py --dry-run  # print, write nothing
"""
from __future__ import annotations

import json
import sys
import time

from lib_turso import Turso

DOC_KEY = "wage_denial_bands"

# Lower bound, upper bound (exclusive), label. `None` is open-ended.
FINE_BANDS = [
    (0, 40_000, "Under $40k"),
    (40_000, 50_000, "$40k to $50k"),
    (50_000, 60_000, "$50k to $60k"),
    (60_000, 70_000, "$60k to $70k"),
    (70_000, 80_000, "$70k to $80k"),
    (80_000, 90_000, "$80k to $90k"),
    (90_000, 100_000, "$90k to $100k"),
    (100_000, 115_000, "$100k to $115k"),
    (115_000, 130_000, "$115k to $130k"),
    (130_000, 160_000, "$130k to $160k"),
    (160_000, None, "$160k and above"),
]

# The edges `ingest_perm_disclosure.py` uses, kept so the two can be
# reconciled. Every coarse edge is also a fine edge, which is what makes the
# sum check possible; a fine band straddling a coarse boundary would make the
# two views genuinely incomparable rather than merely different.
COARSE_BANDS = [
    (0, 60_000, "Under $60K"),
    (60_000, 80_000, "$60K-$80K"),
    (80_000, 100_000, "$80K-$100K"),
    (100_000, 130_000, "$100K-$130K"),
    (130_000, None, "Over $130K"),
]


def log(msg: str) -> None:
    print(msg, flush=True)


def cell(c):
    if c["type"] == "null":
        return None
    v = c["value"]
    if c["type"] == "integer":
        return int(v)
    if c["type"] == "float":
        return float(v)
    return v


def rows(db: Turso, sql: str, args: list | None = None) -> list[dict]:
    res = db.execute(sql, args or [])["response"]["result"]
    cols = [c["name"] for c in res["cols"]]
    return [dict(zip(cols, [cell(c) for c in r])) for r in res["rows"]]


def case_sql(bands) -> str:
    """A CASE expression labelling each row with its band, ordered by edge.

    Built from the band table rather than written out, so the SQL and the
    labels cannot drift apart. The index prefix keeps SQL's ordering the same
    as the table's without a second sort key.
    """
    arms = []
    for i, (_lo, hi, label) in enumerate(bands):
        tag = f"{i:02d} {label}"
        arms.append(
            f"WHEN wage < {hi} THEN '{tag}'" if hi is not None else f"ELSE '{tag}'"
        )
    return "CASE " + " ".join(arms) + " END"


def measure(db: Turso, bands) -> list[dict]:
    expr = case_sql(bands)
    r = rows(
        db,
        f"""SELECT {expr} AS band,
                   SUM(status IN ('certified','denied')) AS decided,
                   SUM(status = 'denied')                AS denied,
                   SUM(status = 'withdrawn')             AS withdrawn
              FROM perm_cases
             WHERE wage IS NOT NULL AND wage > 0
             GROUP BY band ORDER BY band""",
    )
    out = []
    for x in r:
        decided = x["decided"] or 0
        denied = x["denied"] or 0
        out.append(
            {
                "bucket": str(x["band"])[3:],
                "decided": decided,
                "denied": denied,
                "withdrawn": x["withdrawn"] or 0,
                "denialRate": round(denied / decided * 100, 2) if decided else None,
            }
        )
    return out


def main() -> int:
    dry = "--dry-run" in sys.argv
    db = Turso()
    log(f"  target: {db.url}")

    base = rows(db, "SELECT json FROM perm_docs WHERE key = 'disclosure_stats'")
    if not base:
        log("  FAIL: disclosure_stats is missing. Run the disclosure ingest first.")
        return 1
    stats = json.loads(base[0]["json"])
    source_files = stats.get("sourceFiles") or []
    if not source_files:
        log("  FAIL: disclosure_stats carries no sourceFiles.")
        return 1

    fine = measure(db, FINE_BANDS)
    coarse = measure(db, COARSE_BANDS)

    if len(fine) != len(FINE_BANDS) or len(coarse) != len(COARSE_BANDS):
        log(f"  FAIL: {len(fine)}/{len(FINE_BANDS)} fine, {len(coarse)}/{len(COARSE_BANDS)} coarse.")
        return 1

    # THE RECONCILIATION. Every coarse edge is a fine edge, so each coarse band
    # is exactly the fine bands inside it. If this ever fails the two views
    # describe different populations and neither can be trusted.
    idx = 0
    for lo, hi, label in COARSE_BANDS:
        d = n = 0
        while idx < len(FINE_BANDS) and (hi is None or FINE_BANDS[idx][1] is not None and FINE_BANDS[idx][1] <= hi):
            d += fine[idx]["decided"]
            n += fine[idx]["denied"]
            idx += 1
        if hi is None:  # the open-ended band swallows whatever is left
            while idx < len(FINE_BANDS):
                d += fine[idx]["decided"]
                n += fine[idx]["denied"]
                idx += 1
        c = next(x for x in coarse if x["bucket"] == label)
        if (d, n) != (c["decided"], c["denied"]):
            log(
                f"  FAIL: {label} coarse {c['decided']:,}/{c['denied']:,} but the fine "
                f"bands inside it sum to {d:,}/{n:,}. The two views disagree."
            )
            return 1
        log(f"  reconciled {label:<14} {c['decided']:>7,} decided  {c['denied']:>6,} denied")

    # Also reconcile against what the ingest already published, so a change in
    # its band edges shows up here rather than as two pages quietly disagreeing.
    published = {x["bucket"]: x for x in (stats.get("risk") or {}).get("byWage", [])}
    for c in coarse:
        p = published.get(c["bucket"])
        if p and (p["decided"], p["denied"]) != (c["decided"], c["denied"]):
            log(
                f"  FAIL: {c['bucket']} disagrees with risk.byWage "
                f"({p['decided']:,}/{p['denied']:,} vs {c['decided']:,}/{c['denied']:,})."
            )
            return 1
    log(f"  agrees with the published risk.byWage on all {len(published)} bands")

    no_wage = rows(
        db,
        """SELECT SUM(status IN ('certified','denied')) AS decided
             FROM perm_cases WHERE wage IS NULL OR wage <= 0""",
    )
    unbanded = (no_wage[0]["decided"] if no_wage else 0) or 0

    peak = max((b for b in fine if b["denialRate"] is not None), key=lambda b: b["denialRate"])
    log(f"  peak band {peak['bucket']} at {peak['denialRate']}% on {peak['decided']:,} decided")
    log(f"  {unbanded:,} decided cases carry no usable annualised wage")

    doc = {
        "fine": fine,
        "coarse": coarse,
        "unbandedDecided": unbanded,
        "sourceFiles": source_files,
    }

    if dry:
        log("  --dry-run: nothing written")
        return 0

    payload = json.dumps(doc, separators=(",", ":"))
    log(f"  writing perm_docs['{DOC_KEY}'] ({len(payload):,} bytes)")
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
        [DOC_KEY, payload, int(time.time() * 1000)],
    )
    check = rows(db, "SELECT length(json) AS n FROM perm_docs WHERE key = ?", [DOC_KEY])
    if not check or check[0]["n"] != len(payload):
        log("  FAIL: read-back does not match what was written.")
        return 1
    log("  ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
