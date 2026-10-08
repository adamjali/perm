"""DOL's H-2B assignment groups, and how long each group waits.

DOL puts the H-2B applications filed in the first three days a season opens
(January 1 for April starts, July 1 for October starts) into random assignment
groups and works the groups in order: "OFLC will generate and assign a unique
random number to each completed H-2B application filed within the three-day
filing window ... sorted in ascending order", Group A holding enough worker
positions to reach the cap, later groups "no more than 20,000 worker
positions, or roughly 1,000 applications per group" (84 FR 7399, Mar 4 2019).
OFLC publishes each season's list with every case's group, linked from its
news page.

The group is the strongest timing input found for those seasons. January 2026:
group A was decided a median 41 days after filing and group H 125, each
group's middle half about two weeks. Last January's groups, spaced out by this
January's 15% more applications, put every group within 2 to 8 days.

WHAT IS STORED: the case number, the season, the group, and the submitted and
begin dates, in `h2b_groups`. The lists also name each case's attorney; that
column is never read.

WHAT IS WRITTEN: `perm_docs['h2b_group_timing']`, per season and group, the
days from filing to DOL's decision (withdrawals left out; a case still pending
counts as not yet decided, so a percentile is only read once that share of the
group is decided), and for each season still being decided, the estimate the
case page prints (`group_estimate`, the one rule the page, the scorecard and
the backtest share):

    days(g) = anchor + (last season's g - last season's A) x (this season's
              applications / last season's)

where the anchor is last season's group A until this season's own group A has
half its cases decided, and each percentile of a group switches to the group's
own once that share of it is decided. The spread around the date is last
season's for that group.

Runs on the server (`permtracker-uscis@h2b-groups`, daily): www.dol.gov answers
it, a list is read only when it is new or changed, and the timing is rebuilt
from the night's statuses.

    python3 scripts/ingest_h2b_groups.py              # load new lists, rebuild timing
    python3 scripts/ingest_h2b_groups.py --dry-run    # read and print, write nothing
"""

from __future__ import annotations

import argparse
import hashlib
import io
import re
import sys
import time
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_gov_data import discover_links, fetch, iter_rows, read_shared_strings  # noqa: E402
from lib_turso import ET, Turso, query_rows, read_doc, record_run, run_stmts, stmt, write_doc  # noqa: E402

NEWS_URL = "https://www.dol.gov/agencies/eta/foreign-labor/news"
HOST = "https://www.dol.gov"
FILE_PATTERN = r"^(FY\d{2}_(Jan|Jul|July)Peak_PublicFacingReport|H2B_Randomization_Public_Facing_Report)\.xlsx$"
DOC_KEY = "h2b_group_timing"
LOADS_KEY = "h2b_group_lists"
PCTS = (10, 25, 50, 75, 90)
# A group's own percentile is read once this many of its cases are decided.
MIN_DECIDED = 30
WITHDRAWN = "WITHDRAWN"

DDL = [
    """CREATE TABLE IF NOT EXISTS h2b_groups (
         case_number TEXT PRIMARY KEY,
         peak TEXT NOT NULL,
         grp TEXT NOT NULL,
         submitted TEXT,
         begin_date TEXT,
         source_file TEXT
       )""",
    "CREATE INDEX IF NOT EXISTS idx_h2b_groups_peak ON h2b_groups (peak, grp)",
]

HEADERS = {"case": "Case Number", "group": "Randomization Group", "submitted": "Submitted Date", "begin": "Begin Date"}


def as_day(v) -> str | None:
    """An ISO day from a sheet value: an Excel day serial, or text that starts with one."""
    if v is None or str(v).strip() == "":
        return None
    s = str(v).strip()
    if re.fullmatch(r"\d+(\.\d+)?", s):
        return (date(1899, 12, 30) + timedelta(days=int(float(s)))).isoformat()
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return m.group(0)
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    return None


