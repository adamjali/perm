#!/usr/bin/env python3
"""WARN notices, matched to the PERM sponsors in the record. California first.

    python3 scripts/ingest_warn.py                    # fetch California's report, write
    python3 scripts/ingest_warn.py --dry-run          # print, write nothing
    python3 scripts/ingest_warn.py --from-file x.xlsx # parse a saved report

WHAT THIS IS. The Worker Adjustment and Retraining Notification Act makes an
employer file 60 days' notice of a mass layoff or closing with the state,
and some states publish the notices. DOL's PERM files record no layoff, so a
WARN notice is the only public trace of one, and 20 CFR 656.17(k) makes a
layoff in the six months before filing something the employer has to
account for. Each notice becomes one row in `warn_notices`, matched to a
sponsor when the employer's normalised name (`entity_identity.entity_key`,
the same rule the entity table is keyed on) equals a PERM employer's
`merge_key`. An exact key match only: a prefix match would attach a
foundation's layoff to a company that shares its first word.

PARTIAL BY DESIGN. California publishes a spreadsheet with a stable shape
(edd.ca.gov, the "Detailed WARN Report" sheet), so it is read. Texas answers
scripts with a challenge page, Washington keeps a database behind a search
form, New York publishes an HTML list; none is read yet, and the page that
shows these notices says so. Adding a state means a parser for its file and
the same row shape; nothing else changes.

WHAT IT IS NOT. A layoff count for an employer, or a judgment about one. A
notice is one filing as the state printed it, with the state's own numbers.
"""
from __future__ import annotations

import argparse
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from entity_identity import entity_key  # noqa: E402
from lib_turso import Turso, record_run, stamp_freshness  # noqa: E402

CA_URL = "https://edd.ca.gov/siteassets/files/jobs_and_training/warn/warn_report1.xlsx"
CA_PAGE = "https://edd.ca.gov/en/jobs_and_training/Layoff_Services_WARN/"
# Texas: one spreadsheet per calendar year, linked from the WARN page. The
# site answers scripts with a bot challenge (HTTP 202 and a 2 KB page, measured
# from a residential address 2026-09-09); a real browser gets the file. The
# runner tries anyway, and `--state tx --from-file <xlsx>` is the fallback.
TX_URL = "https://www.twc.texas.gov/sites/default/files/oei/docs/warn-act-listings-{year}-twc.xlsx"
TX_PAGE = "https://www.twc.texas.gov/data-reports/warn-notice"
# New York: the current notices live in a Tableau Public dashboard, and Tableau
# Public serves any view as CSV. 194 rows for 2026 on 2026-09-09; the legacy
# HTML list holds 2023 to 2025 as one page per notice and is not read.
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
        fetched_at INTEGER NOT NULL)""",
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


def parse_california(xlsx_bytes: bytes) -> list[dict]:
    """The 'Detailed WARN Report' sheet: one row per notice, columns resolved by header name."""
    import openpyxl  # the runner installs it; the laptop's miniconda has it

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
        base = "|".join([row["state"], row["notice_date"], row["company"], row["effective_date"] or "", row["county"] or "", row.pop("_extra", "") or "", str(row["employees"] or "")])
        n = seen.get(base, 0)
        seen[base] = n + 1
        row["id"] = hashlib.sha1(f"{base}|{n}".encode()).hexdigest()[:16]
    return rows


def parse_texas(xlsx_bytes: bytes) -> list[dict]:
    """TWC's yearly listing: one sheet, one header row, columns by name.

    Header as shipped 2026-09-09: NOTICE_DATE, JOB_SITE_NAME, COUNTY_NAME,
    WDA_NAME, TOTAL_LAYOFF_NUMBER, LayOff_Date, WFDD_RECEIVED_DATE, CITY_NAME.
    Texas does not say whether a notice is a layoff or a closure, so `kind`
    is null rather than guessed.
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
            "_extra": str(r[c_city]).strip() if c_city is not None and r[c_city] else "",
        })
    return assign_ids(out)


def parse_new_york(csv_bytes: bytes) -> list[dict]:
    """The Tableau Public view as CSV. Headers carry stray spaces; they are stripped."""
    import csv

    text = csv_bytes.decode("utf-8-sig", "replace")
    reader = csv.reader(io.StringIO(text))
    header = [h.strip().lower() for h in next(reader, [])]

    def col(*needles: str) -> int | None:
        return next((i for i, h in enumerate(header) if all(n in h for n in needles)), None)

    c_company, c_start, c_notice, c_addr = col("business"), col("layoff/closure starts"), col("date of warn"), col("address")
    c_county, c_lc, c_pt, c_n, c_index = col("county"), col("layoff or closure"), col("permanent"), col("affected workers"), col("index")
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
            "_extra": "|".join(x for x in [r[c_addr].strip() if c_addr is not None else "", r[c_index].strip() if c_index is not None else ""]),
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


def match_employers(db: Turso, rows: list[dict]) -> int:
    """Attach a sponsor slug where the normalised name equals a PERM employer's merge key."""
    keys = sorted({entity_key(r["company"]) for r in rows if r["company"]})
    slug_by_key: dict[str, str] = {}
    for i in range(0, len(keys), 100):
        chunk = keys[i : i + 100]
        marks = ",".join("?" * len(chunk))
        res = db.execute(f"SELECT merge_key, slug, total FROM perm_entities WHERE kind = 'employer' AND merge_key IN ({marks}) ORDER BY total DESC", chunk)
        for r in res["response"]["result"]["rows"]:
            vals = [None if c["type"] == "null" else c["value"] for c in r]
            slug_by_key.setdefault(str(vals[0]), str(vals[1]))  # busiest spelling wins
    n = 0
    for r in rows:
        slug = slug_by_key.get(entity_key(r["company"]))
        r["employer_slug"] = slug
        n += 1 if slug else 0
    return n


