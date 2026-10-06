#!/usr/bin/env python3
"""WARN notices from four states, matched to the PERM sponsors in the record.

python3 scripts/ingest_warn.py                                # every state, write
python3 scripts/ingest_warn.py --dry-run                      # print, write nothing
python3 scripts/ingest_warn.py --state tx --from-file x.xlsx  # parse a saved file

The Worker Adjustment and Retraining Notification Act makes an employer file
60 days' notice of a mass layoff or closing with the state, and some states
publish the notices. DOL's PERM files record no layoff, so a WARN notice is the
only public trace of one, and 20 CFR 656.17(k) makes a layoff in the six months
before filing something the employer has to account for. Each notice becomes
one row in `warn_notices`, matched to a sponsor when the employer's normalised
name (`entity_identity.entity_key`, the rule the entity table is keyed on)
equals a PERM employer's `merge_key`, or has the same letters with the gaps
elsewhere (Rule D in entity_identity.py). Never a prefix match: that would
attach a foundation's layoff to a company that shares its first word.

California, New York, Texas and Washington are read, each by its own parser
into the same row shape. Each state loads, writes and stamps its own freshness
on its own, so one state's outage never costs the others.

What it is not: a layoff count for an employer, or a judgment about one. A
notice is one filing as the state printed it, with the state's own numbers.
"""
from __future__ import annotations

import argparse
import bisect
import datetime as dt
import hashlib
import html
import io
import json
import re
import os
import sys
import time
import urllib.request
from collections.abc import Callable

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from entity_identity import SpacedKeyMap, entity_key  # noqa: E402
from lib_turso import (  # noqa: E402
    Turso, add_missing_columns, query_rows, record_run, stamp_freshness,
)

CA_URL = "https://edd.ca.gov/siteassets/files/jobs_and_training/warn/warn_report1.xlsx"
CA_PAGE = "https://edd.ca.gov/en/jobs_and_training/Layoff_Services_WARN/"
# Texas posts one spreadsheet per calendar year on its WARN page, behind a bot
# challenge that only a browser gets past, so `--state tx --from-file <xlsx>`
# loads one saved by hand.
TX_PAGE = "https://www.twc.texas.gov/data-reports/warn-notice"
# The same notices on the state's open data portal, which serves scripts and
# reaches back to 2019: the automatic source. It trails the agency spreadsheet
# by a couple of months, so a saved spreadsheet is the optional top-up for the
# newest weeks; the two produce identical ids for the notices they share.
TX_API = "https://data.texas.gov/resource/8w53-c4f6.json?$limit=50000&$order=notice_date"
TX_DATA_PAGE = "https://data.texas.gov/d/8w53-c4f6"
# New York's current notices live in a Tableau Public dashboard, which serves
# any view as CSV. Its legacy HTML list (2023 to 2025, a page per notice) is
# not read.
NY_CSV = "https://public.tableau.com/views/WorkerAdjustmentRetrainingNotificationWARN/WARN.csv?:showVizHome=no"
NY_PAGE = "https://dol.ny.gov/warn-dashboard"
# Washington: an ASP.NET grid of 15 rows a page, newest received first, paged
# by WebForms postback (`__EVENTTARGET=ucPSW$gvMain`, `__EVENTARGUMENT=Page$N`).
# Each page's hidden fields sign the next request, so the walk is sequential.
WA_URL = "https://fortress.wa.gov/esd/file/WARN/Public/SearchWARN.aspx"
WA_PAGE = "https://esd.wa.gov/employer-requirements/layoffs-and-employee-notifications/worker-adjustment-and-retraining-notification-warn-layoff-and-closure-database"
WA_DAYS = 400   # walk back this far on every run; the grid is newest-first
WA_MAX_PAGES = 80
DATASET = "warn-notices"
MAX_AGE_DAYS = 21
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

DDL = [
    """CREATE TABLE IF NOT EXISTS warn_notices (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        notice_date TEXT NOT NULL,
        effective_date TEXT,
        company TEXT NOT NULL,
        kind TEXT,
        employees INTEGER,
        county TEXT,
        industry TEXT,
        employer_slug TEXT,
        source_url TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        site TEXT)""",
    "CREATE INDEX IF NOT EXISTS warn_notices_slug ON warn_notices (employer_slug, notice_date DESC)",
    "CREATE INDEX IF NOT EXISTS warn_notices_date ON warn_notices (notice_date DESC)",
]


