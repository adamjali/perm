#!/usr/bin/env python3
"""Everything an entity page needs beyond its own four numbers.

python3 scripts/build_entity_detail.py --cache /tmp/cases.jsonl
python3 scripts/build_entity_detail.py --dry-run
python3 scripts/build_entity_detail.py --live-recent-only   # after each sweep

Two tables, from two corpora:

`perm_entity_pending` comes from `perm_case_status`, the live per-case table,
the only source that knows a case is still waiting (DOL's disclosure files carry
a decision on every row). It lets a sponsor page say how many of its cases are
in analyst review right now. It is refreshed, diffed, with the live remainder
after every sweep, because the page prints it under the sweep's date.

`perm_entity_facets` comes from `perm_cases`, the decided corpus, and says what
an entity's filings are made of: which occupations, which states, which firm
filed them, and for a firm, which employers it files for. Rolled up here rather
than grouped on every page render.

Facets are built only for entities with a page (`MIN_TOTAL_FOR_PAGE`): below
that the facet is the entity, one case in one occupation in one state.

The live table holds employer spellings the decided corpus has no entity for
(filed after the last disclosure file). Their pending counts are real but have
no entity page to land on, and the unmatched share is reported rather than
silently dropped.
"""
from __future__ import annotations

import argparse
import datetime
import time
import json
import pathlib
import sys
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entity_identity import entity_key  # noqa: E402
from lib_naics import naics_title, normalize_naics  # noqa: E402
from lib_slugs import slugify  # noqa: E402
from lib_turso import (  # noqa: E402
    ET, Turso, add_missing_columns, cell, et_date, insert_rows, record_run, rows_of,
    stamp_freshness, write_doc,
)

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


def raw_rows(res) -> list[list]:
    """An `execute()` response's rows with the Hrana cells undecoded, for the
    diff normalisers, which accept a stored row and a built one alike."""
    return res["response"]["result"]["rows"]


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
            rs = raw_rows(res)
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

def build_live_recent(db: Turso, maps) -> tuple[list[dict], str]:
    """Every live case the published files do not hold, slugged for search.

    The disclosure files carry only decided cases, and only up to the last
    published quarter, so without this table everything they miss would be
    invisible to the case search and to its employer's page.

    The rule is membership, not date: a case belongs here when `perm_cases`
    does not hold it. A date boundary would drop every case filed before it
    and still pending, which is exactly who searches for their own case; and
    membership needs no boundary to drift, and self-corrects when a quarterly
    file lands and absorbs part of the set.

    Writes are diffed (`write_live_recent`): the set is ~137k rows and its
    membership barely moves from one night to the next.
    """
    got = raw_rows(db.execute(
        "SELECT s.case_number, s.filing_date, s.current_status, s.is_final, "
        "s.employer_name, s.job_title, s.fetched_at FROM perm_case_status s "
        "WHERE NOT EXISTS (SELECT 1 FROM perm_cases c "
        "                   WHERE c.case_number = s.case_number)"))
    boundary = str(db.scalar("SELECT MAX(decision_date) FROM perm_cases") or "")[:7]
    seen = decided_seen_map(db)
    emp = maps["employer"]
    out = []
    matched = 0
    for r in got:
        name = cell(r[4]) or ""
        hit = emp.get(entity_key(name)) if name else None
        if hit is not None:
            matched += 1
        case = cell(r[0])
        fin = int(cell(r[3]) or 0)
        out.append({
            "case_number": case,
            "filing_date": cell(r[1]),
            "status": cell(r[2]),
            "is_final": fin,
            "employer_name": name,
            # A matched employer carries its canonical entity slug, the one its
            # page and the case search are built from; a name the entity
            # tables have never seen gets its own slug.
            "employer_slug": hit[0] if hit is not None else slugify(name),
            "job_title": cell(r[5]),
            "decided_seen": seen.get(str(case)) if fin else None,
            # The Eastern day this case last changed as the page shows it:
            # fetched_at is rewritten only when the status, employer or job
            # title changes, so an employer's newest one dates its live-only
            # page. Carried for the live-only index; NOT a perm_live_recent
            # column, so live_norm and the diffed write never see it.
            "changed_on": et_date(cell(r[6])),
        })
    log(f"  live-recent: {len(out):,} cases absent from the disclosure corpus "
        f"(published through {boundary}), {matched:,} matched to a known entity")
    return out, boundary


