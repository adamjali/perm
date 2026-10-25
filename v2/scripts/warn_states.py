"""WARN notices from every state beyond the first four that a script may read.

ingest_warn.py reads California, New York, Texas and Washington and writes
every state; this module holds a reader for each other state that publishes
its notices where a plain request reaches them, with robots.txt honoured.
Each `parse_*` takes what the state served (bytes or text) so a saved copy
tests it, and each `load_*` fetches. Every row goes through lib_warn's
`notice()`, `finish()` and `assign_ids()`.

What each state gives is kept as the state printed it. A state that prints
only the month a notice was posted (New Jersey, Pennsylvania) stores the
month ("2026-10"), never an invented day. A state that prints no worker count
(Oklahoma) stores None, never 0. The notice date is the date the state gives
for the notice; where it gives only when it received or posted the notice,
that date is used and the reader says so.

Read from the Internet Archive's copies (Oct 25 2026), because the state's
own site turns scripts away: Louisiana and New Mexico (robots.txt asks
automated readers to stay off their files), Missouri (an hCaptcha check on
every page) and Nevada (its host refuses scripts and robots.txt alike); and
Minnesota and Rhode Island when their page turns a request away. Nothing is
worked around: no proxy, no solved check, no browser pretending. See the
section above the registry.

Not read, and why (checked Oct 25 2026 on each agency's own page):
  - Arkansas: "The Arkansas Division of Workforce Services does not publish or
    disseminate specific company data, including WARN notices, due to
    confidentiality requirements" (A.C.A. 11-10-314). Its job-center site's
    WARN search holds three entries, all from June 2019.
  - New Hampshire: Employment Security's page on business compliance states
    the law and links a postcard, and lists no notices.
  - Wyoming: Workforce Services' page says "Wyoming follows the federal WARN
    Act requirements" and names whom to send a notice to; its one WARN file
    explains how to file, and lists no notices.
  - Massachusetts before July 2020 (.xls workbooks openpyxl can't read) and
    South Carolina before 2022 (reports with no notice date).
"""
from __future__ import annotations

import datetime as dt
import json
import re
import time
import urllib.error
import urllib.parse
from collections.abc import Callable

from lib_warn import (
    DATE_TOKEN, archive_copy, archive_captures, archive_index, cell, clean, col, csv_rows, decode, find_header,
    finish, first_date, get, get_text, header_of, get_with, is_pdf, is_unreachable, is_xlsx, join_site, links,
    notice, parse_date, parse_int, parse_month, pause, pdf_tables, post, session, table_with, tables, text_of,
    xlsx_sheets,
)

# Notices dated before this are left out. It matches Texas's open data portal,
# which starts in 2019, keeps a paged or per-notice source to a bounded walk,
# and covers the six months before a PERM filing (20 CFR 656.17(k)) and the two
# years the sponsor index looks back, several times over.
SINCE = "2019-01-01"

# ingest_warn.main sets this to read what the table already holds for a state,
# as {id: {"employees": ..., "site": ..., "effective_date": ...}}. A reader
# whose counts sit one request per notice (the job-center states) reuses a held
# count instead of asking again. A parse-only run leaves it unset and asks for
# every notice.
HELD: dict[str, Callable[[str], dict] | None] = {"lookup": None}


def held_for(state: str) -> dict:
    fn = HELD["lookup"]
    return fn(state) if fn else {}


def walk_day(state: str) -> int:
    """The weekday (Monday is 0) a state reads its whole history again.

    Spread by the state's place in STATES, so no one day carries every walk:
    Florida's alone takes about ten minutes (its server takes about twenty
    seconds a page of a hundred), and all of them together about twenty.
    """
    codes = list(STATES)
    return codes.index(state.lower()) % 7 if state.lower() in codes else 6


def full_history(state: str, today: dt.date | None = None) -> bool:
    """Whether to read every year back to SINCE, or only the newest.

    A state read a year (or a page) at a time reads all of it on its first load
    and once a week on its own day (`walk_day`), and the newest two years or the
    newest window on other days: history a state has already published rarely
    changes, and a daily walk of seven years would be most of the run. A run
    with nothing held (a parse-only run included) reads everything.
    """
    return not held_for(state) or (today or dt.date.today()).weekday() == walk_day(state)


def years_to_read(state: str, today: dt.date | None = None) -> list[int]:
    """This year back to SINCE's year, or just this year and last."""
    this = (today or dt.date.today()).year
    first = int(SINCE[:4]) if full_history(state, today) else this - 1
    return list(range(this, first - 1, -1))


def first_count(*values) -> int | None:
    """The first value that reads as a count; a printed zero counts."""
    for v in values:
        n = parse_int(v)
        if n is not None:
            return n
    return None


def kind_from_words(v) -> str | None:
    """A free-text reason read for the state's own word: closure, mass layoff
    or layoff. Anything else (a contract ending, "Not Specified") is no kind,
    because the reason text alone doesn't say which it is."""
    t = clean(v).lower()
    if "clos" in t:
        return "Closure"
    if "mass layoff" in t:
        return "Mass Layoff"
    if "layoff" in t or "lay off" in t:
        return "Layoff"
    return None


def read(path: str) -> bytes:
    with open(path, "rb") as fh:
        return fh.read()


def from_rows(state: str, header: list[str], rows, source_url: str, spec: dict[str, tuple[str, ...]],
              kinds: dict[str, str] | None = None) -> list[dict]:
    """Rows of a table whose columns `spec` names by header words.

    `spec` maps a field (notice, company, effective, employees, county, site,
    kind, industry) to the words its header carries. The notice date and the
    company are required; the site doubles as what separates one company's
    notices filed the same day. `kinds` turns a state's code ("LO") into its
    word ("Layoff"). Works on an HTML table, a workbook sheet or a CSV alike.
    """
    h = [str(x or "").lower() for x in header]
    idx = {k: col(h, *v) for k, v in spec.items()}
    if idx.get("notice") is None or idx.get("company") is None:
        raise ValueError(f"{state}: no notice date or company column; header={h}")
    out = []
    for r in rows:
        d = parse_date(cell(r, idx["notice"]))
        if not d:
            continue
        site = clean(cell(r, idx.get("site")))
        kind = clean(cell(r, idx.get("kind")))
        if kinds:
            kind = kinds.get(kind.upper(), kind)
        out.append(notice(state, d, cell(r, idx["company"]), source_url=source_url,
                          effective_date=first_date(cell(r, idx.get("effective"))), kind=kind or None,
                          employees=parse_int(cell(r, idx.get("employees"))), county=cell(r, idx.get("county")),
                          industry=cell(r, idx.get("industry")), site=site or None, extra=site))
    return out


def html_table(state: str, page: str, source_url: str, need: tuple[str, ...], spec: dict,
               kinds: dict[str, str] | None = None) -> list[dict]:
    """Every table on the page whose header names `need`, read by `spec`."""
    out = []
    found = False
    for t in tables(page):
        if not t:
            continue
        head = [c.text.lower() for c in t[0]]
        if all(any(n in x for x in head) for n in need):
            found = True
            out.extend(from_rows(state, head, t[1:], source_url, spec, kinds))
    if not found:
        raise ValueError(f"{state}: no table naming {need}")
    return out


# --- Illinois ---------------------------------------------------------------
# DCEO's layoff database, exported as a workbook from Illinois workNet. It also
# lists layoffs that were not WARN notices; only rows marked as WARN notices are
# read. The export address is the database's own query, not a file name, so it
# doesn't move with each update.
IL_PAGE = "https://www.illinoisworknet.com/LayoffRecovery/Pages/IllinoisWARNData.aspx"
IL_EXPORT = (
    "https://apps.illinoisworknet.com/iebs/api/public/export?search=&layoffTypes=&trade=0"
    "&dateReportedStart=Invalid%20Date&dateReportedEnd=Invalid%20Date&statuses=4&reasons="
    "&eventCauses=&naicsCodes=1&naicIndustries=&naics=&unionsInvolved=0&geolocation=1&cities="
    "&counties=&lwias=&includeAdditionalLwias=false&edrs=&lat=0&lng=0&distance=.5&memberType=1"
    "&users=&accessList=&bookmarked=false")


def parse_illinois(data: bytes) -> list[dict]:
    """Sheet "Layoffs": one row per event, keyed by DCEO's IEBS id.

    The notice date is the date the layoff was first reported; the count is
    the revised layoff where DCEO revised it, the expected one otherwise. The
    "Scheduled Layoffs" sheet dates each event's waves; the first is the
    effective date.
    """
    sheets = xlsx_sheets(data)
    rows = sheets.get("Layoffs")
    if not rows:
        raise ValueError(f"no Layoffs sheet; sheets are {list(sheets)}")
    h = header_of(rows[0])
    c = {k: col(h, *n) for k, n in {
        "name": ("location name",), "addr": ("location address",), "city": ("location city",),
        "zip": ("location zipcode",), "county": ("county",), "warn": ("warn notice",),
        "reason": ("reason",), "naics": ("naics codes",), "id": ("iebs id",),
        "expected": ("expected layoff",), "revised": ("revised layoff",),
        "reported": ("initial date reported",), "notified": ("notification date",)}.items()}
    if c["name"] is None or c["warn"] is None or c["id"] is None:
        raise ValueError(f"name, WARN or IEBS column missing; header={h}")
    waves: dict[str, str] = {}
    sched = sheets.get("Scheduled Layoffs") or []
    if sched:
        sh = header_of(sched[0])
        s_id, s_date = col(sh, "iebs"), col(sh, "event date")
        for r in sched[1:]:
            d = parse_date(cell(r, s_date))
            key = str(cell(r, s_id) or "").strip()
            if d and key and (key not in waves or d < waves[key]):
                waves[key] = d
    out = []
    for r in rows[1:]:
        if cell(r, c["warn"]) is not True:
            continue
        key = str(cell(r, c["id"]) or "").strip()
        reported = parse_date(cell(r, c["reported"])) or first_date(cell(r, c["notified"]))
        if not reported:
            continue
        naics = str(cell(r, c["naics"]) or "").split(",")[0].strip()
        out.append(notice(
            "IL", reported, cell(r, c["name"]), source_url=IL_PAGE,
            effective_date=waves.get(key), kind=cell(r, c["reason"]),
            employees=first_count(cell(r, c["revised"]), cell(r, c["expected"])),
            county=cell(r, c["county"]), industry=naics or None,
            site=join_site(cell(r, c["addr"]), cell(r, c["city"]), f"IL {clean(cell(r, c['zip']))}".strip()),
            extra=key))
    return finish(out, SINCE)


def load_illinois(f: str | None) -> list[dict]:
    return parse_illinois(read(f) if f else get(IL_EXPORT))


# --- New Jersey ---------------------------------------------------------------
# The Department of Labor's archive workbook, one sheet a year. It prints the
# MONTH a notice was posted, not the day, so the notice date is stored as the
# month.
NJ_PAGE = "https://www.nj.gov/labor/business-services/layoffs-and-closing/file-warn-notice/"


def parse_new_jersey(data: bytes) -> list[dict]:
    """Sheets "2026 WARN Notices" and back: Company, City, Month Posted, Effective Date, Workforce Affected.

    The same notice is sometimes printed on two years' sheets (a January notice
    on the year before's as well). An identical row, same company, city,
    effective date and count, is one notice and is kept once, from the newer
    sheet.
    """
    out, seen = [], set()
    for name, rows in sheets_newest_first(xlsx_sheets(data)):
        m = re.match(r"(\d{4})\b", name)
        if not m:
            continue
        year = m[1]
        hi = find_header(rows, "company", "month")
        if hi is None:
            continue
        h = header_of(rows[hi])
        c_co, c_city, c_month = col(h, "company"), col(h, "city"), col(h, "month")
        c_eff, c_n = col(h, "effective"), col(h, "workforce")
        for r in rows[hi + 1:]:
            company = clean(cell(r, c_co))
            month = parse_month(cell(r, c_month), year)
            if not company or not month:
                continue
            eff = first_date(cell(r, c_eff))
            n = parse_int(cell(r, c_n))
            city = clean(cell(r, c_city))
            key = (company.lower(), city.lower(), eff, n)
            if key in seen:
                continue
            seen.add(key)
            out.append(notice("NJ", month, company, source_url=NJ_PAGE, effective_date=eff, employees=n,
                              site=city or None, extra=city))
    return finish(out, SINCE)


def sheets_newest_first(sheets: dict[str, list]) -> list[tuple[str, list]]:
    return sorted(sheets.items(), key=lambda kv: kv[0], reverse=True)


def load_new_jersey(f: str | None) -> list[dict]:
    if f:
        return parse_new_jersey(read(f))
    page = get_text(NJ_PAGE)
    url = next((u for u, _ in links(page, NJ_PAGE) if u.lower().endswith("warn_notice_archive.xlsx")), None)
    if not url:
        raise ValueError("the WARN archive workbook is no longer linked from the New Jersey page")
    pause()
    return parse_new_jersey(get(url, referer=NJ_PAGE))


# --- Virginia ---------------------------------------------------------------
# Virginia Works serves the whole list as a CSV whose name changes on every page
# load, so the link is read from the page each time.
VA_PAGE = "https://virginiaworks.gov/im-an-employer/retain-and-grow/warn-notices/"


def parse_virginia(data: bytes) -> list[dict]:
    rows = csv_rows(data)
    hi = find_header(rows, "company", "notice date")
    if hi is None:
        raise ValueError("no header naming Company and Notice Date")
    h = header_of(rows[hi])
    c_co, c_notice, c_impact = col(h, "company"), col(h, "notice date"), col(h, "impact date")
    c_n, c_loc, c_type = col(h, "employees"), col(h, "location"), col(h, "notice type")
    out = []
    for r in rows[hi + 1:]:
        d = parse_date(cell(r, c_notice))
        if not d:
            continue
        loc = clean(cell(r, c_loc))
        # A multiple choice prints run together ("ClosureLayoff"); split it back.
        kind = re.sub(r"([a-z])([A-Z])", r"\1, \2", clean(cell(r, c_type)))
        out.append(notice("VA", d, cell(r, c_co), source_url=VA_PAGE, effective_date=parse_date(cell(r, c_impact)),
                          kind=kind, employees=parse_int(cell(r, c_n)), site=loc or None, extra=loc))
    return finish(out, SINCE)


def load_virginia(f: str | None) -> list[dict]:
    if f:
        return parse_virginia(read(f))
    page = get_text(VA_PAGE)
    url = next((u for u, _ in links(page, VA_PAGE) if re.search(r"/warn_notices_\d+\.csv$", u)), None)
    if not url:
        raise ValueError("no warn_notices_<n>.csv link on the Virginia page")
    pause()
    return parse_virginia(get(url, referer=VA_PAGE))


# --- Alabama ----------------------------------------------------------------
# The Department of Workforce's list, served as a CSV with no header row:
# notice id, closing or layoff, report date, planned start date, company, city,
# employees affected, row number.
AL_PAGE = "https://workforce.alabama.gov/warn-list/"
AL_CSV = "https://workforce.alabama.gov/documents/warn-list/"


def parse_alabama(data: bytes) -> list[dict]:
    if data.lstrip()[:1] == b"<":
        raise ValueError("not a CSV: Alabama answered with a page")
    out = []
    for r in csv_rows(data):
        if len(r) < 7:
            continue
        d = parse_date(r[2])
        if not d:
            continue
        city = clean(r[5])
        out.append(notice("AL", d, r[4], source_url=AL_PAGE, effective_date=parse_date(r[3]),
                          kind=clean(r[1]).rstrip(" *") or None, employees=parse_int(r[6]),
                          site=city or None, extra=r[0]))
    return finish(out, SINCE)