def log(msg: str) -> None:
    print(f"[warn] {msg}", flush=True)


def _date(v) -> str | None:
    if v is None or v == "":
        return None
    if isinstance(v, (dt.datetime, dt.date)):
        return v.date().isoformat() if isinstance(v, dt.datetime) else v.isoformat()
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return dt.datetime.strptime(s[:10] if fmt == "%Y-%m-%d" else s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _int(v) -> int | None:
    try:
        return int(float(str(v).replace(",", "")))
    except (TypeError, ValueError):
        return None


def _site(v) -> str | None:
    """The notice's site as the state printed it, for display only.

    California and New York join the street to the city with a double space
    ("420 Park Ave S  New York, NY, 10016"); that gap becomes a comma and any
    other run of whitespace one space. One company can file several notices on
    one day for different sites, and without the site they print identically.
    The id does not use this field; it hashes the raw `_extra`, and changing
    that would mint a new id for every held notice.
    """
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    s = re.sub(r",?\s{2,}", ", ", s)
    return re.sub(r"\s+", " ", s)


def parse_california(xlsx_bytes: bytes) -> list[dict]:
    """The 'Detailed WARN Report' sheet: one row per notice, columns resolved by header name."""
    import openpyxl  # installed by the workflow step; not in the standard library

    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), read_only=True, data_only=True)
    sheet = next((n for n in wb.sheetnames if "detailed" in n.lower() and "warn" in n.lower()), None)
    if not sheet:
        raise ValueError(f"no detailed WARN sheet; sheets are {wb.sheetnames}")
    rows = [r for r in wb[sheet].iter_rows(values_only=True)]
    header_i = next((i for i, r in enumerate(rows) if r and any(isinstance(c, str) and "company" in c.lower() for c in r)), None)
    if header_i is None:
        raise ValueError("no header row naming a company column")
    header = [str(c or "").lower().replace("\n", " ").strip() for c in rows[header_i]]

    def col(*needles: str) -> int | None:
        for i, h in enumerate(header):
            if all(n in h for n in needles):
                return i
        return None

    c_county, c_notice, c_effective = col("county"), col("notice", "date"), col("effective")
    c_company, c_kind, c_n, c_industry = col("company"), col("layoff"), col("employees"), col("industry")
    c_address = col("address")
    if c_company is None or c_notice is None:
        raise ValueError(f"company or notice-date column missing; header={header}")
    out: list[dict] = []
    for r in rows[header_i + 1 :]:
        if not r or r[c_company] in (None, ""):
            continue
        company = str(r[c_company]).strip()
        notice = _date(r[c_notice])
        if not notice:
            continue
        effective = _date(r[c_effective]) if c_effective is not None else None
        county = str(r[c_county]).strip() if c_county is not None and r[c_county] else None
        out.append(
            {
                "state": "CA",
                "notice_date": notice,
                "effective_date": effective,
                "company": company,
                "kind": str(r[c_kind]).strip() if c_kind is not None and r[c_kind] else None,
                "employees": _int(r[c_n]) if c_n is not None else None,
                "county": county,
                "industry": str(r[c_industry]).strip() if c_industry is not None and r[c_industry] else None,
                "source_url": CA_PAGE,
                "site": _site(r[c_address]) if c_address is not None else None,
                "_extra": str(r[c_address]).strip() if c_address is not None and r[c_address] else "",
            }
        )
    return assign_ids(out)


def assign_ids(rows: list[dict]) -> list[dict]:
    """A stable id per notice.

    One employer can file several notices on one day for several sites, and a
    report can print identical rows outright; the parser's `_extra` field (an
    address, a city, an index) separates the first and a sequence number the
    second. Row order is stable between downloads of the same report, so the
    ids are stable too.
    """
    seen: dict[str, int] = {}
    for row in rows:
        # `employees` is deliberately not in the identity: a state revises a
        # worker count, and with the count in the hash a revision would become a
        # second row instead of an update. Exact duplicates are still separated
        # by the sequence number below, and `write()` compares the count, so a
        # revision is picked up.
        base = "|".join([row["state"], row["notice_date"], row["company"], row["effective_date"] or "", row["county"] or "", row.pop("_extra", "") or ""])
        n = seen.get(base, 0)
        seen[base] = n + 1
        row["id"] = hashlib.sha1(f"{base}|{n}".encode()).hexdigest()[:16]
    return rows


