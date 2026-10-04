#!/usr/bin/env python3
"""One row per PERM sponsor: each part of its record, ranked against the others.

The employer page and the sponsor finder read `sponsor_index`. Every part is
a figure DOL or USCIS published, measured over a stated window, and ranked
only among sponsors with enough cases for the figure to mean something. There
is no single score: the parts measure different things, and a blend would
read as a precision the data can't support (the same reason /perm-denial-risk
refuses one).

Parts, each with its count:

* PERM approval rate: certified over certified plus denied, in DOL's current
  files, at 20 or more decided cases.
* PERM filings in the last 12 months (`recent_12m`).
* H-1B LCAs certified in the last 24 months.
* Transfers: the share of certified H-1B positions that were a change of
  employer, at 20 or more positions.
* Senior roles: the share of certified LCAs at wage level III or IV, at 20 or
  more with a level.
* USCIS's H-1B approval rate over its last three fiscal years, at 20 or more
  decisions.

THE TWO SHARES HAVE THEIR OWN WINDOW. The transfer and wage-level columns come
from DOL's LCA file detail, which this site filled for some fiscal years before
others (on Oct 4 2026, FY2020 to FY2022 only). They're measured over the 24
months before the newest decision that carries detail, and each part records
its window, so a page never calls 2022 filings "the last 24 months".

A rank is "higher than N% of sponsors with enough cases", the mid-rank
percentile, so ties share a rank. Warnings are facts with dates, never a
penalty on a rank: an active debarment, WARN layoff notices in the last two
years, the H-1B dependent declaration on its newest LCA, any willful-violator
declaration, and a likely cap-exempt college or university.

H-1B and USCIS rows reach a sponsor through `employer_page_map` (built first
by scripts/build_employer_map.py), so a spelling counts on exactly one page.

Usage:
    python3 scripts/build_sponsor_index.py            # rebuild the table
    python3 scripts/build_sponsor_index.py --dry-run  # read and report only
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import sys
import time
from bisect import bisect_left, bisect_right
from collections import defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_turso import Turso, record_run, rows_of  # noqa: E402

TABLE = "sponsor_index"
COLS = [
    "slug", "name", "state", "sector", "sector_label", "cap_exempt", "perm_recent", "perm_decided", "perm_rate",
    "lca_24m", "transfer_share", "senior_share", "uscis_rate", "debarred", "warn_2y", "dependent",
    "parts", "facts",
]
DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        state TEXT,
        sector TEXT,
        sector_label TEXT,
        cap_exempt INTEGER NOT NULL,
        perm_recent INTEGER NOT NULL,
        perm_decided INTEGER NOT NULL,
        perm_rate REAL,
        lca_24m INTEGER NOT NULL,
        transfer_share REAL,
        senior_share REAL,
        uscis_rate REAL,
        debarred INTEGER NOT NULL,
        warn_2y INTEGER NOT NULL,
        dependent INTEGER,
        parts TEXT NOT NULL,
        facts TEXT NOT NULL)""",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_recent ON {TABLE} (perm_recent DESC)",
    f"CREATE INDEX IF NOT EXISTS {TABLE}_state ON {TABLE} (state, perm_recent DESC)",
]
MIN_N = 20
HIGHER_ED_NAICS = "611310"  # src/lib/capExempt.ts, which this mirrors
CAP_EXEMPT_SHARE = 0.5
WRITE_CHUNK = 300
WRITE_PAUSE_S = 0.4