def parse_list(data: bytes) -> list[dict]:
    """Every case row on whichever sheet carries the header row. The FY2024
    January file puts its notes on the first sheet and its rows on another."""
    archive = zipfile.ZipFile(io.BytesIO(data))
    shared = read_shared_strings(archive)
    sheets = sorted(n for n in archive.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n))
    for sheet in sheets:
        cols: dict[str, int] | None = None
        out: list[dict] = []
        for row in iter_rows(archive, sheet, shared):
            if cols is None:
                names = {str(v).strip(): i for i, v in row.items() if v is not None}
                if HEADERS["case"] in names and HEADERS["group"] in names:
                    cols = {k: names.get(h, -1) for k, h in HEADERS.items()}
                continue
            cn = str(row.get(cols["case"], "") or "").strip().upper()
            grp = str(row.get(cols["group"], "") or "").strip().upper()
            if not re.fullmatch(r"H-400-\d{5}-\d{6}", cn) or not re.fullmatch(r"[A-Z]{1,2}", grp):
                continue
            out.append({"case": cn, "group": grp,
                        "submitted": as_day(row.get(cols["submitted"])),
                        "begin": as_day(row.get(cols["begin"]))})
        if cols is not None:
            return out
    return []


def peak_of(rows: list[dict], name: str) -> str | None:
    """The season, YYYY-MM, from the month most of its cases were submitted;
    the file name only when the rows carry no submitted date."""
    months: dict[str, int] = {}
    for r in rows:
        if r["submitted"]:
            months[r["submitted"][:7]] = months.get(r["submitted"][:7], 0) + 1
    if months:
        return max(months.items(), key=lambda kv: kv[1])[0]
    m = re.match(r"FY(\d{2})_(Jan|Jul)", name)
    return f"20{m.group(1)}-{'01' if m.group(2) == 'Jan' else '07'}" if m else None


def group_order(groups) -> list[str]:
    """A, B, ..., Z, AA: by length, then letter."""
    return sorted(groups, key=lambda g: (len(g), g))