def parse_texas(xlsx_bytes: bytes) -> list[dict]:
    """TWC's yearly listing: one sheet, one header row, columns by name.

    Header: NOTICE_DATE, JOB_SITE_NAME, COUNTY_NAME, WDA_NAME,
    TOTAL_LAYOFF_NUMBER, LayOff_Date, WFDD_RECEIVED_DATE, CITY_NAME. Texas
    doesn't say whether a notice is a layoff or a closure, so `kind` is null
    rather than guessed.
    """
    import openpyxl

    if not xlsx_bytes.startswith(b"PK"):
        raise ValueError("not a spreadsheet: Texas answered with a page, most likely its bot challenge; fetch the file in a browser and pass --from-file")
    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), read_only=True, data_only=True)
    rows = [r for r in wb[wb.sheetnames[0]].iter_rows(values_only=True)]
    header_i = next((i for i, r in enumerate(rows) if r and any(isinstance(c, str) and "notice_date" in c.lower() for c in r)), None)
    if header_i is None:
        raise ValueError("no header row naming NOTICE_DATE")
    header = [str(c or "").lower().strip() for c in rows[header_i]]

    def col(needle: str) -> int | None:
        return next((i for i, h in enumerate(header) if needle in h), None)

    c_notice, c_company, c_county, c_n, c_eff, c_city = col("notice_date"), col("job_site_name"), col("county"), col("total_layoff"), col("layoff_date"), col("city")
    if c_notice is None or c_company is None:
        raise ValueError(f"notice or company column missing; header={header}")
    out: list[dict] = []
    for r in rows[header_i + 1 :]:
        if not r or r[c_company] in (None, ""):
            continue
        notice = _date(r[c_notice])
        if not notice:
            continue
        out.append({
            "state": "TX",
            "notice_date": notice,
            "effective_date": _date(r[c_eff]) if c_eff is not None else None,
            "company": str(r[c_company]).strip(),
            "kind": None,
            "employees": _int(r[c_n]) if c_n is not None else None,
            "county": str(r[c_county]).strip() if c_county is not None and r[c_county] else None,
            "industry": None,
            "source_url": TX_PAGE,
            "site": _site(r[c_city]) if c_city is not None else None,
            "_extra": str(r[c_city]).strip() if c_city is not None and r[c_city] else "",
        })
    return assign_ids(out)


def parse_texas_api(body: bytes) -> list[dict]:
    """The Texas open data portal's WARN dataset, mapped onto the same fields
    the spreadsheet parser emits so a notice gets the same id from either."""
    out: list[dict] = []
    for r in json.loads(body.decode("utf8", "replace")):
        notice = _date((r.get("notice_date") or "")[:10])
        company = (r.get("job_site_name") or "").strip()
        if not notice or not company:
            continue
        out.append({
            "state": "TX",
            "notice_date": notice,
            "effective_date": _date((r.get("layoff_date") or "")[:10]) if r.get("layoff_date") else None,
            "company": company,
            "kind": None,
            "employees": _int(r.get("total_layoff_number")),
            "county": (r.get("county_name") or "").strip() or None,
            "industry": None,
            "source_url": TX_DATA_PAGE,
            "site": _site(r.get("city_name")),
            "_extra": (r.get("city_name") or "").strip(),
        })
    return assign_ids(out)