# NAICS two-digit sectors, from the Census Bureau's 2022 list (32 and 33 share 31's
# name, 45 shares 44's, 49 shares 48's).
SECTORS = {
    "11": "Agriculture, forestry, fishing and hunting", "21": "Mining, oil and gas", "22": "Utilities",
    "23": "Construction", "31": "Manufacturing", "32": "Manufacturing", "33": "Manufacturing",
    "42": "Wholesale trade", "44": "Retail trade", "45": "Retail trade", "48": "Transportation and warehousing",
    "49": "Transportation and warehousing", "51": "Information", "52": "Finance and insurance",
    "53": "Real estate", "54": "Professional, scientific and technical services", "55": "Management of companies",
    "56": "Administrative and support services", "61": "Educational services", "62": "Health care and social assistance",
    "71": "Arts, entertainment and recreation", "72": "Accommodation and food services", "81": "Other services",
    "92": "Public administration",
}
SECTOR_OF = {"32": "31", "33": "31", "45": "44", "49": "48"}

PARTS = [
    # id, label, field, minimum-n field, higher is ... (for the sentence)
    ("perm_rate", "PERM approval rate", "perm_rate", "perm_decided"),
    ("perm_recent", "PERM filings in the last 12 months", "perm_recent", None),
    ("lca_24m", "H-1B LCAs certified in the last 24 months", "lca_24m", None),
    ("transfer_share", "Share of H-1B positions that were transfers", "transfer_share", "positions"),
    ("senior_share", "Share of H-1B LCAs at wage level III or IV", "senior_share", "leveled"),
    ("uscis_rate", "USCIS H-1B approval rate, last 3 fiscal years", "uscis_rate", "uscis_n"),
]
# Parts measured over the LCA detail window rather than the calendar.
DETAIL_PARTS = {"transfer_share", "senior_share"}


def log(msg: str) -> None:
    print(msg, flush=True)


