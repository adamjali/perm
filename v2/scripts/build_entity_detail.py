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
import datetime
import time
import json
import pathlib
import sys
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from entity_identity import entity_key  # noqa: E402
from lib_turso import Turso, lit, record_run, stamp_freshness  # noqa: E402

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

def _search_slug(raw: str) -> str:
    """Mirrors slugify in store_entities.py / src/lib/entitySlug.ts.

    Used only as the FALLBACK for employers the entity tables have never
    seen (a company whose first-ever filing is newer than the last
    disclosure file). Matched employers carry their canonical entity slug
    instead, which is what both the case search's needle and the employer
    page's own URL are built from.
    """
    import re as _re
    t = _re.sub(r"[^a-z0-9]+", "-", (raw or "").lower())
    t = _re.sub(r"-+", "-", t).strip("-")[:60]
    return t.rstrip("-")


def build_live_recent(db: Turso, maps) -> tuple[list[dict], str]:
    """Every live case the published files do not hold, slugged for search.

    THE GAP THIS FILLS, in Adam's words: "I knew there was a case by an
    employer but couldn't find it." The disclosure files carry only DECIDED
    cases and only up to the last published quarter, so anything they miss is
    invisible to the case search and to its employer's page even though the
    live corpus holds it.

    THE FIRST VERSION OF THIS TABLE DEFINED THE REMAINDER BY DATE, AND THAT
    WAS THE WRONG AXIS. It took cases filed after the last disclosure MONTH,
    which is the right rule for new filings and the wrong one for everything
    still waiting: a case filed in March 2026 and still pending is not in the
    disclosure files (undecided) and was not in this table either (not recent
    enough), so it existed in our corpus and could be found by nobody who did
    not already know its number. Measured when it was fixed: the table held
    16,676 rows and the true remainder was 136,886 - **120,210 cases missing,
    97,875 of them pending**, which is precisely the population most likely to
    be searching for themselves.

    The rule is therefore membership, not date: a case belongs here when
    `perm_cases` does not hold it. That is the honest definition of "the
    remainder", it needs no boundary to drift, and it self-corrects when a
    quarterly file lands and absorbs part of the set.

    WRITES ARE DIFFED, NOT WHOLESALE. 137k rows rebuilt nightly is ~4.1M
    writes a month against a 10M plan, for a set whose membership barely
    moves. `write_live_recent` writes only rows that changed.
    """
    got = rows_of(db.execute(
        "SELECT s.case_number, s.filing_date, s.current_status, s.is_final, "
        "s.employer_name, s.job_title FROM perm_case_status s "
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
            "employer_slug": hit[0] if hit is not None else _search_slug(name),
            "job_title": cell(r[5]),
            "decided_seen": seen.get(str(case)) if fin else None,
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
    # Turso forbids ANALYZE, so an index has to win on shape alone.
    "CREATE INDEX IF NOT EXISTS perm_live_recent_final_filed "
    "ON perm_live_recent (is_final, filing_date, case_number)",
    "CREATE INDEX IF NOT EXISTS perm_live_recent_filed "
    "ON perm_live_recent (filing_date, case_number)",
]


LIVE_COLS = ["case_number", "filing_date", "status", "is_final",
             "employer_name", "employer_slug", "job_title", "decided_seen"]


def ensure_live_recent_columns(db: Turso) -> None:
    """Add columns the CREATE TABLE above gained after the table existed.

    `CREATE TABLE IF NOT EXISTS` is a no-op on the live database, so a column
    added to the DDL never reaches production by itself. `decided_seen` was
    added 2026-09-02; the ALTER runs once and is idempotent afterwards.
    """
    have = {cell(r[1]) for r in rows_of(db.execute("PRAGMA table_info(perm_live_recent)"))}
    if "decided_seen" not in have:
        db.execute("ALTER TABLE perm_live_recent ADD COLUMN decided_seen TEXT")
        log("  added column perm_live_recent.decided_seen")


def decided_seen_map(db: Turso) -> dict[str, str]:
    """case_number -> the day OUR sweep first recorded a final status.

    An observation date, never DOL's decision date: DOL's per-case lookup
    does not return one. Only cases whose decision the direct sweep actually
    watched have an entry (3,641 of 40,935 decided live cases on 2026-09-02);
    the rest were already decided when the corpus was seeded and stay null.
    `CERTIFIED - EXPIRED` is a clock running out, not a decision, and is not
    a status here anyway; the three real outcomes are named explicitly.
    """
    out: dict[str, str] = {}
    for r in rows_of(db.execute(
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


def write_live_remainder_doc(db: Turso, live: list[dict]) -> bool:
    """Precompute the live remainder's counts into perm_docs['live_remainder'].

    The /perm-cases page prints "N decided and M pending since DOL's last
    file" and offers a month picker. A `count(*)` over 137k rows per request
    is the read pattern that got Turso blocked in August, and the reader
    already treats a doc older than eight days as absent, so the counts are
    written here, by the same run that writes the rows they describe.
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
    db.execute(
        "INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)",
        [LIVE_REMAINDER_DOC, payload, int(time.time() * 1000)])
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

    ONE NORMALISER, BOTH SIDES, AND THIS IS NOT A STYLE POINT. libSQL returns
    every integer as a STRING to protect precision, so a stored `is_final`
    arrives as '0' while the freshly built row holds int 0. Comparing them raw
    makes every row look changed - which is not a slow diff, it is NO diff:
    the first version of this ran and rewrote all 136,886 rows on a night when
    nothing had changed, reporting "ok" while doing it.

    Accepts a built dict or a libSQL row tuple and returns the same shape for
    both, because a comparison whose two sides are prepared differently is the
    defect it is meant to prevent.
    """
    is_tuple = not isinstance(row, dict)
    out = []
    for i, col in enumerate(LIVE_COLS):
        v = cell(row[i]) if is_tuple else row[col]
        out.append(int(v or 0) if col == "is_final" else ("" if v is None else str(v)))
    return tuple(out)


def write_live_recent(db: Turso, live: list[dict]) -> bool:
    """Write only what changed.

    The set is ~137k rows and its membership barely moves: on an ordinary day
    a few hundred cases change status and the nightly prober adds a hundred
    filings. A DELETE-then-reinsert costs 137k writes for that, ~4.1M a month
    against a 10M plan, which is 40% of the budget to express a few hundred
    facts. So the desired set is compared against what is stored and only the
    difference is written.

    The comparison is on the WHOLE row, not on `case_number`: a case whose
    status moved from ANALYST REVIEW to CERTIFIED keeps its number, and a
    membership-only diff would leave the old status in the search index
    forever - stale in exactly the way that makes a live table worse than no
    table.
    """
    for ddl in LIVE_RECENT_DDL:
        db.execute(ddl)
    ensure_live_recent_columns(db)

    stored: dict[str, tuple] = {}
    for r in rows_of(db.execute(
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
    write_changed_slugs(changed, gone, stored)
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
                        stored: dict[str, tuple]) -> None:
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
    counts: dict[str, int] = {}
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
        if args.dry_run:
            log("\nDRY RUN - nothing written")
            return 0
        ok = write_live_recent(db, live) and write_live_remainder_doc(db, live)
        # STAMP FRESHNESS AND AUDIT THE RUN. This table is the only thing that
        # makes cases newer than the last disclosure file findable, it rebuilds
        # under `|| true` in the sweep workflow, and it had no monitoring at
        # all - which is how it sat silently reverted from 137k rows to 16k for
        # hours. The freshness stamp makes a STALLED rebuild go red in
        # check_ingest_health after 3 days; the audit row records the row COUNT
        # per run, which is what makes a sudden drop visible after the fact.
        if ok:
            stamp_freshness(db, "live-recent", source="derived from perm_case_status",
                            cadence="Daily", note=f"{len(live):,} cases", max_age_days=3)
        record_run(db, "build_entity_detail.py --live-recent-only",
                   status="ok" if ok else "mismatch", rows_written=len(live),
                   note=f"remainder past {boundary}")
        return 0 if ok else 1

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
