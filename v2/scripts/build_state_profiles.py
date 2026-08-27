#!/usr/bin/env python3
"""Per-state PERM profiles: who files there, for what, and how it reads against the field.

WHY THIS IS A PRECOMPUTE AND NOT A PAGE QUERY. The aggregation is a GROUP BY
over all 373,939 rows of `perm_cases` on a column pair with no covering index.
Measured against the live database over Hrana: 96 seconds for the employer
grouping, 16 for the occupation one. That is not a request-path query at any
revalidate setting, and `disclosure_stats` already establishes the pattern of
a precomputed document read by one cheap lookup.

WHY IT GROUPS ON `employer_slug` AND NOT `employer_name`. DOL prints the same
firm under several spellings. Washington's top employer is "Microsoft
Corporation" with 4,130 cases AND "MICROSOFT CORPORATION" with 1,690, which
ranked as two different companies and understated the real leader by 29%.
Both carry the same `employer_slug`, so the slug is the identity and the name
is a label: the label chosen here is the spelling that appears most often,
which is also the one the entity page shows.

WHY IT DOES NOT READ `perm_entities`. That table is rebuilt in chunks with the
first chunk clearing the kind, so mid-rebuild it holds one kind and not the
others. A build step that reads it can silently produce a document with no
occupation labels at all. Everything here comes out of `perm_cases`, which is
written once per quarterly ingest and is never partially present.

RUN IT AFTER EVERY `ingest_perm_disclosure.py` RUN. It reads the same corpus
and stamps the same `sourceFiles`, so if the two disagree the page can tell
and the reader is not shown state leaders from an older window than the
figures beside them. It is a post-ingest step, which is exactly the shape of
script that ends up never being run: `indexnow.py` sat correct and uncalled
for weeks for the same reason. It belongs in the ingest runbook.

    python3 scripts/build_state_profiles.py            # write
    python3 scripts/build_state_profiles.py --dry-run  # print, write nothing
"""
from __future__ import annotations

import collections
import json
import sys
import time

from lib_turso import Turso, lit

DOC_KEY = "state_profiles"

# How many leaders to carry per state. Three is what a card holds without
# becoming a table, and the fourth is never the point a reader takes away.
TOP_N = 3

# A state needs this many decided cases before its approval rate is published
# with a comparison to the field. Same floor the ranked rate views use
# (`DEFAULT_RATE_FLOOR` in src/components/tools/RateBars.tsx). Duplicated as a
# number rather than imported across languages; the page asserts they agree.
RATE_FLOOR = 100


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


def median(values: list[float]) -> float | None:
    if not values:
        return None
    s = sorted(values)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2


def soc_base(code: str) -> str:
    """The SOC code without its O*NET detail suffix.

    DOL writes the same occupation as both `51-3022` and `51-3022.00`, and
    grouping on the raw string ranked Alabama's top three as "Meat, Poultry,
    and Fish Cutters and Trimmers" at 2,906, the SAME occupation at 221, and
    software at 106. Two of the three slots went to one job printed twice.

    It cuts at the dot ONLY. `15-1132` (Software Developers, Applications) is
    the 2010 code that the 2018 revision split into `15-1252` and others, and
    those are genuinely different codes with different bases: merging by
    prefix length would fold two real occupations together in the name of
    fixing a formatting difference.
    """
    return code.split(".", 1)[0].strip()


def top_by_count(counts: dict[str, int], labels: dict[str, str], n: int) -> list[dict]:
    """The n biggest keys, each with its label and count.

    Ties broken on the key so a rebuild of the same corpus produces the same
    document. An unstable order would show as a content change on every run.
    """
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:n]
    return [{"key": k, "label": labels.get(k, k), "count": c} for k, c in ranked]


