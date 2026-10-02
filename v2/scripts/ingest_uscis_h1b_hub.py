#!/usr/bin/env python3
"""Ingest USCIS's H-1B Employer Data Hub: first decisions per employer, by fiscal year.

WHAT IT IS. USCIS counts, per petitioner and fiscal year, the H-1B workers it
approved and denied on its FIRST decision, split six ways by the box ticked on
Form I-129 Part 2 Question 2 (new employment, continuation, change with the
same employer, new concurrent, change of employer, amended petition). Appeals
and revocations are excluded and so are petitions still pending (USCIS's
"Understanding Our H-1B Employer Data Hub" page). FY2009 to the current
quarter. This is the only federal record of H-1B approvals and denials by
employer; DOL's LCA files say what an employer was CERTIFIED to file, not what
USCIS then decided.

WHERE IT LIVES, AND HOW IT IS READ (measured from a residential address on
2026-10-01):

* The hub page on www.uscis.gov embeds a Tableau Server view; the view's URL
  is read off that page, never typed here.
* The workbook's sheets are read from the view's own session config
  (`startSession/viewing`, the request USCIS's page makes to render it), which
  lists `repository_urls` and says `allow_export_data: true` for guests.
* Each sheet is exported with Tableau's documented `<view>.csv` form, and a
  fiscal year is chosen with its documented URL filter on the sheet's own
  `Fiscal Year` field (whose name, trailing spaces included, is read from the
  first export's header). That is the "Download to Excel / CSV" USCIS's page
  tells readers to use, in its URL form. One export is 75 to 110 MB, long
  format: one row per petitioner address and measure.
* The ARCHIVED per-year CSVs (`/archive/h-1b-employer-data-hub-files`,
  FY2009 to FY2023, "out of date" by USCIS's own banner) are NOT used: they
  carry only an initial/continuing split, and FY2023's sums to 176,950
  approvals where the live hub's FY2023 sums to 386,334. The live hub is the
  current cut, with the six-way split, for every year.

HOW A LOAD IS GUARDED:

* every row of a year's export must carry the year asked for, so a filter
  that silently stopped applying (which would hand back the default year
  under another year's label) is refused;
* the measure names must be exactly USCIS's twelve, every petitioner key must
  carry all twelve, and every count must be a non-negative integer;
* a year that held N rows before may not come back with under 70% of them, or
  with under 70% of its approvals, without `--accept-drift`;
* a year is written to a staging table, counted back, and swapped into place
  in one transaction, so no page reads a half-written year.

www.uscis.gov 403s GitHub's datacenter runners on some days, so this runs on
the server's timer (scripts/oracle/bin/permtracker-uscis h1b-hub), which is
the site's scheduled USCIS runner.

Usage:
    python3 scripts/ingest_uscis_h1b_hub.py               # the current year, and last year until its Q4 is in
    python3 scripts/ingest_uscis_h1b_hub.py --fy 2024     # one fiscal year
    python3 scripts/ingest_uscis_h1b_hub.py --all         # every year not yet held through Q4 (paced)
    python3 scripts/ingest_uscis_h1b_hub.py --local-csv F --fy 2026 --dry-run   # parse a saved export
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_slugs import slugify  # noqa: E402
from lib_gov_data import BROWSER_HEADERS, fetch, log, quarter_end  # noqa: E402
from lib_turso import Turso, read_doc, record_run, stamp_freshness, write_doc  # noqa: E402

SCRIPT = "ingest_uscis_h1b_hub.py"
HUB_PAGE = "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub"
DATASET = "uscis-h1b-hub"
LOADS_DOC = "uscis_h1b_hub_loads"
TABLE = "uscis_h1b_employers"
STAGE = "uscis_h1b_employers_stage"
DRIFT_FLOOR = 0.70
PAUSE_S = 15

# USCIS's twelve measures, as the export spells them, and the column each lands in.
MEASURES: dict[str, str] = {
    "New Employment Approval": "new_appr",
    "New Employment Denial": "new_den",
    "Continuation Approval": "cont_appr",
    "Continuation Denial": "cont_den",
    "Change with Same Employer Approval": "same_appr",
    "Change with Same Employer Denial": "same_den",
    "New Concurrent Approval": "conc_appr",
    "New Concurrent Denial": "conc_den",
    "Change of Employer Approval": "chg_appr",
    "Change of Employer Denial": "chg_den",
    "Amended Approval": "amend_appr",
    "Amended Denial": "amend_den",
}
COUNT_COLUMNS = list(MEASURES.values())
APPROVAL_COLUMNS = [c for c in COUNT_COLUMNS if c.endswith("_appr")]

# The export's header, stripped. "Line by line" is a row index and is not kept.
HEADER = {
    "employer": "Employer (Petitioner) Name",
    "fy": "Fiscal Year",
    "naics": "Industry (NAICS) Code",
    "measure": "Measure Names",
    "city": "Petitioner City",
    "state": "Petitioner State",
    "zip": "Petitioner Zip Code",
    "tax_id4": "Tax ID",
    "value": "Measure Values",
}
KEY_COLUMNS = ["employer", "naics_sector", "city", "state", "zip", "tax_id4"]

DDL = [
    f"""CREATE TABLE IF NOT EXISTS {TABLE} (
        fy INTEGER NOT NULL, employer TEXT NOT NULL, employer_slug TEXT,
        naics_sector TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL, zip TEXT NOT NULL,
        tax_id4 TEXT NOT NULL,
        {", ".join(f"{c} INTEGER NOT NULL" for c in COUNT_COLUMNS)},
        PRIMARY KEY (fy, employer, naics_sector, city, state, zip, tax_id4))""",
    # The employer page reads one employer's slug range across every year.
    f"CREATE INDEX IF NOT EXISTS {TABLE}_emp ON {TABLE} (employer_slug, fy)",
]


class Refusal(Exception):
    """A load that must not be written, with the reason."""


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

def view_url(hub_html: str) -> str:
    """The Tableau view the hub page embeds, as the page names it."""
    m = re.search(r"https://[a-z0-9.-]+\.uscis\.dhs\.gov/views/[A-Za-z0-9_%.-]+/[A-Za-z0-9_%.-]+", hub_html)
    if not m:
        raise Refusal("the hub page names no Tableau view; USCIS may have moved the data")
    return m.group(0)


def coverage(hub_html: str) -> tuple[int, int, int]:
    """(first FY, last FY, last FY's quarter) from the page's own sentence."""
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", hub_html))
    m = re.search(r"fiscal year (\d{4}) through fiscal year (\d{4})(?: \(quarter (\d)\))?", text, re.I)
    if not m:
        raise Refusal("the hub page no longer says which years it covers")
    return int(m.group(1)), int(m.group(2)), int(m.group(3) or 4)


def session_sheets(view: str) -> list[str]:
    """The workbook's sheets other than the dashboard itself, from its session config."""
    u = urllib.parse.urlsplit(view)
    workbook, sheet = u.path.split("/views/", 1)[1].split("/", 1)
    url = f"{u.scheme}://{u.netloc}/vizql/w/{workbook}/v/{sheet}/startSession/viewing?:embed=y&:showVizHome=no"
    req = urllib.request.Request(url, data=b"", method="POST",
                                 headers={**BROWSER_HEADERS, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        cfg = json.loads(resp.read())
    if not cfg.get("allow_export_data"):
        raise Refusal("the view no longer allows data export to guests")
    origin = cfg.get("origin_repository_url")
    return [f"{u.scheme}://{u.netloc}/views/{r}" for r in cfg.get("repository_urls", []) if r != origin]


def export(sheet: str, fy_field: str | None = None, fy: int | None = None) -> str:
    """One sheet as CSV text, optionally filtered to one fiscal year."""
    q = [(":showVizHome", "no")]
    if fy_field is not None and fy is not None:
        q.append((fy_field, str(fy)))
    blob = fetch(f"{sheet}.csv?{urllib.parse.urlencode(q, quote_via=urllib.parse.quote, safe=':')}")
    if blob[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return blob.decode("utf-16")
    return blob.decode("utf-8-sig")


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def header_map(header: list[str]) -> dict[str, int]:
    """Column positions by our names; refuses when one is missing."""
    stripped = [h.strip() for h in header]
    out: dict[str, int] = {}
    for ours, theirs in HEADER.items():
        if theirs not in stripped:
            raise Refusal(f"the export has no '{theirs}' column (got {stripped})")
        out[ours] = stripped.index(theirs)
    return out


def fy_field(header: list[str]) -> str:
    """The exact Fiscal Year field name, trailing spaces included: the URL filter needs it verbatim."""
    for h in header:
        if h.strip() == HEADER["fy"]:
            return h
    raise Refusal("the export has no Fiscal Year column")


def count(v: str) -> int:
    s = v.replace(",", "").strip()
    if s == "":
        return 0
    if not re.fullmatch(r"\d+", s):
        raise Refusal(f"a count that isn't a whole number: {v!r}")
    return int(s)


def parse(text: str, expect_fy: int | None) -> tuple[int, list[dict]]:
    """Pivot the long export to one row per petitioner address.

    Returns (fiscal year, rows). Refuses on a missing column, a row of another
    year, an unknown measure, a key missing a measure, or a bad count.
    """
    r = csv.reader(io.StringIO(text))
    header = next(r, None)
    if not header:
        raise Refusal("the export is empty")
    col = header_map(header)
    keyed: dict[tuple, dict] = {}
    years: set[int] = set()
    for line in r:
        if not line or all(c == "" for c in line):
            continue
        fy_raw = line[col["fy"]].strip()
        if not re.fullmatch(r"\d{4}", fy_raw):
            raise Refusal(f"a fiscal year that isn't a year: {fy_raw!r}")
        fy = int(fy_raw)
        years.add(fy)
        measure = line[col["measure"]].strip()
        if measure not in MEASURES:
            raise Refusal(f"an unknown measure: {measure!r}")
        # Keyed on the cells EXACTLY as published, so a measure seen twice
        # means a broken pivot. Spellings that differ only in spacing
        # ("MIDDLETON" and "MIDDLETON ", one Wisconsin employer in FY2026) are
        # separate rows there and are summed below, once the check has passed.
        key = tuple(line[col[c]] for c in ("employer", "naics", "city", "state", "zip", "tax_id4"))
        row = keyed.setdefault(key, {})
        name = MEASURES[measure]
        if name in row:
            raise Refusal(f"a petitioner key carries {measure!r} twice: {key}")
        row[name] = count(line[col["value"]])
    if not keyed:
        raise Refusal("the export holds no rows")
    if len(years) != 1:
        raise Refusal(f"one export, several fiscal years: {sorted(years)}")
    fy = years.pop()
    if expect_fy is not None and fy != expect_fy:
        raise Refusal(f"asked for FY{expect_fy}, the export is FY{fy}: the year filter didn't apply")
    merged: dict[tuple, dict] = {}
    for key, measures in keyed.items():
        missing = [c for c in COUNT_COLUMNS if c not in measures]
        if missing:
            raise Refusal(f"a petitioner key is missing {missing}: {key}")
        employer, naics, city, state, zip_code, tax_id4 = (v.strip() for v in key)
        norm = (employer, naics_sector(naics), city, state, zip_code, tax_id4)
        row = merged.get(norm)
        if row is None:
            merged[norm] = {"fy": fy, "employer": employer, "employer_slug": slugify(employer) or None,
                            **dict(zip(KEY_COLUMNS[1:], norm[1:])), **measures}
        else:
            for c in COUNT_COLUMNS:
                row[c] += measures[c]
    return fy, list(merged.values())


def naics_sector(label: str) -> str:
    """'31-33 - Manufacturing' -> '31-33', '54 - Professional...' -> '54', blank -> ''."""
    m = re.match(r"\s*(\d{2}(?:-\d{2})?)\b", label)
    return m.group(1) if m else ""


def totals(rows: list[dict]) -> dict[str, int]:
    return {c: sum(r[c] for r in rows) for c in COUNT_COLUMNS}


def drift(previous: dict | None, rows: list[dict]) -> list[str]:
    """Why a reload looks like a broken export, against the last load of the same year."""
    if not previous:
        return []
    out = []
    if len(rows) < DRIFT_FLOOR * int(previous.get("rows", 0)):
        out.append(f"rows {len(rows):,} against {int(previous['rows']):,} last time")
    appr = sum(totals(rows)[c] for c in APPROVAL_COLUMNS)
    if appr < DRIFT_FLOOR * int(previous.get("approvals", 0)):
        out.append(f"approvals {appr:,} against {int(previous['approvals']):,} last time")
    return out


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

def store(db: Turso, fy: int, rows: list[dict]) -> int:
    """Stage the year, count it back, then swap it in under one transaction."""
    for ddl in DDL:
        db.execute(ddl)
    db.execute(f"DROP TABLE IF EXISTS {STAGE}")
    db.execute(DDL[0].replace(f"IF NOT EXISTS {TABLE}", STAGE))
    cols = ["fy", "employer", "employer_slug", *KEY_COLUMNS[1:], *COUNT_COLUMNS]
    holes = "(" + ",".join("?" * len(cols)) + ")"
    for i in range(0, len(rows), 200):
        chunk = rows[i:i + 200]
        args: list = []
        for r in chunk:
            args += [r[c] for c in cols]
        db.execute(f"INSERT INTO {STAGE} ({', '.join(cols)}) VALUES " + ",".join([holes] * len(chunk)), args)
    staged = int(db.scalar(f"SELECT count(*) FROM {STAGE}") or 0)
    if staged != len(rows):
        raise Refusal(f"parsed {len(rows):,} rows for FY{fy} but staged {staged:,}")
    year = int(fy)  # validated above; inlined because a script batch takes no arguments
    db.script([
        "BEGIN",
        f"DELETE FROM {TABLE} WHERE fy = {year}",
        f"INSERT INTO {TABLE} SELECT * FROM {STAGE}",
        "COMMIT",
    ])
    db.execute(f"DROP TABLE IF EXISTS {STAGE}")
    held = int(db.scalar(f"SELECT count(*) FROM {TABLE} WHERE fy = ?", [year]) or 0)
    if held != len(rows):
        raise Refusal(f"FY{fy}: {held:,} rows held after the swap, {len(rows):,} parsed")
    return held


def load_year(db: Turso | None, fy: int, rows: list[dict], loads: dict, quarter: int, *,
              accept_drift: bool, dry_run: bool) -> int:
    t = totals(rows)
    appr = sum(t[c] for c in APPROVAL_COLUMNS)
    log(f"  FY{fy}: {len(rows):,} petitioner rows, {appr:,} workers approved, "
        f"{sum(v for c, v in t.items() if c.endswith('_den')):,} denied")
    problems = drift(loads.get(str(fy)), rows)
    if problems and not accept_drift:
        raise Refusal(f"FY{fy} looks broken against its last load: {'; '.join(problems)}")
    if dry_run or db is None:
        return 0
    n = store(db, fy, rows)
    loads[str(fy)] = {"rows": len(rows), "approvals": appr, "quarter": quarter,
                      "loaded_at": time.strftime("%Y-%m-%d")}
    write_doc(db, LOADS_DOC, json.dumps(loads, sort_keys=True))
    return n


def years_to_load(first_fy: int, last_fy: int, last_q: int, loads: dict, *,
                  fy: int | None = None, every: bool = False) -> list[int]:
    """Which fiscal years a run fetches, newest first.

    A year is "held" once loaded at the quarter the hub had reached for it:
    the current year at the hub's quarter, every earlier year at Q4. Past
    years don't move after their Q4 (the hub counts a decision in the year
    USCIS first recorded it), so a routine run fetches the current year and,
    until it has been held through Q4, the one before.
    """
    def held(y: int) -> bool:
        want = last_q if y == last_fy else 4
        return int(loads.get(str(y), {}).get("quarter", 0)) >= want

    if fy is not None:
        if fy < first_fy or fy > last_fy:
            raise Refusal(f"FY{fy} is outside the hub's FY{first_fy} to FY{last_fy}")
        return [fy]
    if every:
        return [y for y in range(last_fy, first_fy - 1, -1) if not held(y)]
    out = [last_fy]
    if last_fy - 1 >= first_fy and not held(last_fy - 1):
        out.append(last_fy - 1)
    return out


# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fy", type=int, help="load this fiscal year only")
    ap.add_argument("--all", action="store_true", help="every year not yet held through Q4")
    ap.add_argument("--local-csv", help="parse a saved export instead of fetching")
    ap.add_argument("--dry-run", action="store_true", help="parse and check, write nothing")
    ap.add_argument("--accept-drift", action="store_true", help="write a year that shrank past the drift floor")
    ap.add_argument("--pause", type=float, default=PAUSE_S, help="seconds between year exports")
    args = ap.parse_args(argv)
    started = int(time.time() * 1000)

    if args.local_csv:
        with open(args.local_csv, encoding="utf-8-sig") as f:
            fy, rows = parse(f.read(), args.fy)
        load_year(None, fy, rows, {}, 4, accept_drift=True, dry_run=True)
        return 0

    hub = fetch(HUB_PAGE).decode("utf-8", errors="replace")
    first_fy, last_fy, last_q = coverage(hub)
    view = view_url(hub)
    sheets = session_sheets(view)
    log(f"hub covers FY{first_fy} to FY{last_fy} Q{last_q}; view {view}; sheets {sheets}")

    db = None if args.dry_run else Turso()
    loads = (read_doc(db, LOADS_DOC) or {}) if db else {}
    written = 0
    loaded: list[int] = []
    try:
        # The default export is the current year, and its header names the
        # Fiscal Year field the filter needs. Find the data sheet by its header.
        default_text, sheet = None, None
        for s in sheets:
            text = export(s)
            try:
                header_map(next(csv.reader(io.StringIO(text))))
            except Refusal:
                continue
            default_text, sheet = text, s
            break
        if not sheet or default_text is None:
            raise Refusal(f"no sheet in {sheets} exports the employer table")
        field = fy_field(next(csv.reader(io.StringIO(default_text))))

        def quarter_of(fy: int) -> int:
            return last_q if fy == last_fy else 4

        wanted = years_to_load(first_fy, last_fy, last_q, loads, fy=args.fy, every=args.all)
        for i, fy in enumerate(wanted):
            if i:
                time.sleep(args.pause)
            if fy == last_fy:
                got_fy, rows = parse(default_text, None)
                if got_fy != fy:
                    log(f"  the default export is FY{got_fy}, not FY{fy}; asking for FY{fy} by filter")
                    got_fy, rows = parse(export(sheet, field, fy), fy)
            else:
                got_fy, rows = parse(export(sheet, field, fy), fy)
            written += load_year(db, got_fy, rows, loads, quarter_of(fy),
                                 accept_drift=args.accept_drift, dry_run=args.dry_run)
            loaded.append(got_fy)
    except Refusal as e:
        log(f"REFUSED: {e}")
        if db:
            record_run(db, SCRIPT, status="failed", rows_written=written, note=str(e)[:300], started_at=started)
        return 1

    if db and loaded:
        stamp_freshness(db, DATASET, as_of=quarter_end(last_fy, last_q), source=HUB_PAGE,
                        cadence="Quarterly",
                        note=f"FY{first_fy} to FY{last_fy} Q{last_q}; loaded FY{', FY'.join(map(str, loaded))}",
                        max_age_days=200)
        record_run(db, SCRIPT, status="ok", rows_written=written,
                   note=f"loaded FY{', FY'.join(map(str, loaded))} (hub through FY{last_fy} Q{last_q})",
                   started_at=started)
    log(f"done: {written:,} rows written for {loaded}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