def load_alabama(f: str | None) -> list[dict]:
    return parse_alabama(read(f) if f else get(AL_CSV, referer=AL_PAGE))


# --- Ohio -------------------------------------------------------------------
# ODJFS posts the year's notices as a CSV, linked from the page's own data as
# `csvUrl`; the address carries a version stamp, so it is read each time.
OH_PAGE = ("https://jfs.ohio.gov/job-workforce-services/job-programs-and-services/submit-a-warn-notice/"
           "current-public-notices-of-layoffs-and-closures")


def parse_ohio(data: bytes) -> list[dict]:
    rows = csv_rows(data)
    hi = find_header(rows, "company", "date received")
    if hi is None:
        raise ValueError("no header naming Company and Date Received")
    h = header_of(rows[hi])
    c_co, c_date, c_url = col(h, "company"), col(h, "date received"), col(h, "url")
    c_place, c_kind, c_n, c_eff = col(h, "city/county"), col(h, "layoff/closure"), col(h, "affected"), col(h, "layoff date")
    out = []
    for r in rows[hi + 1:]:
        d = parse_date(cell(r, c_date))
        if not d:
            continue
        place = clean(cell(r, c_place))
        city, _, county = place.partition("/")
        out.append(notice("OH", d, cell(r, c_co), source_url=clean(cell(r, c_url)) or OH_PAGE,
                          effective_date=parse_date(cell(r, c_eff)), kind=cell(r, c_kind),
                          employees=parse_int(cell(r, c_n)), county=county or None,
                          site=city or None, extra=place))
    return finish(out, SINCE)


def load_ohio(f: str | None) -> list[dict]:
    if f:
        return parse_ohio(read(f))
    page = get_text(OH_PAGE)
    urls = re.findall(r'csvUrl\\?"\s*:\s*\\?"(https://[^"\\]+\.csv)', page)
    if not urls:
        raise ValueError("no csvUrl in the Ohio page's data")
    pause()
    return parse_ohio(get(urls[0], referer=OH_PAGE))


# --- Colorado ---------------------------------------------------------------
# The Department of Labor and Employment keeps one Google Sheet a year and links
# each from its page. A sheet's address changes every year, so the links are
# read from the page; each is exported as CSV.
CO_PAGE = "https://cdle.colorado.gov/employers/layoff-separations/layoff-warn-list"


def parse_colorado(data: bytes, source_url: str = CO_PAGE) -> list[dict]:
    rows = csv_rows(data)
    hi = find_header(rows, "company", "warn date")
    if hi is None:
        hi = find_header(rows, "company", "date")
    if hi is None:
        raise ValueError("no header naming Company and a WARN date")
    h = header_of(rows[hi])
    c_co, c_date, c_recv = col(h, "company"), col(h, "warn date"), col(h, "received")
    # Colorado's own count first, under the name each year's sheet gives it:
    # "CO Notifications", "CO Layoffs", "Total CO", then the notice's total
    # ("Total Layoffs", "Layoff Total", "Total Notified"). Never "Total number
    # of employees at the location", which is the site's workforce. 2021's
    # sheet prints only permanent and temporary layoffs, which are added.
    c_co_n = next((i for i in (col(h, "co notif"), col(h, "co layoffs"), col(h, "total co"),
                               col(h, "total layoffs"), col(h, "layoff total"), col(h, "total notified"))
                   if i is not None), None)
    c_perm, c_temp = col(h, "number of permanent layoffs"), col(h, "number of temporary layoffs")
    c_naics, c_area, c_reason = col(h, "naics"), col(h, "area"), col(h, "reason")
    c_begin = col(h, "begin") if col(h, "begin") is not None else col(h, "layoff date")
    out = []
    for r in rows[hi + 1:]:
        d = parse_date(cell(r, c_date)) or parse_date(cell(r, c_recv))
        if not d:
            continue
        n = parse_int(cell(r, c_co_n))
        if n is None and c_perm is not None:
            parts = [parse_int(cell(r, c_perm)), parse_int(cell(r, c_temp))]
            n = sum(p for p in parts if p is not None) if any(p is not None for p in parts) else None
        out.append(notice("CO", d, cell(r, c_co), source_url=source_url, effective_date=first_date(cell(r, c_begin)),
                          kind=kind_from_words(cell(r, c_reason)), employees=n, county=cell(r, c_area),
                          industry=cell(r, c_naics), extra=clean(cell(r, c_area))))
    return finish(out, SINCE)


def colorado_sheets(page: str) -> list[tuple[int | None, str]]:
    """(year, CSV export url) for each Google Sheet the page links, newest first."""
    out, seen = [], set()
    for url, text in links(page, CO_PAGE):
        m = re.match(r"https://docs\.google\.com/spreadsheets/d/([\w-]+)", url)
        if not m or m[1] in seen:
            continue
        seen.add(m[1])
        gid = re.search(r"gid=(\d+)", url)
        year = re.search(r"\b(20\d\d)\b", text)
        out.append((int(year[1]) if year else None,
                    f"https://docs.google.com/spreadsheets/d/{m[1]}/export?format=csv" + (f"&gid={gid[1]}" if gid else "")))
    return out


def load_colorado(f: str | None) -> list[dict]:
    if f:
        return parse_colorado(read(f))
    page = get_text(CO_PAGE)
    sheets = colorado_sheets(page)
    if not sheets:
        raise ValueError("no Google Sheets linked from the Colorado page")
    out: list[dict] = []
    years = years_to_read("CO")
    for year, url in sheets:
        # The newest sheet's link carries no year in its text; it is read too.
        if year is not None and year not in years:
            continue
        pause()
        out.extend(parse_colorado(get(url, referer=CO_PAGE)))
    return reassign(out)


def reassign(rows: list[dict]) -> list[dict]:
    """Rows parsed in batches (a sheet or page at a time) already carry ids.

    Each batch's ids are unique on their own; two batches can only collide on
    an exact repeat, which is the same notice printed twice and is kept once.
    """
    seen, out = set(), []
    for r in rows:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        out.append(r)
    return out


# --- Connecticut ------------------------------------------------------------
# The Department of Labor's document library answers JSON for each year's
# folder of notices, every notice with its own fields.
CT_PAGE = "https://dolpublicdocumentlibrary.ct.gov/CsblrCategory?prefix=/rapid_response/warn_documents"
CT_API = ("https://dolpublicdocumentlibrary.ct.gov/CsblrCategory/GetSpecializedData?pageSize=5000&pageIndex=1"
          "&prefix=%2Frapid_response%2Fwarn_documents%2F{year}&sortedCol=warn_document_date&module=WARN")


def parse_connecticut(data: bytes) -> list[dict]:
    body = json.loads(decode(data))
    out = []
    for item in body.get("blobItems") or []:
        p = item.get("blobProperties") or {}
        d = parse_date(p.get("warn_document_date")) or parse_date(p.get("warn_document_received_date"))
        company = clean(p.get("affected_company"))
        if not d or not company:
            continue
        closing = clean(p.get("closing_dates_"))
        kind = "Closing" if closing and closing.upper() not in ("N/A", "NA", "NONE") else None
        place = clean(p.get("layoff_locations__"))
        out.append(notice("CT", d, company, source_url=CT_PAGE, effective_date=first_date(p.get("layoff_dates")),
                          kind=kind, employees=parse_int(p.get("number_of_impacted_workers")),
                          site=place or None,
                          extra=clean(item.get("name"))))
    return finish(out, SINCE)


def load_connecticut(f: str | None) -> list[dict]:
    if f:
        return parse_connecticut(read(f))
    out: list[dict] = []
    for year in years_to_read("CT"):
        out.extend(parse_connecticut(get(CT_API.format(year=year), referer=CT_PAGE)))
        pause()
    return reassign(out)


# --- North Carolina ------------------------------------------------------------
# The Department of Commerce publishes the year's notices on a page and in a
# Tableau view on its own server, which serves the view as CSV. The CSV carries
# the WARN number, which the page's table does not.
NC_PAGE = "https://www.commerce.nc.gov/data-tools-reports/labor-market-data-tools/workforce-warn-reports"
NC_CSV = "https://bi.nc.gov/t/COM-LEAD/views/WARNdashSaleforcedata/WARN.csv"


def parse_north_carolina(data: bytes) -> list[dict]:
    rows = csv_rows(data)
    hi = find_header(rows, "company name", "date received")
    if hi is None:
        raise ValueError("no header naming Company Name and Date Received")
    h = header_of(rows[hi])
    # Tableau repeats dimensions; the right-hand copies are the detail columns.
    c_co = max(i for i, x in enumerate(h) if x == "company name")
    c_addr = max(i for i, x in enumerate(h) if x.startswith("address_1"))
    c_city, c_county = col(h, "city__c"), col(h, "county")
    c_recv = h.index("date received") if "date received" in h else None
    c_eff, c_sector = col(h, "effective date"), col(h, "industry sector")
    c_kind, c_num, c_n = col(h, "tempperm"), col(h, "warn number"), col(h, "number affected")
    out = []
    for r in rows[hi + 1:]:
        d = parse_date(cell(r, c_recv))
        if not d:
            continue
        county = clean(cell(r, c_county))
        out.append(notice("NC", d, cell(r, c_co), source_url=NC_PAGE, effective_date=parse_date(cell(r, c_eff)),
                          kind=cell(r, c_kind), employees=parse_int(cell(r, c_n)),
                          county=None if county.upper() in ("N/A", "") else county,
                          industry=cell(r, c_sector),
                          site=join_site(cell(r, c_addr), cell(r, c_city)),
                          extra=f"{clean(cell(r, c_num))}|{clean(cell(r, c_addr))}"))
    return finish(out, SINCE)


NC_ARCHIVE = NC_PAGE + "/warn-summary-report-archives"


def parse_north_carolina_archive(data: bytes, source_url: str = NC_ARCHIVE) -> list[dict]:
    """A past year's report, a PDF table: county, WARN number, the dates, the
    company, the kind, the employees and the address.

    The notice date is the date the state received the notice, as in this
    year's CSV, so a notice keeps its id when its year moves into the archive.
    """
    h, rows = pdf_rows(data, "county", "effective date")
    c = {k: col(h, *v) for k, v in {"county": ("county",), "num": ("warn",), "recv": ("received",),
                                     "eff": ("effective",), "co": ("company",), "kind": ("layoff",),
                                     "perm": ("type of layoff",), "n": ("employees",), "addr": ("address",),
                                     "city": ("city",)}.items()}
    if c["co"] is None:
        c["co"] = col(h, "notice name")
    if c["n"] is None:
        c["n"] = col(h, "number affected")
    # "WARN notice type" (Layoff, Closure) is the kind in the newer reports;
    # "Layoff/ Closure" ("Closure Permanent") in the older.
    kind_col = col(h, "notice type") if col(h, "notice type") is not None else c["kind"]
    out = []
    for r in rows:
        d = parse_date(cell(r, c["recv"]))
        if not d:
            continue
        kind = " ".join(x for x in (clean(cell(r, c["perm"])), clean(cell(r, kind_col))) if x)
        addr = clean(cell(r, c["addr"]))
        out.append(notice("NC", d, cell(r, c["co"]), source_url=source_url, effective_date=parse_date(cell(r, c["eff"])),
                          kind=kind or None, employees=parse_int(cell(r, c["n"])), county=cell(r, c["county"]),
                          site=join_site(addr, cell(r, c["city"])), extra=f"{clean(cell(r, c['num']))}|{addr}"))
    return finish(out, SINCE)


def load_north_carolina(f: str | None) -> list[dict]:
    if f:
        return parse_north_carolina(read(f))
    out = parse_north_carolina(get(NC_CSV + "?:showVizHome=no", referer=NC_PAGE))
    years = [y for y in years_to_read("NC") if y < dt.date.today().year]
    if years:
        pause()
        page = get_text(NC_ARCHIVE)
        for url, text in links(page, NC_ARCHIVE):
            m = re.search(r"\b(20\d\d)\b", text)
            if m and int(m[1]) in years and url.endswith("/open"):
                pause()
                out.extend(parse_north_carolina_archive(get(url, referer=NC_ARCHIVE), url))
    return reassign(out)


# --- Massachusetts ----------------------------------------------------------
# mass.gov answers scripts with an Akamai wall, so Massachusetts is read from
# the Massachusetts State Library, which keeps the Executive Office of Labor's
# own weekly WARN report: the current fiscal year as a CSV, each past fiscal
# year as its workbook. The library's API is meant for scripts.
MA_PAGE = ("https://www.mass.gov/info-details/worker-adjustment-and-retraining-notification-act-warn-"
           "layoff-and-closure-updates")
MA_LIBRARY = "https://archives.lib.state.ma.us"
MA_SEARCH = (MA_LIBRARY + "/server/api/discover/search/objects?query=dc.title%3A%22Worker%20Adjustment%20and"
             "%20Retraining%20Act%22&sort=dc.date.issued,DESC&size=100&dsoType=ITEM")
# "*Updated*", and once "*UDATED*".
MA_UPDATED = re.compile(r"^\*\s*u\w{0,3}dated\s*\*\s*", re.I)


def parse_massachusetts(data: bytes, source_url: str = MA_PAGE) -> list[dict]:
    """The weekly report: received date, employer, city, layoff dates, employees.

    Since FY2024 one table: RECEIVED, EMPLOYER, CITY/TOWN, REGION, DATE(S) OF
    LAYOFFS, # EMPLOYEES IMPACTED, as a CSV (this fiscal year) or a workbook.
    FY2021 to FY2023 workbooks keep a sheet per region (Date Received, Company
    Name, City, Layoff Date, # Affected), one sheet leaving the date's header
    blank. The state marks a revision "*Updated*" before the employer's name
    and prints it as its own row with its own received date; the marker becomes
    the kind.
    """
    sheets = list(xlsx_sheets(data).values()) if data.startswith(b"PK") else [csv_rows(data)]
    out, found = [], False
    for rows in sheets:
        hi = find_header(rows, "city")
        if hi is None or not any(w in " ".join(header_of(rows[hi])) for w in ("employer", "company")):
            continue
        found = True
        h = header_of(rows[hi])
        c_recv = col(h, "received")
        c_recv = 0 if c_recv is None and not h[0] else c_recv
        c_emp = col(h, "employer") if col(h, "employer") is not None else col(h, "company")
        c_city, c_dates = col(h, "city"), col(h, "layoff")
        c_n = col(h, "employees") if col(h, "employees") is not None else col(h, "affected")
        for r in rows[hi + 1:]:
            d = first_date(cell(r, c_recv))
            company = clean(cell(r, c_emp))
            if not d or not company:
                continue
            updated = bool(MA_UPDATED.match(company))
            company = MA_UPDATED.sub("", company)
            city = clean(cell(r, c_city))
            out.append(notice("MA", d, company, source_url=source_url, effective_date=first_date(cell(r, c_dates)),
                              kind="Update" if updated else None, employees=parse_int(cell(r, c_n)),
                              site=city or None, extra=city))
    if not found:
        raise ValueError("no sheet naming an employer and a city")
    return finish(out, SINCE)


def massachusetts_reports(search: bytes) -> list[tuple[int, str]]:
    """(fiscal year, item id) for the newest weekly report of each fiscal year."""
    body = json.loads(decode(search))
    newest: dict[int, str] = {}
    for o in body["_embedded"]["searchResult"]["_embedded"]["objects"]:
        item = o["_embedded"]["indexableObject"]
        m = re.search(r"\(WARN\) weekly report \(FY(\d{4})", item.get("name") or "", re.I)
        if m and int(m[1]) not in newest:  # the search is newest first
            newest[int(m[1])] = item["uuid"]
    return sorted(newest.items(), reverse=True)