def build(db: Turso) -> dict:
    log("  reading state x employer")
    t = time.time()
    emp = rows(
        db,
        """SELECT state, employer_slug AS slug, employer_name AS name, COUNT(*) AS n
             FROM perm_cases
            WHERE state IS NOT NULL AND state <> ''
              AND employer_slug IS NOT NULL AND employer_slug <> ''
            GROUP BY state, employer_slug, employer_name""",
    )
    log(f"    {len(emp):,} rows in {time.time() - t:.0f}s")

    log("  reading state x occupation")
    t = time.time()
    occ = rows(
        db,
        """SELECT state, soc_code AS code, soc_title AS title, COUNT(*) AS n
             FROM perm_cases
            WHERE state IS NOT NULL AND state <> ''
              AND soc_code IS NOT NULL AND soc_code <> ''
            GROUP BY state, soc_code, soc_title""",
    )
    log(f"    {len(occ):,} rows in {time.time() - t:.0f}s")

    log("  reading state outcomes and wages")
    t = time.time()
    outcome = rows(
        db,
        """SELECT state,
                  SUM(status IN ('certified','denied'))            AS decided,
                  SUM(status = 'denied')                           AS denied,
                  SUM(status = 'withdrawn')                        AS withdrawn,
                  COUNT(*)                                         AS total
             FROM perm_cases
            WHERE state IS NOT NULL AND state <> ''
            GROUP BY state""",
    )
    log(f"    {len(outcome):,} rows in {time.time() - t:.0f}s")

    # Labels are per (slug, spelling) and per (code, title). Collapse to the
    # modal spelling: the identity is the slug or the code, never the string.
    emp_counts: dict[str, dict[str, int]] = collections.defaultdict(
        lambda: collections.defaultdict(int)
    )
    emp_labels: collections.Counter = collections.Counter()
    for r in emp:
        emp_counts[r["state"]][r["slug"]] += r["n"]
        emp_labels[(r["slug"], r["name"])] += r["n"]

    occ_counts: dict[str, dict[str, int]] = collections.defaultdict(
        lambda: collections.defaultdict(int)
    )
    occ_labels: collections.Counter = collections.Counter()
    for r in occ:
        base = soc_base(r["code"])
        occ_counts[r["state"]][base] += r["n"]
        if r["title"]:
            occ_labels[(base, r["title"])] += r["n"]

    def modal(counter: collections.Counter) -> dict[str, str]:
        best: dict[str, tuple[int, str]] = {}
        for (key, label), n in counter.items():
            cur = best.get(key)
            # Count first, then the label itself, so ties resolve the same way
            # every run rather than on dict order.
            if cur is None or (n, label) > cur:
                best[key] = (n, label)
        return {k: v[1] for k, v in best.items()}

    emp_label = modal(emp_labels)
    occ_label = modal(occ_labels)

    field_decided = sum(r["decided"] or 0 for r in outcome)
    field_denied = sum(r["denied"] or 0 for r in outcome)
    field_rate = (field_denied / field_decided * 100) if field_decided else None

    profiles = []
    for r in sorted(outcome, key=lambda x: -(x["total"] or 0)):
        st = r["state"]
        decided = r["decided"] or 0
        denied = r["denied"] or 0
        total = r["total"] or 0
        top_occ = top_by_count(occ_counts.get(st, {}), occ_label, TOP_N)
        top_emp = top_by_count(emp_counts.get(st, {}), emp_label, TOP_N)
        # Concentration: what share of the state's filings sit in its single
        # biggest occupation, and in its single biggest employer. This is the
        # thing a choropleth cannot say. Alabama reads as an ordinary small
        # state on a volume map and is 58% one occupation.
        occ_share = (top_occ[0]["count"] / total * 100) if top_occ and total else None
        emp_share = (top_emp[0]["count"] / total * 100) if top_emp and total else None
        profiles.append(
            {
                "state": st,
                "total": total,
                "decided": decided,
                "denied": denied,
                "withdrawn": r["withdrawn"] or 0,
                # Null rather than a number below the floor. A denial rate over
                # forty decided cases moves several points on one denial, and a
                # page that prints it next to California's invites the
                # comparison the floor exists to prevent.
                "denialRate": round(denied / decided * 100, 2)
                if decided >= RATE_FLOOR
                else None,
                "topOccupations": top_occ,
                "topEmployers": top_emp,
                "topOccupationShare": round(occ_share, 1) if occ_share is not None else None,
                "topEmployerShare": round(emp_share, 1) if emp_share is not None else None,
            }
        )

    return {
        "rateFloor": RATE_FLOOR,
        "fieldDecided": field_decided,
        "fieldDenied": field_denied,
        "fieldDenialRate": round(field_rate, 2) if field_rate is not None else None,
        "states": profiles,
    }