def parse_new_york(csv_bytes: bytes) -> list[dict]:
    """The Tableau Public view as CSV. Headers carry stray spaces; they are stripped.

    The view is New York's WHOLE current-year list on every download, which is
    why its state entry is a snapshot (see prune_plan).
    """
    import csv

    text = csv_bytes.decode("utf-8-sig", "replace")
    reader = csv.reader(io.StringIO(text))
    header = [h.strip().lower() for h in next(reader, [])]

    def col(*needles: str) -> int | None:
        return next((i for i, h in enumerate(header) if all(n in h for n in needles)), None)

    c_company, c_start, c_notice, c_addr = col("business"), col("layoff/closure starts"), col("date of warn"), col("address")
    c_county, c_lc, c_pt, c_n = col("county"), col("layoff or closure"), col("permanent"), col("affected workers")
    c_posted = col("date posted")
    if c_company is None or c_notice is None:
        raise ValueError(f"company or notice-date column missing; header={header}")
    out: list[dict] = []
    for r in reader:
        if len(r) <= max(c_company, c_notice) or not r[c_company].strip():
            continue
        notice = _date(r[c_notice])
        if not notice:
            continue
        kind = ", ".join(x for x in [r[c_lc].strip() if c_lc is not None else "", r[c_pt].strip() if c_pt is not None else ""] if x) or None
        out.append({
            "state": "NY",
            "notice_date": notice,
            "effective_date": _date(r[c_start]) if c_start is not None else None,
            "company": r[c_company].strip(),
            "kind": kind,
            "employees": _int(r[c_n]) if c_n is not None else None,
            "county": r[c_county].strip() if c_county is not None and r[c_county].strip() else None,
            "industry": None,
            "source_url": NY_PAGE,
            # When New York PUBLISHED the notice, which is what its freshness is
            # stamped from (see NY_POSTING_NOTE). Not stored; write() names its
            # columns and ignores it.
            "posted_date": _date(r[c_posted]) if c_posted is not None else None,
            "site": _site(r[c_addr]) if c_addr is not None else None,
            # The address separates one company's sites filed the same day. The
            # dashboard's "Index" column is a position, not an id (later postings
            # sort in ahead of a notice), so it must stay out of the identity.
            "_extra": r[c_addr].strip() if c_addr is not None else "",
        })
    return assign_ids(out)


WA_ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
WA_CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S)
WA_HIDDEN_RE = re.compile(r'<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]+value="([^"]*)"')


def parse_washington_page(page_html: str) -> list[dict]:
    """One grid page: Company, Location, Layoff Start Date, # of Workers, Closure/Layoff, Type, Received Date, Notice.

    Washington prints no separate notice date, so `notice_date` is the date
    ESD received the notice. The location is a city or a list of counties and
    is kept as printed in `county`. The notice PDF link is the row's source.
    """
    out: list[dict] = []
    for row in WA_ROW_RE.findall(page_html):
        cells = WA_CELL_RE.findall(row)
        if len(cells) != 8:
            continue
        text = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in cells[:7]]
        received = _date(text[6])
        if not received or not text[0]:
            continue
        link = re.search(r"href=['\"]([^'\"]+)['\"]", cells[7])
        out.append({
            "state": "WA",
            "notice_date": received,
            "effective_date": _date(text[2]),
            "company": text[0],
            "kind": ", ".join(x for x in [text[4], text[5]] if x) or None,
            "employees": _int(text[3]),
            "county": text[1] or None,
            "industry": None,
            "source_url": ("https://fortress.wa.gov" + link.group(1)) if link and link.group(1).startswith("/") else WA_PAGE,
            # Washington's only place field is the location already kept in `county`.
            "site": None,
            "_extra": link.group(1) if link else "",
        })
    # Assigned HERE, not in fetch_washington, so the `--from-file` path (one
    # saved page) produces ids as well. The sequence number therefore restarts
    # per page, which is safe: `_extra` is the notice's own PDF link and is
    # unique per notice, so two rows can never collide across pages.
    return assign_ids(out)


def fetch_washington(days: int = WA_DAYS, max_pages: int = WA_MAX_PAGES) -> list[dict]:
    """Walk the grid newest-first until a page's oldest receipt is older than `days`."""
    import http.cookiejar
    import urllib.parse

    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    def get(data: bytes | None = None) -> str:
        headers = {"User-Agent": UA, **({"Content-Type": "application/x-www-form-urlencoded"} if data else {})}
        return opener.open(urllib.request.Request(WA_URL, data=data, headers=headers), timeout=60).read().decode("utf8", "ignore")

    floor = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    page_html = get()
    rows: list[dict] = []
    for n in range(1, max_pages + 1):
        if n > 1:
            form = {**dict(WA_HIDDEN_RE.findall(page_html)), "__EVENTTARGET": "ucPSW$gvMain", "__EVENTARGUMENT": f"Page${n}", "ucPSW$txtSearch": ""}
            page_html = get(urllib.parse.urlencode(form).encode())
        got = parse_washington_page(page_html)
        if not got:
            break
        rows.extend(got)
        if min(r["notice_date"] for r in got) < floor:
            break
        time.sleep(0.3)
    return rows   # each page assigned its own ids in parse_washington_page