def percentile_of(days_sorted: list[int], total: int, p: int) -> int | None:
    """The day by which p% of the group's `total` cases were decided, or None
    when fewer than that share are. Censoring-safe: undecided cases count as
    not yet decided, never as left out."""
    need = -(-p * total // 100)  # ceil
    if total <= 0 or len(days_sorted) < max(need, 1):
        return None
    return days_sorted[need - 1]


def group_stats(cases: list[dict]) -> dict:
    """cases: {group, days or None (pending), withdrawn}. Per group: cases, decided,
    p25/p50/p75 over the group's non-withdrawn cases, each only once measurable."""
    by: dict[str, dict] = {}
    for c in cases:
        if c["withdrawn"]:
            continue
        g = by.setdefault(c["group"], {"days": [], "total": 0})
        g["total"] += 1
        if c["days"] is not None:
            g["days"].append(c["days"])
    out = {}
    for grp in group_order(by):
        d = sorted(by[grp]["days"])
        row = {"cases": by[grp]["total"], "decided": len(d)}
        if len(d) >= MIN_DECIDED:
            for p in PCTS:
                v = percentile_of(d, by[grp]["total"], p)
                if v is not None:
                    row[f"p{p}"] = v
        out[grp] = row
    return out


def group_estimate(prev: dict, prev_apps: int, this: dict, this_apps: int) -> dict:
    """The page's days-from-filing per group this season, from last season's
    groups, spread by this season's applications, corrected by this season's
    own decisions as they come in. Returns {group: {p25, p50, p75, basis}}."""
    pa = prev.get("A", {})
    if "p50" not in pa or prev_apps <= 0:
        return {}
    scale = this_apps / prev_apps
    own_a = this.get("A", {}).get("p50")
    anchor = own_a if own_a is not None else pa["p50"]
    order = group_order(set(prev) | set(this))
    prev_order = [g for g in group_order(prev) if "p50" in prev[g]]
    steps = [prev[b]["p50"] - prev[a]["p50"] for a, b in zip(prev_order, prev_order[1:])]
    step = sum(steps) / len(steps) if steps else 0
    out = {}
    for g in order:
        pg = prev.get(g, {})
        if "p50" in pg:
            src = pg
            gap = pg["p50"] - pa["p50"]
        elif prev_order:
            # A group last season didn't have: one average step past its last.
            src = prev[prev_order[-1]]
            gap = src["p50"] - pa["p50"] + step * (order.index(g) - order.index(prev_order[-1]))
        else:
            continue
        p50 = round(anchor + gap * scale)
        # The spread around the date is last season's for that group.
        est = {f"p{q}": max(0, p50 + src.get(f"p{q}", src["p50"]) - src["p50"]) for q in PCTS}
        est["p50"] = p50
        est["basis"] = "this season's group A" if own_a is not None else "last season's groups"
        mine = this.get(g, {})
        measured = [p for p in PCTS if f"p{p}" in mine]
        for p in measured:
            est[f"p{p}"] = mine[f"p{p}"]
        if measured:
            est["basis"] = "this group's own decisions"
        # Keep the percentiles in order once a measured one has replaced an estimated one.
        for lo_q, hi_q in ((25, 50), (10, 25)):
            est[f"p{lo_q}"] = min(est[f"p{lo_q}"], est[f"p{hi_q}"])
        for lo_q, hi_q in ((50, 75), (75, 90)):
            est[f"p{hi_q}"] = max(est[f"p{hi_q}"], est[f"p{lo_q}"])
        out[g] = est
    return out


def previous_peak(peaks: dict[str, dict], peak: str) -> str | None:
    """The newest earlier season of the same month whose groups are measured."""
    same = sorted(p for p in peaks if p < peak and p[5:7] == peak[5:7] and "p50" in peaks[p]["groups"].get("A", {}))
    return same[-1] if same else None


# ---- reading the record ------------------------------------------------------

def decisions(db: Turso, peak_cases: dict[str, dict]) -> dict[str, tuple[int | None, bool]]:
    """case -> (days from submitted to DOL's decision, or None; withdrawn).
    DOL's file gives the decision date; for a case only the live record has
    decided, the day our sweep first saw it final."""
    nums = list(peak_cases)
    out: dict[str, tuple[int | None, bool]] = {}
    for i in range(0, len(nums), 400):
        chunk = nums[i:i + 400]
        ph = ",".join("?" * len(chunk))
        for cn, st, dd in query_rows(db, f"SELECT case_number, case_status, decision_date FROM seasonal_cases WHERE case_number IN ({ph})", chunk):
            sub = peak_cases[cn]["submitted"]
            st = (st or "").upper()
            if dd and sub:
                out[cn] = ((date.fromisoformat(str(dd)[:10]) - date.fromisoformat(sub)).days, WITHDRAWN in st)
        live = query_rows(
            db,
            f"SELECT s.case_number, s.current_status, s.is_final, MIN(e.changed_at) FROM seasonal_case_status s "
            f"LEFT JOIN seasonal_case_events e ON e.case_number = s.case_number AND e.to_final = 1 "
            f"WHERE s.case_number IN ({ph}) GROUP BY s.case_number",
            chunk,
        )
        for cn, st, fin, at in live:
            if cn in out:
                continue
            st = (st or "").upper()
            sub = peak_cases[cn]["submitted"]
            if str(fin) in ("1", "True") and at and sub:
                d = datetime.fromtimestamp(int(at) / 1000, ET).date()
                out[cn] = ((d - date.fromisoformat(sub)).days, WITHDRAWN in st)
            elif str(fin) in ("1", "True"):
                # Final before our sweep watched it, with no file row yet: decided, day unknown.
                out[cn] = (None, WITHDRAWN in st)
    return out


def build(db: Turso) -> dict:
    rows = query_rows(db, "SELECT case_number, peak, grp, submitted FROM h2b_groups", [])
    by_peak: dict[str, dict[str, dict]] = {}
    for cn, peak, grp, sub in rows:
        by_peak.setdefault(peak, {})[cn] = {"group": grp, "submitted": sub}
    peaks: dict[str, dict] = {}
    for peak, cases in sorted(by_peak.items()):
        dec = decisions(db, cases)
        items = []
        unknown_day = 0
        for cn, c in cases.items():
            days, withdrawn = dec.get(cn, (None, False))
            if cn in dec and days is None and not withdrawn:
                unknown_day += 1
                continue  # decided on a day we can't date: neither pending nor timed
            items.append({"group": c["group"], "days": days, "withdrawn": withdrawn})
        peaks[peak] = {"applications": len(cases), "groups": group_stats(items), "undatedDecisions": unknown_day}
    estimates = {}
    for peak, info in peaks.items():
        pending = sum(g["cases"] - g["decided"] for g in info["groups"].values())
        prev = previous_peak(peaks, peak)
        if not pending or not prev:
            continue
        estimates[peak] = {
            "previous": prev,
            "scale": round(info["applications"] / peaks[prev]["applications"], 3),
            "groups": group_estimate(peaks[prev]["groups"], peaks[prev]["applications"], info["groups"], info["applications"]),
        }
    return {"asOf": datetime.now(ET).date().isoformat(), "peaks": peaks, "estimates": estimates,
            "source": "DOL OFLC H-2B assignment-group lists, with DOL's decisions"}


# ---- loading the lists ---------------------------------------------------------

def load_lists(db: Turso, dry: bool) -> list[str]:
    links = discover_links(fetch(NEWS_URL).decode("utf-8", "replace"), FILE_PATTERN, HOST)
    if not links:
        raise SystemExit("no H-2B group list linked from OFLC's news page; the page may have moved")
    held = (read_doc(db, LOADS_KEY) or {}) if not dry else {}
    loaded = []
    for name, url in sorted(links.items()):
        data = fetch(url, referer=NEWS_URL)
        sha = hashlib.sha256(data).hexdigest()
        if held.get(name, {}).get("sha") == sha:
            continue
        rows = parse_list(data)
        peak = peak_of(rows, name)
        if not rows or not peak:
            # Said once per version of the file: DOL's older list has another
            # layout, and a nightly warning about it would only teach people to
            # ignore warnings. A new version of it is read again.
            print(f"::warning::{name}: no case rows read; left alone")
            if not dry:
                held[name] = {"sha": sha, "rows": 0, "peak": None, "loadedAt": int(time.time() * 1000)}
                write_doc(db, LOADS_KEY, held)
            continue
        print(f"{name}: {len(rows):,} cases, season {peak}")
        if not dry:
            stmts = [stmt("INSERT OR REPLACE INTO h2b_groups (case_number, peak, grp, submitted, begin_date, source_file) "
                          "VALUES (?, ?, ?, ?, ?, ?)", [r["case"], peak, r["group"], r["submitted"], r["begin"], name])
                     for r in rows]
            for i in range(0, len(stmts), 500):
                run_stmts(db, stmts[i:i + 500])
            held[name] = {"sha": sha, "rows": len(rows), "peak": peak, "loadedAt": int(time.time() * 1000)}
            write_doc(db, LOADS_KEY, held)
        loaded.append(name)
        time.sleep(2)
    return loaded


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--timing-only", action="store_true", help="rebuild the timing doc from what is held")
    a = ap.parse_args()
    db = Turso()
    if not a.dry_run:
        for sql in DDL:
            db.execute(sql)
    loaded = [] if a.timing_only else load_lists(db, a.dry_run)
    if a.dry_run:
        return 0
    doc = build(db)
    if not doc["peaks"]:
        print("no group lists held; nothing written")
        return 1
    write_doc(db, DOC_KEY, doc)
    note = f"{len(loaded)} lists loaded; seasons {', '.join(doc['peaks'])}; estimating {', '.join(doc['estimates']) or 'none'}"
    record_run(db, "ingest_h2b_groups.py", status="ok", note=note)
    print(note)
    return 0


if __name__ == "__main__":
    sys.exit(main())