def load_massachusetts(f: str | None) -> list[dict]:
    if f:
        return parse_massachusetts(read(f))
    reports = massachusetts_reports(get(MA_SEARCH))
    if not reports:
        raise ValueError("the State Library lists no WARN weekly report")
    # Fiscal year N runs from July of N-1, so FY2019 is the first holding 2019.
    floor = int(SINCE[:4]) if full_history("MA") else reports[0][0] - 1
    out: list[dict] = []
    for fy, uuid in reports:
        if fy < floor:
            continue
        pause(0.5)
        bundles = json.loads(decode(get(f"{MA_LIBRARY}/server/api/core/items/{uuid}/bundles")))
        original = next((b for b in bundles["_embedded"]["bundles"] if b["name"] == "ORIGINAL"), None)
        if not original:
            continue
        pause(0.5)
        streams = json.loads(decode(get(original["_links"]["bitstreams"]["href"])))["_embedded"]["bitstreams"]
        # A corrected copy ("..._Updated.xlsx") beats the first. FY2020 and
        # earlier are .xls workbooks, which openpyxl can't read, so
        # Massachusetts begins with FY2021 (July 2020).
        files = sorted((b for b in streams if re.search(r"\.(csv|xlsx)$", b["name"], re.I)),
                       key=lambda b: "updated" not in b["name"].lower())
        stream = files[0] if files else None
        if not stream:
            continue
        pause(0.5)
        out.extend(parse_massachusetts(get(stream["_links"]["content"]["href"]),
                                       source_url=f"{MA_LIBRARY}/items/{uuid}"))
    return reassign(out)


# --- Georgia -----------------------------------------------------------------
# The Technical College System's WorkSource Georgia list, a GravityView table
# the page fills from WordPress's admin-ajax with a nonce printed in the page.
# Each entry is the GA WARN id, the company, the date it was submitted and the
# employees affected.
GA_PAGE = "https://www.tcsg.edu/warn-public-view/"


def parse_georgia(data: bytes) -> list[dict]:
    body = json.loads(decode(data))
    out = []
    for r in body.get("data") or []:
        v = [r.get(str(i)) for i in range(5)] if isinstance(r, dict) else list(r) + [None] * 5
        link = re.search(r'href="([^"]+)"', v[0] or "")
        ga_id = clean(re.sub(r"<[^>]+>", " ", v[0] or ""))
        d = parse_date(v[2])
        if not d:
            continue
        out.append(notice("GA", d, v[1], source_url=link[1] if link else GA_PAGE, employees=parse_int(v[3]),
                          extra=ga_id or clean(v[4])))
    return finish(out, SINCE)


def georgia_form(page: str) -> tuple[str, bytes]:
    """The table's own request: its ajax url and the form DataTables sends."""
    m = re.search(r"const config = (\{.*?\});\s*const configStr", page, re.S)
    if not m:
        raise ValueError("the Georgia page no longer carries its table's settings")
    cfg = json.loads(m[1])
    form = [("draw", "1"), ("start", "0"), ("length", "-1"), ("search[value]", ""), ("search[regex]", "false")]
    for i, c in enumerate(cfg["columns"]):
        form += [(f"columns[{i}][data]", str(i)), (f"columns[{i}][name]", c["name"]),
                 (f"columns[{i}][searchable]", "true"), (f"columns[{i}][orderable]", "true"),
                 (f"columns[{i}][search][value]", ""), (f"columns[{i}][search][regex]", "false")]
    form += [("order[0][column]", str(len(cfg["columns"]) - 1)), ("order[0][dir]", "asc")]
    for k, v in cfg["ajax"]["data"].items():
        if isinstance(v, dict):
            form += [(f"{k}[{kk}]", "" if vv is None else str(vv)) for kk, vv in v.items()]
        else:
            form.append((k, str(v).lower() if isinstance(v, bool) else str(v)))
    return cfg["ajax"]["url"], urllib.parse.urlencode(form).encode()