# A tiny employer that merely shares a famous name is not the company in the notice:
# Washington's "Amazon" notice matched a one-filing "AMAZON" while Amazon.com Services
# LLC holds 2,271 (Oct 6 2026). When the exact match has fewer than SMALL_EXACT
# filings, the busiest employer whose key begins with the same words takes the notice
# if it has BUSIER_BY times the filings and BUSY_FLOOR in all. Same rule and numbers as
# the keyless lookup (src/lib/api/employerLookup.ts); test_warn.py holds them together.
SMALL_EXACT, BUSIER_BY, BUSY_FLOOR = 30, 10, 100


def sponsor_matcher(entities) -> Callable[[str], str | None]:
    """`entities` is (merge_key, slug, total) rows, busiest first; returns key -> slug or None."""
    held: dict[str, str] = {}
    totals: dict[str, int] = {}
    for key, slug, total in entities:
        held.setdefault(str(key), str(slug))  # busiest spelling wins
        totals[str(slug)] = max(totals.get(str(slug), 0), int(total or 0))
    by_key = SpacedKeyMap(held)
    keys = sorted(held)

    def match(key: str) -> str | None:
        hit = by_key.get(key)
        own = totals.get(hit, 0) if hit else 0
        if not hit or own >= SMALL_EXACT:
            return hit
        prefix = key + " "  # whole words only: "amazon" never reaches "amazonia"
        best = None
        i = bisect.bisect_left(keys, prefix)
        while i < len(keys) and keys[i].startswith(prefix):
            slug = held[keys[i]]
            if slug != hit and (best is None or totals[slug] > totals[best]):
                best = slug
            i += 1
        return best if best and totals[best] >= max(BUSIER_BY * own, BUSY_FLOOR) else hit

    return match


def match_employers(db: Turso, rows: list[dict]) -> int:
    """Attach a sponsor slug where the normalised name equals a PERM employer's merge key."""
    # Every employer page's key, busiest first, so a notice spelled with the gaps
    # elsewhere ("WAL MART" against "Walmart") still finds its page (Rule D). One
    # read of about 72,000 short rows a week.
    match = sponsor_matcher(query_rows(
        db, "SELECT merge_key, slug, total FROM perm_entities WHERE kind = 'employer' "
            "AND merge_key IS NOT NULL ORDER BY total DESC"))
    n = 0
    for r in rows:
        slug = match(entity_key(r["company"]))
        r["employer_slug"] = slug
        n += 1 if slug else 0
    return n


# Which source outranks which, so a fresher record is never overwritten by a
# staler one. Texas is the only state with two feeds: the agency spreadsheet
# runs to the current week, the open data portal trails it, and they can
# disagree on a revised worker count. Without a rank, every portal run would
# revert the spreadsheet's correction.
SOURCE_RANK = {TX_PAGE: 2, TX_DATA_PAGE: 1}


def rank_of(source_url: str) -> int:
    return SOURCE_RANK.get(source_url or "", 1)


def _cmp(employees, slug, site=None) -> tuple:
    """Both sides of the change check, in one shape.

    libSQL returns integers as strings, so a stored `employees` of '42' never
    equals the parsed int 42, and without normalising both sides every row would
    read as changed and be rewritten (the same reason `live_norm()` exists in
    build_entity_detail.py).
    """
    return (None if employees is None or employees == "" else int(employees), slug or None, site or None)


# Columns added after the table first shipped. `CREATE TABLE IF NOT EXISTS`
# can never add one to a live table, so each is ALTERed in when missing.
EXTRA_COLUMNS = {"site": "TEXT"}

# Named, never positional: a positional INSERT breaks the moment a column is
# added.
INSERT_COLS = ("id, state, notice_date, effective_date, company, kind, employees, county, "
               "industry, employer_slug, source_url, fetched_at, site")