def num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def read(db: Turso, today: dt.date) -> dict:
    """Every input, folded onto PERM sponsor pages."""
    d24 = (today - dt.timedelta(days=730)).isoformat()
    d2y = d24
    sponsors: dict[str, dict] = {}
    for slug, name, total, cert, den, recent in rows_of(db.execute(
            "SELECT slug, name, total, certified, denied, recent_12m FROM perm_entities WHERE kind = 'employer'")):
        sponsors[str(slug)] = {
            "slug": str(slug), "name": str(name or slug), "perm_total": int(num(total)),
            "certified": int(num(cert)), "denied": int(num(den)), "perm_recent": int(num(recent)),
            "state": None, "state_n": 0,
            "lca": 0, "positions": 0, "transfers": 0, "leveled": 0, "senior": 0,
            "dep_yes": None, "dep_no": None, "willful": 0, "uscis_appr": 0, "uscis_den": 0,
            "debarred": [], "warn": 0, "warn_workers": 0, "industry": defaultdict(int),
        }
    page_of: dict[str, str] = {}
    try:
        for src, page in rows_of(db.execute(
                "SELECT source_slug, page_slug FROM employer_page_map WHERE page_kind = 'perm'")):
            page_of[str(src)] = str(page)
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise
        log("  employer_page_map: not built yet; reading each sponsor's own slug only")
    for slug in sponsors:
        page_of.setdefault(slug, slug)

    for slug, facet, key, n in rows_of(db.execute(
            "SELECT slug, facet, key, n FROM perm_entity_facets WHERE kind = 'employer' AND facet IN ('industry', 'state')")):
        s = sponsors.get(str(slug))
        if s is None or not key:
            continue
        if facet == "industry":
            s["industry"][str(key)] += int(num(n))
        elif int(num(n)) > s["state_n"]:
            s["state"], s["state_n"] = str(key), int(num(n))

    # The state facet exists only for employers with three or more filings, so
    # the rest take the state most of their PERM cases name, from the cases.
    try:
        for slug, state, n in rows_of(db.execute(
                "SELECT employer_slug, state, COUNT(*) FROM perm_cases "
                "WHERE employer_slug IS NOT NULL AND state IS NOT NULL GROUP BY employer_slug, state")):
            s = sponsors.get(str(slug))
            if s is not None and s["state"] is None and int(num(n)) > s.get("state_case_n", 0):
                s["state_case"], s["state_case_n"] = str(state), int(num(n))
    except Exception as e:  # noqa: BLE001
        if "no such column" not in str(e):
            raise
    for s in sponsors.values():
        if s["state"] is None and s.get("state_case"):
            s["state"] = s["state_case"]

    # The detail window: the 24 months before the newest decision that carries
    # the LCA detail columns (see the module docstring).
    top_detail = rows_of(db.execute("SELECT MAX(decision_date) FROM lca_cases WHERE workers IS NOT NULL"))[0][0]
    detail_to = str(top_detail)[:10] if top_detail else None
    detail_from = ((dt.date.fromisoformat(detail_to) - dt.timedelta(days=730)).isoformat() if detail_to else "9999-12-31")
    cert = "case_status = 'CERTIFIED' AND decision_date >= ?"
    in_detail = "case_status = 'CERTIFIED' AND decision_date >= ? AND decision_date <= ?"
    for slug, n, workers, change, leveled, senior, dep_yes, dep_no, willful in rows_of(db.execute(
            f"SELECT employer_slug, SUM(CASE WHEN {cert} THEN 1 ELSE 0 END), "
            f"SUM(CASE WHEN {in_detail} THEN workers END), SUM(CASE WHEN {in_detail} THEN change_employer END), "
            f"SUM(CASE WHEN {in_detail} AND wage_level IS NOT NULL THEN 1 ELSE 0 END), "
            f"SUM(CASE WHEN {in_detail} AND wage_level IN ('III', 'IV') THEN 1 ELSE 0 END), "
            "MAX(CASE WHEN h1b_dependent = 1 THEN decision_date END), "
            "MAX(CASE WHEN h1b_dependent = 0 THEN decision_date END), "
            "SUM(CASE WHEN willful_violator = 1 THEN 1 ELSE 0 END) "
            "FROM lca_cases WHERE employer_slug IS NOT NULL GROUP BY employer_slug",
            [d24] + [detail_from, detail_to or "0000"] * 4)):
        s = sponsors.get(page_of.get(str(slug), ""))
        if s is None:
            continue
        s["lca"] += int(num(n))
        s["positions"] += int(num(workers))
        s["transfers"] += int(num(change))
        s["leveled"] += int(num(leveled))
        s["senior"] += int(num(senior))
        s["willful"] += int(num(willful))
        for k, v in (("dep_yes", dep_yes), ("dep_no", dep_no)):
            if v and (s[k] is None or str(v) > s[k]):
                s[k] = str(v)

    try:
        top = rows_of(db.execute("SELECT MAX(fy) FROM uscis_h1b_employers"))[0][0]
        if top:
            kinds = ("new", "cont", "same", "conc", "chg", "amend")
            appr = " + ".join(f"COALESCE({k}_appr, 0)" for k in kinds)
            den = " + ".join(f"COALESCE({k}_den, 0)" for k in kinds)
            for slug, a, d in rows_of(db.execute(
                    f"SELECT employer_slug, SUM({appr}), SUM({den}) FROM uscis_h1b_employers "
                    "WHERE fy >= ? AND employer_slug IS NOT NULL GROUP BY employer_slug", [int(num(top)) - 2])):
                s = sponsors.get(page_of.get(str(slug), ""))
                if s is not None:
                    s["uscis_appr"] += int(num(a))
                    s["uscis_den"] += int(num(d))
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise

    today_s = today.isoformat()
    try:
        for slug, program, start, end in rows_of(db.execute(
                "SELECT entity_slug, program, start_date, end_date FROM debarments WHERE end_date >= ?", [today_s])):
            s = sponsors.get(page_of.get(str(slug), str(slug)))
            if s is not None and str(start or "") <= today_s:
                s["debarred"].append({"program": str(program or ""), "until": str(end)[:10]})
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise
    try:
        for slug, n, workers in rows_of(db.execute(
                "SELECT employer_slug, COUNT(*), SUM(employees) FROM warn_notices "
                "WHERE notice_date >= ? AND employer_slug IS NOT NULL GROUP BY employer_slug", [d2y])):
            s = sponsors.get(page_of.get(str(slug), str(slug)))
            if s is not None:
                s["warn"] += int(num(n))
                s["warn_workers"] += int(num(workers))
    except Exception as e:  # noqa: BLE001
        if "no such table" not in str(e):
            raise
    return {"sponsors": sponsors, "since": d24, "detail_from": detail_from if detail_to else None, "detail_to": detail_to}