def main() -> int:
    dry = "--dry-run" in sys.argv
    db = Turso()
    log(f"  target: {db.url}")

    # The window this document describes, taken from the aggregate the rest of
    # the site reads. Stamped in so a page can compare the two and say nothing
    # rather than presenting leaders from one ingest beside figures from
    # another.
    base = rows(db, "SELECT json FROM perm_docs WHERE key = 'disclosure_stats'")
    if not base:
        log("  FAIL: disclosure_stats is missing. Run the disclosure ingest first.")
        return 1
    stats = json.loads(base[0]["json"])
    source_files = stats.get("sourceFiles") or []
    if not source_files:
        log("  FAIL: disclosure_stats carries no sourceFiles.")
        return 1

    doc = build(db)
    doc["sourceFiles"] = source_files
    doc["uniqueCases"] = stats.get("uniqueCases")

    states = doc["states"]
    if len(states) < 40:
        # A truncated read is the failure mode that reads exactly like a pass:
        # the document is well-formed and the page renders a shorter map.
        log(f"  FAIL: only {len(states)} states. Expected every one DOL records.")
        return 1
    missing_labels = [
        s["state"]
        for s in states
        if any(o["label"] == o["key"] for o in s["topOccupations"])
    ]
    if missing_labels:
        log(f"  FAIL: occupation codes with no title in {missing_labels[:5]}")
        return 1

    # Reconcile against the site's canonical baseline. These are two different
    # universes and they SHOULD differ: `risk.baseline` counts every decided
    # case, this counts only the ones DOL recorded a worksite state for. The
    # gap is the point of the check. If it ever inverted or blew out, one of
    # the two reads is wrong. The page never prints the figure below; it reads
    # `risk.baseline` so the site quotes one number for "a PERM case".
    canon = (stats.get("risk") or {}).get("baseline") or {}
    canon_decided = canon.get("decided")
    if isinstance(canon_decided, int) and canon_decided > 0:
        unplaced = canon_decided - doc["fieldDecided"]
        if unplaced < 0:
            log(
                f"  FAIL: {doc['fieldDecided']:,} state-attributed decided cases "
                f"exceeds the {canon_decided:,} decided cases in the corpus."
            )
            return 1
        log(
            f"  reconcile: {doc['fieldDecided']:,} decided carry a state, "
            f"{unplaced:,} do not ({doc['fieldDenialRate']}% vs "
            f"{canon.get('denialRate')}% site-wide)"
        )

    log(f"  {len(states)} states, floor {doc['rateFloor']}, window {' + '.join(source_files)}")
    for s in states[:3]:
        lead = s["topOccupations"][0] if s["topOccupations"] else None
        log(
            f"    {s['state']:>3} {s['total']:>7,} filings"
            + (f"  top: {lead['label']} ({s['topOccupationShare']}%)" if lead else "")
        )

    if dry:
        log("  --dry-run: nothing written")
        return 0

    payload = json.dumps(doc, separators=(",", ":"))
    log(f"  writing perm_docs['{DOC_KEY}'] ({len(payload):,} bytes)")
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
        [DOC_KEY, payload, int(time.time() * 1000)],
    )

    # Read it back. An INSERT that a pipeline reported as fine is not evidence
    # the row is there in the shape the reader expects.
    check = rows(db, "SELECT length(json) AS n FROM perm_docs WHERE key = ?", [DOC_KEY])
    if not check or check[0]["n"] != len(payload):
        log("  FAIL: read-back does not match what was written.")
        return 1
    log("  ok")
    return 0


if __name__ == "__main__":
    # `lit` is imported for parity with the other ingest scripts, which pass
    # arguments through it. Turso.execute already applies it.
    _ = lit
    raise SystemExit(main())