def write(db: Turso, rows: list[dict], state: str) -> int:
    db.script(DDL)
    add_missing_columns(db, "warn_notices", EXTRA_COLUMNS)
    have, held_rank, held_site = {}, {}, {}
    for nid, employees, slug, source_url, site in query_rows(
            db, "SELECT id, employees, employer_slug, source_url, site FROM warn_notices WHERE state = ?", [state]):
        have[nid] = _cmp(employees, slug, site)
        held_rank[nid] = rank_of(str(source_url or ""))
        held_site[nid] = site
    now = int(time.time() * 1000)
    differs = [r for r in rows if have.get(r["id"]) != _cmp(r["employees"], r.get("employer_slug"), r.get("site"))]
    changed = [r for r in differs if rank_of(r["source_url"]) >= held_rank.get(r["id"], 0)]
    # A lower-ranked source may not overwrite a better one's row (the rank
    # guard below), but it may FILL a site the held row lacks: the id hashes
    # the same city or address, so the two sources agree on it by construction.
    # Without this, Texas notices first loaded from the spreadsheet would never
    # get a site from the weekly portal run.
    fills = [r for r in differs if r not in changed and r["id"] in held_site
             and held_site[r["id"]] is None and r.get("site")]
    # Chunked, like ingest_flag_disclosure.write_cases: the cost is per
    # statement, so 200 rows a statement keeps a full reload to seconds.
    per = 200
    row_sql = "(" + ",".join("?" * 13) + ")"
    for i in range(0, len(changed), per):
        chunk = changed[i:i + per]
        args: list = []
        for r in chunk:
            args += [r["id"], r["state"], r["notice_date"], r["effective_date"], r["company"],
                     r["kind"], r["employees"], r["county"], r["industry"],
                     r.get("employer_slug"), r["source_url"], now, r.get("site")]
        db.execute(f"INSERT OR REPLACE INTO warn_notices ({INSERT_COLS}) VALUES " + ",".join([row_sql] * len(chunk)), args)
    for i in range(0, len(fills), per):
        chunk = fills[i:i + per]
        whens = " ".join("WHEN ? THEN ?" for _ in chunk)
        args = [v for r in chunk for v in (r["id"], r["site"])] + [r["id"] for r in chunk]
        db.execute(f"UPDATE warn_notices SET site = CASE id {whens} END "
                   f"WHERE site IS NULL AND id IN ({','.join('?' * len(chunk))})", args)
    return len(changed) + len(fills)


# A snapshot load that covers less than this share of the (company, notice
# date) pairs already held in its date range is treated as a truncated
# download, and nothing is deleted. A state withdrawing a notice or two stays
# well above it.
PRUNE_MIN_COVERAGE = 0.9


def prune_plan(held: list[tuple[str, str, str]], rows: list[dict]) -> tuple[list[str], float]:
    """Which held ids a snapshot load no longer carries, and how much it covers.

    `held` is (id, company, notice_date) for every row of the state. Only rows
    inside the load's own notice-date range are candidates, so history older
    than the file is never touched. Coverage is measured on (company, notice
    date) pairs, which do not depend on the id scheme, so it still reads true
    on the run that re-keys a whole state. Returns ([], coverage) when the
    load looks truncated; the caller logs it and deletes nothing.
    """
    if not rows:
        return [], 0.0
    lo = min(r["notice_date"] for r in rows)
    hi = max(r["notice_date"] for r in rows)
    ids = {r["id"] for r in rows}
    in_range = [h for h in held if lo <= h[2] <= hi]
    held_keys = {(c.lower(), d) for _, c, d in in_range}
    load_keys = {(r["company"].lower(), r["notice_date"]) for r in rows}
    coverage = len(held_keys & load_keys) / len(held_keys) if held_keys else 1.0
    if coverage < PRUNE_MIN_COVERAGE:
        return [], coverage
    return sorted(i for i, _, _ in in_range if i not in ids), coverage


def prune(db: Turso, rows: list[dict], state: str) -> int:
    held = [tuple(r) for r in query_rows(
        db, "SELECT id, company, notice_date FROM warn_notices WHERE state = ?", [state])]
    stale, coverage = prune_plan(held, rows)
    if not stale:
        if coverage < PRUNE_MIN_COVERAGE:
            log(f"::warning::{state}: this load covers {coverage:.0%} of the notices held in its range; "
                f"treated as truncated, nothing pruned")
        return 0
    for i in range(0, len(stale), 200):
        chunk = stale[i:i + 200]
        db.execute(f"DELETE FROM warn_notices WHERE id IN ({','.join('?' * len(chunk))})", chunk)
    log(f"{state}: pruned {len(stale)} rows the source no longer lists (coverage {coverage:.0%})")
    return len(stale)


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def load_texas(from_file: str | None) -> list[dict]:
    """The spreadsheet when handed one, the open data portal otherwise."""
    if from_file:
        return parse_texas(open(from_file, "rb").read())
    return parse_texas_api(fetch(TX_API))