def percentile(sorted_vals: list[float], v: float) -> float:
    """Mid-rank: the share of the others below v, ties counted half."""
    if len(sorted_vals) <= 1:
        return 0.5
    lo = bisect_left(sorted_vals, v)
    hi = bisect_right(sorted_vals, v)
    return (lo + (hi - lo - 1) / 2) / (len(sorted_vals) - 1)


def plan(data: dict, today: dt.date) -> list[list]:
    """The table's rows. Pure, for the test."""
    sponsors = data["sponsors"]
    for s in sponsors.values():
        decided = s["certified"] + s["denied"]
        s["perm_decided"] = decided
        s["perm_rate"] = s["certified"] / decided if decided else None
        s["lca_24m"] = s["lca"]
        s["transfer_share"] = s["transfers"] / s["positions"] if s["positions"] else None
        s["senior_share"] = s["senior"] / s["leveled"] if s["leveled"] else None
        s["uscis_n"] = s["uscis_appr"] + s["uscis_den"]
        s["uscis_rate"] = s["uscis_appr"] / s["uscis_n"] if s["uscis_n"] else None
        coded = sum(s["industry"].values())
        hi_ed = sum(n for k, n in s["industry"].items() if k.startswith(HIGHER_ED_NAICS))
        s["cap_exempt"] = 1 if coded and hi_ed / coded >= CAP_EXEMPT_SHARE else 0
        top = max(s["industry"].items(), key=lambda kv: (kv[1], kv[0]))[0] if s["industry"] else None
        sector = SECTOR_OF.get(top[:2], top[:2]) if top else None
        s["sector"] = sector if sector in SECTORS else None
        s["sector_label"] = SECTORS.get(s["sector"]) if s["sector"] else None
        if s["dep_yes"] or s["dep_no"]:
            s["dependent"] = 1 if (s["dep_yes"] or "") > (s["dep_no"] or "") else 0
        else:
            s["dependent"] = None

    def eligible(s: dict, field: str, nfield: str | None) -> bool:
        v = s.get(field)
        if v is None:
            return False
        if nfield is None:
            return v > 0
        return s.get(nfield, 0) >= MIN_N

    peers: dict[str, list[float]] = {}
    for pid, _label, field, nfield in PARTS:
        peers[pid] = sorted(float(s[field]) for s in sponsors.values() if eligible(s, field, nfield))

    rows: list[list] = []
    for s in sorted(sponsors.values(), key=lambda s: s["slug"]):
        parts = []
        for pid, label, field, nfield in PARTS:
            if not eligible(s, field, nfield):
                continue
            v = float(s[field])
            part = {
                "id": pid, "label": label, "value": round(v, 4),
                "n": int(s[nfield]) if nfield else int(v),
                "pct": round(percentile(peers[pid], v), 4), "of": len(peers[pid]),
            }
            if pid in DETAIL_PARTS:
                part["from"], part["to"] = data["detail_from"], data["detail_to"]
            parts.append(part)
        facts = []
        for d in s["debarred"]:
            facts.append({"id": "debarred", "program": d["program"], "until": d["until"]})
        if s["warn"]:
            facts.append({"id": "warn", "notices": s["warn"], "workers": s["warn_workers"], "since": data["since"]})
        if s["dependent"] == 1:
            facts.append({"id": "dependent", "as_of": s["dep_yes"][:10]})
        if s["willful"]:
            facts.append({"id": "willful", "lcas": s["willful"]})
        if s["cap_exempt"]:
            facts.append({"id": "cap_exempt"})
        r4 = lambda x: None if x is None else round(float(x), 4)  # noqa: E731
        rows.append([
            s["slug"], s["name"], s["state"], s["sector"], s["sector_label"], s["cap_exempt"], s["perm_recent"],
            s["perm_decided"], r4(s["perm_rate"]), s["lca_24m"], r4(s["transfer_share"]), r4(s["senior_share"]),
            r4(s["uscis_rate"]), 1 if s["debarred"] else 0, s["warn"], s["dependent"],
            json.dumps(parts, separators=(",", ":")), json.dumps(facts, separators=(",", ":")),
        ])
    return rows