LIVE_RECENT_DDL = [
    """CREATE TABLE IF NOT EXISTS perm_live_recent (
         case_number   TEXT PRIMARY KEY,
         filing_date   TEXT,
         status        TEXT,
         is_final      INTEGER,
         employer_name TEXT,
         employer_slug TEXT,
         job_title     TEXT,
         decided_seen  TEXT)""",
    "CREATE INDEX IF NOT EXISTS perm_live_recent_emp "
    "ON perm_live_recent (employer_slug, filing_date DESC)",
    # The two browse orders on /perm-cases and /perm-queue/[month]. Equality
    # first, the range/sort column next, the unique tiebreak last, so
    # `WHERE is_final = ? [AND filing_date range] ORDER BY filing_date,
    # case_number` is one reverse index scan of `take + 1` rows at any offset.
    # The planner has no statistics to lean on, so an index has to win on shape.
    "CREATE INDEX IF NOT EXISTS perm_live_recent_final_filed "
    "ON perm_live_recent (is_final, filing_date, case_number)",
    "CREATE INDEX IF NOT EXISTS perm_live_recent_filed "
    "ON perm_live_recent (filing_date, case_number)",
]


LIVE_COLS = ["case_number", "filing_date", "status", "is_final",
             "employer_name", "employer_slug", "job_title", "decided_seen"]


def ensure_live_recent_columns(db: Turso) -> None:
    """Add the columns the CREATE TABLE above gained after the table existed."""
    if add_missing_columns(db, "perm_live_recent", {"decided_seen": "TEXT"}):
        log("  added column perm_live_recent.decided_seen")


def decided_seen_map(db: Turso) -> dict[str, str]:
    """case_number -> the day OUR sweep first recorded a final status.

    An observation date, never DOL's decision date: DOL's per-case lookup
    does not return one. Only cases whose decision the sweep actually watched
    have an entry; the rest were already decided when first recorded and stay
    null. `CERTIFIED - EXPIRED` is a clock running out, not a decision, so the
    three real outcomes are named explicitly.
    """
    out: dict[str, str] = {}
    for r in raw_rows(db.execute(
            "SELECT case_number, MIN(changed_at) FROM perm_case_events "
            "WHERE to_final = 1 AND to_status IN ('CERTIFIED', 'DENIED', 'WITHDRAWN') "
            "GROUP BY case_number")):
        ms = cell(r[1])
        if ms is None:
            continue
        secs = int(ms) / 1000 if int(ms) > 10_000_000_000 else int(ms)
        out[str(cell(r[0]))] = datetime.datetime.fromtimestamp(
            secs, tz=datetime.timezone.utc).strftime("%Y-%m-%d")
    return out


LIVE_REMAINDER_DOC = "live_remainder"


RECENT_WAIT_DAYS = 90
DIRECT_SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, direct)"


def wait_summary(pairs: list[tuple[str, object]]) -> dict | None:
    """Filing-to-decision days over observed decisions, as percentiles.

    `pairs` is (filing_date, changed_at stamp) for each decision the sweep
    WATCHED happen. Pure, so the test pins it. Null under 20 decisions: a
    percentile over a handful is a list, not a distribution.
    """
    days = []
    for filed, stamp in pairs:
        decided = et_date(stamp)
        if not filed or not decided:
            continue
        d = (datetime.date.fromisoformat(decided) - datetime.date.fromisoformat(filed[:10])).days
        if d >= 0:
            days.append(d)
    if len(days) < 20:
        return None
    days.sort()
    pick = lambda q: days[min(len(days) - 1, int(q * len(days)))]  # noqa: E731
    return {"n": len(days), "p10": pick(0.10), "p25": pick(0.25), "p50": pick(0.50),
            "p75": pick(0.75), "p90": pick(0.90)}


EMPLOYER_RANK_MIN = 20


def employer_waits(by_emp: dict[str, list], names: dict[str, str]) -> list[dict]:
    """Employers with at least EMPLOYER_RANK_MIN observed decisions in the
    window, fastest median first. Ties break on more decisions, then slug, so
    the order is stable night to night. Pure, for the test."""
    out = []
    for slug, pairs in by_emp.items():
        s = wait_summary(pairs)
        if s is None or s["n"] < EMPLOYER_RANK_MIN:
            continue
        out.append({"slug": slug, "name": names.get(slug, slug), "n": s["n"], "p50": s["p50"]})
    out.sort(key=lambda x: (x["p50"], -x["n"], x["slug"]))
    return out