STATES: dict[str, dict] = {
    "ca": {"name": "California", "page": CA_PAGE, "days": 21, "load": lambda f: parse_california(open(f, "rb").read() if f else fetch(CA_URL))},
    # Texas's budget is long because its automatic source, the open data
    # portal, trails the agency's spreadsheet by a couple of months.
    "tx": {"name": "Texas", "page": TX_DATA_PAGE, "days": 120, "load": load_texas},
    # New York: a snapshot (the file is the whole current-year list, so a row
    # it no longer carries is pruned), with freshness stamped from its own
    # "Date Posted": it posts notices about two months after their notice
    # date, so a notice-date stamp would never read fresh.
    "ny": {"name": "New York", "page": NY_PAGE, "days": 21, "snapshot": True, "stamp": "posted_date",
           "load": lambda f: parse_new_york(open(f, "rb").read() if f else fetch(NY_CSV))},
    "wa": {"name": "Washington", "page": WA_PAGE, "days": 21, "load": lambda f: parse_washington_page(open(f, encoding="utf8").read()) if f else fetch_washington()},
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--state", choices=[*STATES, "all"], default="all")
    ap.add_argument("--from-file", help="parse this file instead of fetching; needs --state")
    a = ap.parse_args()
    if a.from_file and a.state == "all":
        ap.error("--from-file needs one --state")
    started = time.time()
    wanted = list(STATES) if a.state == "all" else [a.state]
    parsed: dict[str, list[dict]] = {}
    failed: list[str] = []
    for st in wanted:
        try:
            rows = STATES[st]["load"](a.from_file)
        except Exception as e:  # one state's outage must not cost the others
            log(f"{STATES[st]['name']}: {type(e).__name__}: {str(e)[:200]}")
            failed.append(st)
            continue
        if not rows:
            log(f"{STATES[st]['name']}: no rows parsed; refusing to write it")
            failed.append(st)
            continue
        parsed[st] = rows
        log(f"{STATES[st]['name']}: {len(rows)} notices, {min(r['notice_date'] for r in rows)} to {max(r['notice_date'] for r in rows)}")
    if not parsed:
        log("nothing parsed for any state")
        return 1
    db = Turso()
    every = [r for rows in parsed.values() for r in rows]
    matched = match_employers(db, every)
    log(f"matched {matched} of {len(every)} to a PERM sponsor by merge key")
    if a.dry_run:
        for r in [x for x in every if x.get("employer_slug")][:8]:
            print(json.dumps(r))
        return 0
    written = pruned = 0
    for st, rows in parsed.items():
        written += write(db, rows, st.upper())
        if STATES[st].get("snapshot"):
            pruned += prune(db, rows, st.upper())
        # One freshness row per state, stamped only when that state wrote, so
        # the health check sees a single state go quiet. Dated by what the table
        # holds, not by this batch: a portal run (which trails the spreadsheet)
        # must not move a state's date backwards.
        newest, count = query_rows(
            db, "SELECT MAX(notice_date), COUNT(*) FROM warn_notices WHERE state = ?", [st.upper()])[0]
        as_of = newest or max(r["notice_date"] for r in rows)
        note = f"{STATES[st]['name']}: {count} notices held ({len(rows)} in this load)"
        stamp_key = STATES[st].get("stamp")
        posted = [r[stamp_key] for r in rows if stamp_key and r.get(stamp_key)]
        if posted:
            as_of = max(posted)
            note += f"; last posted {as_of}, newest notice dated {newest}"
        stamp_freshness(
            db, f"{DATASET}-{st}",
            as_of=as_of,
            source=STATES[st]["page"], cadence="Weekly",
            note=note,
            max_age_days=STATES[st]["days"],
        )
    note = "; ".join(f"{STATES[st]['name']} {len(rows)}" for st, rows in parsed.items())
    if failed:
        note += f"; FAILED: {', '.join(STATES[st]['name'] for st in failed)}"
    # The dataset-wide row speaks for every state, so only an all-states run may
    # write it: a `--state tx` run that stamped it would move the whole
    # dataset's as_of to whatever one state happened to hold.
    if a.state == "all":
        stamp_freshness(db, DATASET, as_of=max(r["notice_date"] for r in every), source=CA_PAGE, cadence="Weekly", note=note, max_age_days=MAX_AGE_DAYS)
    if pruned:
        note += f"; pruned {pruned} the source no longer lists"
    record_run(db, "ingest_warn.py", status="partial" if failed else "ok", rows_written=written, note=f"{note}; {matched} matched", started_at=started)
    log(f"wrote {written}; {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