def load_georgia(f: str | None) -> list[dict]:
    if f:
        return parse_georgia(read(f))
    opener = session()
    url, form = georgia_form(decode(get_with(opener, GA_PAGE)))
    pause()
    return parse_georgia(post(url, form, referer=GA_PAGE, opener=opener, headers={
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01"}))


# --- Michigan ---------------------------------------------------------------
# LEO's notices are Sitecore items the page lists through its own search
# service, newest first, each one an HTML fragment. Michigan prints no notice
# date: the item's path carries the day it was posted, which is used.
MI_PAGE = "https://www.michigan.gov/leo/bureaus-agencies/wd/data-public-notices/warn-notices"
MI_FIELD = re.compile(r"<strong>(.*?)</strong>(.*?)(?=<strong>|</p>|</ul>|$)", re.S)


def michigan_fields(frag: str) -> dict[str, str]:
    """Every "<strong>Label:</strong> value" in a notice, labels in lower case.

    Newer notices list them as <li> items under an <h3> name; older ones as
    lines of one paragraph under a link to the notice's PDF.
    """
    out: dict[str, str] = {}
    for label, value in MI_FIELD.findall(frag):
        key = text_of(label).lower().rstrip(": ").strip()
        if key and key not in out:
            out[key] = text_of(value)
    return out


def first_field(fields: dict[str, str], *keys: str) -> str | None:
    return next((fields[k] for k in keys if fields.get(k)), None)


def parse_michigan(data: bytes) -> list[dict]:
    body = json.loads(decode(data))
    out = []
    for item in body.get("Results") or []:
        posted = re.search(r"/(20\d\d)/(\d{1,2})/(\d{1,2})/", item.get("Path") or item.get("Url") or "")
        frag = item.get("Html") or ""
        name = (re.search(r"<h3>(.*?)</h3>", frag, re.S)
                or re.search(r'class="content-title-link"[^>]*>(.*?)</a>', frag, re.S))
        if not posted or not name or not text_of(name[1]):
            continue
        pdf = re.search(r'class="content-title-link" href="(/[^"]+)"', frag)
        fields = michigan_fields(frag)
        d = f"{posted[1]}-{int(posted[2]):02d}-{int(posted[3]):02d}"
        url = pdf[1] if pdf else (item.get("Url") or "")
        out.append(notice("MI", d, text_of(name[1]), source_url="https://www.michigan.gov" + url,
                          effective_date=first_date(first_field(fields, "layoff date", "layoff dates",
                                                                "commencing date", "closure date")),
                          kind=fields.get("type of company action"),
                          employees=parse_int(fields.get("number of jobs impacted")),
                          county=first_field(fields, "county", "counties"),
                          site=first_field(fields, "site address", "site addresses", "site", "site 1", "city",
                                           "cities"),
                          extra=item.get("Id") or ""))
    return finish(out, SINCE)


def michigan_search(page: str) -> str:
    """The search service's address with the page's own search ids."""
    for raw in re.findall(r"data-properties='([^']*)'|data-properties=\"([^\"]*)\"", page):
        props = html_unescape(raw[0] or raw[1])
        try:
            p = json.loads(props)
        except ValueError:
            continue
        if p.get("s") and p.get("v") and p.get("itemid"):
            q = urllib.parse.urlencode({"s": p["s"], "itemid": p["itemid"], "sig": "", "autoFireSearch": "true",
                                        "v": p["v"], "p": "500", "o": p.get("defaultSortOrder") or "Created Date sort,Descending"})
            return "https://www.michigan.gov/leo/sxa/search/results/?" + q
    raise ValueError("the Michigan page no longer names its search")


def html_unescape(s: str) -> str:
    import html
    return html.unescape(s)


def load_michigan(f: str | None) -> list[dict]:
    if f:
        return parse_michigan(read(f))
    url = michigan_search(get_text(MI_PAGE))
    pause()
    return parse_michigan(get(url, referer=MI_PAGE))


# --- Florida -----------------------------------------------------------------
# FloridaCommerce's list, a page a year, a hundred notices a page. The company
# cell holds the name in bold and the address under it.
FL_PAGE = "https://floridajobs.org/workforce-resources/worker-adjustment-and-retraining-notification-(warn)"
FL_LIST = "https://reactwarn.floridajobs.org/WarnList/Records?year={year}&page={page}"


def parse_florida_page(page: str) -> tuple[list[dict], int]:
    """One page: its rows, and the highest page number its pager links."""
    t = table_with(page, "company name", "state notification date")
    if not t:
        raise ValueError("no table naming Company Name and State Notification Date")
    h, body = t
    c_co, c_date, c_eff = col(h, "company"), col(h, "notification date"), col(h, "layoff date")
    c_n, c_ind = col(h, "employees"), col(h, "industry")
    out = []
    for r in body:
        if len(r) <= max(c_co, c_date):
            continue
        d = parse_date(cell(r, c_date))
        lines = r[c_co].lines
        if not d or not lines:
            continue
        address = ", ".join(lines[1:]) or None
        out.append(notice("FL", d, lines[0], source_url=FL_PAGE, effective_date=first_date(cell(r, c_eff)),
                          employees=parse_int(cell(r, c_n)), industry=cell(r, c_ind), site=address,
                          extra=address or ""))
    # The pager's links are HTML-escaped ("?year=2026&amp;page=2"): a pattern
    # that wanted a bare "&" saw no pager, and only each year's first page of
    # a hundred was read.
    last = max([int(n) for n in re.findall(r"(?:[?&]|&amp;)page=(\d+)", page)] or [1])
    return out, last


def parse_florida(data: bytes) -> list[dict]:
    return finish(parse_florida_page(decode(data))[0], SINCE)


def load_florida(f: str | None) -> list[dict]:
    if f:
        return parse_florida(read(f))
    out: list[dict] = []
    for year in years_to_read("FL"):
        n, last = 1, 1
        while n <= last and n <= 40:
            rows, last = parse_florida_page(decode(get(FL_LIST.format(year=year, page=n))))
            out.extend(rows)
            n += 1
            pause()
    return finish(out, SINCE)


# --- Maryland ----------------------------------------------------------------
# The Department of Labor's page per year: this year's at warn.shtml, earlier
# ones linked from it.
MD_PAGE = "https://www.dllr.state.md.us/employment/warn.shtml"


def parse_maryland(data: bytes) -> list[dict]:
    t = table_with(decode(data), "notice date", "company")
    if not t:
        raise ValueError("no table naming Notice Date and Company")
    h, body = t
    c_date, c_naics, c_co, c_loc = col(h, "notice date"), col(h, "naics"), col(h, "company"), col(h, "location")
    c_area, c_n, c_eff, c_type = col(h, "local area"), col(h, "employees"), col(h, "effective"), col(h, "type")
    out = []
    for r in body:
        d = parse_date(cell(r, c_date))
        if not d:
            continue
        loc = clean(cell(r, c_loc))
        out.append(notice("MD", d, cell(r, c_co), source_url=MD_PAGE, effective_date=first_date(cell(r, c_eff)),
                          kind=cell(r, c_type), employees=parse_int(cell(r, c_n)), county=cell(r, c_area),
                          industry=cell(r, c_naics), site=loc or None, extra=loc))
    return finish(out, SINCE)


def load_maryland(f: str | None) -> list[dict]:
    if f:
        return parse_maryland(read(f))
    page = get_text(MD_PAGE)
    out = parse_maryland(page.encode())
    years = years_to_read("MD")
    for url, text in links(page, MD_PAGE):
        m = re.search(r"/warn(20\d\d)\.shtml$", url)
        if m and int(m[1]) in years:
            pause()
            out.extend(parse_maryland(get(url, referer=MD_PAGE)))
    return reassign(out)


# --- Pennsylvania -------------------------------------------------------------
# The Department of Labor and Industry's page: a year heading, then a panel per
# month, then a panel per notice holding its address, county, count, effective
# date and whether it is a closure or a layoff. Pennsylvania prints the MONTH a
# notice was posted, not the day, so the notice date is stored as the month.
PA_PAGE = ("https://www.pa.gov/agencies/dli/programs-services/workforce-development-home/warn-requirements/"
           "warn-notices")
PA_MARK = re.compile(
    r"<h2(?:\s[^>]*)?>\s*(20\d\d)\s*</h2>"
    r'|accordion/item&#34;,&#34;dc:title&#34;:&#34;(.*?)&#34;\}\}" id="[^"]+">\s*<(h\d)')
PA_FIELD = re.compile(r"(COUNTY|#?\s*AFFECTED|EFFECTIVE DATE|LAYOFF DATE|CLOSURE OR LAYOFF)\s*[:–-]\s*", re.I)
MONTH_NAMES = {"january", "february", "march", "april", "may", "june", "july", "august", "september",
               "october", "november", "december"}


def parse_pennsylvania(data: bytes) -> list[dict]:
    page = decode(data)
    marks = list(PA_MARK.finditer(page))
    year = month = None
    out = []
    for i, m in enumerate(marks):
        if m[1]:
            year, month = m[1], None
            continue
        title = html_unescape(m[2])
        # A month panel is titled with the month's name; 2026's sit a level
        # above the notices, 2023's at the same level, so the title decides.
        if clean(title).lower() in MONTH_NAMES:
            month = parse_month(title, year) if year else None
            continue
        if not month:
            continue
        # This notice's panel runs to the <div> that opens the next one.
        if i + 1 < len(marks):
            end = page.rfind("<div", m.end(), marks[i + 1].start())
        else:  # the last notice runs to the page's footer
            foot = re.search(r"<footer|Return to top", page[m.end():])
            end = m.end() + foot.start() if foot else len(page)
        block = page[m.end():end if end > m.end() else len(page)]
        close = re.search(r"</h\d>", block)
        body = block[close.end():] if close else block
        # The panel repeats its own text, escaped, in a data attribute; drop it.
        body = re.sub(r"\sdata-cmp-data-layer=\"[^\"]*\"", "", body)
        text = text_of(body).replace("\u200b", "")
        for site in pennsylvania_sites(text):
            address = site.get("address", "")
            # "9 Pennsylvania workers (209 total)": the leading number is this state's.
            lead = re.match(r"\s*(\d[\d,]*)", site.get("AFFECTED") or "")
            n = parse_int(lead[1]) if lead else None
            if n is None:  # "Everett Foodliner, Inc. - 64 Employees 250 W. Main Street"
                found = re.findall(r"(\d[\d,]*)\s+employees", address, re.I)
                n = parse_int(found[0]) if len(found) == 1 else None
            county, kind = site.get("COUNTY"), site.get("KIND")
            glued = re.match(r"(.*?)\s+(closure|closing|layoffs?)$", county or "", re.I)
            if glued and not kind:  # "County: Bedford Closure" with no label for the kind
                county, kind = glued[1], glued[2]
            out.append(notice("PA", month, title, source_url=PA_PAGE, effective_date=first_date(site.get("DATE")),
                              kind=kind, employees=n, county=county, site=address or None, extra=address))
    return finish(out, SINCE)


PA_KIND = re.compile(r"\s*(?:(?:permanent|temporary)\s+)?(?:closing|closure|layoffs?|mass layoff)\b\.?", re.I)
PA_LABEL = {"COUNTY": "COUNTY", "AFFECTED": "AFFECTED", "EFFECTIVE DATE": "DATE", "LAYOFF DATE": "DATE",
            "CLOSURE OR LAYOFF": "KIND"}


def pennsylvania_sites(text: str) -> list[dict]:
    """A notice panel's sites, each with its own county, count, date and kind.

    Most panels describe one site. Some list several, each address followed by
    its own COUNTY, # AFFECTED, EFFECTIVE DATE and CLOSURE OR LAYOFF lines;
    a site begins at an address and ends at its kind, so each becomes its own
    row, as California and New York list one row per site.
    """
    parts = PA_FIELD.split(text)
    sites: list[dict] = []
    cur: dict = {"address": clean(parts[0])}
    for j in range(1, len(parts) - 1, 2):
        label = PA_LABEL.get(re.sub(r"^#\s*", "", clean(parts[j]).upper()), "")
        value = parts[j + 1]
        if label == "COUNTY" and "COUNTY" in cur:
            sites.append(cur)
            cur = {"address": ""}
        if label == "KIND":
            m = PA_KIND.match(value)
            cur["KIND"] = clean(m.group(0)) if m else clean(value)
            rest = clean(value[m.end():]) if m else ""
            if rest:  # the next site's address follows its kind
                sites.append(cur)
                cur = {"address": rest}
            continue
        if label:
            cur[label] = clean(value)
    sites.append(cur)
    kept = [s for s in sites if len(s) > 1 or s.get("address")]
    return kept[:1] if len(kept) > 1 and all(len(s) == 1 for s in kept[1:]) else kept


def load_pennsylvania(f: str | None) -> list[dict]:
    return parse_pennsylvania(read(f) if f else get(PA_PAGE))


# --- Indiana -----------------------------------------------------------------
# DWD's current notices, one table back to 2008. LO is a layoff, CL a closure.
IN_PAGE = "https://www.in.gov/dwd/warn-notices/current-warn-notices/"
IN_KIND = {"LO": "Layoff", "CL": "Closure"}


def parse_indiana(data: bytes) -> list[dict]:
    t = table_with(decode(data), "company", "notice date")
    if not t:
        raise ValueError("no table naming Company and Notice Date")
    h, body = t
    c_co, c_city, c_n, c_date = col(h, "company"), col(h, "city"), col(h, "affected"), col(h, "notice date")
    c_eff, c_naics, c_ind, c_type = col(h, "lo/cl"), col(h, "naics"), col(h, "description"), col(h, "notice type")
    out = []
    for r in body:
        d = parse_date(cell(r, c_date))
        if not d:
            continue
        city = clean(cell(r, c_city))
        code = clean(cell(r, c_type)).upper()
        naics, desc = clean(cell(r, c_naics)), clean(cell(r, c_ind))
        link = next((u for c in r for u in c.links), None)
        out.append(notice("IN", d, cell(r, c_co), source_url=urllib.parse.urljoin(IN_PAGE, link) if link else IN_PAGE,
                          effective_date=first_date(cell(r, c_eff)), kind=IN_KIND.get(code, code or None),
                          employees=parse_int(cell(r, c_n)),
                          industry=f"{naics} - {desc}" if naics and desc else (naics or desc),
                          site=city or None, extra=city))
    return finish(out, SINCE)


def load_indiana(f: str | None) -> list[dict]:
    return parse_indiana(read(f) if f else get(IN_PAGE))


# --- One-table pages ----------------------------------------------------------
# States that print every notice in a table on one page (Utah prints one table
# a year on its page). Each reads by its header words.
AK_PAGE = "https://jobs.alaska.gov/RR/WARN_notices.htm"
NE_PAGE = "https://dol.nebraska.gov/ReemploymentServices/LayoffServices/LayoffsAndDownsizingWARN"
SD_PAGE = "https://dlr.sd.gov/workforce_services/businesses/warn_notices.aspx"
TN_PAGE = ("https://www.tn.gov/workforce/general-resources/major-publications0/major-publications-redirect/"
           "reports.html")
UT_PAGE = "https://jobs.utah.gov/employer/business/warnnotices.html"


def parse_alaska(data: bytes) -> list[dict]:
    """The Notes column is free text ("Loss of contract", "COVID-19"); only
    its own word for a closure or a layoff becomes the kind."""
    rows = html_table("AK", decode(data), AK_PAGE, ("company", "notice date"), {
        "company": ("company",), "site": ("location",), "notice": ("notice date",),
        "effective": ("layoff date",), "employees": ("employees",), "kind": ("notes",)})
    for r in rows:
        r["kind"] = kind_from_words(r["kind"])
    return finish(rows, SINCE)


def parse_nebraska(data: bytes) -> list[dict]:
    return finish(html_table("NE", decode(data), NE_PAGE, ("date", "company"), {
        "notice": ("date",), "company": ("company",), "employees": ("jobs",), "site": ("location",)}), SINCE)


def parse_south_dakota(data: bytes) -> list[dict]:
    """South Dakota prints when it received each notice, not a notice date."""
    rows = html_table("SD", decode(data), SD_PAGE, ("company", "date received"), {
        "company": ("company",), "site": ("location",), "notice": ("date received",),
        "employees": ("employees",)})
    return finish(rows, SINCE)


def parse_tennessee(data: bytes) -> list[dict]:
    """Tennessee prints when it posted each notice, and the notice's own number."""
    page = decode(data)
    out = []
    for t in tables(page):
        if not t or not any("posting" in c.text.lower() for c in t[0]):
            continue
        h = [c.text.lower() for c in t[0]]
        c_date, c_co, c_county, c_n = col(h, "posting"), col(h, "company"), col(h, "county"), col(h, "affected")
        c_eff, c_num = col(h, "closure/layoff"), col(h, "notice")
        for r in t[1:]:
            d = parse_date(cell(r, c_date))
            if not d:
                continue
            num = clean(cell(r, c_num))
            link = next((u for c in r for u in c.links if u.lower().endswith(".pdf")), None)
            out.append(notice("TN", d, cell(r, c_co), source_url=urllib.parse.urljoin(TN_PAGE, link) if link else TN_PAGE,
                              effective_date=first_date(cell(r, c_eff)), employees=parse_int(cell(r, c_n)),
                              county=cell(r, c_county), extra=num))
    if not out:
        raise ValueError("no table naming Date of Posting")
    return finish(out, SINCE)


def parse_utah(data: bytes) -> list[dict]:
    return finish(html_table("UT", decode(data), UT_PAGE, ("date of notice", "company"), {
        "notice": ("date of notice",), "company": ("company",), "site": ("location",),
        "employees": ("affected",)}), SINCE)


def load_page(parse: Callable[[bytes], list[dict]], url: str) -> Callable[[str | None], list[dict]]:
    return lambda f: parse(read(f) if f else get(url))


# --- District of Columbia -------------------------------------------------------
# DOES posts a page a year. This year's page is the entry, and it links every
# earlier year's. Code 1 is a layoff, 2 a closure.
DC_PAGE = "https://does.dc.gov/page/industry-closings-and-layoffs-warn-notifications-{year}"
DC_KIND = {"1": "Layoff", "2": "Closure"}


def parse_dc(data: bytes, source_url: str | None = None) -> list[dict]:
    rows = html_table("DC", decode(data), source_url or DC_PAGE.format(year=dt.date.today().year),
                      ("notice date", "organization"), {
                          "notice": ("notice date",), "company": ("organization",), "employees": ("employees",),
                          "effective": ("effective",), "kind": ("code",)}, kinds=DC_KIND)
    return finish(rows, SINCE)


def load_dc(f: str | None) -> list[dict]:
    if f:
        return parse_dc(read(f))
    this = dt.date.today().year
    entry = page = None
    for year in (this, this - 1):  # in January, this year's page may not exist yet
        try:
            entry = DC_PAGE.format(year=year)
            page = get_text(entry)
            break
        except Exception as e:  # noqa: BLE001 - a missing year page is a 404
            if "404" not in str(e):
                raise
    if page is None:
        raise ValueError("no DC WARN page for this year or last")
    out = parse_dc(page.encode(), entry)
    years = years_to_read("DC")
    for url, text in links(page, entry):
        m = re.search(r"\b(20\d\d)\b", text)
        if "warn-notifications" in url and m and int(m[1]) in years and url != entry:
            pause()
            out.extend(parse_dc(get(url, referer=entry), url))
    return reassign(out)


# --- Iowa ---------------------------------------------------------------------
# Iowa Workforce Development's WARN log, a workbook with a sheet a year, linked
# from its page.
IA_PAGE = "https://workforce.iowa.gov/employers/resources/warn"


def parse_iowa(data: bytes) -> list[dict]:
    out = []
    for name, rows in sheets_newest_first(xlsx_sheets(data)):
        if not re.fullmatch(r"20\d\d", name.strip()):
            continue
        hi = find_header(rows, "company", "notice date")
        if hi is None:
            continue
        h = header_of(rows[hi])
        c = {k: col(h, *v) for k, v in {"co": ("company",), "addr": ("address",), "city": ("city",),
                                         "county": ("county",), "st": ("st",), "zip": ("zip",),
                                         "type": ("notice type",), "n": ("emp",), "date": ("notice date",),
                                         "eff": ("layoff date",), "ind": ("industry",)}.items()}
        for r in rows[hi + 1:]:
            d = parse_date(cell(r, c["date"]))
            if not d:
                continue
            site = join_site(cell(r, c["addr"]), cell(r, c["city"]),
                             f"{clean(cell(r, c['st']))} {clean(cell(r, c['zip']))}".strip())
            out.append(notice("IA", d, cell(r, c["co"]), source_url=IA_PAGE, effective_date=first_date(cell(r, c["eff"])),
                              kind=cell(r, c["type"]), employees=parse_int(cell(r, c["n"])),
                              county=cell(r, c["county"]), industry=cell(r, c["ind"]), site=site, extra=site or ""))
    return finish(out, SINCE)


def load_iowa(f: str | None) -> list[dict]:
    if f:
        return parse_iowa(read(f))
    page = get_text(IA_PAGE)
    url = next((u for u, text in links(page, IA_PAGE) if "warn log" in text.lower()), None)
    if not url:
        raise ValueError("no WARN log linked from the Iowa page")
    pause()
    return parse_iowa(get(url, referer=IA_PAGE))


# --- Kentucky -------------------------------------------------------------------
# The Office of Employer and Apprenticeship Services posts this year's report
# (its file name carries the day it was made) and a workbook of prior years.
KY_PAGE = "https://kyworks.ky.gov/Services/Pages/Rapid-Response-Layoffs-and-Closures.aspx"


def parse_kentucky(data: bytes) -> list[dict]:
    out = []
    for _, rows in sheets_newest_first(xlsx_sheets(data)):
        hi = find_header(rows, "company", "date received")
        if hi is None:
            continue
        h = header_of(rows[hi])
        # The prior-year sheets leave the county column's header blank, right
        # after Region.
        if "region" in h and h.index("region") + 1 < len(h) and not h[h.index("region") + 1]:
            h[h.index("region") + 1] = "county"
        c = {k: col(h, *v) for k, v in {"co": ("company",), "date": ("date received",), "county": ("county",),
                                         "type": ("closure or layoff",), "n": ("employees",),
                                         "eff": ("projected date",), "naics": ("naics",), "url": ("notice url",),
                                         "num": ("notice number",)}.items()}
        for r in rows[hi + 1:]:
            d = parse_date(cell(r, c["date"]))
            if not d:
                continue
            url = clean(cell(r, c["url"]))
            out.append(notice("KY", d, cell(r, c["co"]), source_url=url or KY_PAGE,
                              effective_date=first_date(cell(r, c["eff"])), kind=cell(r, c["type"]),
                              employees=parse_int(cell(r, c["n"])), county=cell(r, c["county"]),
                              industry=clean(cell(r, c["naics"])) if isinstance(cell(r, c["naics"]), (str, int)) else None,
                              extra=url or clean(cell(r, c["num"]))))
    return finish(out, SINCE)


def load_kentucky(f: str | None) -> list[dict]:
    if f:
        return parse_kentucky(read(f))
    page = get_text(KY_PAGE)
    files = [u for u, text in links(page, KY_PAGE) if u.lower().endswith(".xlsx") and "warn" in u.lower()]
    if not files:
        raise ValueError("no WARN workbook linked from the Kentucky page")
    out: list[dict] = []
    for url in dict.fromkeys(files):
        if "prior" in url.lower() and not full_history("KY"):
            continue
        pause()
        out.extend(parse_kentucky(get(url, referer=KY_PAGE)))
    return reassign(out)


# --- Montana --------------------------------------------------------------------
# The Department of Labor and Industry's workbook of every notice since 2015;
# its file name changes with each update, so the link is read from the page.
MT_PAGE = "https://wsd.dli.mt.gov/wioa/related-links/warn-notice-page"


def parse_montana(data: bytes) -> list[dict]:
    rows = next(iter(xlsx_sheets(data).values()))
    hi = find_header(rows, "date of notice", "company")
    if hi is None:
        raise ValueError("no header naming Date of Notice and Company")
    return finish(from_rows("MT", header_of(rows[hi]), rows[hi + 1:], MT_PAGE, {
        "notice": ("date of notice",), "company": ("company",), "county": ("county",),
        "industry": ("industry",), "effective": ("impact",), "employees": ("employees",)}), SINCE)


def load_montana(f: str | None) -> list[dict]:
    if f:
        return parse_montana(read(f))
    page = get_text(MT_PAGE)
    url = next((u for u, _ in links(page, MT_PAGE) if re.search(r"warn[^/]*\.xlsx$", u, re.I)), None)
    if not url:
        raise ValueError("no WARN workbook linked from the Montana page")
    pause()
    return parse_montana(get(url, referer=MT_PAGE))


# --- Wisconsin --------------------------------------------------------------------
# DWD's page draws its list from a Google Sheet the state publishes; the
# sheet's id is read from the page's own script, and the sheet's "Originals"
# tab is read as CSV (Google serves a published sheet that way without a key).
# Updates to a notice sit in another tab and aren't read.
WI_PAGE = "https://dwd.wisconsin.gov/dislocatedworker/warn/"
WI_SCRIPT = "https://dwd.wisconsin.gov/dislocatedworker/warn/include/default.js"
WI_KIND = {"CL": "Facility closure", "WR": "Workforce reduction"}


def parse_wisconsin(data: bytes) -> list[dict]:
    rows = csv_rows(data)
    hi = find_header(rows, "company", "noticercvd")
    if hi is None:
        raise ValueError("no header naming Company and NoticeRcvd")
    h = header_of(rows[hi])
    c = {k: h.index(k.lower()) if k.lower() in h else None for k in
         ("PK", "Company", "City", "AffectedWorkers", "NoticeRcvd", "NoticeType", "LayoffBeginDate",
          "NAICSDescription", "County")}
    out = []
    for r in rows[hi + 1:]:
        d = parse_date(cell(r, c["NoticeRcvd"]))
        if not d:
            continue
        codes = [x.strip() for x in clean(cell(r, c["NoticeType"])).split(",") if x.strip()]
        kind = ", ".join(WI_KIND[x] for x in codes if x in WI_KIND) or None
        city = clean(cell(r, c["City"]))
        out.append(notice("WI", d, cell(r, c["Company"]), source_url=WI_PAGE,
                          effective_date=first_date(cell(r, c["LayoffBeginDate"])), kind=kind,
                          employees=parse_int(cell(r, c["AffectedWorkers"])), county=cell(r, c["County"]),
                          industry=cell(r, c["NAICSDescription"]), site=city or None,
                          extra=clean(cell(r, c["PK"]))))
    return finish(out, SINCE)


def load_wisconsin(f: str | None) -> list[dict]:
    if f:
        return parse_wisconsin(read(f))
    script = get_text(WI_SCRIPT, referer=WI_PAGE)
    # The production line, not the commented "Acceptance" one under it.
    live = [ln for ln in script.splitlines() if "spreadsheets/" in ln and not ln.strip().startswith("//")]
    m = re.search(r"spreadsheets/([\w-]{20,})", live[0]) if live else None
    if not m:
        raise ValueError("the Wisconsin page script no longer names its sheet")
    pause()
    return parse_wisconsin(get(f"https://docs.google.com/spreadsheets/d/{m[1]}/gviz/tq?tqx=out:csv&sheet=Originals"))


# --- Oklahoma ----------------------------------------------------------------------
# The Employment Security Commission's notices sit in a Salesforce community
# page that loads them through its own Aura service. The request names the
# page's framework build (`fwuid`) and app version, read from the page.
# Oklahoma prints no worker count, so every count is None.
OK_PAGE = "https://www.employoklahoma.gov/Participants/s/warnnotices"
OK_AURA = "https://www.employoklahoma.gov/Participants/s/sfsites/aura?r=1&aura.ApexAction.execute=1"


def parse_oklahoma(data: bytes) -> list[dict]:
    body = json.loads(decode(data))
    out = []
    for action in body.get("actions") or []:
        value = (action.get("returnValue") or {})
        for r in value.get("returnValue") or [] if isinstance(value, dict) else []:
            d = parse_date(r.get("Launchpad__Notice_Date__c"))
            if not d:
                continue
            city = clean(r.get("OESC_Employer_City__c"))
            out.append(notice("OK", d, r.get("OESC_Employer_Name__c"), source_url=OK_PAGE,
                              kind=r.get("Launchpad__Layoff_Closure_Type__c"), employees=None,
                              site=join_site(city.title() if city.isupper() else city, r.get("OESC_Employer_Zip_Code__c")),
                              extra=r.get("Id") or ""))
    return finish(out, SINCE)


def oklahoma_form(page: str) -> bytes:
    fwuid = re.search(r'"fwuid"\s*:\s*"([^"]+)"', page)
    app = re.search(r'"APPLICATION@markup://siteforce:communityApp"\s*:\s*"([^"]+)"', page)
    if not fwuid or not app:
        raise ValueError("the Oklahoma page no longer names its framework build")
    message = {"actions": [{"id": "1;a", "descriptor": "aura://ApexActionController/ACTION$execute",
                            "callingDescriptor": "UNKNOWN",
                            "params": {"namespace": "", "classname": "OESC_JS_getWARNLayoffNotices",
                                       "method": "getListofLayoffAccService", "cacheable": False,
                                       "isContinuation": False}}]}
    context = {"mode": "PROD", "fwuid": fwuid[1], "app": "siteforce:communityApp",
               "loaded": {"APPLICATION@markup://siteforce:communityApp": app[1]}, "dn": [], "globals": {},
               "uad": True}
    return urllib.parse.urlencode({"message": json.dumps(message), "aura.context": json.dumps(context),
                                   "aura.pageURI": "/Participants/s/warnnotices", "aura.token": "null"}).encode()


def load_oklahoma(f: str | None) -> list[dict]:
    if f:
        return parse_oklahoma(read(f))
    opener = session()
    form = oklahoma_form(decode(get_with(opener, OK_PAGE)))
    pause()
    return parse_oklahoma(post(OK_AURA, form, referer=OK_PAGE, opener=opener, headers={
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "Accept": "*/*",
        "Origin": "https://www.employoklahoma.gov"}))


# --- Oregon --------------------------------------------------------------------------
# HECC's Rapid Response list, 25 notices a page, newest first, each with its
# own track number.
OR_PAGE = "https://ccwd.hecc.oregon.gov/Layoff/WARN"
OR_DAYS = 120  # the window a daily run walks; the weekly walk and a first load go to SINCE


def parse_oregon_page(page: str) -> list[dict]:
    t = table_with(page, "notification date", "employer")
    if not t:
        t = next(((x[0], x[1:]) for x in ([[c.text.lower() for c in tb[0]], tb] for tb in tables(page))
                  if any("track" in h for h in x[0])), None)
        if t:
            t = (t[0], t[1][1:])
    if not t:
        raise ValueError("no table naming Notification Date and Employer")
    h, body = t
    c_track, c_date, c_type = col(h, "track"), col(h, "notification"), col(h, "layoff type")
    c_n, c_emp, c_city = col(h, "count"), col(h, "employer"), col(h, "city")
    out = []
    for r in body:
        d = parse_date(cell(r, c_date))
        if not d:
            continue
        track = clean(cell(r, c_track))
        city = clean(cell(r, c_city))
        out.append(notice("OR", d, cell(r, c_emp), source_url=f"https://ccwd.hecc.oregon.gov/Layoff/WARN/UploadIndex/{track}"
                          if track.isdigit() else OR_PAGE, kind=cell(r, c_type), employees=parse_int(cell(r, c_n)),
                          site=city or None, extra=track))
    return out


def parse_oregon(data: bytes) -> list[dict]:
    return finish(parse_oregon_page(decode(data)), SINCE)


def load_oregon(f: str | None) -> list[dict]:
    if f:
        return parse_oregon(read(f))
    floor = SINCE if full_history("OR") else (dt.date.today() - dt.timedelta(days=OR_DAYS)).isoformat()
    out: list[dict] = []
    for n in range(1, 400):
        rows = parse_oregon_page(decode(get(f"{OR_PAGE}?page={n}")))
        if not rows:
            break
        out.extend(rows)
        if min(r["notice_date"] for r in rows) < floor:
            break
        pause()
    return finish(out, SINCE)


# --- The job-center states: Arizona, Delaware, Kansas, Maine, Vermont ------------------
# Five states publish WARN notices through one job-center platform. Its search
# lists each notice's employer, city, ZIP and notice date, 25 a page; the
# notice's own page adds its address and the employees affected. A count
# already held is reused, so a daily run asks only for new notices' pages.
JOB_CENTERS = {
    "AZ": "https://www.azjobconnection.gov",
    "DE": "https://joblink.delaware.gov",
    "KS": "https://www.kansasworks.com",
    "ME": "https://joblink.maine.gov",
    "VT": "https://www.vermontjoblink.com",
}
JC_DAYS = 120          # the window a daily run lists; the weekly walk and a first load list from SINCE
# Notice pages are asked for newest first, each once: a held count is reused.
# A run stops asking at whichever comes first, the cap or the time budget, and
# the rest wait for the next run. The budget is short on an ordinary day (a
# day's new notices take seconds) and long on the state's walk day and on a
# first load, long enough to fill a state's whole record in that one run:
# Arizona's 489 notices since 2019 at about 1.3 seconds a page, the pause
# included (measured from the laptop, Oct 25 2026), is about 10 minutes,
# inside the WARN step's 35. The notices still waiting are counted in the
# run's log and filled by a later run.
JC_DETAIL_CAP = 1000
JC_DETAIL_SECONDS = 120
JC_FILL_SECONDS = 900


def job_center_search(base: str, since: str, until: str, page: int) -> str:
    q = urllib.parse.urlencode({"commit": "Search", "page": page, "q[employer_name_cont]": "",
                                "q[notice_eq]": "true", "q[notice_on_gteq]": since, "q[notice_on_lteq]": until,
                                "utf8": "✓"})
    return f"{base}/search/warn_lookups?{q}"


def parse_job_center_list(state: str, page: str, base: str) -> list[dict]:
    """One search page: a row per notice, its own page linked from the employer."""
    t = table_with(page, "employer", "notice date")
    if not t:
        raise ValueError(f"{state}: no table naming Employer and Notice Date")
    h, body = t
    c_emp, c_city, c_zip, c_date = col(h, "employer"), col(h, "city"), col(h, "zip"), col(h, "notice date")
    out = []
    for r in body:
        d = parse_date(cell(r, c_date))
        if not d or c_emp >= len(r):
            continue
        link = next((u for u in r[c_emp].links if "/warn_lookups/" in u), None)
        rid = link.rstrip("/").rsplit("/", 1)[-1] if link else ""
        out.append(notice(state, d, cell(r, c_emp), source_url=urllib.parse.urljoin(base, link) if link else base,
                          site=join_site(cell(r, c_city), cell(r, c_zip)), extra=rid))
    return out


def parse_job_center_detail(page: str) -> dict:
    """A notice's own page: its address and the employees affected."""
    main = page[page.find("<main"):page.find("</main>")] if "<main" in page else page
    text = text_of(main)
    n = re.search(r"Number of Employees Affected\s+([\d,]+)", text, re.I)
    addr = re.search(r"Address\s+(.*?)\s+Notice Date", text, re.I)
    return {"employees": parse_int(n[1]) if n else None, "site": clean(addr[1]) if addr else None}


def parse_job_center(state: str, data: bytes) -> list[dict]:
    """A saved search page, read without its notices' own pages."""
    return finish(parse_job_center_list(state, decode(data), JOB_CENTERS[state]), SINCE)


def load_job_center(state: str) -> Callable[[str | None], list[dict]]:
    base = JOB_CENTERS[state]

    def load(f: str | None) -> list[dict]:
        if f:
            return parse_job_center(state, read(f))
        today = dt.date.today()
        since = SINCE if full_history(state) else (today - dt.timedelta(days=JC_DAYS)).isoformat()
        rows: list[dict] = []
        for n in range(1, 200):
            page = decode(get(job_center_search(base, since, today.isoformat(), n)))
            got = parse_job_center_list(state, page, base)
            rows.extend(got)
            if len(got) < 25 or f"page={n + 1}" not in page:
                break
            pause()
        rows = finish(rows, SINCE)
        held = held_for(state)
        deadline = time.monotonic() + (JC_FILL_SECONDS if full_history(state) else JC_DETAIL_SECONDS)
        asked = waiting = 0
        for r in sorted(rows, key=lambda x: x["notice_date"], reverse=True):
            h = held.get(r["id"])
            if h and h.get("employees") is not None:
                r["employees"], r["site"] = h["employees"], h.get("site") or r["site"]
                continue
            if asked >= JC_DETAIL_CAP or time.monotonic() > deadline:
                waiting += 1
                continue
            pause()
            asked += 1
            detail = parse_job_center_detail(decode(get(r["source_url"], referer=base)))
            r["employees"] = detail["employees"]
            r["site"] = detail["site"] or r["site"]
        if waiting:
            print(f"  {state}: read {asked} notice pages; {waiting} notices wait for a later run's count", flush=True)
        return rows

    return load


# --- Hawaii ------------------------------------------------------------------------------
# DLIR posts each notice since August 2026 as its own page, with the date it
# received the notice, the employees affected and the worksite. Before that,
# a page a year links each notice's letter; those rows carry the company and
# the date from the letter's file name, and no count, because the count is only
# in the letter.
HI_PAGE = "https://labor.hawaii.gov/wdd/warn-notices/"
HI_ARCHIVE = "https://labor.hawaii.gov/wdc/real-time-warn-updates/"
HI_FILE_DATE = re.compile(r"/((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)-(\d{1,2})-(20\d\d)-", re.I)


# How each notice page words its count, most specific first: those losing
# their jobs before everyone at the site.
HI_COUNT = [re.compile(p, re.I) for p in (
    r"(?:to be laid off|to be separated|employees affected|affected employees|employees to be affected)\s*:\s*"
    r"(?:approximately\s*)?([\d,]+)",
    r"(?:approximately\s*)?([\d,]+)\s+employees\s+(?:are|will be)\s+(?:anticipated|expected)?\s*(?:to be\s+)?"
    r"(?:separated|laid off|affected)",
    r"total employees (?:statewide|in hawaii|affected)\s*:\s*(?:approximately\s*)?([\d,]+)",
)]


def section(text: str, start: str, end: str) -> str:
    i = text.find(start)
    if i < 0:
        return ""
    j = text.find(end, i + len(start))
    return text[i + len(start):j if j > 0 else len(text)]


def parse_hawaii_notice(page: str, url: str) -> dict | None:
    """One notice's page: the date DLIR received it, when it takes effect, how
    many lose their jobs, the company and the worksite. The count is the
    notice's own words ("Approximate number of employees to be laid off: 14");
    a page that gives none ("Number not included") stores None."""
    main = page[page.find("<main"):page.find("</main>")] if "<main" in page else page
    text = text_of(main)
    company = re.search(r"Company Name:\s*(.*?)\s+(?:Employer Headquarters|Doing Business|Worksite Address|Address"
                        r"|Contact Person|Additional Information)", text)
    received = re.search(r"Date Department Received WARN\s+(\w+ \d{1,2}, \d{4})", text)
    if not company or not received:
        return None
    counts = section(text, "Number of Affected Employees (Total)", "Company/Employer Information")
    n = next((m for p in HI_COUNT for m in [p.search(counts)] if m), None)
    when = section(text, "When Employees Will Be Affected", "Number of Affected Employees")
    site = re.search(r"Worksite Address(?:es)?:\s*(.*?)\s+(?:Contact Person|Additional Information|Summary)", text)
    return notice("HI", parse_date(received[1]), company[1], source_url=url, effective_date=first_date(when),
                  employees=parse_int(n[1]) if n else None, site=clean(site[1]) if site else None, extra=url)


def parse_hawaii_archive(page: str, base: str) -> list[dict]:
    out = []
    for url, text in links(page, base):
        m = HI_FILE_DATE.search(url)
        if not m or not url.lower().endswith(".pdf") or not text or "rescind" in text.lower():
            continue
        d = parse_date(f"{m[1][:3]} {m[2]}, {m[3]}")
        company = re.sub(r"^\s*update\s*[–-]\s*", "", text, flags=re.I)
        out.append(notice("HI", d, company, source_url=url, kind="Update" if text.lower().startswith("update") else None,
                          extra=url))
    return out


def parse_hawaii(data: bytes) -> list[dict]:
    """A saved year page of the archive."""
    return finish(parse_hawaii_archive(decode(data), HI_ARCHIVE), SINCE)


def load_hawaii(f: str | None) -> list[dict]:
    if f:
        return parse_hawaii(read(f))
    held = held_for("HI")
    # A notice page read before is carried as held, and read again on Hawaii's walk day.
    by_url = {} if full_history("HI") else {h.get("source_url"): (i, h) for i, h in held.items()}
    out: list[dict] = []
    kept: list[dict] = []
    current = get_text(HI_PAGE)
    for url, _ in links(current, HI_PAGE):
        if not re.match(r"https://labor\.hawaii\.gov/wdd/warn-notices/warn-notice-", url):
            continue
        if url in by_url:
            i, h = by_url[url]
            kept.append({**h, "id": i, "state": "HI"})
            continue
        pause()
        row = parse_hawaii_notice(get_text(url, referer=HI_PAGE), url)
        if row:
            out.append(row)
    pause()
    archive = get_text(HI_ARCHIVE)
    out.extend(parse_hawaii_archive(archive, HI_ARCHIVE))
    years = years_to_read("HI")
    for url, text in links(archive, HI_ARCHIVE):
        m = re.search(r"\b(20\d\d) WARN Notices", text, re.I)
        if m and int(m[1]) in years and url.rstrip("/") != HI_ARCHIVE.rstrip("/"):
            pause()
            out.extend(parse_hawaii_archive(get_text(url, referer=HI_ARCHIVE), url))
    # Held rows keep the id they were written with.
    return reassign(finish(out, SINCE) + kept)


# --- PDF lists: Idaho, Mississippi, North Dakota, South Carolina ------------------------------
# Each prints its notices as a table in a PDF, read with pdfplumber (the
# debarment and annual-limits loaders use it too).
ID_PAGE = "https://www.labor.idaho.gov/businesses/layoff-assistance/"
MS_PAGE = "https://mdes.ms.gov/information-center/warn-information/"
ND_PAGE = "https://www.jobsnd.com/"
ND_PDF = "https://www.jobsnd.com/sites/www/files/documents/jsnd-documents/WARN%20Notices%202015%20to%20present.pdf"
SC_PAGE = "https://scworks.org/employer/employer-programs/risk-closing/layoff-notification-reports"
# South Carolina's 2019 to 2021 reports print the projected layoff date and no
# notice date, so its record here begins with 2022.
SC_FIRST_YEAR = 2022


def pdf_rows(data, *needles: str) -> tuple[list[str], list[list]]:
    """Every table row in a PDF under the first header naming `needles`.

    `data` is the PDF, or the tables pdfplumber found in it (what a test hands
    in, so a fixture is a few rows of JSON rather than the whole file). A
    header the PDF repeats on each page is dropped. Cells keep pdfplumber's
    line breaks as spaces.
    """
    header: list[str] | None = None
    rows: list[list] = []
    for t in pdf_tables(data) if isinstance(data, (bytes, bytearray)) else data:
        for r in t:
            cells = [clean((c or "").replace("\n", " ")) for c in r]
            low = [c.lower() for c in cells]
            if all(any(n in c for c in low) for n in needles):
                header = header or low
                continue
            if header is not None and any(cells):
                rows.append(cells)
    if header is None:
        raise ValueError(f"no PDF table naming {needles}")
    return header, rows


def pdf_date(v) -> str | None:
    """A date, or one whose digits a neighbouring column's letters ran through
    ("1C/8o/u2n0t2ie6s" is 1/8/2026 under the word "Counties")."""
    d = parse_date(v)
    if d or not v:
        return d
    stripped = re.sub(r"[A-Za-z\s,.]", "", str(v))
    return parse_date(stripped) if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{2,4}", stripped) else None


def parse_idaho(data: bytes) -> list[dict]:
    """Date of Letter, Updates, Company, Address, City, State, Zip, Employees, Effective Date.

    A count printed "106 (1 in ID)" is the notice's total and Idaho's share;
    Idaho's share is kept, as Colorado's own notifications are.
    """
    h, rows = pdf_rows(data, "company", "address")
    c = {k: col(h, *v) for k, v in {"date": ("date of",), "upd": ("updates",), "co": ("company",),
                                     "addr": ("address",), "city": ("city",), "st": ("state",), "zip": ("zip",),
                                     "n": ("employees",), "eff": ("effective",)}.items()}
    out = []
    for r in rows:
        d = parse_date(cell(r, c["date"]))
        if not d:
            continue
        raw_n = clean(cell(r, c["n"]))
        in_id = re.search(r"\((\d[\d,]*) in ID\)", raw_n)
        n = parse_int(in_id[1]) if in_id else parse_int(raw_n)
        site = join_site(cell(r, c["addr"]), cell(r, c["city"]),
                         f"{clean(cell(r, c['st']))} {clean(cell(r, c['zip']))}".strip())
        out.append(notice("ID", d, cell(r, c["co"]), source_url=ID_PAGE, effective_date=first_date(cell(r, c["eff"])),
                          kind="Update" if clean(cell(r, c["upd"])).lower().startswith("revised") else None,
                          employees=n, site=site, extra=site or ""))
    return finish(out, SINCE)


def load_idaho(f: str | None) -> list[dict]:
    if f:
        return parse_idaho(read(f))
    page = get_text(ID_PAGE)
    url = next((u for u, _ in links(page, ID_PAGE) if re.search(r"labor\.idaho\.gov/.*warn[^/]*\.pdf$", u, re.I)), None)
    if not url:
        raise ValueError("no WARN PDF linked from the Idaho page")
    pause()
    return parse_idaho(get(url, referer=ID_PAGE))


def parse_mississippi(data: bytes, source_url: str = MS_PAGE) -> list[dict]:
    """A quarter's notices. MDES lists notices the WARN Act didn't require
    ("NON-WARN") beside the WARN ones; only WARN notices are kept."""
    h, rows = pdf_rows(data, "company", "date of")
    c = {k: col(h, *v) for k, v in {"date": ("date of notice",), "co": ("company",), "city": ("city",),
                                     "county": ("county",), "event": ("event",), "naics": ("naics",),
                                     "type": ("type of action",), "n": ("affected",), "eff": ("date of action",),
                                     "why": ("reason",)}.items()}
    out = []
    for r in rows:
        if clean(cell(r, c["why"])).upper().startswith("NON-WARN"):
            continue
        d = parse_date(cell(r, c["date"]))
        if not d:
            continue
        event = clean(cell(r, c["event"]))
        out.append(notice("MS", d, cell(r, c["co"]), source_url=source_url, effective_date=first_date(cell(r, c["eff"])),
                          kind=cell(r, c["type"]), employees=parse_int(cell(r, c["n"])), county=cell(r, c["county"]),
                          industry=cell(r, c["naics"]), site=cell(r, c["city"]),
                          extra=event if event.upper() not in ("", "N/A") else clean(cell(r, c["city"]))))
    return finish(out, SINCE)


def load_mississippi(f: str | None) -> list[dict]:
    if f:
        return parse_mississippi(read(f))
    page = get_text(MS_PAGE)
    files = list(dict.fromkeys(u for u, _ in links(page, MS_PAGE) if re.search(r"/warn[^/]*\.pdf$", u, re.I)))
    if not files:
        raise ValueError("no quarterly WARN PDF linked from the Mississippi page")
    years = set(years_to_read("MS"))
    out: list[dict] = []
    for url in files:
        y = re.findall(r"(20\d\d)", url.rsplit("/", 1)[-1])
        if y and not any(int(x) in years for x in y):
            continue
        pause()
        out.extend(parse_mississippi(get(url, referer=MS_PAGE), url))
    return reassign(out)


def parse_north_dakota(data: bytes) -> list[dict]:
    """Company Name, Location, WARN Dated, Date of Layoff/Closure, Number Laid Off, Notes.

    From 2024 the PDF prints the layoff date inside the WARN-dated cell
    ("3/3/2025 5/2/2025"), leaving its own column empty: the first date is the
    notice, the second the layoff.
    """
    h, rows = pdf_rows(data, "company", "warn dated")
    c = {k: col(h, *v) for k, v in {"co": ("company",), "loc": ("location",), "date": ("warn dated",),
                                     "eff": ("layoff/closure",), "n": ("number",)}.items()}
    out = []
    for r in rows:
        dates = [parse_date(t) for t in DATE_TOKEN.findall(clean(cell(r, c["date"])))]
        dates = [d for d in dates if d]
        if not dates:
            continue
        eff = first_date(cell(r, c["eff"])) or (dates[1] if len(dates) > 1 else None)
        loc = clean(cell(r, c["loc"]))
        out.append(notice("ND", dates[0], cell(r, c["co"]), source_url=ND_PDF, effective_date=eff,
                          employees=parse_int(cell(r, c["n"])), site=loc or None, extra=loc))
    return finish(out, SINCE)


def load_north_dakota(f: str | None) -> list[dict]:
    return parse_north_dakota(read(f) if f else get(ND_PDF, referer=ND_PAGE))


def parse_south_carolina(data: bytes, source_url: str = SC_PAGE) -> list[dict]:
    h, rows = pdf_rows(data, "company", "notice date")
    c = {k: col(h, *v) for k, v in {"co": ("company",), "county": ("county",), "date": ("notice date",),
                                     "eff": ("layoff/closure date",), "n": ("impacted",),
                                     "type": ("layoff/closure",), "addr": ("address",)}.items()}
    # "Layoff/Closure Date" also contains "layoff/closure"; the type column is the other one.
    types = [i for i, x in enumerate(h) if "layoff/closure" in x and "date" not in x]
    c["type"] = types[0] if types else None
    out, undated = [], []
    for r in rows:
        d = pdf_date(cell(r, c["date"]))
        if not d:
            # A notice row the state misdated ("08/29/205") is skipped, and
            # counted, so the total check below can tell it from a missed row.
            if clean(cell(r, c["co"])) and parse_int(cell(r, c["n"])) is not None and clean(cell(r, c["addr"])):
                undated.append(clean(cell(r, c["co"])))
            continue
        addr = clean(cell(r, c["addr"]))
        out.append(notice("SC", d, cell(r, c["co"]), source_url=source_url, effective_date=first_date(cell(r, c["eff"])),
                          kind=cell(r, c["type"]), employees=parse_int(cell(r, c["n"])), county=cell(r, c["county"]),
                          site=addr or None, extra=addr))
    # The report prints its own count ("Total WARN:38"). A row skipped for a
    # date that can't be read is named and accounted for. pdfplumber can lose
    # a row where a long name wraps across a cell (2023's report: 47 of 48), so
    # a shortfall of one in twenty or less warns, and more refuses the year.
    total = re.search(r"Total WARN:\s*(\d+)", " ".join(" ".join(r) for r in rows))
    short = int(total[1]) - len(out) - len(undated) if total else 0
    if short and abs(short) * 20 > int(total[1]):
        raise ValueError(f"the report counts {total[1]} notices and {len(out)} were read")
    if short:
        print(f"::warning::South Carolina: the report counts {total[1]} notices and {len(out)} were read", flush=True)
    if undated:
        print(f"  South Carolina: skipped {len(undated)} notice(s) whose date can't be read: {', '.join(undated)}",
              flush=True)
    return finish(out, SINCE)


def load_south_carolina(f: str | None) -> list[dict]:
    if f:
        return parse_south_carolina(read(f))
    page = get_text(SC_PAGE)
    years = set(years_to_read("SC"))
    newest: dict[int, str] = {}
    for url, text in links(page, SC_PAGE):
        if not url.lower().endswith(".pdf"):
            continue
        m = re.search(r"(20\d\d)", urllib.parse.unquote(url.rsplit("/", 1)[-1]))
        # Each year's link is listed newest first; a later link for the same
        # year is an older run of that year's report.
        if m and int(m[1]) in years and int(m[1]) >= SC_FIRST_YEAR and int(m[1]) not in newest:
            newest[int(m[1])] = url
    if not newest:
        raise ValueError("no yearly WARN report linked from the South Carolina page")
    out: list[dict] = []
    for _, url in sorted(newest.items(), reverse=True):
        pause()
        out.extend(parse_south_carolina(get(url, referer=SC_PAGE), url))
    return reassign(out)


# --- States whose own host turns scripts away (read Oct 25 2026) -----------------------------
# Minnesota and Rhode Island: the state's page answered this module's ordinary
# request with the page, and the files it links are open to scripts. When the
# page turns a request away, the Internet Archive's newest copy of it says
# which files to read, and the files still come from the state.
# Louisiana and New Mexico serve their yearly files, but robots.txt asks
# automated readers to stay off them; Missouri puts an hCaptcha check in front
# of every page, and Nevada's host refuses scripts outright. Those four are
# read from the Archive's copies, and nothing at the state's host is asked.
# An Archive copy is as new as its newest capture: about daily for Louisiana's
# file, about monthly for Missouri's and Nevada's pages, a few times a year
# for New Mexico's files. Each budget allows for that, and SOURCE_NOTES names
# the copy a run read, for the note on the state's freshness row.
SOURCE_NOTES: dict[str, str] = {}


def note_source(state: str, text: str) -> None:
    SOURCE_NOTES[state.lower()] = text


def captured_note(dates: list[str]) -> str:
    return f"read from the Internet Archive's copies, the newest captured {max(dates)}" if dates else ""


def newest_copy(urls: list[str], accept) -> "object":
    """The Archive's newest good copy among several addresses of one file
    (New Mexico posts a year's file under two folders)."""
    ranked = sorted(((archive_captures(u, 3) or [""])[0], u) for u in urls)
    for _, url in reversed(ranked):
        try:
            return archive_copy(url, accept)
        except LookupError:
            continue
    raise LookupError(f"the Internet Archive holds no usable copy of {urls[0]}")


def plain_url(url: str) -> str:
    """The address as a reader would open it: https, no port."""
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(("https", parts.hostname or parts.netloc, parts.path, parts.query, ""))


# --- Minnesota ----------------------------------------------------------------------
# DEED lists each notice it receives (the employer, the day and the letter as
# a PDF) under a heading per year: this year's on the layoff page, earlier
# years on its archive page. The list prints no count, and the letters are the
# employers' own, worded every way, so a row carries the company and the day.
MN_PAGE = "https://mn.gov/deed/business/layoff-resources/"
MN_ARCHIVE = "https://mn.gov/deed/business/layoff-resources/warn-archive/"
# mn.gov's robots.txt: "Visit-time: 0000-1200" (UTC) and "Request-rate: 10".
MN_VISIT_UTC_HOURS = range(0, 12)
MN_GAP_S = 10
MN_LINK = re.compile(r'href\s*=\s*["\'][^"\']*/deed/assets/[^"\']*warn[^"\']*\.pdf', re.I)
MN_YEAR = re.compile(r"<h4[^>]*>\s*(20\d\d)\s*</h4>\s*<ul\b[^>]*>(.*?)</ul>", re.S | re.I)
MN_REVISION = re.compile(r"\(\s*(?:revision|revised|updated?|amended)[^)]*\)", re.I)


def has_mn_list(data: bytes) -> bool:
    return bool(MN_LINK.search(decode(data)))


def parse_minnesota(data: bytes, base: str = MN_PAGE) -> list[dict]:
    """Every "Company - date" in the list under a year heading, linked to its
    letter. The list sits inside an accordion that is itself a list item, so
    each year's own list is taken whole before its items are read."""
    out = []
    items = [li for m in MN_YEAR.finditer(decode(data)) for li in re.findall(r"<li\b[^>]*>(.*?)</li>", m[2], re.S | re.I)]
    for li in items:
        a = re.search(r'<a\b[^>]*href\s*=\s*["\']([^"\']+\.pdf)["\'][^>]*>(.*?)</a>(.*)', li, re.S | re.I)
        if not a or "warn" not in a[1].lower() or "plant-closing" in a[1].lower():
            continue
        company, rest = text_of(a[2]), text_of(a[3])
        d = first_date(rest)
        if not d:
            continue
        url = urllib.parse.urljoin(base, a[1].replace("&amp;", "&"))
        update = bool(MN_REVISION.search(company) or re.search(r"revis|update|amend", rest, re.I))
        out.append(notice("MN", d, clean(MN_REVISION.sub("", company)), source_url=url,
                          kind="Update" if update else None, extra=url))
    return finish(out, SINCE)


def mn_page(url: str, now: dt.datetime | None = None) -> tuple[bytes, str | None]:
    """The page from mn.gov when it answers with the list inside the hours its
    robots.txt names, else the Archive's newest copy and its day."""
    if (now or dt.datetime.now(dt.timezone.utc)).hour in MN_VISIT_UTC_HOURS:
        try:
            data = get(url)
            if has_mn_list(data):
                return data, None
            print(f"  Minnesota: {url} answered without its list; reading the Internet Archive's copy", flush=True)
        except Exception as exc:  # noqa: BLE001 - a refusal falls back; a defect does not
            if not is_unreachable(exc):
                raise
            print(f"  Minnesota: {url} refused ({type(exc).__name__}); reading the Internet Archive's copy", flush=True)
    copy = archive_copy(url, has_mn_list)
    return copy.data, copy.captured


def load_minnesota(f: str | None) -> list[dict]:
    if f:
        return parse_minnesota(read(f))
    out: list[dict] = []
    captured: list[str] = []
    for i, url in enumerate((MN_PAGE, MN_ARCHIVE)):
        if i:
            pause(MN_GAP_S)
        data, day = mn_page(url)
        if day:
            captured.append(day)
        out.extend(parse_minnesota(data, url))
    note_source("MN", captured_note(captured))
    return reassign(out)


# --- Rhode Island -------------------------------------------------------------------
# DLT's WARN page links one workbook, a sheet a year and one for earlier years,
# which DLT says it updates within a day of a notice arriving. The workbook's
# address changes when DLT uploads a new one, so it's read off the page.
RI_PAGE = "https://dlt.ri.gov/employers/worker-adjustment-and-retraining-notification-warn"


def ri_report_link(page: str) -> str | None:
    for url, text in links(page, RI_PAGE):
        if re.search(r"warn", url + " " + text, re.I) and (
                re.search(r"\.xlsx?(?:$|\?)", url, re.I) or re.search(r"/media/\d+/download", url)):
            return url
    return None


def parse_rhode_island(data: bytes) -> list[dict]:
    """WARN Date, Date Received, Company Name, Location of Layoffs, Number
    Affected, Effective Date, Closing Yes/No, Union Yes/No, Union Address.

    The union address names a union's officers and is never read. A count
    printed "9,891 Remote Workers (2 from RI)" keeps Rhode Island's share, as
    Idaho's does.
    """
    out = []
    for name, rows in xlsx_sheets(data).items():
        i = find_header(rows, "warn date", "company")
        if i is None:
            continue
        h = header_of(rows[i])
        c = {k: col(h, *v) for k, v in {"date": ("warn date",), "recv": ("received",), "co": ("company",),
                                         "loc": ("location",), "n": ("affected",), "eff": ("effective",),
                                         "closing": ("closing",)}.items()}
        for r in rows[i + 1:]:
            d = parse_date(cell(r, c["date"])) or parse_date(cell(r, c["recv"]))
            if not d or not clean(cell(r, c["co"])):
                continue
            raw_n = clean(cell(r, c["n"]))
            share = re.search(r"\((\d[\d,]*) from RI\)", raw_n, re.I)
            # "309 *updated 10/26/23": the count, then a note about it.
            noted = re.match(r"^(\d[\d,]*)\s*\*", raw_n)
            closing = clean(cell(r, c["closing"])).lower()
            kind = "Closure" if closing.startswith("yes") else "Layoff" if closing.startswith("no") else None
            loc = clean(cell(r, c["loc"]))
            out.append(notice("RI", d, cell(r, c["co"]), source_url=RI_PAGE, effective_date=first_date(cell(r, c["eff"])),
                              kind=kind, employees=parse_int((share or noted or [None, raw_n])[1]), site=loc or None,
                              extra=loc))
    return finish(out, SINCE)


def load_rhode_island(f: str | None) -> list[dict]:
    if f:
        return parse_rhode_island(read(f))
    captured: list[str] = []
    url = None
    try:
        url = ri_report_link(get_text(RI_PAGE))
        if not url:
            print("  Rhode Island: the page answered without its workbook link; reading the Internet Archive's copy",
                  flush=True)
    except Exception as exc:  # noqa: BLE001
        if not is_unreachable(exc):
            raise
        print(f"  Rhode Island: the page refused ({type(exc).__name__}); reading the Internet Archive's copy", flush=True)
    if not url:
        copy = archive_copy(RI_PAGE, lambda d: ri_report_link(decode(d)) is not None)
        url = ri_report_link(decode(copy.data))
        captured.append(copy.captured)
    pause()
    try:
        data = get(url, referer=RI_PAGE)
        if not is_xlsx(data):
            raise urllib.error.URLError("the workbook's address answered with a page")
    except Exception as exc:  # noqa: BLE001
        if not is_unreachable(exc):
            raise
        copy = archive_copy(url, is_xlsx)
        data = copy.data
        captured.append(copy.captured)
    note_source("RI", captured_note(captured))
    return parse_rhode_island(data)


# --- Louisiana ----------------------------------------------------------------------
# The Workforce Commission posts a PDF a year. Its robots.txt lets only
# Google's and Bing's crawlers in, so the files are read from the Archive's
# copies (it captures the current year's about daily) and found through the
# Archive's own index of the folder. Until 2025 a notice's address sits in the
# company's cell, under the name; from 2026 it has its own column.
LA_PAGE = "https://www.laworks.net/Downloads/Downloads_WFD.asp"
LA_FOLDER = "laworks.net/Downloads/WFD/WarnNotices"
LA_FILE = re.compile(r"^WarnNotices(20\d\d)\.pdf$", re.I)
SMALL_NUMBERS = {w: i for i, w in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
    "seventeen eighteen nineteen twenty".split())}


def la_count(v) -> int | None:
    """The notice's count, or Louisiana's share where the cell says so
    ("*292 *Only forty (40) employees affected in Louisiana" is 40)."""
    raw = clean(v)
    if re.search(r"in louisiana", raw, re.I):
        m = re.search(r"only\s+(\w+)(?:\s*\((\d[\d,]*)\))?", raw, re.I)
        if not m:
            return None
        return parse_int(m[2]) if m[2] else parse_int(m[1]) if m[1].isdigit() else SMALL_NUMBERS.get(m[1].lower())
    return parse_int(raw.replace("*", ""))


def la_name_and_site(v) -> tuple[str, str | None]:
    """A company cell that holds the address too: the lines before the first
    one that reads as an address are the name."""
    lines = [clean(x) for x in str(v or "").split("\n") if clean(x)]
    for i, line in enumerate(lines[1:], start=1):
        if re.match(r"\d|P\.?\s*O\.?\s+Box\b|One\s|Suite\b", line, re.I) or re.search(r"\b[A-Z]{2}\s+\d{5}", line):
            return " ".join(lines[:i]), ", ".join(lines[i:])
    return " ".join(lines), None


def parse_louisiana(data, source_url: str = LA_PAGE) -> list[dict]:
    header: list[str] | None = None
    out = []
    for t in pdf_tables(data) if isinstance(data, (bytes, bytearray)) else data:
        for r in t:
            raw = [c or "" for c in r]
            low = [clean(c).lower() for c in raw]
            if any("company" in c for c in low) and any("notice" in c for c in low):
                header = low
                continue
            if header is None or not any(clean(c) for c in raw):
                continue
            c = {k: col(header, *v) for k, v in {"co": ("company",), "addr": ("address",), "date": ("notice",),
                                                  "eff": ("layoff",), "n": ("affected",), "ind": ("industry",)}.items()}
            d = parse_date(clean(cell(raw, c["date"])))
            if not d:
                continue
            if c["addr"] is not None:
                company, site = clean(cell(raw, c["co"])), clean(cell(raw, c["addr"])) or None
            else:
                company, site = la_name_and_site(cell(raw, c["co"]))
            out.append(notice("LA", d, company, source_url=source_url, effective_date=first_date(clean(cell(raw, c["eff"]))),
                              employees=la_count(cell(raw, c["n"])), industry=cell(raw, c["ind"]), site=site,
                              extra=site or ""))
    if header is None:
        raise ValueError("no table naming Company and Notice Date in Louisiana's file")
    return finish(out, SINCE)


def load_louisiana(f: str | None) -> list[dict]:
    if f:
        return parse_louisiana(read(f))
    files: dict[int, str] = {}
    for url in archive_index(LA_FOLDER, LA_FILE.pattern):
        m = LA_FILE.match(urllib.parse.unquote(url.rsplit("/", 1)[-1]))
        files[int(m[1])] = url
    years = [y for y in years_to_read("LA") if y in files]
    if not years:
        raise ValueError("the Internet Archive's index lists no Louisiana WARN file for the years read")
    out: list[dict] = []
    captured: list[str] = []
    for y in years:
        try:
            copy = archive_copy(files[y], is_pdf)
        except LookupError as exc:
            print(f"  Louisiana {y}: {exc}", flush=True)
            continue
        captured.append(copy.captured)
        out.extend(parse_louisiana(copy.data, plain_url(files[y])))
        pause()
    note_source("LA", captured_note(captured))
    return reassign(out)


# --- New Mexico ---------------------------------------------------------------------
# Workforce Solutions posts a PDF a year, and robots.txt keeps scripts out of
# the folder (`Disallow: /Portals/`), so the Archive's copies are read. It
# captures them a few times a year, under two folders.
NM_PAGE = "https://www.dws.nm.gov/Rapid-Response"
NM_FOLDER = "dws.nm.gov/Portals/0/"
NM_FILE = re.compile(r"^(20\d\d)[ _]WARN\.pdf$", re.I)


def parse_new_mexico(data, source_url: str = NM_PAGE) -> list[dict]:
    """Notice Date, Job Site Name, County, WDA, Total Layoff Number, Layoff
    Date, Received Date, City."""
    h, rows = pdf_rows(data, "notice date", "job site")
    c = {k: col(h, *v) for k, v in {"date": ("notice date",), "co": ("job site",), "county": ("county",),
                                     "n": ("total layoff",), "eff": ("layoff date",), "recv": ("received",),
                                     "city": ("city",)}.items()}
    out = []
    for r in rows:
        d = parse_date(cell(r, c["date"])) or parse_date(cell(r, c["recv"]))
        if not d:
            continue
        city = clean(cell(r, c["city"]))
        out.append(notice("NM", d, cell(r, c["co"]), source_url=source_url, effective_date=first_date(cell(r, c["eff"])),
                          employees=parse_int(cell(r, c["n"])), county=cell(r, c["county"]), site=city or None,
                          extra=city))
    return finish(out, SINCE)


def load_new_mexico(f: str | None) -> list[dict]:
    if f:
        return parse_new_mexico(read(f))
    files: dict[int, list[str]] = {}
    for url in archive_index(NM_FOLDER, r"WARN"):
        m = NM_FILE.match(urllib.parse.unquote(url.rsplit("/", 1)[-1]))
        if m:
            files.setdefault(int(m[1]), []).append(url)
    # archive_index keeps one address per file name; New Mexico's second folder
    # holds the same names, so ask the Archive for both.
    for y, urls in files.items():
        for u in list(urls):
            other = u.replace("/Portals/0/DM/Business/", "/Portals/0/") if "/DM/Business/" in u else \
                u.replace("/Portals/0/", "/Portals/0/DM/Business/")
            if other not in urls:
                urls.append(other)
    years = [y for y in years_to_read("NM") if y in files]
    if not years:
        raise ValueError("the Internet Archive's index lists no New Mexico WARN file for the years read")
    out: list[dict] = []
    captured: list[str] = []
    for y in years:
        try:
            copy = newest_copy(files[y], is_pdf)
        except LookupError as exc:
            print(f"  New Mexico {y}: {exc}", flush=True)
            continue
        captured.append(copy.captured)
        out.extend(parse_new_mexico(copy.data, plain_url(copy.url)))
        pause()
    note_source("NM", captured_note(captured))
    return reassign(out)


# --- Missouri -----------------------------------------------------------------------
# The Office of Workforce Development lists a year's notices on a page per
# year (received, employer, industry, location, county, type, layoff dates,
# workers affected). Every page sits behind an hCaptcha check, so the
# Archive's copies are read; it captures each about monthly, and a capture of
# the check page itself is passed over.
MO_PAGE = "https://jobs.mo.gov/warn/"
MO_YEAR = "https://jobs.mo.gov/warn/{year}"


def has_mo_table(data: bytes) -> bool:
    return table_with(decode(data), "received", "affected") is not None


def parse_missouri(data: bytes, source_url: str = MO_PAGE) -> list[dict]:
    t = table_with(decode(data), "received", "affected")
    if not t:
        raise ValueError("no table naming Received and # affected on Missouri's page")
    h, body = t
    c = {k: col(h, *v) for k, v in {"date": ("received",), "co": ("title",), "ind": ("industry",),
                                     "loc": ("location",), "county": ("county",), "type": ("type",),
                                     "eff": ("layoff date",), "n": ("affected",)}.items()}
    out = []
    for r in body:
        d = parse_date(cell(r, c["date"]))
        if not d:
            continue
        loc = clean(cell(r, c["loc"]))
        out.append(notice("MO", d, cell(r, c["co"]), source_url=source_url, effective_date=first_date(cell(r, c["eff"])),
                          kind=cell(r, c["type"]), employees=parse_int(cell(r, c["n"])), county=cell(r, c["county"]),
                          industry=cell(r, c["ind"]), site=loc or None, extra=loc))
    return finish(out, SINCE)


def load_missouri(f: str | None) -> list[dict]:
    if f:
        return parse_missouri(read(f))
    out: list[dict] = []
    captured: list[str] = []
    for y in years_to_read("MO"):
        url = MO_YEAR.format(year=y)
        try:
            copy = archive_copy(url, has_mo_table)
        except LookupError as exc:
            print(f"  Missouri {y}: {exc}", flush=True)
            continue
        captured.append(copy.captured)
        out.extend(parse_missouri(copy.data, url))
        pause()
    if not captured:
        raise ValueError("the Internet Archive holds no copy of any Missouri year page read")
    note_source("MO", captured_note(captured))
    return reassign(out)


# --- Nevada -------------------------------------------------------------------------
# DETR posts a master PDF a year, WARN and non-WARN notices together, linked
# from its WARN page. Its host refuses scripts and its robots.txt alike, so the
# Archive's copies are read. The PDF draws no table rules, so its columns are
# read from where each word sits: the employer, city, county and notification
# columns are left-aligned, so their left edges are the x positions nearly
# every row shares.
NV_PAGE = "https://detr.nv.gov/Page/WARN"
NV_MASTER = re.compile(r"(20\d\d)\s*WARN Act Notices", re.I)


def nv_masters(page: str) -> dict[int, str]:
    out: dict[int, str] = {}
    for url, text in links(page, NV_PAGE):
        m = NV_MASTER.search(text)
        if m and url.lower().endswith(".pdf"):
            out.setdefault(int(m[1]), plain_url(url))
    return out


def pdf_word_lines(data) -> list[list[dict]]:
    """Each printed line of a PDF as its words ({"text", "x0"}), top to bottom.
    `data` is the PDF, or those lines as a test hands them in."""
    if not isinstance(data, (bytes, bytearray)):
        return data
    import io as _io

    import pdfplumber

    if not is_pdf(data):
        raise ValueError("not a PDF: the source answered with something else")
    out: list[list[dict]] = []
    with pdfplumber.open(_io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            words = sorted(page.extract_words(x_tolerance=1.5), key=lambda w: (w["top"], w["x0"]))
            line: list[dict] = []
            top = None
            for w in words:
                if top is not None and abs(w["top"] - top) > 2:
                    out.append(sorted(line, key=lambda x: x["x0"]))
                    line = []
                top = w["top"] if not line else top
                line.append({"text": w["text"], "x0": round(w["x0"], 1)})
            if line:
                out.append(sorted(line, key=lambda x: x["x0"]))
    return out


NV_DATE = re.compile(r"^\d{1,2}/\d{1,2}/\d{2,4}$")


def parse_nevada(data, source_url: str = NV_PAGE) -> list[dict]:
    """Received Date, Effective Date, Type, Affected Total, Employer, City,
    County, Notification. Only rows marked WARN are kept, as Mississippi's are.
    A WARN row printed without its received date can't be dated and is named."""
    lines = pdf_word_lines(data)
    rows = [ln for ln in lines if ln and NV_DATE.match(ln[0]["text"])]
    if not rows:
        raise ValueError("no dated rows in Nevada's file")
    from collections import Counter
    share = Counter(round(w["x0"]) for ln in rows for w in {round(w["x0"]): w for w in ln}.values())
    lefts = sorted(x for x, n in share.items() if n >= 0.6 * len(rows))
    if len(lefts) < 4:
        raise ValueError(f"Nevada's columns can't be found from where its words sit ({lefts})")
    emp_x, city_x, county_x, notif_x = (x - 1.5 for x in lefts[-4:])
    out = []
    undated = [ln for ln in lines if ln and not NV_DATE.match(ln[0]["text"]) and ln[-1]["text"] == "WARN"
               and any(w["x0"] >= emp_x for w in ln) and any(re.fullmatch(r"\d+", w["text"]) for w in ln)]
    for ln in rows:
        pre = [w["text"] for w in ln if w["x0"] < emp_x]
        emp = " ".join(w["text"] for w in ln if emp_x <= w["x0"] < city_x)
        city = " ".join(w["text"] for w in ln if city_x <= w["x0"] < county_x)
        county = " ".join(w["text"] for w in ln if county_x <= w["x0"] < notif_x)
        notif = (" ".join(w["text"] for w in ln if w["x0"] >= notif_x) or ln[-1]["text"]).upper()
        if not notif.endswith("WARN") or "NON" in notif:
            continue
        kind = next((t for t in pre[1:] if re.fullmatch(r"layoffs?|closures?|closing", t, re.I)), None)
        count = next((t for t in reversed(pre[1:]) if (re.match(r"\d", t) and not NV_DATE.match(t))
                      or t.lower() == "unknown"), None)
        eff = next((t for t in pre[1:2] if NV_DATE.match(t)), None)
        out.append(notice("NV", parse_date(pre[0]), emp, source_url=source_url, effective_date=parse_date(eff),
                          kind=kind, employees=parse_int(count),
                          county=county, site=city or None, extra=city))
    if undated:
        names = ", ".join(" ".join(w["text"] for w in ln if emp_x <= w["x0"] < city_x) for ln in undated)
        print(f"  Nevada: {len(undated)} WARN row(s) print no received date and are left out: {names}", flush=True)
    return finish(out, SINCE)


def load_nevada(f: str | None) -> list[dict]:
    if f:
        return parse_nevada(read(f))
    page = archive_copy(NV_PAGE, lambda d: bool(nv_masters(decode(d))))
    masters = nv_masters(decode(page.data))
    captured = [page.captured]
    out: list[dict] = []
    for y in years_to_read("NV"):
        if y not in masters:
            continue
        pause()
        try:
            copy = archive_copy(masters[y], is_pdf)
        except LookupError as exc:
            print(f"  Nevada {y}: {exc}", flush=True)
            continue
        captured.append(copy.captured)
        out.extend(parse_nevada(copy.data, masters[y]))
    note_source("NV", captured_note(captured))
    return reassign(out)


# --- West Virginia ------------------------------------------------------------------
# WorkForce West Virginia posts each notice as the employer's letter, a PDF
# per notice, the link's words naming the employer and usually the day. Its
# compiled list of January 2022 to January 3 2025 prints every field; each
# letter outside that span gives the company and the day (or the month, where
# that's all the link says) and no count, because the count is only inside the
# letter, often a scan. Contact names in the compiled list are never read.
WV_PAGE = "https://workforcewv.org/job-seeker/layoffs-downsizing/warn-listing/"
WV_GAP_S = 10  # robots.txt: "Crawl-delay: 10"
WV_MONTHS = r"(january|february|march|april|may|june|july|august|september|october|november|december)"
WV_WORDS = re.compile(r"\b(?:warn|notices?|state|supplemental|signed|revised|revisedsigned|workforce|letter|update)\b"
                      r"|\br\d\b", re.I)


def wv_letter(url: str, text: str) -> dict | None:
    """One letter's link: the day from its words or its file name, else the
    month they name ("08-2026", "July"), else the month the file was posted."""
    path = urllib.parse.urlsplit(url).path
    stem = re.sub(r"\.pdf$", "", urllib.parse.unquote(path.rsplit("/", 1)[-1]), flags=re.I)
    words = clean(text).replace("_", " ")
    spaced = stem.replace("_", " ").replace("-", " ")
    posted = re.search(r"/uploads/(20\d\d)/(\d\d)/", path)
    d = first_date(words) or first_date(stem.replace("_", "-"))
    for src in ((words, spaced) if not d else ()):
        mm = re.search(r"\b(\d{1,2})[-/](20\d\d)\b", src)
        if mm and 1 <= int(mm[1]) <= 12:
            d = f"{mm[2]}-{int(mm[1]):02d}"
            break
        mn = re.search(r"\b" + WV_MONTHS + r"\b(?:\D{0,3}(20\d\d))?", src, re.I)
        d = parse_month(mn[1], mn[2] or (posted[1] if posted else None)) if mn else None
        if d:
            break
    if not d and posted:
        d = f"{posted[1]}-{posted[2]}"
    if not d:
        return None
    co = DATE_TOKEN.sub(" ", words)
    co = re.sub(r"\b\d{1,2}[-/]20\d\d\b|\b20\d\d\b|\b" + WV_MONTHS + r"\b", " ", co, flags=re.I)
    co = clean(re.sub(r"\s[–—-]\s|^\s*[–—-]\s*|\s*[–—-]\s*$", " ", WV_WORDS.sub(" ", co)))
    co = clean(re.sub(r"(?:\s+\d+)+$", "", co))
    if not co:
        return None
    update = bool(re.search(r"\br\d\b|revis|supplemental|update|amend", words + " " + stem, re.I))
    return notice("WV", d, co, source_url=url, kind="Update" if update else None, extra=url)


def wv_compiled_span(data: bytes) -> tuple[str, str] | None:
    """The span the compiled list covers, from its own title ("1/1/22 to 1/3/25")."""
    import io as _io

    import pdfplumber

    with pdfplumber.open(_io.BytesIO(data)) as pdf:
        text = pdf.pages[0].extract_text() or ""
    m = re.search(r"(\d{1,2}/\d{1,2}/\d{2,4})\s+to\s+(\d{1,2}/\d{1,2}/\d{2,4})", text)
    return (parse_date(m[1]), parse_date(m[2])) if m else None


def parse_west_virginia_compiled(data, source_url: str = WV_PAGE) -> list[dict]:
    """A two-column table per notice: Company, Address, Contact Information
    (never read), Region, County, Date of Notice, Projected Date, Closure/Mass
    Layoff, Number Affected.

    A notice that runs over a page break continues in the next table, which
    starts without a Company row. A notice for several sites lists the extra
    addresses under its address and prints "Total" beside its whole count.
    """
    found: list[dict[str, list[str]]] = []
    current: dict[str, list[str]] | None = None
    last = ""
    for t in pdf_tables(data) if isinstance(data, (bytes, bytearray)) else data:
        for r in t:
            cells = [clean(c) for c in (r or [])]
            if not cells:
                continue
            key, values = cells[0].lower(), [c for c in cells[1:] if c]
            if key == "company":
                current = {}
                found.append(current)
            if current is None:
                continue
            if key:
                current[key], last = values, key
            elif last == "address" and values:
                current["address"] = current.get("address", []) + values[:1]
    out = []
    for f in found:
        first = {k: (v[0] if v else "") for k, v in f.items()}
        d = parse_date(first.get("date of notice"))
        if not d or not first.get("company"):
            continue
        n = f.get("number affected") or []
        count = parse_int(n[-1]) if len(n) > 1 and n[0].lower() == "total" else parse_int(first.get("number affected"))
        sites = f.get("address") or []
        out.append(notice("WV", d, first["company"], source_url=source_url,
                          effective_date=first_date(first.get("projected date")), kind=first.get("closure/mass layoff"),
                          employees=count, county=first.get("county"), site="; ".join(sites) or None,
                          extra=sites[0] if sites else ""))
    return finish(out, SINCE)


def parse_west_virginia(data: bytes, span: tuple[str, str] | None = None) -> list[dict]:
    """The listing page's letters, leaving to the compiled list the span it covers."""
    out = []
    for url, text in links(decode(data), WV_PAGE):
        if "/wp-content/uploads/" not in url or not url.lower().endswith(".pdf") or re.search(r"\bto\b", url):
            continue
        row = wv_letter(url, text)
        if row and not (span and span[0] <= row["notice_date"][:10] <= span[1]):
            out.append(row)
    return finish(out, SINCE)


def wv_compiled_url(page: str) -> str | None:
    return next((u for u, _ in links(page, WV_PAGE) if re.search(r"/WV-WARN-Notices-[^/]*to[^/]*\.pdf$", u, re.I)), None)


def load_west_virginia(f: str | None) -> list[dict]:
    if f:
        return parse_west_virginia(read(f))
    page = get(WV_PAGE)
    out: list[dict] = []
    span = None
    compiled = wv_compiled_url(decode(page))
    if compiled:
        pause(WV_GAP_S)
        data = get(compiled, referer=WV_PAGE)
        span = wv_compiled_span(data)
        out.extend(parse_west_virginia_compiled(data, compiled))
    return reassign(out + parse_west_virginia(page, span))


# "days" is each state's freshness budget: its newest notice may be this old
# before the health check says the state has gone quiet. Set Oct 25 2026 from
# the longest gap between two notices in the two years before, plus a week,
# and never under the newest notice's age that day plus two weeks (a state
# posts its notices some days after their date). New Jersey and Pennsylvania
# date a notice by its month, read as the month's first day, so theirs is ten
# weeks. Florida's is set from how densely it posts (several notices a week),
# because the measured run read only one page a year until its pager was fixed.
STATES: dict[str, dict] = {
    "il": {"name": "Illinois", "page": IL_PAGE, "days": 28, "snapshot": True, "load": load_illinois},
    "nj": {"name": "New Jersey", "page": NJ_PAGE, "days": 70, "snapshot": True, "load": load_new_jersey},
    "ma": {"name": "Massachusetts", "page": MA_PAGE, "days": 35, "snapshot": True, "load": load_massachusetts},
    "ga": {"name": "Georgia", "page": GA_PAGE, "days": 35, "snapshot": True, "load": load_georgia},
    "nc": {"name": "North Carolina", "page": NC_PAGE, "days": 42, "snapshot": True, "load": load_north_carolina},
    "va": {"name": "Virginia", "page": VA_PAGE, "days": 63, "snapshot": True, "load": load_virginia},
    "mi": {"name": "Michigan", "page": MI_PAGE, "days": 70, "snapshot": True, "load": load_michigan},
    "oh": {"name": "Ohio", "page": OH_PAGE, "days": 35, "snapshot": True, "load": load_ohio},
    "fl": {"name": "Florida", "page": FL_PAGE, "days": 28, "snapshot": True, "load": load_florida},
    "md": {"name": "Maryland", "page": MD_PAGE, "days": 28, "snapshot": True, "load": load_maryland},
    "pa": {"name": "Pennsylvania", "page": PA_PAGE, "days": 70, "snapshot": True, "load": load_pennsylvania},
    "ct": {"name": "Connecticut", "page": CT_PAGE, "days": 84, "snapshot": True, "load": load_connecticut},
    "co": {"name": "Colorado", "page": CO_PAGE, "days": 49, "snapshot": True, "load": load_colorado},
    "in": {"name": "Indiana", "page": IN_PAGE, "days": 70, "snapshot": True, "load": load_indiana},
    "al": {"name": "Alabama", "page": AL_PAGE, "days": 56, "snapshot": True, "load": load_alabama},
    "ak": {"name": "Alaska", "page": AK_PAGE, "days": 406, "snapshot": True, "load": load_page(parse_alaska, AK_PAGE)},
    "az": {"name": "Arizona", "page": JOB_CENTERS["AZ"] + "/search/warn_lookups/new", "days": 42, "snapshot": True,
           "load": load_job_center("AZ")},
    "de": {"name": "Delaware", "page": JOB_CENTERS["DE"] + "/search/warn_lookups/new", "days": 308, "snapshot": True,
           "load": load_job_center("DE")},
    "dc": {"name": "District of Columbia", "page": DC_PAGE.format(year=dt.date.today().year), "days": 105,
           "snapshot": True, "load": load_dc},
    "hi": {"name": "Hawaii", "page": HI_PAGE, "days": 63, "snapshot": True, "load": load_hawaii},
    "ia": {"name": "Iowa", "page": IA_PAGE, "days": 35, "snapshot": True, "load": load_iowa},
    "id": {"name": "Idaho", "page": ID_PAGE, "days": 105, "snapshot": True, "load": load_idaho},
    "ks": {"name": "Kansas", "page": JOB_CENTERS["KS"] + "/search/warn_lookups/new", "days": 196, "snapshot": True,
           "load": load_job_center("KS")},
    "ky": {"name": "Kentucky", "page": KY_PAGE, "days": 49, "snapshot": True, "load": load_kentucky},
    "me": {"name": "Maine", "page": JOB_CENTERS["ME"] + "/search/warn_lookups/new", "days": 203, "snapshot": True,
           "load": load_job_center("ME")},
    "ms": {"name": "Mississippi", "page": MS_PAGE, "days": 119, "snapshot": True, "load": load_mississippi},
    "mt": {"name": "Montana", "page": MT_PAGE, "days": 161, "snapshot": True, "load": load_montana},
    "nd": {"name": "North Dakota", "page": ND_PDF, "days": 301, "snapshot": True, "load": load_north_dakota},
    "ne": {"name": "Nebraska", "page": NE_PAGE, "days": 126, "snapshot": True, "load": load_page(parse_nebraska, NE_PAGE)},
    "ok": {"name": "Oklahoma", "page": OK_PAGE, "days": 224, "snapshot": True, "load": load_oklahoma},
    "or": {"name": "Oregon", "page": OR_PAGE, "days": 49, "snapshot": True, "load": load_oregon},
    "sc": {"name": "South Carolina", "page": SC_PAGE, "days": 70, "snapshot": True, "load": load_south_carolina},
    "sd": {"name": "South Dakota", "page": SD_PAGE, "days": 147, "snapshot": True,
           "load": load_page(parse_south_dakota, SD_PAGE)},
    "tn": {"name": "Tennessee", "page": TN_PAGE, "days": 56, "snapshot": True, "load": load_page(parse_tennessee, TN_PAGE)},
    "ut": {"name": "Utah", "page": UT_PAGE, "days": 77, "snapshot": True, "load": load_page(parse_utah, UT_PAGE)},
    "vt": {"name": "Vermont", "page": JOB_CENTERS["VT"] + "/search/warn_lookups/new", "days": 161, "snapshot": True,
           "load": load_job_center("VT")},
    "wi": {"name": "Wisconsin", "page": WI_PAGE, "days": 42, "snapshot": True, "load": load_wisconsin},
    # Read since Oct 25 2026: each state's own host turns scripts away, so these
    # read a page the host does serve, or the Internet Archive's copy (see the
    # section above). Archive-read budgets add the Archive's longest gap
    # between good captures of the state's file or page.
    "mn": {"name": "Minnesota", "page": MN_PAGE, "days": 60, "snapshot": True, "load": load_minnesota},
    "ri": {"name": "Rhode Island", "page": RI_PAGE, "days": 120, "snapshot": True, "load": load_rhode_island},
    "la": {"name": "Louisiana", "page": LA_PAGE, "days": 70, "snapshot": True, "load": load_louisiana},
    "nm": {"name": "New Mexico", "page": NM_PAGE, "days": 200, "snapshot": True, "load": load_new_mexico},
    "mo": {"name": "Missouri", "page": MO_PAGE, "days": 70, "snapshot": True, "load": load_missouri},
    "nv": {"name": "Nevada", "page": NV_PAGE, "days": 120, "snapshot": True, "load": load_nevada},
    "wv": {"name": "West Virginia", "page": WV_PAGE, "days": 90, "snapshot": True, "load": load_west_virginia},
}