def write_recent_wait(db: Turso) -> bool:
    """perm_docs['recent_decision_wait']: how long the cases DOL decided in
    the last 90 days took, filing to decision, for employer pages to compare
    one employer against.

    Decisions the sweep watched, not first sightings: `decided_seen` dates a
    case the first time we saw it final, which for a case discovered late is
    months after DOL decided it. A final event exists only when the sweep saw
    the case pending and then decided, so it is dated to within the half day
    between sweeps. Expirations and withdrawals are left out: neither is DOL
    deciding a case.
    """
    since = int((time.time() - RECENT_WAIT_DAYS * 86_400) * 1000)
    rows = raw_rows(db.execute(
        "SELECT s.filing_date, MIN(e.changed_at), r.employer_slug, r.employer_name "
        "FROM perm_case_events e "
        "JOIN perm_case_status s ON s.case_number = e.case_number "
        "LEFT JOIN perm_live_recent r ON r.case_number = e.case_number "
        "WHERE e.changed_at >= ? AND e.source = ? AND e.to_final = 1 "
        "AND e.from_status NOT LIKE 'CERTIFIED%' AND e.from_status NOT LIKE 'DENIED%' "
        "AND e.from_status NOT LIKE 'WITHDRAWN%' AND e.to_status NOT LIKE 'WITHDRAWN%' "
        "GROUP BY e.case_number", [since, DIRECT_SOURCE]))
    val = lambda c: cell(c)  # noqa: E731
    pairs = [(val(r[0]), val(r[1])) for r in rows]
    summary = wait_summary(pairs)
    if summary is None:
        log("  recent_decision_wait: fewer than 20 observed decisions; doc left as it was")
        return False
    by_emp: dict[str, list] = defaultdict(list)
    names: dict[str, str] = {}
    for r in rows:
        slug = val(r[2])
        if slug:
            by_emp[slug].append((val(r[0]), val(r[1])))
            names[slug] = val(r[3]) or slug
    ranked = employer_waits(by_emp, names)
    doc = {**summary, "windowDays": RECENT_WAIT_DAYS,
           "computedOn": datetime.datetime.now(ET).date().isoformat(),
           "employersRanked": len(ranked), "minDecisions": EMPLOYER_RANK_MIN,
           "fastest": ranked[:10], "slowest": list(reversed(ranked[-10:])) if len(ranked) > 10 else []}
    write_doc(db, "recent_decision_wait", json.dumps(doc))
    log(f"  recent_decision_wait: n={summary['n']:,}, median {summary['p50']} days")
    return True