def _cmp(employees, slug) -> tuple:
    """Both sides of the change check, in one shape.

    **libSQL returns integers as STRINGS**, so a stored `employees` of '42'
    never equals the parsed int 42 and every row reads as changed: measured
    2026-09-09, an identical re-run rewrote all 566 rows and logged "wrote
    566" as though it had done useful work. That is not a slow diff, it is NO
    diff, and it is the same defect `live_norm()` exists for in
    build_entity_detail.py. Normalise both sides or do not compare at all.
    """
    return (None if employees is None or employees == "" else int(employees), slug or None)


def write(db: Turso, rows: list[dict], state: str) -> int:
    db.script(DDL)
    res = db.execute("SELECT id, employees, employer_slug FROM warn_notices WHERE state = ?", [state])
    have = {}
    for r in res["response"]["result"]["rows"]:
        vals = [None if c["type"] == "null" else c["value"] for c in r]
        have[vals[0]] = _cmp(vals[1], vals[2])
    now = int(time.time() * 1000)
    written = 0
    for r in rows:
        if have.get(r["id"]) == _cmp(r["employees"], r.get("employer_slug")):
            continue
        db.execute(
            "INSERT OR REPLACE INTO warn_notices VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            [r["id"], r["state"], r["notice_date"], r["effective_date"], r["company"], r["kind"], r["employees"], r["county"], r["industry"], r.get("employer_slug"), r["source_url"], now],
        )
        written += 1
    return written


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def load_texas(from_file: str | None) -> list[dict]:
    raw = open(from_file, "rb").read() if from_file else fetch(TX_URL.format(year=dt.date.today().year))
    return parse_texas(raw)


# `browser_only` states refuse automated clients as a matter of policy, so a
# refusal from a scheduled run is EXPECTED and must not mark the run partial:
# a job that reports failure every single week teaches everyone to skip its
# alert, which is exactly how the I-485 outage of Sep 6 to 9 2026 sat unread
# for four days. Measured 2026-09-09 from GitHub runner 52.155.33.249 and from
# a residential address alike: Texas answers HTTP 202 with zero bytes for both
# its WARN page and its spreadsheet. Staleness is still reported, by the state's
# own freshness row below, which only moves when that state actually writes.
STATES: dict[str, dict] = {
    "ca": {"name": "California", "page": CA_PAGE, "days": 21, "load": lambda f: parse_california(open(f, "rb").read() if f else fetch(CA_URL))},
    "tx": {"name": "Texas", "page": TX_PAGE, "days": 45, "browser_only": True, "load": load_texas},
    "ny": {"name": "New York", "page": NY_PAGE, "days": 21, "load": lambda f: parse_new_york(open(f, "rb").read() if f else fetch(NY_CSV))},
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
    failed: list[str] = []     # unexpected: these make the run partial
    refused: list[str] = []    # expected: a browser-only source turning a script away
    for st in wanted:
        asked_by_hand = a.from_file is not None
        try:
            rows = STATES[st]["load"](a.from_file)
        except Exception as e:  # one state's outage must not cost the others
            log(f"{STATES[st]['name']}: {type(e).__name__}: {str(e)[:200]}")
            (failed if asked_by_hand or not STATES[st].get("browser_only") else refused).append(st)
            continue
        if not rows:
            log(f"{STATES[st]['name']}: no rows parsed; refusing to write it")
            (failed if asked_by_hand or not STATES[st].get("browser_only") else refused).append(st)
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
    written = 0
    for st, rows in parsed.items():
        written += write(db, rows, st.upper())
        # ONE FRESHNESS ROW PER STATE, stamped only when that state actually
        # wrote. The health check reads every row in that table dynamically, so
        # this is what makes a single state going quiet visible without the
        # whole job crying wolf: Texas needs a browser fetch, and its row ages
        # out at 45 days if nobody does one.
        stamp_freshness(
            db, f"{DATASET}-{st}",
            as_of=max(r["notice_date"] for r in rows),
            source=STATES[st]["page"], cadence="Weekly",
            note=f"{STATES[st]['name']}: {len(rows)} notices"
                 + (" (browser-only source; needs --state tx --from-file)" if STATES[st].get("browser_only") else ""),
            max_age_days=STATES[st]["days"],
        )
    note = "; ".join(f"{STATES[st]['name']} {len(rows)}" for st, rows in parsed.items())
    if refused:
        note += f"; refused as expected (browser-only): {', '.join(STATES[st]['name'] for st in refused)}"
    if failed:
        note += f"; FAILED: {', '.join(STATES[st]['name'] for st in failed)}"
    # The dataset-wide row speaks for every state, so only an all-states run may
    # write it: a `--state tx` run that stamped it would move the whole
    # dataset's as_of to whatever one state happened to hold.
    if a.state == "all":
        stamp_freshness(db, DATASET, as_of=max(r["notice_date"] for r in every), source=CA_PAGE, cadence="Weekly", note=note, max_age_days=MAX_AGE_DAYS)
    record_run(db, "ingest_warn.py", status="partial" if failed else "ok", rows_written=written, note=f"{note}; {matched} matched", started_at=started)
    log(f"wrote {written}; {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