def norm(row: list) -> tuple:
    ints = {"cap_exempt", "perm_recent", "perm_decided", "lca_24m", "debarred", "warn_2y"}
    reals = {"perm_rate", "transfer_share", "senior_share", "uscis_rate"}
    out = []
    for c, v in zip(COLS, row):
        if v is None:
            out.append(None)
        elif c in ints or c == "dependent":
            out.append(int(float(v)))
        elif c in reals:
            out.append(round(float(v), 4))
        else:
            out.append(str(v))
    return tuple(out)


def write_diff(db: Turso, want: list[list]) -> tuple[int, int]:
    stored = {}
    for r in rows_of(db.execute(f"SELECT {','.join(COLS)} FROM {TABLE}")):
        n = norm(list(r))
        stored[n[0]] = n
    changed = [w for w in want if stored.get(w[0]) != norm(w)]
    wanted = {w[0] for w in want}
    gone = [k for k in stored if k not in wanted]
    for i in range(0, len(gone), 500):
        chunk = gone[i:i + 500]
        db.execute(f"DELETE FROM {TABLE} WHERE slug IN ({','.join('?' for _ in chunk)})", chunk)
        time.sleep(WRITE_PAUSE_S)
    marks = "(" + ",".join("?" * len(COLS)) + ")"
    for i in range(0, len(changed), WRITE_CHUNK):
        chunk = changed[i:i + WRITE_CHUNK]
        db.execute(f"INSERT OR REPLACE INTO {TABLE} ({','.join(COLS)}) VALUES " + ",".join([marks] * len(chunk)),
                   [v for row in chunk for v in row])
        time.sleep(WRITE_PAUSE_S)
    return len(changed), len(gone)


def main() -> int:
    global WRITE_PAUSE_S
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--show", nargs="*", default=[], metavar="SLUG")
    ap.add_argument("--pause", type=float, default=WRITE_PAUSE_S)
    args = ap.parse_args()
    WRITE_PAUSE_S = max(0.0, args.pause)
    started = time.time()
    db = Turso()
    today = dt.date.today()
    data = read(db, today)
    rows = plan(data, today)
    log(f"sponsors {len(rows):,}; with an LCA in 24 months {sum(1 for r in rows if r[9]):,}; "
        f"with a USCIS rate {sum(1 for r in rows if r[12] is not None):,}")
    if args.dry_run:
        by = {r[0]: r for r in rows}
        for slug in args.show:
            r = by.get(slug)
            log(f"  {slug}: {dict(zip(COLS, r)) if r else 'not a sponsor page'}")
        return 0
    for ddl in DDL:
        db.execute(ddl)
    changed, gone = write_diff(db, rows)
    got = int(rows_of(db.execute(f"SELECT count(*) FROM {TABLE}"))[0][0] or 0)
    ok = got == len(rows)
    log(f"  {'ok ' if ok else 'MISMATCH'} {TABLE} {got:,} of {len(rows):,} ({changed:,} written, {gone:,} removed)")
    record_run(db, "build_sponsor_index.py", status="ok" if ok else "failed", rows_written=changed,
               note=f"{len(rows):,} sponsors ranked", started_at=started)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