def write_live_remainder_doc(db: Turso, live: list[dict]) -> bool:
    """Precompute the live remainder's counts into perm_docs['live_remainder'].

    The /perm-cases page prints "N decided and M pending since DOL's last
    file" and offers a month picker. Counting the whole table per request is
    too many rows read, so the counts are written here, by the run that writes
    the rows they describe; the reader treats a doc older than eight days as
    absent.
    """
    published_through = db.scalar("SELECT MAX(decision_date) FROM perm_cases")
    by_month: dict[str, dict[str, int]] = {}
    counts = {"pending": 0, "decided": 0, "certified": 0, "denied": 0, "withdrawn": 0}
    for row in live:
        fin = int(row["is_final"] or 0)
        counts["decided" if fin else "pending"] += 1
        st = (row["status"] or "").upper()
        if st in ("CERTIFIED", "DENIED", "WITHDRAWN"):
            counts[st.lower()] += 1
        m = (row["filing_date"] or "")[:7]
        if len(m) == 7:
            b = by_month.setdefault(m, {"total": 0, "pending": 0, "decided": 0})
            b["total"] += 1
            b["decided" if fin else "pending"] += 1
    doc = {
        "total": len(live),
        **counts,
        "publishedThrough": str(published_through) if published_through else None,
        "asOf": datetime.datetime.now(tz=datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "byMonth": [{"month": m, **v} for m, v in
                    sorted(by_month.items(), key=lambda kv: kv[1]["total"], reverse=True)],
    }
    payload = json.dumps(doc, separators=(",", ":"))
    db.execute("""CREATE TABLE IF NOT EXISTS perm_docs (
        key TEXT PRIMARY KEY, json TEXT NOT NULL, computed_at INTEGER NOT NULL)""")
    write_doc(db, LIVE_REMAINDER_DOC, payload)
    # Read it back: an INSERT the pipeline reported as fine is not evidence
    # the row is there in the shape the reader expects.
    got = db.scalar("SELECT length(json) FROM perm_docs WHERE key = ?", [LIVE_REMAINDER_DOC])
    ok = int(got or 0) == len(payload)
    log(f"  {'ok ' if ok else 'MISMATCH'} perm_docs[{LIVE_REMAINDER_DOC}]  "
        f"{counts['decided']:,} decided, {counts['pending']:,} pending, "
        f"{len(by_month)} months, {len(payload):,} bytes")
    return ok


def live_norm(row) -> tuple:
    """One row of `perm_live_recent` as comparable values, from either side.

    One normaliser for both sides: libSQL returns every integer as a string, so
    a stored `is_final` arrives as '0' while a freshly built row holds int 0.
    Compared raw, every row looks changed and the diff rewrites the whole table
    while reporting success. Accepts a built dict or a libSQL row tuple and
    returns the same shape for both.
    """
    is_tuple = not isinstance(row, dict)
    out = []
    for i, col in enumerate(LIVE_COLS):
        v = cell(row[i]) if is_tuple else row[col]
        out.append(int(v or 0) if col == "is_final" else ("" if v is None else str(v)))
    return tuple(out)


def write_live_recent(db: Turso, live: list[dict],
                      extra_changed: dict[str, int] | None = None) -> bool:
    """Write only what changed.

    The set is ~137k rows and on an ordinary day only a few hundred change
    status or arrive, so the desired set is compared against what is stored
    and only the difference is written, rather than deleting and reinserting
    every row.

    The comparison is on the whole row, not on `case_number`: a case whose
    status moved keeps its number, and a membership-only diff would leave the
    old status in the search index forever.
    """
    for ddl in LIVE_RECENT_DDL:
        db.execute(ddl)
    ensure_live_recent_columns(db)

    stored: dict[str, tuple] = {}
    for r in raw_rows(db.execute(
            "SELECT " + ", ".join(LIVE_COLS) + " FROM perm_live_recent")):
        vals = live_norm(r)
        stored[str(vals[0])] = vals

    changed = []
    for row in live:
        key = str(row["case_number"])
        want = live_norm(row)
        have = stored.get(key)
        if have is None or have[1:] != want[1:]:
            changed.append(row)

    wanted_keys = {str(r["case_number"]) for r in live}
    gone = [k for k in stored if k not in wanted_keys]

    # Deleted first: a case that has just been absorbed into a quarterly file
    # must not be served from both tables while the insert half runs.
    for i in range(0, len(gone), 500):
        chunk = gone[i:i + 500]
        marks = ",".join("?" for _ in chunk)
        db.execute(f"DELETE FROM perm_live_recent WHERE case_number IN ({marks})", chunk)

    if changed:
        write_rows(db, "perm_live_recent", LIVE_COLS, changed)

    got = int(db.scalar("SELECT count(*) FROM perm_live_recent") or 0)
    ok = got == len(live)
    log(f"  {'ok ' if ok else 'MISMATCH'} perm_live_recent       {got:>7,} of {len(live):,} "
        f"({len(changed):,} written, {len(gone):,} removed)")
    write_changed_slugs(changed, gone, stored, extra_changed)
    return ok


LIVE_ONLY_DDL = [
    """CREATE TABLE IF NOT EXISTS perm_live_only_index (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cases INTEGER NOT NULL,
        first_filed TEXT,
        rank INTEGER NOT NULL,
        last_changed TEXT)""",
    "CREATE INDEX IF NOT EXISTS perm_live_only_rank ON perm_live_only_index (rank)",
]

def ensure_live_only_columns(db: Turso) -> None:
    """Add the columns the live-only index gained after it existed."""
    if add_missing_columns(db, "perm_live_only_index", {"last_changed": "TEXT"}):
        log("  added column perm_live_only_index.last_changed")


def live_only_rows(live: list[dict], published_slugs: set[str]) -> list[list]:
    """One row per live-only employer, ranked densely for the sitemap windows.

    Live-only means the live feed names the employer and `perm_entities` has no
    row for its slug. Ordered by first filing then slug, so a night's new
    arrivals mostly append and the rank windows the sitemap reads stay stable;
    ordering by case count would reshuffle every rank whenever a count moved.

    `last_changed` is the page's sitemap lastmod: the newest day any of the
    employer's cases changed as the page shows it (its `changed_on`, falling
    back to its filing date). Google uses lastmod only when it is "consistently
    and verifiably accurate", so it moves only when the page does.
    """
    by_slug: dict[str, dict] = {}
    for row in live:
        slug = row.get("employer_slug")
        if not slug or slug in published_slugs:
            continue
        rec = by_slug.setdefault(slug, {"names": {}, "cases": 0, "first": None, "last": None})
        rec["cases"] += 1
        name = row.get("employer_name") or slug
        rec["names"][name] = rec["names"].get(name, 0) + 1
        filed = row.get("filing_date")
        if filed and (rec["first"] is None or filed < rec["first"]):
            rec["first"] = filed
        touched = row.get("changed_on") or filed
        if touched and (rec["last"] is None or touched > rec["last"]):
            rec["last"] = touched
    ordered = sorted(by_slug.items(), key=lambda kv: (kv[1]["first"] or "9999", kv[0]))
    out = []
    for rank, (slug, rec) in enumerate(ordered, start=1):
        name = max(rec["names"], key=lambda n: (rec["names"][n], n))
        out.append([slug, name, rec["cases"], rec["first"], rank, rec["last"]])
    return out


def write_live_only_index(db: Turso, live: list[dict], maps) -> bool:
    """Write only the rows that changed, the same discipline as the live table."""
    for ddl in LIVE_ONLY_DDL:
        db.execute(ddl)
    ensure_live_only_columns(db)
    published = {v[0] for v in maps["employer"].values()}
    want = live_only_rows(live, published)
    stored: dict[str, tuple] = {}
    for r in raw_rows(db.execute(
            "SELECT slug, name, cases, first_filed, rank, last_changed FROM perm_live_only_index")):
        vals = [cell(c) for c in r]
        stored[str(vals[0])] = (str(vals[1]), int(vals[2] or 0), vals[3], int(vals[4] or 0), vals[5])
    changed = [w for w in want if stored.get(w[0]) != (w[1], w[2], w[3], w[4], w[5])]
    wanted = {w[0] for w in want}
    gone = [k for k in stored if k not in wanted]
    for i in range(0, len(gone), 500):
        chunk = gone[i:i + 500]
        db.execute(f"DELETE FROM perm_live_only_index WHERE slug IN ({','.join('?' for _ in chunk)})", chunk)
    if changed:
        write_rows(db, "perm_live_only_index",
                   ["slug", "name", "cases", "first_filed", "rank", "last_changed"], changed)
    got = int(db.scalar("SELECT count(*) FROM perm_live_only_index") or 0)
    top = int(db.scalar("SELECT max(rank) FROM perm_live_only_index") or 0)
    ok = got == len(want) and top == len(want)
    log(f"  {'ok ' if ok else 'MISMATCH'} perm_live_only_index   {got:>7,} of {len(want):,} "
        f"({len(changed):,} written, {len(gone):,} removed; max rank {top:,})")
    return ok


# The employer pages carry `revalidate = 2592000`. Thirty days is right for the
# quarterly disclosure figures that fill most of that page and wrong for the
# live band on it, and a route segment gets exactly one window. So the pages
# whose live rows moved are named here and expired by path after the sweep.
# See src/app/api/revalidate-live-employers/route.ts for the other half.
CHANGED_SLUGS_PATH = "changed-employer-slugs.json"

# Matches MAX_PATHS in that route. Truncating HERE rather than letting the
# endpoint reject the batch means a big night still refreshes the pages that
# moved most, instead of refreshing nothing.
MAX_CHANGED_SLUGS = 800


def write_changed_slugs(changed: list[dict], gone: list[str],
                        stored: dict[str, tuple],
                        extra: dict[str, int] | None = None) -> None:
    """Name the employer pages whose live content moved, busiest first.

    BOTH HALVES OF THE DIFF COUNT. A case that CHANGED names its employer
    directly; a case that is GONE - absorbed into a new quarterly file, so
    deleted from the live table - only exists in the stored row, and its
    employer's page still has to drop it from the live band. Taking only
    `changed` would leave every absorbed case listed as live for a month.

    Published employers are included too, not just live-only ones. Their pages
    render `LiveQueueBand` and a recent-filings list from the same table, so
    they go stale in exactly the same way; the thirty-day window is there for
    their disclosure statistics, which is a different half of the same page.

    Ranked by how many cases moved so that a truncated batch keeps the pages a
    reader is most likely to be looking at.
    """
    # `extra` is the employers whose QUEUE moved (`write_pending`): their
    # pages print that queue in `LiveQueueBand`, so they expire with the rest.
    counts: dict[str, int] = dict(extra or {})
    for row in changed:
        slug = row.get("employer_slug")
        if slug:
            counts[str(slug)] = counts.get(str(slug), 0) + 1
    for key in gone:
        row_vals = stored.get(key)
        # employer_slug is index 5 in LIVE_COLS order.
        slug = row_vals[5] if row_vals and len(row_vals) > 5 else None
        if slug:
            counts[str(slug)] = counts.get(str(slug), 0) + 1

    ranked = sorted(counts, key=lambda s: (-counts[s], s))
    kept = ranked[:MAX_CHANGED_SLUGS]
    with open(CHANGED_SLUGS_PATH, "w", encoding="utf-8") as fh:
        json.dump({"slugs": kept}, fh)
    extra = f", {len(ranked) - len(kept):,} over the cap not listed" if len(ranked) > len(kept) else ""
    log(f"  {len(kept):,} employer pages to expire{extra} -> {CHANGED_SLUGS_PATH}")


PENDING_COLS = ["kind", "slug", "tracked", "pending", "stages", "oldest"]


def pending_norm(row) -> tuple:
    """One `perm_entity_pending` row as comparable values, from either side.

    The live table's lesson again: libSQL returns integers as STRINGS, so a
    stored `tracked` of '968' never equals a built 968, and a raw comparison
    rewrites every row while logging success. `stages` is compared as parsed
    JSON rather than as text, so a different key order cannot fake a change.
    """
    is_tuple = not isinstance(row, dict)
    kind, slug, tracked, pend, stages, oldest = (
        cell(row[i]) if is_tuple else row[c] for i, c in enumerate(PENDING_COLS))
    try:
        parsed = json.loads(stages) if isinstance(stages, str) else dict(stages or {})
    except ValueError:
        parsed = {}
    return (str(kind), str(slug), int(tracked or 0), int(pend or 0),
            tuple(sorted((str(k), int(v)) for k, v in parsed.items())),
            "" if oldest is None else str(oldest))


def pending_diff(stored: list, built: list[dict]):
    """(rows to write, (kind, slug) keys to delete, slug -> how much it moved).

    The weight ranks the pages to expire: a sponsor whose 200 cases went on
    hold outranks one that gained a single filing, so a truncated expiry
    batch keeps the pages a reader is most likely to be looking at.
    """
    have: dict[tuple, tuple] = {}
    for r in stored:
        n = pending_norm(r)
        have[(n[0], n[1])] = n
    changed: list[dict] = []
    moved: dict[str, int] = {}
    wanted: set[tuple] = set()
    for row in built:
        n = pending_norm(row)
        key = (n[0], n[1])
        wanted.add(key)
        old = have.get(key)
        if old == n:
            continue
        changed.append(row)
        if old is None:
            weight = max(1, n[3])
        else:
            a, b = dict(old[4]), dict(n[4])
            shifted = sum(abs(a.get(k, 0) - b.get(k, 0)) for k in set(a) | set(b)) // 2
            weight = max(1, abs(n[3] - old[3]) + shifted)
        moved[n[1]] = moved.get(n[1], 0) + weight
    gone = [k for k in have if k not in wanted]
    for kind, slug in gone:
        moved[slug] = moved.get(slug, 0) + max(1, have[(kind, slug)][3])
    return changed, gone, moved


def write_pending(db: Turso, pending: list[dict]) -> tuple[bool, dict[str, int]]:
    """Refresh `perm_entity_pending` every night, writing only what moved.

    Every published employer page prints this table in `LiveQueueBand` under
    the sweep's date, so it is refreshed with each sweep; refreshed only with
    the quarterly load, it would show a weeks-old queue as today's beside the
    live figures elsewhere on the same page.

    Diffed like `perm_live_recent`: about 70,000 rows, of which a night moves
    a few hundred to a few thousand.
    """
    db.script(DDL)
    stored = raw_rows(db.execute(
        "SELECT " + ", ".join(PENDING_COLS) + " FROM perm_entity_pending"))
    changed, gone, moved = pending_diff(stored, pending)
    for i in range(0, len(gone), 250):
        chunk = gone[i:i + 250]
        clause = " OR ".join("(kind = ? AND slug = ?)" for _ in chunk)
        db.execute(f"DELETE FROM perm_entity_pending WHERE {clause}",
                   [x for key in chunk for x in key])
    if changed:
        write_rows(db, "perm_entity_pending", PENDING_COLS, changed)
    got = int(db.scalar("SELECT count(*) FROM perm_entity_pending") or 0)
    ok = got == len(pending)
    log(f"  {'ok ' if ok else 'MISMATCH'} perm_entity_pending    {got:>7,} of {len(pending):,} "
        f"({len(changed):,} written, {len(gone):,} removed)")
    return ok, moved


def build_pending(db: Turso, maps) -> list[dict]:
    """Per-employer live queue position, aggregated server-side.

    Aggregated in the database, so the read returns one row per employer rather
    than every case. Stage counts come from a second aggregate restricted to
    `is_final = 0`, so the two never disagree about what "pending" means: the
    table's own flag decides, not a status list kept here that would drift the
    first time DOL adds a stage.
    """
    totals = raw_rows(db.execute(
        "SELECT employer_name, count(*), sum(1 - is_final), min(CASE WHEN is_final = 0 "
        "THEN filing_date END) FROM perm_case_status WHERE employer_name IS NOT NULL "
        "AND employer_name <> '' GROUP BY employer_name"))
    stages = raw_rows(db.execute(
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
    cols = ["employer_name", "attorney_name", "soc_code", "soc_title", "status", "state",
            "naics", "worksite_city"]
    if cache:
        with open(cache) as f:
            for line in f:
                yield json.loads(line)
        return
    off = 0
    while True:
        res = db.execute(
            f"SELECT {','.join(cols)} FROM perm_cases ORDER BY rowid LIMIT 25000 OFFSET ?", [off])
        rs = raw_rows(res)
        for r in rs:
            yield {c: cell(x) for c, x in zip(cols, r)}
        if len(rs) < 25000:
            return
        off += 25000


def city_key(city: str | None, state: str | None) -> str | None:
    """One key per city, whatever case or punctuation DOL printed it in.

    "St. Louis", "ST LOUIS" and "St Louis " are one place. The state is part
    of the key because Portland, OR and Portland, ME are not.
    """
    if not city or not state:
        return None
    k = " ".join(city.replace(".", " ").upper().split())
    return f"{k}|{state}" if k else None


def _title_case(s: str) -> str:
    return " ".join("-".join(p.capitalize() for p in w.split("-")) for w in s.split())


def city_labels(votes: dict[str, Counter]) -> dict[str, str]:
    """The display spelling for each city key.

    The most common spelling in mixed case wins, because a filer who typed
    "McLean" knew something an all-caps "MCLEAN" hides. With only capitals (or
    only lower case) on record, title case is the fallback. Ties go to the
    alphabetically later spelling, so a rebuild cannot flip a label.
    """
    out: dict[str, str] = {}
    for key, c in votes.items():
        state = key.rsplit("|", 1)[1]
        mixed = [(n, sp) for sp, n in c.items() if sp not in (sp.upper(), sp.lower())]
        name = max(mixed)[1] if mixed else _title_case(max(c.items(), key=lambda kv: (kv[1], kv[0]))[0])
        out[key] = f"{name}, {state}"
    return out


def industry_label(code: str) -> str:
    """Census's title for the code, saying which code it belongs to on a fallback."""
    hit = naics_title(code)
    if not hit:
        return "Not a code in Census's NAICS lists"
    owner, title = hit
    return title if owner == code else f"{title} (Census group {owner})"


def build_facets(db: Turso, maps, cache) -> list[list]:
    emp, att, occ = maps["employer"], maps["attorney"], maps["occupation"]
    city_votes: dict[str, Counter] = defaultdict(Counter)
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
        raw_city = " ".join((r.get("worksite_city") or "").split())
        ck = city_key(raw_city, state)
        if ck:
            city_votes[ck][raw_city] += 1
        naics = normalize_naics(r.get("naics"))

        # The occupation facet's key is the occupation's slug, not its SOC
        # code: it is a link target, and /perm-wages/[slug] is keyed on the
        # entity slug.
        if e and e[1] >= PAGE_FLOOR:
            if o:
                add("employer", e[0], "occupation", o[0], occ_label or code, cert, den)
            if state:
                add("employer", e[0], "state", state, state, cert, den)
            if a:
                add("employer", e[0], "attorney", a[0], r["attorney_name"], cert, den)
            if ck:
                add("employer", e[0], "city", ck, ck, cert, den)
            if naics:
                add("employer", e[0], "industry", naics, naics, cert, den)
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
            if ck:
                add("occupation", o[0], "city", ck, ck, cert, den)
    log(f"  {n:,} cases -> {len(acc):,} (entity, facet) groups")
    labels = city_labels(city_votes)

    out: list[list] = []
    for (kind, slug, facet), bucket in acc.items():
        # Ties broken on the key so a rebuild cannot reshuffle a page's
        # "top occupations" list without the underlying counts changing.
        ranked = sorted(bucket.items(), key=lambda kv: (-kv[1][0], kv[0]))[:TOP_N]
        for pos, (key, (cnt, cert, den, label)) in enumerate(ranked):
            if facet == "city":
                label = labels.get(key, label)
            elif facet == "industry":
                label = industry_label(key)
            out.append([kind, slug, facet, pos, key, label, cnt, cert, den])
    log(f"  {len(out):,} facet rows")
    return out


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def write_rows(db: Turso, table: str, cols: list[str], rows: list) -> None:
    """INSERT OR REPLACE, so a retry after a lost response replays a write
    that already landed without harm. Rows are dicts keyed by column, or
    sequences in column order."""
    insert_rows(db, table, cols, [[r[c] for c in cols] if isinstance(r, dict) else r[:len(cols)]
                                  for r in rows], per_stmt=CHUNK)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", help="NDJSON of perm_cases rows, for local iteration")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--live-recent-only", action="store_true",
        help="Rebuild only perm_live_recent (cases newer than the last "
             "disclosure file). Cheap; runs daily after the status sweep so "
             "the case search and employer pages see the day's filings.")
    args = ap.parse_args()

    db = Turso()
    log("SLUGS")
    maps = slug_maps(db)

    if args.live_recent_only:
        log("LIVE RECENT")
        live, boundary = build_live_recent(db, maps)
        log("PENDING")
        pending = build_pending(db, maps)
        if args.dry_run:
            log("\nDRY RUN - nothing written")
            return 0
        # The queue band's table refreshes with the live remainder. Its own
        # failure must not cost the live remainder, which is what makes the
        # day's filings findable at all, so it is caught and reported.
        try:
            pending_ok, moved = write_pending(db, pending)
        except Exception as exc:  # noqa: BLE001
            log(f"  perm_entity_pending refresh FAILED: {exc}")
            pending_ok, moved = False, {}
        ok = write_live_recent(db, live, moved) and write_live_remainder_doc(db, live)
        # The sitemap's live-only family reads this table; it must move with
        # the live remainder or the sitemap advertises yesterday's employers.
        ok = write_live_only_index(db, live, maps) and ok
        # The "filed in the last 12 months" facet reads this column; it moves
        # with the live remainder, so it refreshes here every night.
        if ok:
            try:
                refresh_recent_12m(db)
            except Exception as exc:  # noqa: BLE001 - a facet must not fail the rebuild
                log(f"  recent_12m refresh FAILED: {exc}")
        # The all-employers comparison the employer pages' wait section reads.
        try:
            write_recent_wait(db)
        except Exception as exc:  # noqa: BLE001 - a comparison must not fail the rebuild
            log(f"  recent_decision_wait refresh FAILED: {exc}")
        # Stamp freshness and audit the run. This table is what makes cases newer
        # than the last disclosure file findable, and the sweep workflow runs it
        # under `|| true`, so a stalled rebuild must turn the health check red
        # (the stamp), and a sudden drop in rows must be visible afterwards (the
        # audit row's count).
        if ok:
            stamp_freshness(db, "live-recent", source="derived from perm_case_status",
                            cadence="Daily", note=f"{len(live):,} cases", max_age_days=3)
        record_run(db, "build_entity_detail.py --live-recent-only",
                   status="ok" if ok and pending_ok else "mismatch", rows_written=len(live),
                   note=f"remainder past {boundary}; queue band {len(pending):,} employers"
                        + ("" if pending_ok else ", perm_entity_pending NOT refreshed"))
        return 0 if ok and pending_ok else 1

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
    live, _ = build_live_recent(db, maps)
    write_live_recent(db, live)
    write_live_remainder_doc(db, live)
    write_live_only_index(db, live, maps)
    # The quarterly load recreates perm_entities, so its recent_12m values
    # are empty until this runs; the nightly pass refreshes it too.
    try:
        refresh_recent_12m(db)
    except Exception as exc:  # noqa: BLE001 - a facet must not fail the rebuild
        log(f"  recent_12m refresh FAILED: {exc}")

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



# ---------------------------------------------------------------------------
# recent_12m: filings received in the last 12 months, per employer and firm
# ---------------------------------------------------------------------------

RECENT_WINDOW_DAYS = 365


def refresh_recent_12m(db: Turso) -> tuple[int, int]:
    """Refresh perm_entities.recent_12m for employers and law firms.

    The count is filings RECEIVED in the last 365 days, from both halves of the
    corpus: the published files (perm_cases.received_date, on idx_pc_received)
    and the live remainder (perm_live_recent.filing_date, indexed). The live
    table carries no attorney, so a firm's count is the published half only,
    which is said on the page. Only rows whose value changed are written, in
    one UPDATE ... CASE per 200 slugs, so a quiet night costs a few hundred
    writes rather than one per employer.

    Returns (rows_changed, rows_examined).
    """
    if add_missing_columns(db, "perm_entities", {"recent_12m": "INTEGER"}):
        log("  added perm_entities.recent_12m")
    cutoff = (datetime.date.today() - datetime.timedelta(days=RECENT_WINDOW_DAYS)).isoformat()
    counts: dict[tuple[str, str], int] = defaultdict(int)
    for kind, col, table, date_col in (
        ("employer", "employer_slug", "perm_cases", "received_date"),
        ("attorney", "attorney_slug", "perm_cases", "received_date"),
        ("employer", "employer_slug", "perm_live_recent", "filing_date"),
    ):
        res = db.execute(
            f"SELECT {col}, COUNT(*) FROM {table} WHERE {date_col} >= ? "
            f"AND {col} IS NOT NULL AND {col} <> '' GROUP BY {col}", [cutoff])
        for slug, n in rows_of(res):
            counts[(kind, slug)] += int(n)
    current = {}
    for kind, slug, val in rows_of(db.execute(
            "SELECT kind, slug, recent_12m FROM perm_entities WHERE kind IN ('employer', 'attorney')")):
        current[(kind, slug)] = None if val is None else int(val)
    changed = [(k, s, counts.get((k, s), 0)) for (k, s), have in current.items()
               if have != counts.get((k, s), 0)]
    for i in range(0, len(changed), 200):
        chunk = changed[i:i + 200]
        cases = " ".join(f"WHEN {lit_sql(s)} THEN {n}" for _k, s, n in chunk)
        slugs = ", ".join(lit_sql(s) for _k, s, _n in chunk)
        for kind in ("employer", "attorney"):
            sub = [c for c in chunk if c[0] == kind]
            if not sub:
                continue
            cases = " ".join(f"WHEN {lit_sql(s)} THEN {n}" for _k, s, n in sub)
            slugs = ", ".join(lit_sql(s) for _k, s, _n in sub)
            db.execute(
                f"UPDATE perm_entities SET recent_12m = CASE slug {cases} END "
                f"WHERE kind = '{kind}' AND slug IN ({slugs})")
    log(f"  recent_12m: {len(changed):,} of {len(current):,} entities changed "
        f"(window from {cutoff})")
    return len(changed), len(current)


def lit_sql(s: str) -> str:
    """A string as a single-quoted SQL literal. Slugs are [a-z0-9-] but the
    quote is doubled anyway, because a rule that holds today is not a parser."""
    return "'" + str(s).replace("'", "''") + "'"


# Last, and it must stay last: a definition below the guard doesn't exist yet
# when the guard runs main(). test_main_guard.py holds every script to this.
if __name__ == "__main__":
    sys.exit(main())
